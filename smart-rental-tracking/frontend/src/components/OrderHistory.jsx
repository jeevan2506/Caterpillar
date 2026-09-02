import { useState, useEffect } from "react";
import Badge from "./Badge.jsx";
import Icon from "./Icon.jsx";
import { Loading, EmptyState } from "./ui.jsx";
import { getUserOrderHistory } from "../services/api.js";
import { fmtDate } from "../utils/helpers.js";

export default function OrderHistory({ userId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!showHistory) return;
    setLoading(true);
    getUserOrderHistory(userId)
      .then((res) => setOrders(res.data))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [userId, showHistory]);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="section-title">Order History</h3>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="btn btn-dark btn-sm text-xs font-bold px-3 py-2 flex items-center gap-1.5"
        >
          <Icon name="activity" className="h-3.5 w-3.5" />
          {showHistory ? "Hide History" : "View All Orders"}
        </button>
      </div>

      {showHistory && (
        <div className="animate-fade-up">
          {loading ? (
            <Loading label="Loading order history…" />
          ) : orders.length === 0 ? (
            <EmptyState
              title="No orders found"
              hint="Your order history will appear here after you make a booking."
            />
          ) : (
            <div className="space-y-3">
              {orders.map((item) => {
                const b = item.booking;
                const eq = item.equipment;
                const op = item.operator;
                const isExpanded = expanded === b.bookingId;

                return (
                  <div
                    key={b.bookingId}
                    className="card overflow-hidden transition-all hover:shadow-lift"
                  >
                    {/* Main Row */}
                    <button
                      onClick={() =>
                        setExpanded(isExpanded ? null : b.bookingId)
                      }
                      className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 text-left hover:bg-stone-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white font-bold text-sm ${
                            b.qrStatus === "completed"
                              ? "bg-emerald-500"
                              : b.qrStatus === "checked-out"
                              ? "bg-blue-500"
                              : b.approvalStatus === "rejected"
                              ? "bg-red-500"
                              : b.qrStatus === "expired"
                              ? "bg-stone-400"
                              : "bg-amber-500"
                          }`}
                        >
                          {b.qrStatus === "completed" ? (
                            <Icon name="check" className="h-5 w-5" />
                          ) : b.qrStatus === "checked-out" ? (
                            <Icon name="cube" className="h-5 w-5" />
                          ) : (
                            <Icon name="activity" className="h-5 w-5" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="font-display text-sm font-bold tracking-tight text-stone-900 truncate">
                            {b.bookingId}
                          </p>
                          <p className="text-xs text-stone-500">
                            {eq ? `${eq.type} · ${eq.equipmentId}` : b.equipmentId}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <Badge status={b.qrStatus} />
                        <Badge status={b.paymentStatus} />
                        {b.approvalStatus && (
                          <Badge
                            status={b.approvalStatus}
                            label={
                              b.approvalStatus === "pending_approval"
                                ? "Pending"
                                : b.approvalStatus
                            }
                          />
                        )}
                        <span className="text-[10px] sm:text-xs text-stone-400 font-medium ml-1">
                          {fmtDate(b.createdAt)}
                        </span>
                        <Icon
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          className="h-4 w-4 text-stone-400 ml-1 shrink-0"
                        />
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-stone-100 bg-stone-50/50 p-4 sm:p-5 animate-fade-up">
                        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
                          <DetailItem label="Equipment" value={eq ? `${eq.equipmentId} · ${eq.type}` : b.equipmentId} />
                          <DetailItem label="Rental Duration" value={b.rentalDays ? `${b.rentalDays} days` : "—"} />
                          <DetailItem label="Booked On" value={fmtDate(b.createdAt)} />
                          <DetailItem label="Pickup Date" value={fmtDate(b.checkOutDate)} />
                          <DetailItem label="Expected Return" value={fmtDate(b.expectedReturnDate)} />
                          <DetailItem label="Returned On" value={fmtDate(b.checkInDate)} />
                          <DetailItem
                            label="Operator"
                            value={
                              op
                                ? `${op.name} (${op.operatorId})`
                                : b.assignedOperatorId
                                ? b.assignedOperatorId
                                : b.operatorRequest === "self"
                                ? "Own operator"
                                : "—"
                            }
                          />
                          <DetailItem
                            label="Site"
                            value={eq?.siteId || "—"}
                          />
                        </dl>

                        {b.approvalStatus === "rejected" && b.rejectionReason && (
                          <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs text-red-900 border border-red-200">
                            <Icon name="alert" className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                            <span>Rejected: {b.rejectionReason}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-xs sm:text-sm font-medium text-stone-800 break-words">
        {value}
      </dd>
    </div>
  );
}
