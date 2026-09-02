import { useState, useEffect } from "react";
import Header from "../components/Header.jsx";
import Badge from "../components/Badge.jsx";
import BookingModal from "../components/BookingModal.jsx";
import QRCard from "../components/QRCard.jsx";
import OrderHistory from "../components/OrderHistory.jsx";
import Icon from "../components/Icon.jsx";
import { Loading, EmptyState, Alert } from "../components/ui.jsx";
import { getEquipment, getUserBookings, getUser, updateUserPhone } from "../services/api.js";
import { getSession } from "../services/auth.js";

export default function UserDashboard() {
  const session = getSession();
  const [equipment, setEquipment] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneSuccess, setPhoneSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [eqRes, bkRes, userRes] = await Promise.all([
        getEquipment({ status: "available" }),
        getUserBookings(session.userId),
        getUser(session.userId).catch(() => ({ data: null })),
      ]);
      setEquipment(eqRes.data);
      setBookings(bkRes.data);
      if (userRes.data?.phone) {
        setPhone(userRes.data.phone);
      }
    } catch {
      setError("Could not load data. Make sure the backend is running on port 5000.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePhone(e) {
    e.preventDefault();
    if (!phone.trim()) return;
    setPhoneSaving(true);
    setPhoneSuccess("");
    try {
      await updateUserPhone(session.userId, phone.trim());
      setPhoneSuccess("Phone number saved to database for SMS alerts!");
      setTimeout(() => setPhoneSuccess(""), 4000);
    } catch {
      setError("Failed to save phone number to database.");
    } finally {
      setPhoneSaving(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeBookings = bookings.filter(
    (b) => b.booking.qrStatus === "unused" || b.booking.qrStatus === "checked-out"
  ).length;

  return (
    <div className="min-h-screen">
      <Header
        title="Smart Rental Tracking"
        subtitle="Customer portal"
        name={session?.name}
        role={session?.role}
      />

      <main className="mx-auto max-w-7xl space-y-6 sm:space-y-8 px-3.5 py-6 sm:px-6 sm:py-8">
        {error && <Alert>{error}</Alert>}

        {/* Hero */}
        <section className="overflow-hidden rounded-2xl bg-cat-ink p-5 sm:p-8 text-white">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-cat-yellow">
                Welcome back
              </p>
              <h2 className="mt-1 font-display text-xl sm:text-2xl font-extrabold tracking-tight">
                {session?.name}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-stone-400">
                Reserve equipment and manage active rentals.
              </p>
            </div>
            <div className="flex gap-2.5 sm:gap-3">
              <Stat label="Available now" value={equipment.length} />
              <Stat label="Active bookings" value={activeBookings} />
            </div>
          </div>
        </section>

        {/* Phone & SMS Alert Setting Card */}
        <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-900 font-bold">
                📱
              </span>
              <div>
                <h4 className="font-display text-sm font-bold text-stone-900">
                  SMS Alert Mobile Number
                </h4>
                <p className="text-xs text-stone-500">
                  Automatic due-date reminders and remaining time alerts will be sent to this number.
                </p>
              </div>
            </div>

            <form onSubmit={handleSavePhone} className="flex items-center gap-2">
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919876543210 or +18547770158"
                className="input text-xs font-semibold py-1.5 w-48 sm:w-56"
              />
              <button
                type="submit"
                disabled={phoneSaving}
                className="btn btn-primary btn-sm text-xs font-bold px-3.5 py-1.5 shrink-0"
              >
                {phoneSaving ? "Saving..." : "Save Phone"}
              </button>
            </form>
          </div>
          {phoneSuccess && (
            <p className="mt-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              ✓ {phoneSuccess}
            </p>
          )}
        </section>

        {/* Available Equipment */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="section-title">Available Equipment</h3>
            <span className="text-xs sm:text-sm text-stone-400 font-medium">
              {equipment.length} unit{equipment.length === 1 ? "" : "s"}
            </span>
          </div>

          {loading ? (
            <Loading label="Loading fleet…" />
          ) : equipment.length === 0 ? (
            <EmptyState
              title="No equipment available"
              hint="Everything is currently on rent. Check back soon."
            />
          ) : (
            <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {equipment.map((eq) => (
                <EquipmentCard key={eq.equipmentId} eq={eq} onBook={() => setSelected(eq)} />
              ))}
            </div>
          )}
        </section>

        {/* My Bookings */}
        <section>
          <h3 className="section-title mb-4">My Bookings</h3>
          {loading ? (
            <Loading />
          ) : bookings.length === 0 ? (
            <EmptyState
              title="No bookings yet"
              hint="Book a machine above to get your pickup QR code."
            />
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => (
                <QRCard key={b.booking.bookingId} data={b} onRefresh={load} />
              ))}
            </div>
          )}
        </section>

        {/* Order History */}
        <OrderHistory userId={session.userId} />
      </main>

      {selected && (
        <BookingModal
          equipment={selected}
          userId={session.userId}
          onClose={() => {
            setSelected(null);
            load();
          }}
          onBooked={load}
        />
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex-1 sm:flex-none rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 sm:px-4 sm:py-2.5 text-center">
      <p className="font-display text-xl sm:text-2xl font-extrabold leading-none text-cat-yellow">
        {value}
      </p>
      <p className="mt-1 text-[10px] sm:text-[11px] uppercase tracking-wide text-stone-400">
        {label}
      </p>
    </div>
  );
}

function EquipmentCard({ eq, onBook }) {
  const total = eq.engineHoursPerDay + eq.idleHoursPerDay;
  const util = total > 0 ? Math.round((eq.engineHoursPerDay / total) * 100) : 0;

  return (
    <div className="card group flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative flex items-center justify-between border-b border-stone-100 bg-gradient-to-br from-stone-50 to-white px-4 py-3.5 sm:px-5 sm:py-4">
        <div>
          <p className="font-display text-base sm:text-lg font-bold tracking-tight text-stone-900">
            {eq.equipmentId}
          </p>
          <p className="text-xs sm:text-sm text-stone-500">{eq.type}</p>
        </div>
        <span className="grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-xl bg-cat-yellow/15 text-cat-ink">
          <Icon name="cube" className="h-5 w-5 sm:h-6 sm:w-6" />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 sm:gap-4 p-4 sm:p-5">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="text-stone-500">Site</span>
          <span className="font-medium text-stone-800">{eq.siteId || "Unassigned"}</span>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-stone-500">Engine vs idle (per day)</span>
            <span className="font-semibold text-stone-700">{util}% active</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-cat-yellow"
              style={{ width: `${util}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] sm:text-[11px] text-stone-400">
            <span>{eq.engineHoursPerDay}h engine</span>
            <span>{eq.idleHoursPerDay}h idle</span>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between pt-1 gap-2">
          <Badge status={eq.status} />
          <button onClick={onBook} className="btn btn-dark btn-sm text-xs font-bold px-3 py-2">
            Book equipment
          </button>
        </div>
      </div>
    </div>
  );
}
