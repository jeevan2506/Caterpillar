import { useState, useEffect } from "react";
import Badge from "./Badge.jsx";
import { fmtDate } from "../utils/helpers.js";
import { getMaintenance, updateMaintenance } from "../services/api.js";
import { Loading, Alert } from "./ui.jsx";

const NEXT_STATUS = {
  pending: "in-progress",
  "in-progress": "resolved",
  resolved: "resolved",
};
const FILTERS = ["all", "pending", "in-progress", "resolved"];

export default function MaintenancePanel() {
  const [records, setRecords] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await getMaintenance(filter === "all" ? undefined : filter);
      setRecords(res.data);
    } catch {
      setError("Could not load maintenance records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function advance(rec) {
    const next = NEXT_STATUS[rec.status];
    if (next === rec.status) return;
    try {
      await updateMaintenance(rec._id, { status: next });
      load();
    } catch {
      setError("Failed to update record.");
    }
  }

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
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
          </button>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <Loading />
      ) : records.length === 0 ? (
        <div className="card px-6 py-12 text-center text-sm text-stone-400">
          No maintenance records.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="th">Equipment</th>
                  <th className="th">Issue</th>
                  <th className="th">Reported</th>
                  <th className="th text-right">Downtime</th>
                  <th className="th">Technician</th>
                  <th className="th">Status</th>
                  <th className="th">Resolved</th>
                  <th className="th text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {records.map((r) => (
                  <tr key={r._id} className="transition hover:bg-stone-50/70">
                    <td className="td font-display font-bold text-stone-900">
                      {r.equipmentId}
                    </td>
                    <td className="td max-w-xs text-stone-600">
                      <div>{r.issueReported}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {r.source === "customer" && (
                          <span className="badge bg-amber-50 text-amber-700 ring-amber-600/20">
                            Customer-reported
                          </span>
                        )}
                        {r.severity && (
                          <span
                            className={`badge ${
                              r.severity === "high"
                                ? "bg-red-50 text-red-700 ring-red-600/20"
                                : r.severity === "low"
                                ? "bg-stone-100 text-stone-600 ring-stone-500/20"
                                : "bg-amber-50 text-amber-700 ring-amber-600/20"
                            }`}
                          >
                            {r.severity} severity
                          </span>
                        )}
                        {r.bookingId && (
                          <span className="text-[10px] text-stone-400">
                            {r.bookingId}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="td whitespace-nowrap">{fmtDate(r.reportedDate)}</td>
                    <td className="td text-right tabular-nums">{r.downtimeHours}h</td>
                    <td className="td">{r.technicianId || "—"}</td>
                    <td className="td">
                      <Badge status={r.status} />
                    </td>
                    <td className="td whitespace-nowrap">{fmtDate(r.resolvedDate)}</td>
                    <td className="td text-right">
                      {r.status !== "resolved" ? (
                        <button
                          onClick={() => advance(r)}
                          className="btn btn-dark btn-sm capitalize"
                        >
                          Mark {NEXT_STATUS[r.status].replace(/-/g, " ")}
                        </button>
                      ) : (
                        <span className="text-xs text-stone-400">Closed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
