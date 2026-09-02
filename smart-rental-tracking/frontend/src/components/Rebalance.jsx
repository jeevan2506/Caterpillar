import { useState, useEffect } from "react";
import { getRebalance } from "../services/api.js";
import Icon from "./Icon.jsx";
import { Loading, Alert } from "./ui.jsx";

const MONTHS = { "01":"Jan","02":"Feb","03":"Mar","04":"Apr","05":"May","06":"Jun",
  "07":"Jul","08":"Aug","09":"Sep","10":"Oct","11":"Nov","12":"Dec" };
const fmtMonth = (m) => {
  const [y, mo] = String(m).split("-");
  return `${MONTHS[mo] || mo} ${y}`;
};

export default function Rebalance() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dispatched, setDispatched] = useState({}); // local mock

  useEffect(() => {
    getRebalance()
      .then((r) => setPlan(r.data))
      .catch(() =>
        setError("Could not build the rebalance plan. Is demand_history seeded?")
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label="Analysing forecast vs fleet…" />;
  if (error) return <Alert>{error}</Alert>;

  const recs = plan?.recommendations || [];

  return (
    <div className="space-y-6">
      {/* Explainer banner */}
      <div className="flex items-center gap-4 rounded-2xl bg-cat-ink px-6 py-5 text-white">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cat-yellow text-cat-ink">
          <Icon name="radio" className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-cat-yellow">
            Auto-dispatch
          </p>
          <p className="mt-0.5 font-display text-base font-bold leading-snug">
            {recs.length
              ? `${recs.length} move${recs.length === 1 ? "" : "s"} would pre-position idle machines against upcoming demand.`
              : "Fleet is already well positioned — no moves recommended."}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <Stat label="Forecast shortages" value={plan?.shortageCombos ?? 0} tone="red" />
        <Stat label="Idle-heavy machines" value={plan?.idleUnits ?? 0} tone="amber" />
        <Stat label="Recommended moves" value={recs.length} />
      </div>

      {/* Recommendation cards */}
      {recs.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/15">
          <Icon name="check" className="h-4 w-4" strokeWidth={2.5} />
          Nothing to rebalance right now.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {recs.map((r) => {
            const done = dispatched[r.equipmentId];
            return (
              <div
                key={r.equipmentId}
                className="card border-l-4 border-l-cat-yellow p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold text-stone-900">
                      {r.equipmentId}
                    </span>
                    <span className="text-xs text-stone-400">{r.type}</span>
                  </div>
                  <span className="badge bg-stone-100 text-stone-600 ring-stone-500/20">
                    impact {r.impact}
                  </span>
                </div>

                {/* from → to */}
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="rounded-md bg-stone-100 px-2 py-1 font-semibold text-stone-700">
                    {r.fromSite}
                  </span>
                  <span className="text-stone-400">
                    <Icon name="scan" className="h-4 w-4" />
                  </span>
                  <span className="rounded-md bg-cat-yellow/25 px-2 py-1 font-bold text-cat-ink">
                    {r.toSite}
                  </span>
                  <span className="ml-auto text-xs text-stone-400">
                    peak {fmtMonth(r.peakMonth)}
                  </span>
                </div>

                <p className="mt-2.5 text-xs leading-relaxed text-stone-500">
                  {r.idlePercent > 0
                    ? `${r.idlePercent}% idle`
                    : "Available"}{" "}
                  · covers a <strong>{r.shortage}-unit</strong> {r.type} shortage
                  ({r.available} available vs {r.predicted} predicted).
                </p>

                <button
                  onClick={() =>
                    setDispatched((d) => ({ ...d, [r.equipmentId]: true }))
                  }
                  disabled={done}
                  className={`btn btn-sm mt-3 w-full ${
                    done ? "btn-ghost" : "btn-dark"
                  }`}
                >
                  {done ? "Dispatch scheduled ✓" : "Schedule dispatch"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }) {
  const active = tone && value > 0;
  return (
    <div className="card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-2xl font-extrabold tracking-tight ${
          tone === "red" && active
            ? "text-red-600"
            : tone === "amber" && active
            ? "text-amber-600"
            : "text-stone-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
