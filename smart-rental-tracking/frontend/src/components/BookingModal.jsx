import { useState, useEffect } from "react";
import {
  getOperators,
  createBooking,
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../services/api.js";
import Badge from "./Badge.jsx";
import Icon from "./Icon.jsx";
import { Spinner, Alert } from "./ui.jsx";

export default function BookingModal({ equipment, userId, onClose, onBooked }) {
  const [operatorRequest, setOperatorRequest] = useState("caterpillar-assigned");
  const [rentalDays, setRentalDays] = useState(7);
  const [operators, setOperators] = useState([]);
  const [loadingOps, setLoadingOps] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const days = Math.max(1, Math.min(90, Number(rentalDays) || 1));
  const totalAmount = (equipment.dailyRate || 3500) * days;
  const estReturn = new Date(Date.now() + days * 86400000).toLocaleDateString();
  const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;

  useEffect(() => {
    const scriptId = "razorpay-checkout-script";
    const existingScript = document.getElementById(scriptId);

    if (!existingScript) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (operatorRequest !== "caterpillar-assigned") return;
    setLoadingOps(true);
    getOperators(equipment.type)
      .then((res) => setOperators(res.data))
      .catch(() => setOperators([]))
      .finally(() => setLoadingOps(false));
  }, [operatorRequest, equipment.type]);

  async function payWithRazorpay() {
    setError("");
    setPaying(true);

    try {
      if (!razorpayKey) {
        throw new Error("Razorpay key is missing. Add VITE_RAZORPAY_KEY_ID to the frontend .env file.");
      }

      if (typeof window.Razorpay === "undefined") {
        throw new Error("Razorpay checkout SDK is not loaded yet. Please check your internet connection and try again.");
      }

      const amountPaise = Math.max(100, Math.round(totalAmount * 100));

      const orderRes = await createRazorpayOrder({
        amount: amountPaise,
        currency: "INR",
        receipt: `booking_${Date.now()}`,
      });

      const { order_id } = orderRes.data;

      const options = {
        key: razorpayKey,
        amount: amountPaise,
        currency: "INR",
        name: "Smart Rental Tracking",
        description: `${equipment.equipmentId} rental (${days} days)`,
        order_id,
        handler: async function (response) {
          try {
            const verification = await verifyRazorpayPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (!verification.data?.success) {
              throw new Error("Payment verification failed.");
            }

            const res = await createBooking({
              userId,
              equipmentId: equipment.equipmentId,
              operatorRequest,
              rentalDays: days,
              paymentStatus: "paid",
            });

            setConfirmation(res.data);
            onBooked && onBooked();
          } catch (verifyErr) {
            setError(
              verifyErr.response?.data?.message ||
                verifyErr.message ||
                "Payment verification failed. Please contact support."
            );
          }
        },
        prefill: {
          name: "Joy Customer",
          email: "customer@example.com",
          contact: "9876543210",
        },
        theme: {
          color: "#0B0B0C",
        },
        modal: {
          ondismiss: function () {
            setError("Payment cancelled. You can retry payment anytime.");
          },
        },
      };

      const razorpayCheckout = new window.Razorpay(options);
      razorpayCheckout.on("payment.failed", function (response) {
        setError(
          response.error?.description ||
            "Payment failed on Razorpay. Please verify your payment details."
        );
      });
      razorpayCheckout.open();
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Booking failed. Please try again."
      );
    } finally {
      setPaying(false);
    }
  }

  const options = [
    {
      key: "caterpillar-assigned",
      title: "Request a Caterpillar operator",
      desc: "A certified operator is assigned by the Admin at pickup.",
      icon: "users",
    },
    {
      key: "self",
      title: "Bring my own operator",
      desc: "You provide the operator ID at pickup.",
      icon: "cube",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4 animate-fade-in">
      <div className="flex max-h-[92vh] w-full max-w-lg animate-scale-in flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3.5 sm:px-6 sm:py-4">
          <h2 className="font-display text-sm sm:text-base font-bold tracking-tight text-stone-900">
            {confirmation ? "Rental Request Submitted" : "Book equipment"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            aria-label="Close booking modal"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {!confirmation && (
            <>
              <div className="mb-4 flex items-center gap-3 rounded-xl bg-stone-50 p-3 sm:p-3.5">
                <span className="grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-lg bg-cat-yellow/15 text-cat-ink">
                  <Icon name="cube" className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-stone-900 truncate">
                    {equipment.equipmentId} · {equipment.type}
                  </p>
                  <p className="truncate text-xs text-stone-500">
                    Site {equipment.siteId || "—"} · {equipment.engineHoursPerDay}h engine ·{" "}
                    {equipment.idleHoursPerDay}h idle/d
                  </p>
                </div>
              </div>

              <p className="mb-2 text-xs sm:text-sm font-semibold text-stone-800">
                How many days do you need this equipment?
              </p>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={rentalDays}
                    onChange={(e) => setRentalDays(e.target.value)}
                    className="input w-20 sm:w-24 text-center font-bold"
                  />
                  <span className="text-xs sm:text-sm text-stone-500">days</span>
                </div>
                <div className="ml-auto flex flex-wrap gap-1">
                  {[3, 7, 14, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => setRentalDays(d)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        days === d
                          ? "bg-cat-ink text-white shadow-sm"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              <p className="mb-4 text-[11px] sm:text-xs text-stone-400">
                Estimated return by <span className="font-medium text-stone-600">{estReturn}</span>{" "}
                (final window starts at Admin pickup scan).
              </p>

              <p className="mb-2 text-xs sm:text-sm font-semibold text-stone-800">
                How would you like to operate this equipment?
              </p>
              <div className="space-y-2">
                {options.map((o) => {
                  const on = operatorRequest === o.key;
                  return (
                    <button
                      key={o.key}
                      onClick={() => setOperatorRequest(o.key)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 sm:p-3.5 text-left transition min-h-[44px] ${
                        on
                          ? "border-cat-ink bg-stone-50 ring-2 ring-cat-ink/10"
                          : "border-stone-200 hover:border-stone-300"
                      }`}
                    >
                      <span
                        className={`grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-lg ${
                          on ? "bg-cat-yellow text-cat-ink" : "bg-stone-100 text-stone-500"
                        }`}
                      >
                        <Icon name={o.icon} className="h-4 w-4 sm:h-5 sm:w-5" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs sm:text-sm font-semibold text-stone-900">
                          {o.title}
                        </span>
                        <span className="block text-[11px] text-stone-500 truncate">{o.desc}</span>
                      </span>
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                          on ? "border-cat-ink bg-cat-ink text-white" : "border-stone-300"
                        }`}
                      >
                        {on && <Icon name="check" className="h-3 w-3" strokeWidth={2.5} />}
                      </span>
                    </button>
                  );
                })}
              </div>

              {operatorRequest === "caterpillar-assigned" && (
                <div className="mt-3 rounded-xl border border-stone-200 p-3">
                  <p className="mb-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-stone-400">
                    Certified operators for {equipment.type} · one assigned at pickup
                  </p>
                  {loadingOps ? (
                    <p className="flex items-center gap-2 text-xs text-stone-400">
                      <Spinner className="h-4 w-4" /> Checking availability…
                    </p>
                  ) : operators.length === 0 ? (
                    <p className="text-xs text-red-600">
                      No certified operators available right now.
                    </p>
                  ) : (
                    <ul className="divide-y divide-stone-100">
                      {operators.map((op) => (
                        <li
                          key={op.operatorId}
                          className="flex items-center justify-between py-1.5 text-xs"
                        >
                          <span className="font-medium text-stone-800">
                            {op.name}{" "}
                            <span className="text-stone-400">({op.operatorId})</span>
                          </span>
                          <Badge status={op.availabilityStatus} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between rounded-xl bg-stone-50 p-3.5 sm:p-4 border border-stone-200">
                <div>
                  <p className="text-[11px] font-semibold text-stone-500">Total Rental Amount</p>
                  <p className="font-display text-lg sm:text-xl font-bold text-stone-900">₹{totalAmount.toLocaleString()}</p>
                </div>
                <div className="text-right text-[11px] text-stone-500">
                  <span>₹{equipment.dailyRate || 3500}/day × {days}d</span>
                </div>
              </div>

              {error && (
                <div className="mt-3">
                  <Alert>{error}</Alert>
                </div>
              )}
            </>
          )}

          {confirmation && (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 text-amber-900">
                <div className="flex items-center gap-2.5 font-bold text-sm text-amber-900">
                  <Icon name="check" className="h-5 w-5 text-amber-600 shrink-0" strokeWidth={2.5} />
                  Payment Received · Awaiting Admin Approval
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-amber-800">
                  Your payment has been verified via Razorpay. The booking request is now awaiting review and dispatch approval by the Administrator. Once approved, you can generate your dynamic QR code under <span className="font-semibold text-amber-950">My Bookings</span>.
                </p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3.5 sm:p-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-stone-400 uppercase font-semibold text-[10px]">Booking ID</p>
                    <p className="font-display font-bold text-stone-900 mt-0.5 break-all">{confirmation.booking?.bookingId}</p>
                  </div>
                  <div>
                    <p className="text-stone-400 uppercase font-semibold text-[10px]">Equipment</p>
                    <p className="font-semibold text-stone-900 mt-0.5">{equipment.equipmentId} ({equipment.type})</p>
                  </div>
                  <div>
                    <p className="text-stone-400 uppercase font-semibold text-[10px]">Payment Status</p>
                    <div className="mt-0.5"><Badge status="paid" /></div>
                  </div>
                  <div>
                    <p className="text-stone-400 uppercase font-semibold text-[10px]">Approval Status</p>
                    <div className="mt-0.5"><Badge status="pending_approval" label="Pending Approval" /></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-stone-100 px-4 py-3.5 sm:px-6 sm:py-4">
          {!confirmation ? (
            <div className="space-y-2">
              <button
                onClick={payWithRazorpay}
                disabled={paying}
                className="btn btn-primary w-full py-3 font-bold text-sm shadow-sm flex items-center justify-center gap-2 min-h-[44px]"
              >
                {paying ? (
                  <>
                    <Spinner className="h-4 w-4" /> Processing Razorpay Checkout…
                  </>
                ) : (
                  <>
                    <span>Pay ₹{totalAmount.toLocaleString()} with Razorpay</span>
                  </>
                )}
              </button>
              <p className="text-center text-[10px] text-stone-400">
                Secured by Razorpay Gateway · 100% Encrypted
              </p>
            </div>
          ) : (
            <button onClick={onClose} className="btn btn-dark w-full py-3 font-bold min-h-[44px]">
              View My Bookings
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
