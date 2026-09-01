const express = require("express");
const router = express.Router();
const EquipmentTelemetry = require("../models/EquipmentTelemetry");
const Equipment = require("../models/Equipment");

// Configurable timeout threshold in seconds (default: 10s)
const getTimeoutSeconds = () =>
  parseInt(process.env.TELEMETRY_TIMEOUT_SECONDS || "10", 10);

// Helper function to format telemetry and compute dynamic connection status
function formatTelemetry(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const timeoutSec = getTimeoutSeconds();
  const now = Date.now();
  const lastSeenMs = obj.lastSeen ? new Date(obj.lastSeen).getTime() : 0;
  const diffSec = lastSeenMs > 0 ? Math.floor((now - lastSeenMs) / 1000) : null;
  const isOnline = diffSec !== null && diffSec <= timeoutSec;

  return {
    ...obj,
    connectionStatus: isOnline ? "online" : "offline",
    offlineDurationSeconds: isOnline ? 0 : diffSec,
    timeoutThresholdSeconds: timeoutSec,
  };
}

// POST /api/telemetry/:equipmentId (or POST /api/telemetry with equipmentId in body)
router.post("/:equipmentId?", async (req, res) => {
  try {
    const equipmentId = req.params.equipmentId || req.body.equipmentId;

    if (!equipmentId) {
      return res.status(400).json({
        success: false,
        message: "equipmentId is required",
      });
    }

    const {
      machineStatus = "running",
      engineHours,
      idleHours,
      fuelLevel,
      fuelConsumed,
      latitude,
      longitude,
      siteId,
    } = req.body;

    // Validate machine status enum
    const validStatuses = ["running", "idle", "stopped", "unknown"];
    const statusToSave = validStatuses.includes(machineStatus)
      ? machineStatus
      : "unknown";

    const updateFields = {
      machineStatus: statusToSave,
      lastSeen: new Date(),
    };

    if (engineHours !== undefined && engineHours !== null && !isNaN(engineHours)) {
      updateFields.engineHours = Number(engineHours);
    }
    if (idleHours !== undefined && idleHours !== null && !isNaN(idleHours)) {
      updateFields.idleHours = Number(idleHours);
    }
    if (fuelLevel !== undefined && fuelLevel !== null && !isNaN(fuelLevel)) {
      updateFields.fuelLevel = Number(fuelLevel);
    }
    if (fuelConsumed !== undefined && fuelConsumed !== null && !isNaN(fuelConsumed)) {
      updateFields.fuelConsumed = Number(fuelConsumed);
    }
    if (latitude !== undefined && latitude !== null && !isNaN(latitude)) {
      updateFields.latitude = Number(latitude);
    }
    if (longitude !== undefined && longitude !== null && !isNaN(longitude)) {
      updateFields.longitude = Number(longitude);
    }
    if (siteId !== undefined) {
      updateFields.siteId = siteId;
    }

    // Upsert telemetry record
    const telemetry = await EquipmentTelemetry.findOneAndUpdate(
      { equipmentId },
      { $set: updateFields },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // If siteId is provided, optionally sync with equipment master
    if (siteId) {
      await Equipment.findOneAndUpdate(
        { equipmentId },
        { $set: { siteId } }
      ).catch(() => {});
    }

    const formatted = formatTelemetry(telemetry);

    return res.status(200).json({
      success: true,
      message: "Telemetry updated successfully",
      data: formatted,
    });
  } catch (err) {
    console.error("Telemetry update error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update telemetry",
      error: err.message,
    });
  }
});

// GET /api/telemetry/:equipmentId
router.get("/:equipmentId", async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const telemetry = await EquipmentTelemetry.findOne({ equipmentId });

    if (!telemetry) {
      // Check if equipment exists in master database to provide helpful context
      const equipment = await Equipment.findOne({ equipmentId });
      const timeoutSec = getTimeoutSeconds();

      return res.json({
        equipmentId,
        machineStatus: "unknown",
        engineHours: equipment ? equipment.engineHoursPerDay : 0,
        idleHours: equipment ? equipment.idleHoursPerDay : 0,
        fuelLevel: 0,
        siteId: equipment ? equipment.siteId : null,
        lastSeen: null,
        connectionStatus: "offline",
        offlineDurationSeconds: null,
        timeoutThresholdSeconds: timeoutSec,
        equipmentType: equipment ? equipment.type : null,
      });
    }

    return res.json(formatTelemetry(telemetry));
  } catch (err) {
    return res.status(500).json({
      message: "Failed to fetch telemetry",
      error: err.message,
    });
  }
});

// GET /api/telemetry
router.get("/", async (req, res) => {
  try {
    const telemetries = await EquipmentTelemetry.find();
    const formattedList = telemetries.map(formatTelemetry);
    return res.json(formattedList);
  } catch (err) {
    return res.status(500).json({
      message: "Failed to fetch all telemetry records",
      error: err.message,
    });
  }
});

module.exports = router;
