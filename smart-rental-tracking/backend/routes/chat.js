const express = require("express");
const router = express.Router();

const Equipment = require("../models/Equipment");
const Maintenance = require("../models/Maintenance");
const Booking = require("../models/Booking");
const Operator = require("../models/Operator");
const EquipmentTelemetry = require("../models/EquipmentTelemetry");
const { buildSummary: buildForecastSummary } = require("./forecast");
const { buildRebalancePlan } = require("./rebalance");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const TELEMETRY_TIMEOUT = parseInt(process.env.TELEMETRY_TIMEOUT_SECONDS || "10", 10);

// Same anomaly logic the Admin dashboard uses, computed here so answers are reliable.
function getAnomalies(eq, maintenance = [], telemetry = null) {
  const flags = [];

  const openMaint = maintenance.filter(
    (m) => m.equipmentId === eq.equipmentId && m.status !== "resolved"
  );
  if (openMaint.length) {
    flags.push({
      type: "OPEN MAINTENANCE",
      severity: "medium",
      reason: `Unresolved: ${openMaint.map((m) => m.issueReported).join("; ")}`,
    });
  }

  // Only active / on-rent machinery is evaluated for operational site/telemetry anomalies
  if (eq.status !== "active" && eq.status !== "overdue") {
    return flags;
  }

  if (eq.siteId === null || eq.lastOperatorId === null) {
    flags.push({
      type: "UNASSIGNED",
      severity: "medium",
      reason: "No site or no operator on record",
    });
  }

  // Utilisation family — at most one flag, most specific first
  const total = eq.engineHoursPerDay + eq.idleHoursPerDay;
  const ratio = total > 0 ? eq.idleHoursPerDay / total : 0;
  if (eq.engineHoursPerDay === 0 && eq.operatingDays > 0) {
    flags.push({
      type: "NEVER OPERATED",
      severity: "high",
      reason: `On rent ${eq.operatingDays} operating days but 0 engine hours/day — never started`,
    });
  } else if (ratio > 0.6) {
    flags.push({
      type: "UNDERUTILIZED",
      severity: ratio > 0.85 ? "high" : "medium",
      reason: `Idle ratio ${Math.round(ratio * 100)}%`,
    });
  } else if (eq.idleHoursPerDay >= 10) {
    flags.push({
      type: "EXCESSIVE IDLE",
      severity: "medium",
      reason: `${eq.idleHoursPerDay}h idle per day — sustained long idle hours`,
    });
  }

  if (eq.checkOutDate && eq.checkInDate) {
    const days = Math.round(
      (new Date(eq.checkInDate) - new Date(eq.checkOutDate)) / 86400000
    );
    if (eq.operatingDays > days) {
      flags.push({
        type: "RENTAL INTEGRITY ISSUE",
        severity: "high",
        reason: `Operating days ${eq.operatingDays} exceed rental window ${days} days`,
      });
    }
  }

  if (telemetry && telemetry.fuelLevel != null && telemetry.fuelLevel < 15) {
    flags.push({
      type: "LOW FUEL",
      severity: "high",
      reason: `Fuel level ${Math.round(telemetry.fuelLevel)}% — refuel required`,
    });
  }

  if (telemetry && telemetry.connectionStatus === "offline") {
    flags.push({
      type: "TELEMETRY OFFLINE",
      severity: "high",
      reason:
        telemetry.offlineDurationSeconds != null
          ? `No heartbeat for ${telemetry.offlineDurationSeconds}s — machine disconnected`
          : "No telemetry heartbeat — machine disconnected",
    });
  }

  if (eq.status === "active" && eq.checkInDate && new Date(eq.checkInDate) < new Date()) {
    flags.push({
      type: "RENTAL OVERRUN",
      severity: "high",
      reason: "Past expected return date and not checked back in",
    });
  }

  return flags;
}

// Attach live connection status to raw telemetry docs.
function withStatus(t) {
  const obj = t.toObject ? t.toObject() : { ...t };
  const lastSeenMs = obj.lastSeen ? new Date(obj.lastSeen).getTime() : 0;
  const diff = lastSeenMs > 0 ? Math.floor((Date.now() - lastSeenMs) / 1000) : null;
  const online = diff !== null && diff <= TELEMETRY_TIMEOUT;
  return {
    ...obj,
    connectionStatus: online ? "online" : "offline",
    offlineDurationSeconds: online ? 0 : diff,
  };
}

// POST /api/chat  { question }
router.post("/", async (req, res) => {
  try {
    const question = (req.body.question || "").trim();
    if (!question) {
      return res.status(400).json({ answer: "Please ask a question." });
    }
    if (!process.env.GROQ_API_KEY) {
      return res.json({ answer: "Chatbot is not configured (GROQ_API_KEY missing)." });
    }

    const [equipment, maintenance, bookings, operators, rawTelemetry] =
      await Promise.all([
        Equipment.find().lean(),
        Maintenance.find().lean(),
        Booking.find().lean(),
        Operator.find().lean(),
        EquipmentTelemetry.find(),
      ]);

    const telemetry = rawTelemetry.map(withStatus);
    const telMap = Object.fromEntries(telemetry.map((t) => [t.equipmentId, t]));

    const anomalies = equipment.flatMap((eq) =>
      getAnomalies(eq, maintenance, telMap[eq.equipmentId]).map((a) => ({
        equipmentId: eq.equipmentId,
        type: eq.type,
        ...a,
      }))
    );

    // 6-month demand forecast (peak month + shortage/surplus per site+type)
    let demandForecast = null;
    try {
      const { insight, summary } = await buildForecastSummary();
      demandForecast = {
        headline: insight,
        // keep it compact for the prompt
        rows: summary.slice(0, 12).map((s) => ({
          site: s.site_id,
          equipment: s.equipment_type,
          peakMonth: s.peak_month,
          predicted: s.predicted_units,
          available: s.units_available,
          shortage: s.shortage,
          surplus: s.surplus,
        })),
      };
    } catch (e) {
      console.warn("forecast summary unavailable for chat:", e.message);
    }

    // Rebalancing plan — which idle machine to move to which forecast shortage
    let rebalance = null;
    try {
      const plan = await buildRebalancePlan();
      rebalance = plan.recommendations.slice(0, 8);
    } catch (e) {
      console.warn("rebalance plan unavailable for chat:", e.message);
    }

    const context = JSON.stringify({
      equipment,
      maintenance,
      bookings,
      operators,
      telemetry,
      anomalies,
      demandForecast,
      rebalance,
    });

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 1024,
        messages: [
          {
            role: "system",
            content:
              "You are the assistant for a Caterpillar equipment rental dashboard. " +
              "Answer ONLY from the JSON context provided. Cite equipment IDs, sites " +
              "and operator IDs. If the context does not contain the answer, say so.\n" +
              "For demand / shortage / 'what will be needed' questions, use " +
              "context.demandForecast (peak month, predicted vs available units, " +
              "shortage/surplus per site + equipment type).\n" +
              "For 'what should we move / relocate / pre-position' questions, use " +
              "context.rebalance (which idle machine to move to which shortage site).\n\n" +
              "This reply is shown in a narrow chat window. Reply in short plain " +
              "sentences. When listing items, use simple dash bullets like:\n" +
              "- EQX1001 (site S003): idle ratio 87%\n" +
              "Do NOT use markdown tables, pipe characters, or headings. Keep it under 120 words.",
          },
          { role: "user", content: `CONTEXT:\n${context}\n\nQUESTION: ${question}` },
        ],
      }),
    });

    if (!groqRes.ok) {
      const text = await groqRes.text();
      console.error("Groq error:", groqRes.status, text);
      return res
        .status(502)
        .json({ answer: `The AI service returned an error (${groqRes.status}).` });
    }

    const data = await groqRes.json();
    const answer = data.choices?.[0]?.message?.content?.trim() || "No answer returned.";
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ answer: "Sorry, the assistant could not be reached." });
  }
});

module.exports = router;
