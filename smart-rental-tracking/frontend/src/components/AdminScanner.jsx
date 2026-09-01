import { useState } from "react";
import QRScanner from "./QRScanner.jsx";
import Badge from "./Badge.jsx";
import Icon from "./Icon.jsx";
import { Spinner, Alert } from "./ui.jsx";
import {
  validateScan,
  confirmPickup,
  confirmReturn,
  getOperators,
} from "../services/api.js";

export default function AdminScanner({ onChange }) {
  const [bookingId, setBookingId] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [siteId, setSiteId] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [operatorChoices, setOperatorChoices] = useState([]);

  async function runValidate(id) {
    const theId = (id || bookingId).trim();
    if (!theId) return;
    setError("");
    setSuccess("");
    setResult(null);
    setOperatorChoices([]);
    setLoading(true);
    try {
      const res = await validateScan(theId);
      if (!res.data.success) {
        setError(res.data.message);
      } else {
        setResult({ ...res.data, bookingId: theId });
        // For a Caterpillar-operator booking at pickup, load the operators the
        // Admin is allowed to choose: certified for this equipment + available.
        if (
          res.data.action === "confirm-pickup" &&
          res.data.booking.operatorRequest === "caterpillar-assigned" &&
          res.data.equipment
        ) {
          getOperators(res.data.equipment.type)
            .then((r) => setOperatorChoices(r.data))
            .catch(() => setOperatorChoices([]));
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || "Validation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function doPickup() {
    setLoading(true);
    setError("");
    try {
      await confirmPickup({
        bookingId: result.bookingId,
        siteId: siteId.trim() || undefined,
        operatorId: operatorId.trim() || undefined,
      });
      setSuccess("Pickup confirmed — the equipment is now active on site.");
      reset();
      onChange && onChange();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to confirm pickup.");
    } finally {
      setLoading(false);
    }
  }

  async function doReturn() {
    setLoading(true);
    setError("");
    try {
      await confirmReturn(result.bookingId);
      setSuccess("Return confirmed — the equipment is back and available.");
      reset();
      onChange && onChange();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to confirm return.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setBookingId("");
    setSiteId("");
    setOperatorId("");
    setOperatorChoices([]);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      {/* Scan input */}
      <div className="card h-fit p-5">
        <div className="mb-3 flex items-center gap-2">
          <Icon name="scan" className="h-4 w-4 text-stone-400" />
          <h3 className="section-title">Scan a booking</h3>
        </div>

        <QRScanner onResult={(text) => runValidate(text)} />

        <div className="my-4 flex items-center gap-3 text-xs text-stone-400">
          <span className="h-px flex-1 bg-stone-200" />
          OR ENTER MANUALLY
          <span className="h-px flex-1 bg-stone-200" />
        </div>

        <label className="label">Booking ID</label>
        <div className="flex gap-2">
          <input
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runValidate()}
            placeholder="BOOK-…"
            className="input"
          />
          <button
            onClick={() => runValidate()}
            disabled={loading}
            className="btn btn-dark shrink-0"
          >
            {loading ? <Spinner className="h-4 w-4" /> : "Validate"}
          </button>
        </div>
      </div>

      {/* Result */}
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        {!result && !error && !success && (
          <div className="card grid place-items-center px-6 py-16 text-center">
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-stone-100 text-stone-400">
              <Icon name="scan" className="h-6 w-6" />
            </div>
            <p className="font-semibold text-stone-700">Awaiting a scan</p>
            <p className="mt-1 text-sm text-stone-400">
              Scan a customer's QR or type the booking ID to validate it.
            </p>
          </div>
        )}

        {result && (
          <div className="card animate-fade-up overflow-hidden">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold text-stone-900">
                  {result.booking.bookingId}
                </span>
                <Badge status={result.booking.qrStatus} />
              </div>
              <span
                className={`badge ${
                  result.action === "confirm-pickup"
                    ? "bg-cat-yellow/20 text-cat-ink ring-cat-yellow/40"
                    : "bg-blue-50 text-blue-700 ring-blue-600/20"
                }`}
              >
                {result.action === "confirm-pickup" ? "Pickup" : "Return"}
              </span>
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-3">
              <Field label="Customer" value={result.booking.userId} />
              <Field label="Payment" value={<Badge status={result.booking.paymentStatus} />} />
              <Field
                label="Operator mode"
                value={(result.booking.operatorRequest || "—").replace(/-/g, " ")}
              />
              <Field
                label="Booked duration"
                value={result.booking.rentalDays ? `${result.booking.rentalDays} days` : "—"}
              />
              {result.action === "confirm-return" && result.booking.expectedReturnDate && (
                <Field
                  label="Was due"
                  value={new Date(result.booking.expectedReturnDate).toLocaleDateString()}
                />
              )}
              {result.equipment && (
                <>
                  <Field
                    label="Equipment"
                    value={`${result.equipment.equipmentId} · ${result.equipment.type}`}
                  />
                  <Field label="Current site" value={result.equipment.siteId || "—"} />
                  <Field label="Equipment status" value={<Badge status={result.equipment.status} />} />
                </>
              )}
              {result.operator && (
                <Field
                  label="Assigned operator"
                  value={`${result.operator.name} (${result.operator.operatorId})`}
                />
              )}
            </div>

            <div className="border-t border-stone-100 bg-stone-50/60 p-5">
              {result.action === "confirm-pickup" && (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label">Site ID</label>
                      <input
                        value={siteId}
                        onChange={(e) => setSiteId(e.target.value)}
                        placeholder="e.g. S003"
                        className="input"
                      />
                    </div>
                    {result.booking.operatorRequest === "self" ? (
                      <div>
                        <label className="label">Operator ID (customer's own)</label>
                        <input
                          value={operatorId}
                          onChange={(e) => setOperatorId(e.target.value)}
                          placeholder="e.g. OP550"
                          className="input"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="label">
                          Assign a Caterpillar operator ({result.equipment?.type})
                        </label>
                        <select
                          value={operatorId}
                          onChange={(e) => setOperatorId(e.target.value)}
                          className="input"
                        >
                          <option value="">— assign later —</option>
                          {operatorChoices.map((op) => (
                            <option key={op.operatorId} value={op.operatorId}>
                              {op.name} ({op.operatorId})
                            </option>
                          ))}
                        </select>
                        {operatorChoices.length === 0 && (
                          <p className="mt-1 text-xs text-amber-600">
                            No certified operator available — pick one later from Operators.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={doPickup}
                    disabled={loading}
                    className="btn btn-primary w-full py-3"
                  >
                    {loading ? <Spinner className="h-4 w-4" /> : "Confirm pickup"}
                  </button>
                </div>
              )}

              {result.action === "confirm-return" && (
                <button
                  onClick={doReturn}
                  disabled={loading}
                  className="btn btn-primary w-full py-3"
                >
                  {loading ? <Spinner className="h-4 w-4" /> : "Confirm return"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium capitalize text-stone-800">{value}</div>
    </div>
  );
}
