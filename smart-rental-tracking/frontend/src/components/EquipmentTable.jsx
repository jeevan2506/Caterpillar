import { useState } from "react";
import Badge from "./Badge.jsx";
import Icon from "./Icon.jsx";
import { fmtDate, displayStatus } from "../utils/helpers.js";

const FILTERS = ["all", "available", "booked", "active", "due-soon", "overdue"];

export default function EquipmentTable({ equipment = [] }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const rows = equipment.filter((eq) => {
    if (filter !== "all" && displayStatus(eq) !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const match =
        eq.equipmentId?.toLowerCase().includes(q) ||
        eq.type?.toLowerCase().includes(q) ||
        eq.siteId?.toLowerCase().includes(q) ||
        eq.lastOperatorId?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition min-h-[36px] ${
                filter === f
                  ? "bg-cat-ink text-white shadow-sm"
                  : "bg-white text-stone-600 ring-1 ring-inset ring-stone-200 hover:text-stone-900 active:bg-stone-50"
              }`}
            >
              {f.replace(/-/g, " ")}
              {f !== "all" && (
                <span className="ml-1.5 opacity-60">
                  {equipment.filter((eq) => displayStatus(eq) === f).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fleet (EQ..., type, site)..."
            className="input pl-8 py-1.5 text-xs"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400">
            <Icon name="scan" className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/80">
                <th className="th">Equipment</th>
                <th className="th">Type</th>
                <th className="th">Site</th>
                <th className="th">Status</th>
                <th className="th">Check out</th>
                <th className="th">Expected return</th>
                <th className="th">Actual Check-In</th>
                <th className="th text-right">Engine h/d</th>
                <th className="th text-right">Idle h/d</th>
                <th className="th text-right">Op. days</th>
                <th className="th">Last operator</th>
                <th className="th">Operator source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((eq) => (
                <tr key={eq.equipmentId} className="transition hover:bg-stone-50/70">
                  <td className="td font-display font-bold text-stone-900">
                    {eq.equipmentId}
                  </td>
                  <td className="td">{eq.type}</td>
                  <td className="td">{eq.siteId || "—"}</td>
                  <td className="td">
                    <Badge status={displayStatus(eq)} />
                  </td>
                  <td className="td whitespace-nowrap text-xs">{fmtDate(eq.checkOutDate)}</td>
                  <td className="td whitespace-nowrap text-xs">{fmtDate(eq.checkInDate)}</td>
                  <td className="td whitespace-nowrap text-xs">
                    {eq.actualReturnDate ? (
                      <span className="font-semibold text-emerald-700">{fmtDate(eq.actualReturnDate)}</span>
                    ) : eq.status === "active" || eq.status === "overdue" ? (
                      <span className="text-blue-700 font-medium">On site</span>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="td text-right tabular-nums">{eq.engineHoursPerDay}</td>
                  <td className="td text-right tabular-nums">{eq.idleHoursPerDay}</td>
                  <td className="td text-right tabular-nums">{eq.operatingDays}</td>
                  <td className="td">{eq.lastOperatorId || "—"}</td>
                  <td className="td capitalize">
                    {eq.operatorSource ? eq.operatorSource.replace(/-/g, " ") : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="td py-10 text-center text-stone-400" colSpan={12}>
                    No equipment matches this filter or search query.
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
