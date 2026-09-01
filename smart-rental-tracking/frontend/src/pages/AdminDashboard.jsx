import { useState, useEffect } from "react";
import Header from "../components/Header.jsx";
import AdminScanner from "../components/AdminScanner.jsx";
import EquipmentTable from "../components/EquipmentTable.jsx";
import AnomalyPanel from "../components/AnomalyPanel.jsx";
import MaintenancePanel from "../components/MaintenancePanel.jsx";
import DemandInsights from "../components/DemandInsights.jsx";
import DemandForecast from "../components/DemandForecast.jsx";
import OperatorTable from "../components/OperatorTable.jsx";
import ChatWidget from "../components/ChatWidget.jsx";
import LiveTelemetryMonitor from "../components/LiveTelemetryMonitor.jsx";
import Icon from "../components/Icon.jsx";
import { Loading, Alert } from "../components/ui.jsx";
import { getContext } from "../services/api.js";
import { getSession } from "../services/auth.js";
import { displayStatus, getAnomalies } from "../utils/helpers.js";

const NAV = [
  { label: "Dashboard", icon: "grid" },
  { label: "Live Telemetry", icon: "activity" },
  { label: "QR Scanner", icon: "scan" },
  { label: "Equipment", icon: "cube" },
  { label: "Anomalies", icon: "alert" },
  { label: "Maintenance", icon: "wrench" },
  { label: "Demand Insights", icon: "chart" },
  { label: "Demand Forecasting", icon: "chart" },
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
      getAnomalies(eq, { telemetry: telMap[eq.equipmentId], maintenance: data.maintenance })
        .length,
    0
  );
  const activeCount = data.equipment.filter((eq) => displayStatus(eq) === "active").length;
  const overdueCount = data.equipment.filter((eq) => displayStatus(eq) === "overdue").length;
  const dueSoonCount = data.equipment.filter((eq) => displayStatus(eq) === "due-soon").length;
  const offlineCount = (data.telemetry || []).filter(
    (t) => t.connectionStatus === "offline"
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
        {/* Sidebar */}
        {menuOpen && (
          <div
            className="fixed inset-0 z-10 bg-black/30 md:hidden"
            onClick={() => setMenuOpen(false)}
          />
        )}
        <aside
          className={`${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          } fixed left-0 top-16 z-10 h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-stone-200 bg-white p-3 transition-transform md:sticky md:translate-x-0`}
        >
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
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    on
                      ? "bg-cat-ink text-white"
                      : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  <Icon
                    name={n.icon}
                    className={`h-[18px] w-[18px] ${on ? "text-cat-yellow" : ""}`}
                  />
                  {n.label}
                  {n.label === "Anomalies" && anomalyCount > 0 && (
                    <span className="ml-auto rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                      {anomalyCount}
                    </span>
                  )}
                  {n.label === "Maintenance" && pendingMaint > 0 && (
                    <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                      {pendingMaint}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 space-y-6 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-stone-900">
              {tab}
            </h2>
            <button onClick={load} className="btn btn-ghost btn-sm">
              <Icon name="spark" className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {error && <Alert>{error}</Alert>}
          {loading && <Loading label="Loading console…" />}

          {!loading && tab === "Dashboard" && (
            <div className="space-y-6">
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Total equipment" value={data.equipment.length} icon="cube" />
                <StatCard label="Active rentals" value={activeCount} icon="scan" />
                <StatCard label="Due soon" value={dueSoonCount} icon="alert" tone="amber" />
                <StatCard label="Overdue" value={overdueCount} icon="alert" tone="red" />
                <StatCard label="Machines offline" value={offlineCount} icon="activity" tone="red" />
                <StatCard label="Open anomalies" value={anomalyCount} icon="alert" tone="red" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="card p-5">
                <AnomalyPanel
                equipment={data.equipment}
                telemetry={data.telemetry}
                maintenance={data.maintenance}
              />
              </div>
            </div>
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
            <DemandForecast />
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
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          {label}
        </p>
        <span
          className={`grid h-8 w-8 place-items-center rounded-lg ${
            red
              ? "bg-red-50 text-red-500"
              : amber
              ? "bg-amber-50 text-amber-500"
              : "bg-stone-100 text-stone-400"
          }`}
        >
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
      <p
        className={`mt-2 font-display text-3xl font-extrabold tracking-tight ${
          red ? "text-red-600" : amber ? "text-amber-600" : "text-stone-900"
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
