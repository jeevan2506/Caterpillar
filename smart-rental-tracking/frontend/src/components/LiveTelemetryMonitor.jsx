import { useState, useEffect, useRef } from "react";
import Icon from "./Icon.jsx";
import { getAllTelemetry } from "../services/api.js";

export default function LiveTelemetryMonitor({ equipment = [] }) {
  const [selectedId, setSelectedId] = useState("EQX1001");
  const [telemetryMap, setTelemetryMap] = useState({});
  const [now, setNow] = useState(Date.now());
  const [autoPoll] = useState(true);
  const pollIntervalRef = useRef(null);
  const reqSeqRef = useRef(0);
  // Display equipped / active machinery on rent, or fall back to available fleet
  const equippedList = equipment.filter(
    (e) => e.status === "active" || e.status === "overdue"
  );
  const displayList = equippedList.length > 0 ? equippedList : equipment;
  const equippedEqIds = displayList.length > 0
    ? displayList.map((e) => e.equipmentId)
    : ["EQX1001", "EQX1002", "EQX1003", "EQX1004", "EQX1005", "EQX1006", "EQX1007"];

  // Keep selectedId in sync with equipped machines
  useEffect(() => {
    if (equippedEqIds.length > 0 && (!selectedId || !equippedEqIds.includes(selectedId))) {
      setSelectedId(equippedEqIds[0]);
    }
  }, [equippedEqIds, selectedId]);

  // Fetch telemetry for all machines. Responses can arrive out of order, so
  // tag each request and ignore any that isn't the latest — otherwise a slow
  // response can overwrite fresher data and make the status flicker.
  async function fetchLiveTelemetry() {
    const seq = ++reqSeqRef.current;
    try {
      const res = await getAllTelemetry();
      if (seq !== reqSeqRef.current) return; // a newer request already returned
      const newMap = {};
      if (Array.isArray(res.data)) {
        res.data.forEach((item) => {
          if (item && item.equipmentId) {
            newMap[item.equipmentId] = item;
            if (item.equipmentId.startsWith("EQ") && !item.equipmentId.startsWith("EQX")) {
              newMap["EQX" + item.equipmentId.slice(2)] = item;
            } else if (item.equipmentId.startsWith("EQX")) {
              newMap["EQ" + item.equipmentId.slice(3)] = item;
            }
          }
        });
      }
      setTelemetryMap(newMap);
    } catch (err) {
      console.error("Failed to fetch live telemetry:", err);
    }
  }

  // 1-second timer to update "X seconds ago" relative time display smoothly
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll every 2s so the displayed "last heartbeat" stays close to real time
  useEffect(() => {
    fetchLiveTelemetry();

    if (autoPoll) {
      pollIntervalRef.current = setInterval(() => {
        fetchLiveTelemetry();
      }, 2000);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [autoPoll]);

  if (equippedList.length === 0) {
    return (
      <div className="card overflow-hidden border-stone-200/90 shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-stone-100 bg-stone-50/80 px-5 py-3.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-cat-yellow/20 text-cat-ink">
            <Icon name="activity" className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold tracking-tight text-stone-900">
                LIVE EQUIPMENT TELEMETRY MONITOR
              </h3>
              <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Standby Mode
              </span>
            </div>
            <p className="text-xs text-stone-400">
              Real-time machine IoT health, connection state, and telematics metrics.
            </p>
          </div>
        </div>

        <div className="grid place-items-center px-6 py-16 text-center">
          <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-500/20">
            <Icon name="cube" className="h-7 w-7" />
          </div>
          <h4 className="font-display text-base font-bold text-stone-800">
            No Active / Equipped Vehicles on Rent
          </h4>
          <p className="mt-1.5 max-w-md text-xs text-stone-500">
            Telemetry is only monitored for equipment actively checked out to job sites. Unrented units resting in the inventory depot do not transmit telemetric data.
          </p>
          <div className="mt-4 rounded-xl bg-stone-50 px-4 py-2 text-xs text-stone-600 border border-stone-200">
            💡 <span className="font-semibold">Tip:</span> Confirm a pickup in <span className="font-bold text-stone-800">QR Scanner</span> to deploy a vehicle and initiate live IoT monitoring.
          </div>
        </div>
      </div>
    );
  }

  const activeTelemetry = telemetryMap[selectedId];
  const selectedEquipmentInfo = equipment.find((e) => e.equipmentId === selectedId);

  // Calculate dynamic online status and seconds ago
  const lastSeenDate = activeTelemetry?.lastSeen ? new Date(activeTelemetry.lastSeen) : null;
  const secondsAgo = lastSeenDate ? Math.max(0, Math.floor((now - lastSeenDate.getTime()) / 1000)) : null;
  const timeoutThreshold = activeTelemetry?.timeoutThresholdSeconds || 10;
  const isOnline = lastSeenDate !== null && secondsAgo !== null && secondsAgo <= timeoutThreshold;

  const machineState = isOnline
    ? (activeTelemetry?.machineStatus || "running")
    : "unknown";

  const engineHours = activeTelemetry?.engineHours ?? selectedEquipmentInfo?.engineHoursPerDay ?? 0;
  const idleHours = activeTelemetry?.idleHours ?? selectedEquipmentInfo?.idleHoursPerDay ?? 0;
  const fuelLevel = activeTelemetry?.fuelLevel ?? null;
  const fuelConsumed = activeTelemetry?.fuelConsumed ?? 0;
  const location =
    activeTelemetry?.latitude != null && activeTelemetry?.longitude != null
      ? `${activeTelemetry.latitude.toFixed(4)}, ${activeTelemetry.longitude.toFixed(4)}`
      : null;
  const fuelColor =
    fuelLevel == null
      ? "bg-stone-300"
      : fuelLevel < 15
      ? "bg-red-500"
      : fuelLevel < 40
      ? "bg-amber-500"
      : "bg-emerald-500";
  const siteId = activeTelemetry?.siteId || selectedEquipmentInfo?.siteId || "—";
  const equipmentType = selectedEquipmentInfo?.type || activeTelemetry?.equipmentType || "Excavator";

  return (
    <div className="card overflow-hidden border-stone-200/90 shadow-sm">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/80 px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cat-yellow/20 text-cat-ink">
            <Icon name="activity" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xs sm:text-sm font-bold tracking-tight text-stone-900">
                LIVE EQUIPMENT TELEMETRY MONITOR
              </h3>
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live 3s Polling
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-stone-400 truncate">
              Real-time machine IoT health, connection state, and telematics metrics.
            </p>
          </div>
        </div>

        {/* Equipment Selector Horizontal Swipeable Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
          {equippedEqIds.map((id) => {
            const eqTelem = telemetryMap[id];
            const eqLastSeen = eqTelem?.lastSeen ? new Date(eqTelem.lastSeen) : null;
            const eqSecAgo = eqLastSeen ? Math.floor((now - eqLastSeen.getTime()) / 1000) : null;
            const eqOnline = eqSecAgo !== null && eqSecAgo <= timeoutThreshold;

            return (
              <button
                key={id}
                onClick={() => setSelectedId(id)}
                className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold shrink-0 transition min-h-[32px] ${
                  selectedId === id
                    ? "bg-cat-ink text-white shadow-sm"
                    : "bg-white text-stone-600 ring-1 ring-inset ring-stone-200 hover:bg-stone-50"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    eqOnline ? "bg-emerald-500 animate-pulse" : "bg-stone-300"
                  }`}
                />
                {id}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Telemetry Panel */}
      <div className="p-3.5 sm:p-5">
        <div className="grid gap-5 sm:gap-6 lg:grid-cols-[1.3fr_1fr]">
          {/* Main Selected Equipment Card */}
          <div
            className={`relative rounded-2xl border p-4 sm:p-5 transition-all ${
              isOnline
                ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50/30 via-white to-stone-50/50 shadow-sm"
                : "border-red-200/80 bg-gradient-to-br from-red-50/20 via-white to-stone-50/50 shadow-sm"
            }`}
          >
            {/* Header / Equipment Identity & Online Status */}
            <div className="flex flex-wrap items-start justify-between gap-3 pb-3.5 sm:pb-4 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div
                  className={`grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-xl font-bold shrink-0 ${
                    isOnline
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-stone-100 text-stone-600"
                  }`}
                >
                  <Icon name="cube" className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-stone-900">
                      {selectedId}
                    </h4>
                    <span className="text-stone-400 font-medium">—</span>
                    <span className="text-xs sm:text-sm font-semibold text-stone-700">
                      {equipmentType}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-stone-500 flex items-center gap-1.5 mt-0.5">
                    <span className="font-semibold text-stone-400 uppercase tracking-wider text-[10px]">Site:</span>
                    <span className="font-semibold text-stone-800 bg-stone-100 px-1.5 py-0.5 rounded">
                      {siteId}
                    </span>
                  </p>
                </div>
              </div>

              {/* Status Pill */}
              <div className="flex flex-col items-start sm:items-end gap-1">
                {isOnline ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-white shadow-sm ring-2 ring-emerald-300">
                    <span className="h-2 w-2 animate-ping rounded-full bg-white" />
                    🟢 ONLINE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-white shadow-sm ring-2 ring-red-300">
                    <span className="h-2 w-2 rounded-full bg-white/80" />
                    🔴 OFFLINE
                  </span>
                )}
                <span className="text-[10px] sm:text-[11px] font-medium text-stone-400">
                  {secondsAgo !== null
                    ? `Last heartbeat: ${secondsAgo}s ago`
                    : "No heartbeat received"}
                </span>
              </div>
            </div>

            {/* Offline Alert Box */}
            {!isOnline && (
              <div className="my-4 rounded-xl border border-red-200 bg-red-50/90 p-4 text-red-800">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-100 text-red-600">
                    <Icon name="alert" className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-display text-sm font-bold text-red-900 uppercase tracking-wide">
                      🚨 TELEMETRY CONNECTION LOST
                    </p>
                    <p className="text-xs text-red-700 mt-0.5">
                      {secondsAgo !== null
                        ? `No telemetry received for ${secondsAgo}s (timeout threshold: ${timeoutThreshold}s). Machine is offline or simulator paused.`
                        : "No active telemetric connection established for this equipment."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Live Metrics Grid */}
            <div className="mt-4 grid gap-3 grid-cols-2 lg:grid-cols-4">
              {/* Machine State */}
              <div className="rounded-xl border border-stone-200/80 bg-white p-3.5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Machine State
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {machineState === "running" && (
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700">
                      🟢 RUNNING
                    </span>
                  )}
                  {machineState === "idle" && (
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-600">
                      🟡 IDLE
                    </span>
                  )}
                  {machineState === "stopped" && (
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-stone-600">
                      ⚪ STOPPED
                    </span>
                  )}
                  {machineState === "unknown" && (
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-stone-400">
                      ⚫ UNKNOWN
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-stone-400 mt-1">
                  {isOnline ? "Operational engine load" : "Last known status"}
                </p>
              </div>

              {/* Engine Hours */}
              <div className="rounded-xl border border-stone-200/80 bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                    Engine Hours
                  </p>
                  <Icon name="gauge" className="h-3.5 w-3.5 text-stone-400" />
                </div>
                <p className="mt-1 font-display text-xl font-extrabold text-stone-900">
                  {engineHours}{" "}
                  <span className="text-xs font-semibold text-stone-400">hrs</span>
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  Live operating time
                </p>
              </div>

              {/* Idle Hours */}
              <div className="rounded-xl border border-stone-200/80 bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                    Idle Hours
                  </p>
                  <Icon name="wrench" className="h-3.5 w-3.5 text-stone-400" />
                </div>
                <p className="mt-1 font-display text-xl font-extrabold text-stone-900">
                  {idleHours}{" "}
                  <span className="text-xs font-semibold text-stone-400">hrs</span>
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  Standby / idle time
                </p>
              </div>

              {/* Fuel */}
              <div className="rounded-xl border border-stone-200/80 bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                    Fuel
                  </p>
                  <Icon name="fuel" className="h-3.5 w-3.5 text-stone-400" />
                </div>
                <p className="mt-1 font-display text-xl font-extrabold text-stone-900">
                  {fuelLevel != null ? Math.round(fuelLevel) : "—"}
                  {fuelLevel != null && (
                    <span className="text-xs font-semibold text-stone-400">%</span>
                  )}
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`h-full rounded-full ${fuelColor}`}
                    style={{ width: `${fuelLevel != null ? Math.max(2, fuelLevel) : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-stone-400 mt-1">
                  {fuelConsumed}L used this session
                </p>
              </div>
            </div>

            {location && (
              <p className="mt-2 text-[11px] text-stone-400">
                📍 Location: <span className="font-medium text-stone-600">{location}</span>
                {" · "}Site {siteId}
              </p>
            )}

            {/* Bottom Status Ribbon */}
            <div className="mt-4 flex flex-wrap items-center justify-between border-t border-stone-100 pt-3 text-xs text-stone-500">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE TELEMETRY STREAM ACTIVE
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 font-semibold text-stone-400">
                    <span className="h-2 w-2 rounded-full bg-stone-300" />
                    STREAM INACTIVE
                  </span>
                )}
              </div>
              <div className="text-[11px] text-stone-400">
                {lastSeenDate ? (
                  <span>
                    Last recorded: <span className="font-medium text-stone-600">{lastSeenDate.toLocaleTimeString()}</span>
                  </span>
                ) : (
                  <span>Awaiting initial ping</span>
                )}
              </div>
            </div>
          </div>

          {/* Fleet Health Snapshot */}
          <div className="flex flex-col justify-between rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="font-display text-sm font-bold tracking-tight text-stone-900 uppercase">
                  Telematics Fleet Overview
                </h4>
                <button
                  onClick={fetchLiveTelemetry}
                  className="btn btn-ghost btn-sm text-[11px] px-2 py-1"
                >
                  <Icon name="spark" className="h-3 w-3" />
                  Sync
                </button>
              </div>
              <p className="mt-1 text-xs text-stone-400">
                Live heartbeat summary across all monitored machinery.
              </p>

              {/* Fleet List */}
              <div className="mt-4 space-y-2">
                {equippedEqIds.map((id) => {
                  const eqData = equipment.find((e) => e.equipmentId === id);
                  const telem = telemetryMap[id];
                  const telemLastSeen = telem?.lastSeen ? new Date(telem.lastSeen) : null;
                  const telemSecAgo = telemLastSeen ? Math.floor((now - telemLastSeen.getTime()) / 1000) : null;
                  const telemOnline = telemSecAgo !== null && telemSecAgo <= timeoutThreshold;

                  return (
                    <div
                      key={id}
                      onClick={() => setSelectedId(id)}
                      className={`flex cursor-pointer items-center justify-between rounded-xl p-2.5 transition ${
                        selectedId === id
                          ? "bg-cat-yellow/15 ring-1 ring-cat-yellow/40"
                          : "hover:bg-stone-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            telemOnline ? "bg-emerald-500 animate-pulse" : "bg-stone-300"
                          }`}
                        />
                        <div>
                          <p className="font-display text-xs font-bold text-stone-900">
                            {id}{" "}
                            <span className="font-normal text-stone-500">
                              · {eqData?.type || telem?.equipmentType || "Equipment"}
                            </span>
                          </p>
                          <p className="text-[10px] text-stone-400">
                            Site {telem?.siteId || eqData?.siteId || "—"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        {telemOnline ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                            ONLINE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-500">
                            OFFLINE
                          </span>
                        )}
                        <p className="text-[10px] text-stone-400 mt-0.5">
                          {telemSecAgo !== null ? `${telemSecAgo}s ago` : "—"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
