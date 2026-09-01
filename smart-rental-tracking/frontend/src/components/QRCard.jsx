import Badge from "./Badge.jsx";
import { fmtDate } from "../utils/helpers.js";

// Booking confirmation + QR (data URL from backend).
export default function QRCard({ data }) {
  const { booking, equipment, operator, qrCode } = data;

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
      <div className="grid gap-6 p-5 sm:grid-cols-[1fr_auto] sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-base font-bold tracking-tight text-stone-900">
              {booking.bookingId}
            </p>
            <Badge status={booking.paymentStatus} />
            <Badge status={booking.qrStatus} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  {k}
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-stone-800">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-stone-50 p-4 sm:w-52">
          {qrCode ? (
            <img
              src={qrCode}
              alt="Booking QR code"
              className="h-40 w-40 rounded-lg border border-stone-200 bg-white p-1.5"
            />
          ) : (
            <div className="grid h-40 w-40 place-items-center rounded-lg border border-dashed border-stone-300 text-xs text-stone-400">
              No QR
            </div>
          )}
          <p className="text-center text-[11px] leading-snug text-stone-500">
            Show this QR to Admin at pickup &amp; return
          </p>
        </div>
      </div>
    </div>
  );
}
