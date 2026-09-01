import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getForecast, getForecastSummary, getForecastMeta } from "../services/api.js";

// ─── Caterpillar design tokens ────────────────────────────────────────────────
const CAT_YELLOW = "#FFCD11";
const CAT_INK    = "#1C1917";
const SITE_COLORS = [
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#8b5cf6", // violet
  "#0ea5e9", // sky
];

const MONTH_NAMES = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

function fmtMonth(m) {
  const [y, mo] = m.split("-");
  return `${MONTH_NAMES[mo]} ${y}`;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e7e5e4",
      borderRadius: 12,
      padding: "10px 16px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
      fontSize: 13,
    }}>
      <p style={{ fontWeight: 700, color: CAT_INK, marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.fill || p.color, margin: "2px 0" }}>
          <b>{p.name}</b>: {p.value} units
        </p>
      ))}
    </div>
  );
}

export default function DemandForecast() {
  const [meta, setMeta]           = useState({ site_ids: [], equipment_types: [] });
  const [summary, setSummary]     = useState([]);
  const [insight, setInsight]     = useState("");
  const [selectedSite, setSelectedSite]   = useState("");
  const [selectedEquip, setSelectedEquip] = useState("");
  const [chartData1, setChartData1] = useState([]); // by equipment, per month (selected site)
  const [chartData2, setChartData2] = useState([]); // by site, per month (selected equip)
  const [tableRows, setTableRows]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loading2, setLoading2]     = useState(false);
  const [error, setError]           = useState("");

  // ── Step 1: Load meta + summary ────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      setLoading(true);
      setError("");
      try {
        const [metaRes, sumRes] = await Promise.all([
          getForecastMeta(),
          getForecastSummary(),
        ]);
        const m = metaRes.data;
        const s = sumRes.data;
        setMeta(m);
        setSummary(s.summary || []);
        setInsight(s.insight || "");
        // Set default selections
        if (m.site_ids.length)       setSelectedSite(m.site_ids[0]);
        if (m.equipment_types.length) setSelectedEquip(m.equipment_types[0]);
      } catch (e) {
        setError("Could not load forecast data. Make sure the backend is running and demand_history is seeded.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // ── Step 2: Fetch chart data whenever filters change ───────────────────────
  const fetchCharts = useCallback(async () => {
    if (!selectedSite || !selectedEquip || !meta.site_ids.length) return;
    setLoading2(true);
    try {
      // Chart 1: all equipment types for selected site → per month bars
      const equipPromises = meta.equipment_types.map((eq) =>
        getForecast(selectedSite, eq)
      );
      // Chart 2: all sites for selected equipment type → per month bars
      const sitePromises = meta.site_ids.map((s) =>
        getForecast(s, selectedEquip)
      );

      const [equipResults, siteResults] = await Promise.all([
        Promise.all(equipPromises),
        Promise.all(sitePromises),
      ]);

      // Build Chart 1 data: x = month, bars = equipment types
      const months1 = equipResults[0]?.data?.forecast?.map((f) => f.month) || [];
      const chart1 = months1.map((m) => {
        const row = { month: fmtMonth(m) };
        equipResults.forEach((r, i) => {
          const eq = meta.equipment_types[i];
          const fcast = r.data?.forecast?.find((f) => f.month === m);
          row[eq] = fcast?.predicted_units ?? 0;
        });
        return row;
      });
      setChartData1(chart1);

      // Build Chart 2 data: x = month, bars = sites
      const months2 = siteResults[0]?.data?.forecast?.map((f) => f.month) || [];
      const chart2 = months2.map((m) => {
        const row = { month: fmtMonth(m) };
        siteResults.forEach((r, i) => {
          const s = meta.site_ids[i];
          const fcast = r.data?.forecast?.find((f) => f.month === m);
          row[s] = fcast?.predicted_units ?? 0;
        });
        return row;
      });
      setChartData2(chart2);

      // Build table from summary, filtered by selected site and equip
      const rows = summary.map((s) => ({
        equipment_type: s.equipment_type,
        site_id: s.site_id,
        peak_month: fmtMonth(s.peak_month),
        predicted_units: s.predicted_units,
        units_available: s.units_available,
        shortage: s.shortage,
        surplus: s.surplus,
      }));
      setTableRows(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading2(false);
    }
  }, [selectedSite, selectedEquip, meta, summary]);

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts]);

  // ── Peak bar index helpers ─────────────────────────────────────────────────
  function getMaxKey(row, keys) {
    return keys.reduce((best, k) => (row[k] > (row[best] ?? -1) ? k : best), keys[0]);
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 40, color: "#78716c" }}>
        <span style={{ fontSize: 24 }}>⏳</span>
        <span style={{ fontWeight: 600 }}>Loading forecast data…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 16,
        padding: "16px 20px", color: "#dc2626", fontWeight: 600
      }}>
        ⚠️ {error}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Insight Banner ─────────────────────────────────────────────────── */}
      {insight && (
        <div style={{
          background: "linear-gradient(135deg, #1c1917 0%, #292524 100%)",
          borderRadius: 20,
          padding: "20px 28px",
          display: "flex",
          alignItems: "center",
          gap: 18,
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: CAT_YELLOW,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, flexShrink: 0,
          }}>📊</div>
          <div>
            <p style={{ color: "#a8a29e", fontSize: 11, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              Top Demand Insight
            </p>
            <p style={{ color: "#fff", fontWeight: 700, fontSize: 16, margin: 0,
              lineHeight: 1.5 }}>
              {insight}
            </p>
          </div>
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div style={{
        background: "#fff",
        borderRadius: 20, border: "1px solid #e7e5e4",
        padding: "16px 24px",
        display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end",
      }}>
        <div>
          <label className="label">Site ID</label>
          <select
            id="forecast-site-filter"
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="input"
            style={{ minWidth: 160 }}
          >
            {meta.site_ids.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Equipment Type</label>
          <select
            id="forecast-equip-filter"
            value={selectedEquip}
            onChange={(e) => setSelectedEquip(e.target.value)}
            className="input"
            style={{ minWidth: 200 }}
          >
            {meta.equipment_types.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
        {loading2 && (
          <div style={{ color: "#a8a29e", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
            Updating charts…
          </div>
        )}
      </div>

      {/* ── Chart 1: Equipment Types for Selected Site ─────────────────────── */}
      <div className="card" style={{ padding: "24px 28px" }}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontWeight: 800, fontSize: 16, color: CAT_INK, margin: 0 }}>
            📦 Predicted Demand by Equipment Type
          </h3>
          <p style={{ color: "#78716c", fontSize: 13, marginTop: 4, marginBottom: 0 }}>
            Site <strong>{selectedSite}</strong> — next 6 months forecast
          </p>
        </div>
        {chartData1.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData1} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#78716c" }} />
              <YAxis tick={{ fontSize: 12, fill: "#78716c" }} unit=" u" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {meta.equipment_types.map((eq, i) => {
                const maxRow = chartData1.reduce((best, row) =>
                  (row[eq] > (best?.[eq] ?? -1) ? row : best), null
                );
                const colors = ["#6366f1","#f59e0b","#10b981","#ef4444","#8b5cf6","#0ea5e9"];
                return (
                  <Bar key={eq} dataKey={eq} name={eq} radius={[4, 4, 0, 0]}>
                    {chartData1.map((row) => (
                      <Cell
                        key={row.month}
                        fill={row === maxRow ? CAT_YELLOW : colors[i % colors.length]}
                        opacity={0.9}
                      />
                    ))}
                  </Bar>
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: "#a8a29e", textAlign: "center", padding: 40 }}>No data available</p>
        )}
      </div>

      {/* ── Chart 2: All Sites for Selected Equipment ──────────────────────── */}
      <div className="card" style={{ padding: "24px 28px" }}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontWeight: 800, fontSize: 16, color: CAT_INK, margin: 0 }}>
            🏗️ Predicted Demand Across All Sites
          </h3>
          <p style={{ color: "#78716c", fontSize: 13, marginTop: 4, marginBottom: 0 }}>
            Equipment: <strong>{selectedEquip}</strong> — next 6 months forecast
          </p>
        </div>
        {chartData2.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData2} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#78716c" }} />
              <YAxis tick={{ fontSize: 12, fill: "#78716c" }} unit=" u" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {meta.site_ids.map((site, i) => {
                const maxRow = chartData2.reduce((best, row) =>
                  (row[site] > (best?.[site] ?? -1) ? row : best), null
                );
                return (
                  <Bar key={site} dataKey={site} name={site} radius={[4, 4, 0, 0]}>
                    {chartData2.map((row) => (
                      <Cell
                        key={row.month}
                        fill={row === maxRow ? CAT_YELLOW : SITE_COLORS[i % SITE_COLORS.length]}
                        opacity={0.9}
                      />
                    ))}
                  </Bar>
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: "#a8a29e", textAlign: "center", padding: 40 }}>No data available</p>
        )}
      </div>

      {/* ── Forecast Table ─────────────────────────────────────────────────── */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 0" }}>
          <h3 style={{ fontWeight: 800, fontSize: 16, color: CAT_INK, margin: 0 }}>
            📋 Full Forecast Summary
          </h3>
          <p style={{ color: "#78716c", fontSize: 13, marginTop: 4, marginBottom: 16 }}>
            All site + equipment combinations sorted by peak demand
          </p>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Equipment Type","Site","Peak Month","Predicted Units","Available","Status"].map((h) => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => {
                const isShortage = row.shortage > 0;
                const isSurplus  = row.surplus > 0;
                return (
                  <tr key={i} style={{ borderTop: "1px solid #f5f5f4" }}>
                    <td className="td">
                      <span style={{ fontWeight: 700, color: CAT_INK }}>
                        {row.equipment_type}
                      </span>
                    </td>
                    <td className="td">
                      <span style={{
                        background: "#f5f5f4", borderRadius: 8, padding: "2px 10px",
                        fontSize: 12, fontWeight: 700, color: CAT_INK,
                      }}>
                        {row.site_id}
                      </span>
                    </td>
                    <td className="td" style={{ fontWeight: 600, color: "#6366f1" }}>
                      {row.peak_month}
                    </td>
                    <td className="td">
                      <span style={{
                        background: CAT_YELLOW + "33", color: CAT_INK,
                        borderRadius: 8, padding: "2px 10px", fontWeight: 700, fontSize: 13,
                      }}>
                        {row.predicted_units}
                      </span>
                    </td>
                    <td className="td" style={{ color: "#78716c" }}>
                      {row.units_available}
                    </td>
                    <td className="td">
                      {isShortage ? (
                        <span style={{
                          background: "#fef2f2", color: "#dc2626",
                          borderRadius: 8, padding: "3px 10px",
                          fontSize: 12, fontWeight: 700,
                        }}>
                          ⚠️ -{row.shortage} shortage
                        </span>
                      ) : isSurplus ? (
                        <span style={{
                          background: "#f0fdf4", color: "#16a34a",
                          borderRadius: 8, padding: "3px 10px",
                          fontSize: 12, fontWeight: 700,
                        }}>
                          ✅ +{row.surplus} surplus
                        </span>
                      ) : (
                        <span style={{
                          background: "#f5f5f4", color: "#78716c",
                          borderRadius: 8, padding: "3px 10px",
                          fontSize: 12, fontWeight: 700,
                        }}>
                          — balanced
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {tableRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="td" style={{ textAlign: "center", color: "#a8a29e" }}>
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
