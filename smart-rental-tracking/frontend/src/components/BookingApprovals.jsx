import { useState, useEffect } from "react";
import Badge from "./Badge.jsx";
import Icon from "./Icon.jsx";
import { Spinner, Alert, EmptyState } from "./ui.jsx";
import { getPendingBookings, approveBooking, rejectBooking, getOperators } from "../services/api.js";

export default function BookingApprovals({ onApproved }) {
  const [pending, setPending] = useState([]);
  const [operatorsMap, setOperatorsMap] = useState({});
  const [selectedOperators, setSelectedOperators] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadPending() {
    setLoading(true);
    setError("");
    try {
      const res = await getPendingBookings();
      const list = res.data || [];
      setPending(list);

      // Load operators for caterpillar-assigned requests
      const catReqs = list.filter((item) => item.booking.operatorRequest === "caterpillar-assigned");
      const types = [...new Set(catReqs.map((item) => item.equipment?.type).filter(Boolean))];

      const opMap = {};
      await Promise.all(
        types.map(async (type) => {
          try {
            const opRes = await getOperators(type);
            opMap[type] = opRes.data || [];
          } catch {
            opMap[type] = [];
          }
        })
      );
      setOperatorsMap(opMap);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load pending booking requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPending();
  }, []);

  async function handleApprove(bookingId, equipmentType) {
    setActionLoading(bookingId);
    setError("");
    setSuccess("");
    try {
      const assignedOp = selectedOperators[bookingId] || undefined;
      await approveBooking(bookingId, {
        assignedOperatorId: assignedOp,
      });
      setSuccess(`Booking ${bookingId} approved successfully. Dynamic QR code activated for customer.`);
      await loadPending();
      onApproved && onApproved();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to approve booking.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(bookingId) {
    if (!window.confirm(`Are you sure you want to reject booking ${bookingId}? The payment will be marked refunded and equipment released.`)) {
      return;
    }
    setActionLoading(bookingId);
    setError("");
    setSuccess("");
    try {
      await rejectBooking(bookingId, {
        rejectionReason: "Equipment unavailable for requested schedule or operational limits.",
      });
      setSuccess(`Booking ${bookingId} rejected and refund initiated.`);
      await loadPending();
      onApproved && onApproved();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reject booking.");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="card p-12 text-center">
        <Spinner className="mx-auto h-6 w-6 text-cat-ink" />
        <p className="mt-2 text-xs text-stone-500">Loading pending booking requests…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="section-title">Rental Booking Approvals</h3>
          <p className="text-xs text-stone-500">
            Review paid customer booking requests, assign operators if requested, and approve dynamic QR generation.
          </p>
        </div>
        <button onClick={loadPending} className="btn btn-ghost btn-sm text-xs">
          <Icon name="spark" className="h-3.5 w-3.5" />
          Refresh Requests
        </button>
      </div>

      {error && <Alert>{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      {pending.length === 0 ? (
        <EmptyState
          title="No pending booking requests"
          hint="All customer rental requests have been reviewed and approved."
        />
      ) : (
        <div className="space-y-3">
          {pending.map(({ booking, equipment }) => {
            const opList = operatorsMap[equipment?.type] || [];
            const isActing = actionLoading === booking.bookingId;

            return (
              <div
                key={booking.bookingId}
                className="card overflow-hidden border border-stone-200/90 transition-all hover:border-stone-300"
              >
                <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-stone-100 bg-stone-50/70 px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-bold text-stone-900 break-all">
                      {booking.bookingId}
                    </span>
                    <Badge status="paid" />
                    <Badge status="pending_approval" label="Awaiting Approval" />
                  </div>
                  <span className="text-[11px] sm:text-xs text-stone-400">
                    Requested: {new Date(booking.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="grid gap-3.5 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-stone-400">Customer</p>
                      <p className="mt-0.5 text-xs sm:text-sm font-bold text-stone-800 break-words">{booking.userId}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-stone-400">Equipment</p>
                      <p className="mt-0.5 text-xs sm:text-sm font-semibold text-stone-900">
                        {booking.equipmentId} {equipment ? `· ${equipment.type}` : ""}
                      </p>
                      <p className="text-[11px] text-stone-500">Site {equipment?.siteId || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-stone-400">Rental Duration</p>
                      <p className="mt-0.5 text-xs sm:text-sm font-semibold text-stone-800">
                        {booking.rentalDays} Days
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-stone-400">Operator Preference</p>
                      <p className="mt-0.5 text-xs font-semibold capitalize text-stone-800">
                        {booking.operatorRequest === "self" ? "Own Operator" : "Caterpillar Assigned"}
                      </p>
                    </div>
                  </div>

                  {booking.operatorRequest === "caterpillar-assigned" && (
                    <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50/60 p-3 sm:p-3.5">
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                        Assign Certified Caterpillar Operator for {equipment?.type} (Optional)
                      </label>
                      <select
                        value={selectedOperators[booking.bookingId] || ""}
                        onChange={(e) =>
                          setSelectedOperators({
                            ...selectedOperators,
                            [booking.bookingId]: e.target.value,
                          })
                        }
                        className="input w-full max-w-md text-xs"
                      >
                        <option value="">— Assign at pickup scan or choose now —</option>
                        {opList.map((op) => (
                          <option key={op.operatorId} value={op.operatorId}>
                            {op.name} ({op.operatorId}) — {op.availabilityStatus}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-stone-100 pt-4">
                    <button
                      onClick={() => handleReject(booking.bookingId)}
                      disabled={isActing}
                      className="btn btn-ghost text-xs text-red-600 hover:bg-red-50 hover:text-red-700 flex-1 sm:flex-none min-h-[40px]"
                    >
                      Reject &amp; Refund
                    </button>
                    <button
                      onClick={() => handleApprove(booking.bookingId, equipment?.type)}
                      disabled={isActing}
                      className="btn btn-primary text-xs font-bold py-2 px-4 shadow-sm flex-1 sm:flex-none min-h-[40px]"
                    >
                      {isActing ? (
                        <>
                          <Spinner className="h-3.5 w-3.5" /> Approving…
                        </>
                      ) : (
                        "✅ Approve & Activate QR"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
