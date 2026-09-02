import Icon from "./Icon.jsx";

const TYPES = ["Excavator", "Crane", "Bulldozer", "Grader"];

export default function DemandInsights({ equipment, telemetry = [], maintenance = [] }) {
  const counts = {};
  const avgDays = {};
  TYPES.forEach((t) => {
    const list = equipment.filter((e) => e.type === t);
    counts[t] = list.length;
    const total = list.reduce((s, e) => s + (e.operatingDays || 0), 0);
    avgDays[t] = list.length ? Math.round(total / list.length) : 0;
  });

  const maxCount = Math.max(1, ...Object.values(counts));
  const maxAvg = Math.max(1, ...Object.values(avgDays));

  // Fleet usage totals (rented hours = per-day rate x operating days)
  const round = (n) => Math.round(n);
  const totalEngine = round(
    equipment.reduce((s, e) => s + e.engineHoursPerDay * e.operatingDays, 0)
  );
  const totalIdle = round(
    equipment.reduce((s, e) => s + e.idleHoursPerDay * e.operatingDays, 0)
  );
  const totalDays = equipment.reduce((s, e) => s + (e.operatingDays || 0), 0);
  const fleetUtil = totalEngine + totalIdle > 0
    ? round((totalEngine / (totalEngine + totalIdle)) * 100)
    : 0;
  const totalFuel = round(telemetry.reduce((s, t) => s + (t.fuelConsumed || 0), 0));
  const totalDowntime = round(maintenance.reduce((s, m) => s + (m.downtimeHours || 0), 0));

  // Usage by site
  const bySite = {};
  equipment.forEach((e) => {
    const key = e.siteId || "Unassigned";
    const s = (bySite[key] = bySite[key] || { machines: 0, engine: 0, idle: 0, days: 0 });
    s.machines += 1;
    s.engine += e.engineHoursPerDay * e.operatingDays;
    s.idle += e.idleHoursPerDay * e.operatingDays;
    s.days += e.operatingDays || 0;
  });
  const siteRows = Object.entries(bySite).sort((a, b) => b[1].engine - a[1].engine);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Fleet usage summary */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="Total rented engine hours" value={totalEngine} unit="h" />
        <SummaryCard label="Total idle hours" value={totalIdle} unit="h" tone="amber" />
        <SummaryCard label="Total operating days" value={totalDays} unit="d" />
        <SummaryCard label="Fleet utilisation" value={fleetUtil} unit="%" />
        <SummaryCard label="Fuel consumed" value={totalFuel} unit="L" />
        <SummaryCard label="Total downtime" value={totalDowntime} unit="h" tone="amber" />
      </div>

      {/* Usage by site */}
      <div className="card overflow-hidden">
        <div className="border-b border-stone-100 px-4 py-3 sm:px-5 sm:py-3.5">
          <h3 className="section-title">Usage by site</h3>
        </div>
        <div className="table-container">
          <table className="w-full min-w-[500px] border-collapse">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="th">Site</th>
                <th className="th text-right">Machines</th>
                <th className="th text-right">Engine hours</th>
                <th className="th text-right">Idle hours</th>
                <th className="th text-right">Operating days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {siteRows.map(([site, s]) => (
                <tr key={site} className="transition hover:bg-stone-50/70">
                  <td className="td font-display font-bold text-stone-900">{site}</td>
                  <td className="td text-right tabular-nums">{s.machines}</td>
                  <td className="td text-right tabular-nums">{round(s.engine)}</td>
                  <td className="td text-right tabular-nums">{round(s.idle)}</td>
                  <td className="td text-right tabular-nums">{s.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fleet composition */}
      <div className="card p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Icon name="chart" className="h-4 w-4 text-stone-400" />
          <h3 className="section-title">Fleet composition by type</h3>
        </div>
        <div className="space-y-3 sm:space-y-3.5">
          {TYPES.map((t) => (
            <div key={t} className="flex items-center gap-3 sm:gap-4">
              <span className="w-20 sm:w-24 shrink-0 text-xs sm:text-sm font-medium text-stone-600">{t}</span>
              <div className="h-7 flex-1 overflow-hidden rounded-lg bg-stone-100">
                <div
                  className="flex h-full items-center justify-end rounded-lg bg-cat-yellow pr-2.5 text-xs font-bold text-cat-ink transition-all"
                  style={{ width: `${Math.max(12, (counts[t] / maxCount) * 100)}%` }}
                >
                  {counts[t]}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Avg operating days */}
      <div>
        <h3 className="section-title mb-3">Average operating days per rental</h3>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {TYPES.map((t) => (
            <div key={t} className="card p-3.5 sm:p-5">
              <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                {t}
              </p>
              <p className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">
                {avgDays[t]}
                <span className="ml-1 text-xs sm:text-sm font-semibold text-stone-400">days</span>
              </p>
              <div className="mt-2.5 sm:mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-cat-ink"
                  style={{ width: `${(avgDays[t] / maxAvg) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, unit, tone }) {
  return (
    <div className="card p-3 sm:p-4 flex flex-col justify-between">
      <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-400 leading-tight">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-xl sm:text-2xl font-extrabold tracking-tight ${
          tone === "amber" ? "text-amber-600" : "text-stone-900"
        }`}
      >
        {value}
        <span className="ml-0.5 text-xs sm:text-sm font-semibold text-stone-400">{unit}</span>
      </p>
    </div>
  );
}
