/**
 * forecast.js — Demand Forecasting Routes
 *
 * GET /api/forecast?site_id=S001&equipment_type=Excavator
 *   Returns historical monthly data + 6-month seasonal decomposition forecast.
 *
 * GET /api/forecast/summary
 *   Returns peak demand month for every site+equipment_type combo, sorted by
 *   predicted units descending.
 *
 * GET /api/forecast/meta
 *   Returns distinct site_ids and equipment_types for filter dropdowns.
 *
 * ALGORITHM: Seasonal Decomposition + Weighted Linear Regression
 *   1. Build monthly time series from historical records (avg units per YYYY-MM)
 *   2. Compute seasonal indices: avg demand per calendar month (1–12)
 *      normalised by overall mean → captures recurring yearly peaks/troughs
 *   3. De-seasonalise data: actual / seasonal_index → isolate pure trend
 *   4. Fit WEIGHTED linear regression (recent months get exponentially higher
 *      weight, decay=0.92) on de-seasonalised series → captures latest momentum
 *   5. Forecast = trend(t) × seasonal_index(calendar month) → clamped ≥ 0
 *   6. Returns MAE (mean absolute error) on historical fit as a quality metric
 */

const express = require("express");
const router  = express.Router();
const DemandHistory = require("../models/DemandHistory");

// ── Weighted Linear Regression ────────────────────────────────────────────────
// Gives exponentially more weight to recent observations so the trend
// reflects the latest demand momentum, not a flat average across all years.
function weightedLinearRegression(xs, ys, weights) {
  const n = xs.length;
  if (n === 0) return { slope: 0, intercept: 0 };

  const W   = weights.reduce((a, b) => a + b, 0);
  const Wx  = xs.reduce((s, x, i) => s + weights[i] * x, 0);
  const Wy  = ys.reduce((s, y, i) => s + weights[i] * y, 0);
  const Wxy = xs.reduce((s, x, i) => s + weights[i] * x * ys[i], 0);
  const Wx2 = xs.reduce((s, x, i) => s + weights[i] * x * x, 0);

  const denom = W * Wx2 - Wx * Wx;
  if (Math.abs(denom) < 1e-10) return { slope: 0, intercept: Wy / W };

  const slope     = (W * Wxy - Wx * Wy) / denom;
  const intercept = (Wy - slope * Wx) / W;
  return { slope, intercept };
}

// ── Seasonal Indices (12-element array, index 0 = Jan, 11 = Dec) ─────────────
// seasonal[m] > 1.0 → that month is typically above average
// seasonal[m] < 1.0 → that month is typically below average
function computeSeasonalIndices(monthlyAvgs) {
  const byCalMonth = Array.from({ length: 12 }, () => []);

  for (const [key, avg] of Object.entries(monthlyAvgs)) {
    const mo = parseInt(key.split("-")[1], 10) - 1; // 0-based month
    byCalMonth[mo].push(avg);
  }

  const calMonthAvgs = byCalMonth.map((vals) =>
    vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  );

  const valid = calMonthAvgs.filter((v) => v !== null);
  const overallMean = valid.length
    ? valid.reduce((a, b) => a + b, 0) / valid.length
    : 1;

  // If a month has no data, assume index = 1 (neutral)
  return calMonthAvgs.map((v) =>
    v !== null && overallMean > 0 ? v / overallMean : 1.0
  );
}

// ── Exponential decay weights: most recent point has weight 1 ─────────────────
function buildWeights(n, decay = 0.92) {
  return Array.from({ length: n }, (_, i) => Math.pow(decay, n - 1 - i));
}

// ── Fixed forecast window: Jan–Jun 2026 ──────────────────────────────────────
function getForecastMonths() {
  const months = [];
  const startYear = 2026, startMonth = 1;
  for (let i = 0; i < 6; i++) {
    const m = ((startMonth - 1 + i) % 12) + 1;
    const y = startYear + Math.floor((startMonth - 1 + i) / 12);
    months.push({
      label:    `${y}-${String(m).padStart(2, "0")}`,
      monthNum: m,
    });
  }
  return months;
}

// ── Core Forecast Engine ──────────────────────────────────────────────────────
function computeForecast(records) {
  if (!records || records.length === 0) {
    return { history: [], forecast: [], model: "none" };
  }

  // 1. Build monthly time series
  const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
  const monthMap = {};
  sorted.forEach((r) => {
    const key = r.month; // "YYYY-MM"
    if (!monthMap[key]) monthMap[key] = { sum: 0, count: 0, available: 0 };
    monthMap[key].sum      += r.units_requested;
    monthMap[key].count    += 1;
    monthMap[key].available = Math.max(monthMap[key].available, r.units_available);
  });

  const historyKeys = Object.keys(monthMap).sort();
  const monthlyAvgs = {};
  historyKeys.forEach((k) => { monthlyAvgs[k] = monthMap[k].sum / monthMap[k].count; });

  const history = historyKeys.map((key, idx) => ({
    month:               key,
    avg_units_requested: Math.round(monthlyAvgs[key]),
    units_available:     monthMap[key].available,
    index:               idx,
  }));

  // Fall back to simple average if not enough data
  if (history.length < 3) {
    const avg = Math.round(
      history.reduce((s, h) => s + h.avg_units_requested, 0) / (history.length || 1)
    );
    return {
      history,
      forecast: getForecastMonths().map((fm) => ({ month: fm.label, predicted_units: avg })),
      model: "average_fallback",
    };
  }

  // 2. Seasonal indices
  const seasonal  = computeSeasonalIndices(monthlyAvgs);

  // 3. De-seasonalise historical data
  const xs        = history.map((h) => h.index);
  const rawYs     = history.map((h) => h.avg_units_requested);
  const calMonths = historyKeys.map((k) => parseInt(k.split("-")[1], 10) - 1);

  const deSeasonYs = rawYs.map((y, i) => {
    const si = seasonal[calMonths[i]];
    return si > 0.05 ? y / si : y; // guard against near-zero seasonal index
  });

  // 4. Weighted linear regression on de-seasonalised trend
  const weights = buildWeights(xs.length);
  const { slope, intercept } = weightedLinearRegression(xs, deSeasonYs, weights);

  // 5. Forecast: re-apply seasonal factor to future trend values
  const forecastMonths = getForecastMonths();
  const nextIdx        = history.length;

  const forecast = forecastMonths.map((fm, i) => {
    const trendVal  = slope * (nextIdx + i) + intercept;
    const si        = seasonal[fm.monthNum - 1];
    return {
      month:           fm.label,
      predicted_units: Math.max(0, Math.round(trendVal * si)),
    };
  });

  // 6. MAE on historical fit (model quality)
  const residuals = rawYs.map((y, i) => {
    const si  = seasonal[calMonths[i]];
    const fit = (slope * xs[i] + intercept) * si;
    return Math.abs(y - fit);
  });
  const mae = residuals.reduce((s, r) => s + r, 0) / residuals.length;

  return {
    history,
    forecast,
    model:            "seasonal_decomposition_weighted",
    slope:            +slope.toFixed(4),
    intercept:        +intercept.toFixed(4),
    seasonal_indices: seasonal.map((s) => +s.toFixed(3)),
    mae:              +mae.toFixed(2),
  };
}

// ── Helper: "2026-01" → "Jan 2026" ───────────────────────────────────────────
function formatMonthLabel(monthStr) {
  const [y, m] = monthStr.split("-");
  const names  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
}

// ── GET /api/forecast/meta ────────────────────────────────────────────────────
router.get("/meta", async (req, res) => {
  try {
    const [sites, equipTypes] = await Promise.all([
      DemandHistory.distinct("site_id"),
      DemandHistory.distinct("equipment_type"),
    ]);
    res.json({ site_ids: sites.sort(), equipment_types: equipTypes.sort() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching meta", error: err.message });
  }
});

// ── Caches ───────────────────────────────────────────────────────────────────
// demand_history is a static, seeded dataset — it doesn't change during a demo
// session, so caching the raw rows and the derived summary makes the forecast /
// rebalance / chatbot-context endpoints return in ~1ms instead of ~1.7s.
const CACHE_TTL_MS = 5 * 60 * 1000;
let _rowsCache = null;
let _rowsCacheAt = 0;
let _summaryCache = null;
let _summaryCacheAt = 0;

async function getAllHistory() {
  if (_rowsCache && Date.now() - _rowsCacheAt < CACHE_TTL_MS) return _rowsCache;
  _rowsCache = await DemandHistory.find().lean();
  _rowsCacheAt = Date.now();
  return _rowsCache;
}

// ── Build the full site+equipment forecast summary (reused by the chatbot) ────
async function buildSummary() {
  if (_summaryCache && Date.now() - _summaryCacheAt < CACHE_TTL_MS) return _summaryCache;

  const all = await getAllHistory();
  const groups = {};
  for (const r of all) {
    const key = `${r.site_id}|${r.equipment_type}`;
    (groups[key] = groups[key] || []).push(r);
  }

  const results = [];
  for (const [key, records] of Object.entries(groups)) {
    const [site_id, equipment_type] = key.split("|");
    const { forecast, mae } = computeForecast(records);
    if (!forecast.length) continue;

    const latestRec = [...records].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    const available = latestRec ? latestRec.units_available : 0;

    const peak = forecast.reduce((best, f) =>
      f.predicted_units > best.predicted_units ? f : best
    );

    results.push({
      site_id,
      equipment_type,
      peak_month:      peak.month,
      predicted_units: peak.predicted_units,
      units_available: available,
      shortage:        Math.max(0, peak.predicted_units - available),
      surplus:         Math.max(0, available - peak.predicted_units),
      mae:             mae ?? null,
      all_forecast:    forecast,
    });
  }

  results.sort((a, b) => b.predicted_units - a.predicted_units);

  const insight = results.length > 0
    ? `${results[0].equipment_type}s will be in highest demand at Site ${results[0].site_id} in ${formatMonthLabel(results[0].peak_month)} (predicted ${results[0].predicted_units} units).`
    : "";

  _summaryCache = { insight, summary: results };
  _summaryCacheAt = Date.now();
  return _summaryCache;
}

// ── GET /api/forecast/summary ─────────────────────────────────────────────────
router.get("/summary", async (req, res) => {
  try {
    res.json(await buildSummary());
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error computing summary", error: err.message });
  }
});

// ── GET /api/forecast ─────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { site_id, equipment_type } = req.query;

    // Filter the cached rows in memory — the Demand Forecasting screen fires
    // ~11 of these at once, so this avoids 11 round-trips to Atlas.
    const records = (await getAllHistory()).filter(
      (r) =>
        (!site_id || r.site_id === site_id) &&
        (!equipment_type || r.equipment_type === equipment_type)
    );
    if (!records.length) {
      return res.json({ site_id, equipment_type, history: [], forecast: [] });
    }

    res.json({ site_id, equipment_type, ...computeForecast(records) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error computing forecast", error: err.message });
  }
});

module.exports = router;
module.exports.buildSummary = buildSummary;
