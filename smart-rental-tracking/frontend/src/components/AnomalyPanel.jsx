import Badge from "./Badge.jsx";
import Icon from "./Icon.jsx";
import { getAnomalies } from "../utils/helpers.js";

const SEV_RANK = { high: 2, medium: 1, low: 0 };

export default function AnomalyPanel({ equipment, telemetry = [], maintenance = [], bookings = [] }) {
  const telMap = {};
  telemetry.forEach((t) => {
    telMap[t.equipmentId] = t;
  });

  // One group per flagged machine — never repeat the same equipment ID.
  const groups = [];
  equipment.forEach((eq) => {
    const flags = getAnomalies(eq, { telemetry: telMap[eq.equipmentId], maintenance, bookings });
    if (!flags.length) return;
    const worst = flags.reduce(
      (s, f) => (SEV_RANK[f.severity] > SEV_RANK[s] ? f.severity : s),
      "low"
    );
    groups.push({ eq, flags, worst });
  });
  groups.sort((a, b) => SEV_RANK[b.worst] - SEV_RANK[a.worst] || b.flags.length - a.flags.length);

  const totalFlags = groups.reduce((n, g) => n + g.flags.length, 0);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h3 className="section-title">Anomaly Flags</h3>
        <span
          className="grid h-4 w-4 cursor-help place-items-center rounded-full bg-stone-200 text-[10px] font-bold text-stone-500"
          title="These anomalies are meaningful because usage is now verified — pickup/return are witnessed by Admin QR scans, and running hours come from a live machine heartbeat, not self-reported logs."
        >
          i
        </span>
        <span className="ml-auto text-sm text-stone-400">
          {groups.length} machine{groups.length === 1 ? "" : "s"} · {totalFlags} issue
          {totalFlags === 1 ? "" : "s"}
        </span>
      </div>

      {groups.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/15">
          <Icon name="check" className="h-4 w-4" strokeWidth={2.5} />
          No anomalies detected across the fleet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map(({ eq, flags, worst }) => (
            <div
              key={eq.equipmentId}
              className={`rounded-xl border border-stone-200 border-l-4 bg-white p-4 shadow-card ${
                worst === "high" ? "border-l-red-400" : "border-l-amber-400"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-sm font-bold text-stone-900">
                    {eq.equipmentId}
                  </p>
                  <p className="text-xs text-stone-400">
                    {eq.type}
                    {eq.siteId ? ` · ${eq.siteId}` : ""}
                  </p>
                </div>
                <Badge status={worst} />
              </div>

              <ul className="mt-3 space-y-2.5">
                {flags.map((f, i) => (
                  <li key={i}>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-stone-700">
                        {f.type}
                      </p>
                      <span
                        className={`text-[9px] font-bold uppercase ${
                          f.severity === "high" ? "text-red-500" : "text-amber-500"
                        }`}
                      >
                        {f.severity}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-stone-500">{f.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
