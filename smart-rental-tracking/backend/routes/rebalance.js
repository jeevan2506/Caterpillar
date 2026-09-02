/**
 * rebalance.js — Fleet Rebalancing / Auto-Dispatch Recommendations
 *
 * GET /api/rebalance
 *   Cross-references the demand forecast (predicted shortages per site +
 *   equipment type) with the current fleet (idle / underutilised / available
 *   machines) and recommends which machine to pre-position where.
 *
 *   This turns two read-only insights (forecast + anomalies) into an
 *   actionable plan that directly attacks the stated problems: equipment
 *   sitting idle, demand not met on time, and misallocation delays.
 */
const express = require("express");
const router = express.Router();
const Equipment = require("../models/Equipment");
const { buildSummary } = require("./forecast");

function idleRatio(eq) {
  const total = eq.engineHoursPerDay + eq.idleHoursPerDay;
  return total > 0 ? eq.idleHoursPerDay / total : 0;
}

async function buildRebalancePlan() {
  const [equipment, { summary }] = await Promise.all([
    Equipment.find().lean(),
    buildSummary(),
  ]);

  const shortages = summary
    .filter((s) => s.shortage > 0)
    .sort((a, b) => b.shortage - a.shortage);

  const used = new Set(); // never recommend the same machine twice
  const recommendations = [];

  for (const sh of shortages) {
    // A machine worth moving: right type, not already at the shortage site,
    // and clearly under-worked — an available machine sitting >=30% idle, or
    // any machine sitting >60% idle. Fully-utilised machines are left alone.
    const candidates = equipment
      .filter(
        (eq) =>
          eq.type === sh.equipment_type &&
          eq.siteId !== sh.site_id &&
          !used.has(eq.equipmentId) &&
          (eq.status === "available"
            ? idleRatio(eq) >= 0.3
            : idleRatio(eq) > 0.6)
      )
      .sort((a, b) => idleRatio(b) - idleRatio(a));

    const pick = candidates[0];
    if (!pick) continue;
    used.add(pick.equipmentId);

    const idlePct = Math.round(idleRatio(pick) * 100);
    const impact = idlePct + Math.min(sh.shortage, 25); // idle waste + gap size

    recommendations.push({
      equipmentId: pick.equipmentId,
      type: pick.type,
      fromSite: pick.siteId || "Unassigned",
      toSite: sh.site_id,
      peakMonth: sh.peak_month,
      shortage: sh.shortage,
      predicted: sh.predicted_units,
      available: sh.units_available,
      idlePercent: idlePct,
      impact,
      reason:
        `${pick.equipmentId} is ${idlePct > 0 ? idlePct + "% idle" : "available"} ` +
        `at ${pick.siteId || "no assigned site"}. Move it to ${sh.site_id} to cover the ` +
        `forecast ${sh.equipment_type} shortage of ${sh.shortage} units peaking in ${sh.peak_month}.`,
    });
  }

  recommendations.sort((a, b) => b.impact - a.impact);

  return {
    generatedAt: new Date(),
    shortageCombos: shortages.length,
    idleUnits: equipment.filter((eq) => idleRatio(eq) > 0.6).length,
    recommendations,
  };
}

// GET /api/rebalance
router.get("/", async (req, res) => {
  try {
    res.json(await buildRebalancePlan());
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to build rebalance plan", error: err.message });
  }
});

module.exports = router;
module.exports.buildRebalancePlan = buildRebalancePlan;
