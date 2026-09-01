import { useState, useEffect } from "react";
import Badge from "./Badge.jsx";
import { getOperators, assignOperator } from "../services/api.js";
import { Spinner, Alert } from "./ui.jsx";

export default function OperatorTable({ operators, bookings, equipment = [], onChange }) {
  function currentAssignment(operatorId) {
    const b = bookings.find(
      (bk) =>
        bk.assignedOperatorId === operatorId &&
        (bk.qrStatus === "unused" || bk.qrStatus === "checked-out")
    );
    if (!b) return null;
    return `${b.equipmentId} · ${b.bookingId}`;
  }

  // Machines that are checked out on a Caterpillar-operator booking but have
  // nobody assigned yet.
  const pending = bookings
    .filter(
      (b) =>
        b.qrStatus === "checked-out" &&
        b.operatorRequest === "caterpillar-assigned" &&
        !b.assignedOperatorId
    )
    .map((b) => ({ booking: b, eq: equipment.find((e) => e.equipmentId === b.equipmentId) }));

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div className="card p-5">
          <h3 className="section-title mb-3">
            Equipment awaiting operator ({pending.length})
          </h3>
          <div className="space-y-3">
            {pending.map(({ booking, eq }) => (
              <AssignRow
                key={booking.bookingId}
                booking={booking}
                eq={eq}
                onDone={onChange}
              />
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="th">Operator</th>
                <th className="th">Name</th>
                <th className="th">Certified equipment</th>
                <th className="th">Availability</th>
                <th className="th">Current assignment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {operators.map((op) => {
                const assignment = currentAssignment(op.operatorId);
                return (
                  <tr key={op.operatorId} className="transition hover:bg-stone-50/70">
                    <td className="td font-display font-bold text-stone-900">
                      {op.operatorId}
                    </td>
                    <td className="td">{op.name}</td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1">
                        {op.certifiedEquipmentTypes.map((t) => (
                          <span
                            key={t}
                            className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="td">
                      <Badge status={op.availabilityStatus} />
                    </td>
                    <td className="td text-stone-500">
                      {assignment || <span className="text-stone-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AssignRow({ booking, eq, onDone }) {
  const [choices, setChoices] = useState([]);
  const [operatorId, setOperatorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eq) return;
    getOperators(eq.type)
      .then((r) => setChoices(r.data))
      .catch(() => setChoices([]));
  }, [eq]);

  async function assign() {
    if (!operatorId) return;
    setBusy(true);
    setError("");
    try {
      await assignOperator({ bookingId: booking.bookingId, operatorId });
      onDone && onDone();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to assign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-stone-200 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-display font-bold text-stone-900">
            {booking.equipmentId}
          </span>{" "}
          <span className="text-stone-500">
            {eq ? `${eq.type} · site ${eq.siteId || "—"}` : ""} · {booking.bookingId}
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={operatorId}
          onChange={(e) => setOperatorId(e.target.value)}
          className="input max-w-xs"
        >
          <option value="">
            {choices.length ? "Select a certified operator…" : "No certified operator available"}
          </option>
          {choices.map((op) => (
            <option key={op.operatorId} value={op.operatorId}>
              {op.name} ({op.operatorId})
            </option>
          ))}
        </select>
        <button
          onClick={assign}
          disabled={busy || !operatorId}
          className="btn btn-dark btn-sm"
        >
          {busy ? <Spinner className="h-4 w-4" /> : "Assign"}
        </button>
      </div>
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}
    </div>
  );
}
