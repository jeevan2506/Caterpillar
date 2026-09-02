const EquipmentTelemetry = require("../models/EquipmentTelemetry");
const Equipment = require("../models/Equipment");

let simulationTimer = null;

// Default site coordinates for live simulation
const SITE_COORDINATES = {
  S001: { lat: 37.7749, lng: -122.4194 },
  S002: { lat: 37.7833, lng: -122.4167 },
  S003: { lat: 37.7690, lng: -122.4467 },
  S004: { lat: 37.7900, lng: -122.4000 },
  S005: { lat: 37.7600, lng: -122.4300 },
  S006: { lat: 37.7550, lng: -122.4150 },
  Yard: { lat: 37.7700, lng: -122.4200 },
};

/**
 * Updates real-time telemetry records in MongoDB on a continuous live heartbeat.
 */
async function tickTelemetry() {
  try {
    const allEquipment = await Equipment.find();
    const now = new Date();

    for (const eq of allEquipment) {
      const siteKey = eq.siteId && SITE_COORDINATES[eq.siteId] ? eq.siteId : "Yard";
      const baseCoords = SITE_COORDINATES[siteKey] || SITE_COORDINATES.Yard;

      // Small jitter for realistic GPS motion if active
      const jitterLat = (Math.random() - 0.5) * 0.0005;
      const jitterLng = (Math.random() - 0.5) * 0.0005;

      const existing = await EquipmentTelemetry.findOne({ equipmentId: eq.equipmentId });

      if (eq.status === "active" || eq.status === "overdue") {
        // Machine is on site: simulate live operation
        const currentFuel = existing ? existing.fuelLevel : 95;
        const newFuel = Math.max(12, currentFuel - 0.02); // slowly consume fuel
        const fuelConsumed = Math.round((100 - newFuel) * 1.5);
        const currentEngine = existing ? existing.engineHours : (eq.engineHoursPerDay || 4.2);
        const currentIdle = existing ? existing.idleHours : (eq.idleHoursPerDay || 1.1);

        const isRunning = Math.random() > 0.25;

        await EquipmentTelemetry.findOneAndUpdate(
          { equipmentId: eq.equipmentId },
          {
            $set: {
              machineStatus: isRunning ? "running" : "idle",
              engineHours: Number((currentEngine + (isRunning ? 0.01 : 0)).toFixed(2)),
              idleHours: Number((currentIdle + (isRunning ? 0 : 0.01)).toFixed(2)),
              fuelLevel: Number(newFuel.toFixed(1)),
              fuelConsumed,
              latitude: Number((baseCoords.lat + jitterLat).toFixed(5)),
              longitude: Number((baseCoords.lng + jitterLng).toFixed(5)),
              siteId: eq.siteId || "S001",
              lastSeen: now,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } else {
        // Machine is in yard / depot (available or booked awaiting pickup)
        await EquipmentTelemetry.findOneAndUpdate(
          { equipmentId: eq.equipmentId },
          {
            $set: {
              machineStatus: "stopped",
              engineHours: existing?.engineHours || 0,
              idleHours: existing?.idleHours || 0,
              fuelLevel: 100,
              fuelConsumed: 0,
              latitude: baseCoords.lat,
              longitude: baseCoords.lng,
              siteId: eq.siteId || "Yard",
              lastSeen: now,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }
  } catch (err) {
    console.error("[Telemetry Service] Error ticking telemetry:", err.message);
  }
}

/**
 * Starts the live background telemetry streamer (ticks every 3 seconds).
 */
function startTelemetryStreamer() {
  if (simulationTimer) {
    clearInterval(simulationTimer);
  }

  console.log("[Telemetry Service] Live Real-Time IoT Telemetry Streamer started (3s interval).");
  tickTelemetry().catch(() => {});

  simulationTimer = setInterval(() => {
    tickTelemetry().catch(() => {});
  }, 3000);

  return simulationTimer;
}

function stopTelemetryStreamer() {
  if (simulationTimer) {
    clearInterval(simulationTimer);
    simulationTimer = null;
    console.log("[Telemetry Service] Telemetry Streamer stopped.");
  }
}

module.exports = {
  startTelemetryStreamer,
  stopTelemetryStreamer,
  tickTelemetry,
};
