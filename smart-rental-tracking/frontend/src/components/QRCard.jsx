import { useState } from "react";
import Badge from "./Badge.jsx";
import Icon from "./Icon.jsx";
import { fmtDate } from "../utils/helpers.js";
import { getDynamicQr } from "../services/api.js";
import { Spinner } from "./ui.jsx";

// Booking confirmation + Dynamic QR card.
export default function QRCard({ data, onRefresh }) {
  const { booking, equipment, operator, qrCode: initialQrCode } = data;
  const [qrCode, setQrCode] = useState(initialQrCode);
  const [loadingQr, setLoadingQr] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState(null);
  const [error, setError] = useState("");

  const isApproved = booking.approvalStatus === "approved" || (!booking.approvalStatus && booking.paymentStatus === "paid");
  const isPending = booking.approvalStatus === "pending_approval";
  const isRejected = booking.approvalStatus === "rejected";

  async function generateDynamicQr() {
    setLoadingQr(true);
    setError("");
    try {
      const res = await getDynamicQr(booking.bookingId);
      setQrCode(res.data.qrCode);
      setLastGeneratedAt(new Date());
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate dynamic QR");
    } finally {
      setLoadingQr(false);
    }
  }

  const rows = [
    ["Equipment", `${booking.equipmentId}${equipment ? ` · ${equipment.type}` : ""}`],
    [
      "Operator",
      operator
        ? `${operator.name} (${operator.operatorId})`
        : booking.assignedOperatorId
        ? booking.assignedOperatorId
        : booking.operatorRequest === "self"
        ? "Own operator"
        : "Assigned by Admin at pickup",
    ],
    ["Rental duration", booking.rentalDays ? `${booking.rentalDays} days` : "—"],
    [
      "Expected return",
      fmtDate(booking.expectedReturnDate || equipment?.checkInDate),
    ],
    ["Pickup date", fmtDate(booking.checkOutDate)],
    ["Returned on", fmtDate(booking.checkInDate)],
  ];

  return (
    <div className="card overflow-hidden animate-fade-up">
      <div className="grid gap-5 sm:gap-6 p-4 sm:p-6 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <p className="font-display text-sm sm:text-base font-bold tracking-tight text-stone-900 break-all">
              {booking.bookingId}
            </p>
            <Badge status={booking.paymentStatus} />
            {booking.approvalStatus && (
              <Badge
                status={booking.approvalStatus}
                label={
                  booking.approvalStatus === "pending_approval"
                    ? "Awaiting Admin Approval"
                    : booking.approvalStatus
                }
              />
            )}
            <Badge status={booking.qrStatus} />
          </div>

          <dl className="mt-4 grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-x-6 gap-y-3">
            {rows.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  {k}
                </dt>
                <dd className="mt-0.5 text-xs sm:text-sm font-medium text-stone-800 break-words">{v}</dd>
              </div>
            ))}
          </dl>

          {isPending && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 border border-amber-200">
              <Icon name="alert" className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <span className="leading-relaxed">
                Payment received. Your booking is awaiting review &amp; approval by Admin.
              </span>
            </div>
          )}

          {isRejected && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs text-red-900 border border-red-200">
              <Icon name="alert" className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span className="leading-relaxed">
                Booking was rejected. Reason: {booking.rejectionReason || "Admin decision"}. Full refund processed.
              </span>
            </div>
          )}

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>

        {/* QR Section */}
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-stone-50 p-4 w-full sm:w-56 border border-stone-200/60">
          {isPending ? (
            <div className="flex flex-col items-center justify-center h-40 w-full sm:w-44 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4 text-center">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-600 mb-2">
                <Icon name="activity" className="h-5 w-5" />
              </div>
              <p className="font-bold text-xs text-amber-900">Awaiting Approval</p>
              <p className="mt-1 text-[10px] text-amber-700 leading-tight">
                QR code will activate once Admin approves your rental.
              </p>
            </div>
          ) : isRejected ? (
            <div className="flex flex-col items-center justify-center h-40 w-full sm:w-44 rounded-xl border border-dashed border-red-200 bg-red-50/50 p-4 text-center">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-red-100 text-red-600 mb-2">
                <Icon name="close" className="h-5 w-5" />
              </div>
              <p className="font-bold text-xs text-red-900">Request Rejected</p>
              <p className="mt-1 text-[10px] text-red-600 leading-tight">
                Refund initiated to original payment source.
              </p>
            </div>
          ) : isApproved ? (
            <>
              {qrCode ? (
                <img
                  src={qrCode}
                  alt="Booking QR code"
                  className="h-36 w-36 sm:h-40 sm:w-40 rounded-lg border border-stone-200 bg-white p-1.5 shadow-sm"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-36 w-36 sm:h-40 sm:w-40 rounded-lg border border-dashed border-stone-300 bg-white p-3 text-center">
                  <p className="text-xs text-stone-500 font-medium">Ready to generate</p>
                </div>
              )}

              <button
                onClick={generateDynamicQr}
                disabled={loadingQr}
                className="btn btn-dark btn-sm w-full text-xs py-2 min-h-[40px] flex items-center justify-center gap-1.5 font-bold shadow-sm"
              >
                {loadingQr ? (
                  <>
                    <Spinner className="h-3.5 w-3.5" /> Generating…
                  </>
                ) : (
                  <>
                    <Icon name="spark" className="h-3.5 w-3.5 text-cat-yellow" />
                    <span>{qrCode ? "Regenerate Dynamic QR" : "Generate Dynamic QR"}</span>
                  </>
                )}
              </button>

              <p className="text-center text-[10px] leading-snug text-stone-500">
                {lastGeneratedAt ? (
                  <span className="text-emerald-700 font-semibold">
                    Updated {lastGeneratedAt.toLocaleTimeString()}
                  </span>
                ) : (
                  "Show this dynamic QR at pickup"
                )}
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
