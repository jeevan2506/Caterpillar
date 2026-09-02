import { useState, useEffect } from "react";
import Badge from "./Badge.jsx";
import Icon from "./Icon.jsx";
import { getOperators, assignOperator, createOperator } from "../services/api.js";
import { Spinner, Alert } from "./ui.jsx";

const EQUIPMENT_TYPES = [
  "Excavator",
  "Bulldozer",
  "Crane",
  "Loader",
  "Compactor",
  "Dump Truck",
  "Backhoe",
];

export default function OperatorTable({ operators = [], bookings = [], equipment = [], onChange }) {
  const [showAddModal, setShowAddModal] = useState(false);

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
      {/* Header with Add Operator Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-stone-900">
            Certified Operators Directory
          </h2>
          <p className="text-xs text-stone-500">
            {operators.length} certified heavy-machinery operators registered in the fleet.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center gap-2 font-bold shadow-sm"
        >
          <Icon name="plus" className="h-4 w-4" />
          <span>Add Operator</span>
        </button>
      </div>

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
        <div className="table-container">
          <table className="w-full min-w-[680px] border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/60">
                <th className="th">Operator ID</th>
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
                    <td className="td font-medium text-stone-900">{op.name}</td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1">
                        {op.certifiedEquipmentTypes.map((t) => (
                          <span
                            key={t}
                            className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700"
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

      {/* Add Operator Modal */}
      {showAddModal && (
        <AddOperatorModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false);
            onChange && onChange();
          }}
        />
      )}
    </div>
  );
}

function AddOperatorModal({ onClose, onAdded }) {
  const [name, setName] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [selectedTypes, setSelectedTypes] = useState(["Excavator"]);
  const [availabilityStatus, setAvailabilityStatus] = useState("available");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleType(type) {
    if (selectedTypes.includes(type)) {
      if (selectedTypes.length === 1) return; // Keep at least one
      setSelectedTypes(selectedTypes.filter((t) => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter the operator's full name.");
      return;
    }
    if (selectedTypes.length === 0) {
      setError("Please select at least one certified equipment type.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await createOperator({
        name: name.trim(),
        operatorId: operatorId.trim() || undefined,
        certifiedEquipmentTypes: selectedTypes,
        availabilityStatus,
      });

      onAdded && onAdded();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to add operator.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl animate-scale-in max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-cat-yellow/20 text-cat-ink font-bold">
              <Icon name="users" className="h-4 w-4" />
            </span>
            <h3 className="font-display text-sm sm:text-base font-bold text-stone-900">
              Add Certified Operator
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            aria-label="Close modal"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Patel"
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
              Operator ID <span className="text-stone-400 font-normal lowercase">(optional · auto-assigned if blank)</span>
            </label>
            <input
              type="text"
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              placeholder="e.g. OP105"
              className="input w-full uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
              Certified Machine Types *
            </label>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_TYPES.map((type) => {
                const active = selectedTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "bg-cat-ink text-white shadow-sm"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {active ? "✓ " : "+ "}
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
              Initial Availability
            </label>
            <select
              value={availabilityStatus}
              onChange={(e) => setAvailabilityStatus(e.target.value)}
              className="input w-full text-xs"
            >
              <option value="available">Available (Ready for assignment)</option>
              <option value="assigned">Assigned (Currently operating on site)</option>
            </select>
          </div>

          {error && <Alert>{error}</Alert>}

          <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary text-xs font-bold flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Spinner className="h-4 w-4" /> Adding Operator…
                </>
              ) : (
                <>
                  <Icon name="plus" className="h-4 w-4" />
                  <span>Save Operator</span>
                </>
              )}
            </button>
          </div>
        </form>
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
