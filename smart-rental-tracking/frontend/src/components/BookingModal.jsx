import { useState, useEffect } from "react";
import { getOperators, createBooking } from "../services/api.js";
import Badge from "./Badge.jsx";
import QRCard from "./QRCard.jsx";
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
  const estReturn = new Date(Date.now() + days * 86400000).toLocaleDateString();

  useEffect(() => {
    if (operatorRequest !== "caterpillar-assigned") return;
    setLoadingOps(true);
    getOperators(equipment.type)
      .then((res) => setOperators(res.data))
      .catch(() => setOperators([]))
      .finally(() => setLoadingOps(false));
  }, [operatorRequest, equipment.type]);

  async function payNow() {
    setError("");
    setPaying(true);
    try {
      const res = await createBooking({
        userId,
        equipmentId: equipment.equipmentId,
        operatorRequest,
        rentalDays: days,
      });
      setConfirmation(res.data);
      onBooked && onBooked();
    } catch (err) {
      setError(err.response?.data?.message || "Booking failed. Please try again.");
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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-cat-dark/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg animate-scale-in flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <h2 className="font-display text-base font-bold tracking-tight text-stone-900">
            {confirmation ? "Booking confirmed" : "Book equipment"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {!confirmation && (
            <>
              <div className="mb-5 flex items-center gap-3 rounded-xl bg-stone-50 p-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-cat-yellow/15 text-cat-ink">
                  <Icon name="cube" className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-stone-900">
                    {equipment.equipmentId} · {equipment.type}
                  </p>
                  <p className="truncate text-xs text-stone-500">
                    Site {equipment.siteId || "—"} · {equipment.engineHoursPerDay}h engine ·{" "}
                    {equipment.idleHoursPerDay}h idle per day
                  </p>
                </div>
              </div>

              <p className="mb-2 text-sm font-semibold text-stone-800">
                How many days do you need this equipment?
              </p>
              <div className="mb-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={rentalDays}
                  onChange={(e) => setRentalDays(e.target.value)}
                  className="input w-24"
                />
                <span className="text-sm text-stone-500">days</span>
                <div className="ml-auto flex gap-1">
                  {[3, 7, 14, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => setRentalDays(d)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        days === d
                          ? "bg-cat-ink text-white"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              <p className="mb-5 text-xs text-stone-400">
                Estimated return by <span className="font-medium text-stone-600">{estReturn}</span>{" "}
                (final window starts at Admin pickup scan).
              </p>

              <p className="mb-2.5 text-sm font-semibold text-stone-800">
                How would you like to operate this equipment?
              </p>
              <div className="space-y-2.5">
                {options.map((o) => {
                  const on = operatorRequest === o.key;
                  return (
                    <button
                      key={o.key}
                      onClick={() => setOperatorRequest(o.key)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition ${
                        on
                          ? "border-cat-ink bg-stone-50 ring-2 ring-cat-ink/10"
                          : "border-stone-200 hover:border-stone-300"
                      }`}
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                          on ? "bg-cat-yellow text-cat-ink" : "bg-stone-100 text-stone-500"
                        }`}
                      >
                        <Icon name={o.icon} className="h-5 w-5" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-semibold text-stone-900">
                          {o.title}
                        </span>
                        <span className="block text-xs text-stone-500">{o.desc}</span>
                      </span>
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-full border ${
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
                <div className="mt-4 rounded-xl border border-stone-200 p-3.5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
                    Certified operators for {equipment.type} · one assigned at pickup
                  </p>
                  {loadingOps ? (
                    <p className="flex items-center gap-2 text-sm text-stone-400">
                      <Spinner className="h-4 w-4" /> Checking availability…
                    </p>
                  ) : operators.length === 0 ? (
                    <p className="text-sm text-red-600">
                      No certified operators available right now.
                    </p>
                  ) : (
                    <ul className="divide-y divide-stone-100">
                      {operators.map((op) => (
                        <li
                          key={op.operatorId}
                          className="flex items-center justify-between py-2 text-sm"
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

              {error && (
                <div className="mt-4">
                  <Alert>{error}</Alert>
                </div>
              )}
            </>
          )}

          {confirmation && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/15">
                <Icon name="check" className="h-4 w-4" strokeWidth={2.5} />
                Payment successful — your booking is confirmed.
              </div>
              <QRCard data={confirmation} />
            </div>
          )}
        </div>

        <div className="border-t border-stone-100 px-6 py-4">
          {!confirmation ? (
            <button
              onClick={payNow}
              disabled={paying}
              className="btn btn-primary w-full py-3"
            >
              {paying ? (
                <>
                  <Spinner className="h-4 w-4" /> Processing payment…
                </>
              ) : (
                "Pay now · mock payment"
              )}
            </button>
          ) : (
            <button onClick={onClose} className="btn btn-dark w-full py-3">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
