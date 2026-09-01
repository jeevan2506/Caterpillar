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
import Icon from "./Icon.jsx";
import Badge from "./Badge.jsx";
import { Loading, Alert } from "./ui.jsx";

const CAT_YELLOW = "#FFCD11";
const SERIES = ["#0f766e", "#7c3aed", "#2563eb", "#db2777", "#ea580c", "#0891b2"];

const MONTH_NAMES = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun",
  "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};
function fmtMonth(m) {
  const [y, mo] = m.split("-");
  return `${MONTH_NAMES[mo]} ${y}`;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs shadow-lift">
      <p className="mb-1 font-bold text-stone-900">{label}</p>
      {payload
        .filter((p) => p.value > 0)
        .map((p) => (
          <p key={p.dataKey} className="tabular-nums" style={{ color: p.color }}>
            {p.name}: <strong>{p.value}</strong> units
          </p>
        ))}
    </div>
  );
}

export default function DemandForecast() {
  const [meta, setMeta] = useState({ site_ids: [], equipment_types: [] });
  const [summary, setSummary] = useState([]);
  const [insight, setInsight] = useState("");
  const [selectedSite, setSelectedSite] = useState("");
  const [selectedEquip, setSelectedEquip] = useState("");
  const [chartData1, setChartData1] = useState([]);
  const [chartData2, setChartData2] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loading2, setLoading2] = useState(false);
  const [error, setError] = useState("");

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
        setMeta(m);
        setSummary(sumRes.data.summary || []);
        setInsight(sumRes.data.insight || "");
        if (m.site_ids.length) setSelectedSite(m.site_ids[0]);
        if (m.equipment_types.length) setSelectedEquip(m.equipment_types[0]);
      } catch {
        setError(
          "Could not load forecast data. Make sure the backend is running and demand_history is seeded (npm run seed:demand)."
        );
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const fetchCharts = useCallback(async () => {
    if (!selectedSite || !selectedEquip || !meta.site_ids.length) return;
    setLoading2(true);
    try {
      const [equipResults, siteResults] = await Promise.all([
        Promise.all(meta.equipment_types.map((eq) => getForecast(selectedSite, eq))),
        Promise.all(meta.site_ids.map((s) => getForecast(s, selectedEquip))),
      ]);

      const months1 = equipResults[0]?.data?.forecast?.map((f) => f.month) || [];
      setChartData1(
        months1.map((m) => {
          const row = { month: fmtMonth(m) };
          equipResults.forEach((r, i) => {
            const f = r.data?.forecast?.find((x) => x.month === m);
            row[meta.equipment_types[i]] = f?.predicted_units ?? 0;
          });
          return row;
        })
      );

      const months2 = siteResults[0]?.data?.forecast?.map((f) => f.month) || [];
      setChartData2(
        months2.map((m) => {
          const row = { month: fmtMonth(m) };
          siteResults.forEach((r, i) => {
            const f = r.data?.forecast?.find((x) => x.month === m);
            row[meta.site_ids[i]] = f?.predicted_units ?? 0;
          });
          return row;
        })
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading2(false);
    }
  }, [selectedSite, selectedEquip, meta]);

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts]);

  if (loading) return <Loading label="Loading forecast…" />;
  if (error) return <Alert>{error}</Alert>;

  const shortages = summary.filter((s) => s.shortage > 0).length;

  return (
    <div className="space-y-6">
      {/* Insight banner */}
      {insight && (
        <div className="flex items-center gap-4 rounded-2xl bg-cat-ink px-6 py-5 text-white">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cat-yellow text-cat-ink">
            <Icon name="spark" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-cat-yellow">
              Top demand insight
            </p>
            <p className="mt-0.5 font-display text-base font-bold leading-snug">
              {insight}
            </p>
          </div>
        </div>
      )}

      {/* Summary stat row */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <MiniStat label="Site + type combos" value={summary.length} />
        <MiniStat label="Forecast horizon" value="6 mo" />
        <MiniStat label="Combos in shortage" value={shortages} tone="red" />
        <MiniStat
          label="Model"
          value="Seasonal + WLR"
          hint="Seasonal decomposition + weighted linear regression"
        />
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="label">Site</label>
          <select
            id="forecast-site-filter"
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="input min-w-[140px]"
          >
            {meta.site_ids.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Equipment type</label>
          <select
            id="forecast-equip-filter"
            value={selectedEquip}
            onChange={(e) => setSelectedEquip(e.target.value)}
            className="input min-w-[160px]"
          >
            {meta.equipment_types.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
        {loading2 && (
          <span className="pb-2.5 text-xs text-stone-400">Updating charts…</span>
        )}
      </div>

      {/* Chart 1 — by equipment type at the selected site */}
      <ForecastChart
        icon="cube"
        title="Predicted demand by equipment type"
        subtitle={<>Site <strong>{selectedSite}</strong> · next 6 months</>}
        data={chartData1}
        keys={meta.equipment_types}
      />

      {/* Chart 2 — by site for the selected equipment type */}
      <ForecastChart
        icon="activity"
        title="Predicted demand across all sites"
        subtitle={<>Equipment <strong>{selectedEquip}</strong> · next 6 months</>}
        data={chartData2}
        keys={meta.site_ids}
      />

      {/* Full summary table */}
      <div className="card overflow-hidden">
        <div className="border-b border-stone-100 px-5 py-3.5">
          <h3 className="section-title">Full forecast summary</h3>
          <p className="text-xs text-stone-400">
            Every site + equipment combination, sorted by peak predicted demand
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="th">Equipment</th>
                <th className="th">Site</th>
                <th className="th">Peak month</th>
                <th className="th text-right">Predicted</th>
                <th className="th text-right">Available</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {summary.map((row, i) => (
                <tr key={i} className="transition hover:bg-stone-50/70">
                  <td className="td font-display font-bold text-stone-900">
                    {row.equipment_type}
                  </td>
                  <td className="td">
                    <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700">
                      {row.site_id}
                    </span>
                  </td>
                  <td className="td whitespace-nowrap">{fmtMonth(row.peak_month)}</td>
                  <td className="td text-right">
                    <span className="rounded-md bg-cat-yellow/20 px-2 py-0.5 font-bold tabular-nums text-cat-ink">
                      {row.predicted_units}
                    </span>
                  </td>
                  <td className="td text-right tabular-nums text-stone-500">
                    {row.units_available}
                  </td>
                  <td className="td">
                    {row.shortage > 0 ? (
                      <Badge status="overdue" label={`−${row.shortage} shortage`} />
                    ) : row.surplus > 0 ? (
                      <Badge status="available" label={`+${row.surplus} surplus`} />
                    ) : (
                      <Badge status="unused" label="balanced" />
                    )}
                  </td>
                </tr>
              ))}
              {summary.length === 0 && (
                <tr>
                  <td colSpan={6} className="td py-10 text-center text-stone-400">
                    No forecast data.
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

function MiniStat({ label, value, tone, hint }) {
  return (
    <div className="card p-4" title={hint || undefined}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-xl font-extrabold tracking-tight ${
          tone === "red" && value > 0 ? "text-red-600" : "text-stone-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ForecastChart({ icon, title, subtitle, data, keys }) {
  // highlight the peak bar per series in CAT yellow
  const peakByKey = {};
  keys.forEach((k) => {
    let best = null;
    data.forEach((row) => {
      if (best === null || row[k] > data[best][k]) best = data.indexOf(row);
    });
    peakByKey[k] = best;
  });

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon name={icon} className="h-4 w-4 text-stone-400" />
        <div>
          <h3 className="section-title">{title}</h3>
          <p className="text-xs text-stone-400">{subtitle}</p>
        </div>
      </div>
      {data.length ? (
        <div className="overflow-x-auto">
          <ResponsiveContainer width="100%" height={300} minWidth={480}>
            <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0efec" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#78716c" }}
                axisLine={{ stroke: "#e7e5e4" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#78716c" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f5f5f433" }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {keys.map((k, i) => (
                <Bar
                  key={k}
                  dataKey={k}
                  name={k}
                  fill={SERIES[i % SERIES.length]}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={26}
                >
                  {data.map((row, idx) => (
                    <Cell
                      key={idx}
                      fill={idx === peakByKey[k] ? CAT_YELLOW : SERIES[i % SERIES.length]}
                    />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-stone-400">No data available.</p>
      )}
    </div>
  );
}
