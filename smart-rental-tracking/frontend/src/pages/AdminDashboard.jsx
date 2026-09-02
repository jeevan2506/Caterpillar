import { useState, useEffect, lazy, Suspense } from "react";
import Header from "../components/Header.jsx";
import AdminScanner from "../components/AdminScanner.jsx";
import EquipmentTable from "../components/EquipmentTable.jsx";
import AnomalyPanel from "../components/AnomalyPanel.jsx";
import MaintenancePanel from "../components/MaintenancePanel.jsx";
import DemandInsights from "../components/DemandInsights.jsx";
import OperatorTable from "../components/OperatorTable.jsx";
import ChatWidget from "../components/ChatWidget.jsx";
import LiveTelemetryMonitor from "../components/LiveTelemetryMonitor.jsx";
import Icon from "./../components/Icon.jsx";
import { Loading, Alert } from "../components/ui.jsx";

// Heavy / rarely-first screens — loaded on demand so the initial bundle stays small.
const DemandForecast = lazy(() => import("../components/DemandForecast.jsx"));
const Rebalance = lazy(() => import("../components/Rebalance.jsx"));
const BookingApprovals = lazy(() => import("../components/BookingApprovals.jsx"));
const RentalsManagement = lazy(() => import("../components/RentalsManagement.jsx"));
import { getContext } from "../services/api.js";
import { getSession } from "../services/auth.js";
import { displayStatus, getAnomalies, fmtDate } from "../utils/helpers.js";

const NAV = [
  { label: "Dashboard", icon: "grid" },
  { label: "Vehicle Rentals", icon: "cube" },
  { label: "Approvals", icon: "check" },
  { label: "Live Telemetry", icon: "activity" },
  { label: "QR Scanner", icon: "scan" },
  { label: "Equipment", icon: "cube" },
  { label: "Anomalies", icon: "alert" },
  { label: "Maintenance", icon: "wrench" },
  { label: "Demand Insights", icon: "chart" },
  { label: "Demand Forecasting", icon: "chart" },
  { label: "Rebalancing", icon: "radio" },
  { label: "Operators", icon: "users" },
];

export default function AdminDashboard() {
  const session = getSession();
  const [tab, setTab] = useState("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [data, setData] = useState({
    equipment: [],
    bookings: [],
    operators: [],
    maintenance: [],
    telemetry: [],
    users: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await getContext();
      setData(res.data);
    } catch {
      setError("Could not load dashboard data. Make sure the backend is running on port 5000.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const telMap = {};
  (data.telemetry || []).forEach((t) => {
    telMap[t.equipmentId] = t;
  });

  const anomalyCount = data.equipment.reduce(
    (n, eq) =>
      n +
      getAnomalies(eq, {
        telemetry: telMap[eq.equipmentId],
        maintenance: data.maintenance,
        bookings: data.bookings,
      }).length,
    0
  );
  const pendingApprovalsCount = (data.bookings || []).filter(
    (b) =>
      b.approvalStatus === "pending_approval" &&
      b.qrStatus !== "completed" &&
      b.qrStatus !== "checked-out"
  ).length;
  const bookedCount = data.equipment.filter((eq) => displayStatus(eq) === "booked").length;
  const activeCount = data.equipment.filter((eq) => displayStatus(eq) === "active").length;
  const overdueCount = data.equipment.filter((eq) => displayStatus(eq) === "overdue").length;
  const dueSoonCount = data.equipment.filter((eq) => displayStatus(eq) === "due-soon").length;
  const activeRentalsCount = (data.bookings || []).filter(
    (b) => b.qrStatus === "checked-out"
  ).length;
  const activeEqIds = new Set(
    data.equipment
      .filter((eq) => eq.status === "active" || eq.status === "overdue")
      .map((eq) => eq.equipmentId)
  );
  const offlineCount = (data.telemetry || []).filter(
    (t) => activeEqIds.has(t.equipmentId) && t.connectionStatus === "offline"
  ).length;
  const pendingMaint = data.maintenance.filter((m) => m.status !== "resolved").length;
  const availableOps = data.operators.filter((o) => o.availabilityStatus === "available").length;

  function pick(t) {
    setTab(t);
    setMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#f6f5f3]">
      <Header
        title="Smart Rental Tracking"
        subtitle="Admin console"
        name={session?.name}
        role={session?.role}
        onMenu={() => setMenuOpen((o) => !o)}
      />

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar Backdrop & Drawer on Mobile */}
        {menuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden transition-opacity"
            onClick={() => setMenuOpen(false)}
          />
        )}
        <aside
          className={`${
            menuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
          } fixed left-0 top-0 z-50 h-full w-72 max-w-[85vw] shrink-0 overflow-y-auto border-r border-stone-200 bg-white p-4 transition-transform duration-200 ease-in-out md:sticky md:top-16 md:z-10 md:h-fit md:max-h-[calc(100vh-4rem)] md:w-64 md:translate-x-0 md:self-start md:border-b md:rounded-br-2xl md:p-3 md:shadow-none`}
        >
          <div className="flex items-center justify-between pb-3 md:hidden border-b border-stone-100 mb-2">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-cat-ink font-display text-xs font-extrabold text-cat-yellow">
                CAT
              </div>
              <span className="font-display text-sm font-bold text-stone-900">Admin Console</span>
            </div>
            <button
              onClick={() => setMenuOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              aria-label="Close menu"
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>

          <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            Navigation
          </p>
          <nav className="space-y-1">
            {NAV.map((n) => {
              const on = tab === n.label;
              return (
                <button
                  key={n.label}
                  onClick={() => pick(n.label)}
                  className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 ${
                    on
                      ? "bg-gradient-to-b from-[#262320] to-cat-ink text-white shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_6px_16px_-8px_rgba(0,0,0,0.4)]"
                      : "text-stone-600 hover:bg-stone-900/[0.04] hover:text-stone-900 active:bg-stone-900/[0.07]"
                  }`}
                >
                  <Icon
                    name={n.icon}
                    className={`h-[18px] w-[18px] shrink-0 transition-colors ${on ? "text-cat-yellow" : "text-stone-400"}`}
                  />
                  <span className="truncate">{n.label}</span>
                  {n.label === "Vehicle Rentals" && activeRentalsCount > 0 && (
                    <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 shrink-0">
                      {activeRentalsCount} active
                    </span>
                  )}
                  {n.label === "Approvals" && pendingApprovalsCount > 0 && (
                    <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 shrink-0">
                      {pendingApprovalsCount}
                    </span>
                  )}
                  {n.label === "Anomalies" && anomalyCount > 0 && (
                    <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 shrink-0">
                      {anomalyCount}
                    </span>
                  )}
                  {n.label === "Maintenance" && pendingMaint > 0 && (
                    <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 shrink-0">
                      {pendingMaint}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 space-y-5 p-3.5 sm:p-6 overflow-x-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-stone-900">
              {tab}
            </h2>
            <button onClick={load} className="btn btn-ghost btn-sm text-xs flex items-center gap-1.5">
              <Icon name="spark" className="h-3.5 w-3.5 text-amber-600" />
              <span>Refresh</span>
            </button>
          </div>

          {error && <Alert>{error}</Alert>}
          {loading && <Loading label="Loading console…" />}

          {!loading && tab === "Dashboard" && (
            <div className="space-y-5 sm:space-y-6">
              <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                <StatCard label="Total equipment" value={data.equipment.length} icon="cube" />
                <StatCard label="Pending Approvals" value={pendingApprovalsCount} icon="check" tone={pendingApprovalsCount > 0 ? "amber" : null} />
                <StatCard label="Booked (Approved)" value={bookedCount} icon="scan" tone={bookedCount > 0 ? "purple" : null} />
                <StatCard label="Active rentals" value={activeCount} icon="scan" tone={activeCount > 0 ? "blue" : null} />
                <StatCard label="Due soon" value={dueSoonCount} icon="alert" tone="amber" />
                <StatCard label="Overdue" value={overdueCount} icon="alert" tone="red" />
                <StatCard label="Machines offline" value={offlineCount} icon="activity" tone="red" />
                <StatCard label="Open anomalies" value={anomalyCount} icon="alert" tone="red" />
              </div>

              {/* Quick Rentals & Vehicle Status Summary */}
              <div className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3 mb-4">
                  <div>
                    <h3 className="section-title text-sm sm:text-base font-bold text-stone-900">
                      Vehicle Rentals & Fleet Check-Out / Check-In Status
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Live status of active checkouts, fleet in yard, and rental records.
                    </p>
                  </div>
                  <button
                    onClick={() => setTab("Vehicle Rentals")}
                    className="btn btn-dark btn-sm text-xs font-bold px-3 py-1.5 flex items-center gap-1"
                  >
                    <span>View All Vehicle Rentals & History</span>
                    <span>→</span>
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div
                    onClick={() => setTab("Vehicle Rentals")}
                    className="cursor-pointer rounded-xl border border-blue-200 bg-blue-50/40 p-4 transition hover:shadow-md hover:border-blue-300"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                        Checked-Out (On Site)
                      </span>
                      <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                    </div>
                    <p className="font-display text-3xl font-black text-blue-950 mt-2">
                      {activeRentalsCount}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Vehicles currently dispatched to client worksites.
                    </p>
                  </div>

                  <div
                    onClick={() => setTab("Vehicle Rentals")}
                    className="cursor-pointer rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 transition hover:shadow-md hover:border-emerald-300"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                        Checked-In (Fleet Yard)
                      </span>
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    </div>
                    <p className="font-display text-3xl font-black text-emerald-950 mt-2">
                      {data.equipment.filter((eq) => eq.status === "available").length}
                    </p>
                    <p className="text-xs text-emerald-700 mt-1">
                      Available machines returned to depot, ready for rent.
                    </p>
                  </div>

                  <div
                    onClick={() => setTab("Vehicle Rentals")}
                    className="cursor-pointer rounded-xl border border-stone-200 bg-stone-50 p-4 transition hover:shadow-md hover:border-stone-300"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                        Previously Rented
                      </span>
                      <span className="h-2 w-2 rounded-full bg-stone-400" />
                    </div>
                    <p className="font-display text-3xl font-black text-stone-900 mt-2">
                      {(data.bookings || []).filter((b) => b.qrStatus === "completed").length}
                    </p>
                    <p className="text-xs text-stone-500 mt-1">
                      Total completed historical rental logs on file.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                <MiniPanel
                  title="Maintenance"
                  primary={`${pendingMaint} open`}
                  secondary={`${data.maintenance.length} records total`}
                  icon="wrench"
                />
                <MiniPanel
                  title="Operators"
                  primary={`${availableOps} available`}
                  secondary={`${data.operators.length} on roster`}
                  icon="users"
                />
              </div>

              <div className="card p-4 sm:p-5">
                <AnomalyPanel
                  equipment={data.equipment}
                  telemetry={data.telemetry}
                  maintenance={data.maintenance}
                  bookings={data.bookings}
                />
              </div>
            </div>
          )}

          {!loading && tab === "Vehicle Rentals" && (
            <Suspense fallback={<Loading label="Loading rentals…" />}>
              <RentalsManagement
                equipment={data.equipment}
                bookings={data.bookings}
                operators={data.operators}
                telemetry={data.telemetry}
                users={data.users}
                onRefresh={load}
              />
            </Suspense>
          )}

          {!loading && tab === "Approvals" && (
            <Suspense fallback={<Loading label="Loading approvals…" />}>
              <BookingApprovals onApproved={load} />
            </Suspense>
          )}

          {!loading && tab === "Live Telemetry" && (
            <div className="space-y-6">
              <LiveTelemetryMonitor equipment={data.equipment} />
            </div>
          )}

          {!loading && tab === "QR Scanner" && <AdminScanner onChange={load} />}

          {!loading && tab === "Equipment" && (
            <EquipmentTable equipment={data.equipment} />
          )}

          {!loading && tab === "Anomalies" && (
            <div className="card p-5">
              <AnomalyPanel
                equipment={data.equipment}
                telemetry={data.telemetry}
                maintenance={data.maintenance}
                bookings={data.bookings}
              />
            </div>
          )}

          {!loading && tab === "Maintenance" && <MaintenancePanel />}

          {!loading && tab === "Demand Insights" && (
            <DemandInsights
              equipment={data.equipment}
              telemetry={data.telemetry}
              maintenance={data.maintenance}
            />
          )}

          {tab === "Demand Forecasting" && (
            <Suspense fallback={<Loading label="Loading forecast…" />}>
              <DemandForecast />
            </Suspense>
          )}

          {tab === "Rebalancing" && (
            <Suspense fallback={<Loading label="Loading rebalancing…" />}>
              <Rebalance />
            </Suspense>
          )}

          {!loading && tab === "Operators" && (
            <OperatorTable
              operators={data.operators}
              bookings={data.bookings}
              equipment={data.equipment}
              onChange={load}
            />
          )}
        </main>
      </div>

      <ChatWidget />
    </div>
  );
}

function StatCard({ label, value, icon, tone }) {
  const active = tone && value > 0;
  const red = tone === "red" && active;
  const amber = tone === "amber" && active;
  const purple = tone === "purple" && active;
  return (
    <div
      className={`card relative flex flex-col justify-between overflow-hidden p-3.5 sm:p-4 ${
        active ? "border-stone-300/60" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-[3px] ${
          red ? "bg-red-500" : amber ? "bg-amber-500" : purple ? "bg-purple-500" : active ? "bg-cat-yellow" : "bg-stone-200"
        }`}
      />
      <div className="flex items-start justify-between gap-1">
        <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.09em] text-stone-400 sm:text-[11px]">
          {label}
        </p>
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg sm:h-8 sm:w-8 ${
            red
              ? "bg-red-50 text-red-500"
              : amber
              ? "bg-amber-50 text-amber-500"
              : purple
              ? "bg-purple-50 text-purple-600"
              : "bg-stone-100 text-stone-400"
          }`}
        >
          <Icon name={icon} className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </span>
      </div>
      <p
        className={`mt-2 font-display text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl ${
          red ? "text-red-600" : amber ? "text-amber-600" : purple ? "text-purple-700" : "text-stone-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function MiniPanel({ title, primary, secondary, icon }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-cat-yellow/15 text-cat-ink">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          {title}
        </p>
        <p className="font-display text-lg font-bold text-stone-900">{primary}</p>
        <p className="text-xs text-stone-400">{secondary}</p>
      </div>
    </div>
  );
}
