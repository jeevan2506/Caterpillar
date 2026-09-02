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

function getPossibleEquipmentIds(rawId) {
  if (!rawId) return [];
  const id = String(rawId).trim();
  const set = new Set([id, id.toUpperCase()]);

  // Handle EQ1001 <-> EQX1001 prefix mapping
  if (/^eq\d+$/i.test(id)) {
    const num = id.replace(/^eq/i, "");
    set.add(`EQX${num}`);
    set.add(`EQ${num}`);
  } else if (/^eqx\d+$/i.test(id)) {
    const num = id.replace(/^eqx/i, "");
    set.add(`EQ${num}`);
    set.add(`EQX${num}`);
  }

  return Array.from(set);
}

// POST /api/telemetry/:equipmentId (or POST /api/telemetry with equipmentId in body)
router.post("/:equipmentId?", async (req, res) => {
  try {
    const rawEquipmentId = req.params.equipmentId || req.body.equipmentId;

    if (!rawEquipmentId) {
      return res.status(400).json({
        success: false,
        message: "equipmentId is required",
      });
    }

    const possibleIds = getPossibleEquipmentIds(rawEquipmentId);
    let canonicalId = possibleIds[0];

    // Find if a matching equipment exists in master database
    const masterEq = await Equipment.findOne({ equipmentId: { $in: possibleIds } });
    if (masterEq) {
      canonicalId = masterEq.equipmentId;
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

    // Upsert telemetry record for canonical ID and any aliases
    const targetIds = Array.from(new Set([canonicalId, ...possibleIds]));
    let mainTelemetry = null;

    for (const eqId of targetIds) {
      const tel = await EquipmentTelemetry.findOneAndUpdate(
        { equipmentId: eqId },
        { $set: updateFields },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      if (eqId === canonicalId || !mainTelemetry) {
        mainTelemetry = tel;
      }
    }

    // If siteId is provided, sync with equipment master
    if (siteId) {
      await Equipment.updateMany(
        { equipmentId: { $in: targetIds } },
        { $set: { siteId } }
      ).catch(() => {});
    }

    const formatted = formatTelemetry(mainTelemetry);

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
    const possibleIds = getPossibleEquipmentIds(equipmentId);

    const telemetry = await EquipmentTelemetry.findOne({
      equipmentId: { $in: possibleIds },
    }).sort({ lastSeen: -1 });

    if (!telemetry) {
      // Check if equipment exists in master database to provide helpful context
      const equipment = await Equipment.findOne({ equipmentId: { $in: possibleIds } });
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
    const telemetries = await EquipmentTelemetry.find().sort({ lastSeen: -1 });
    const formattedList = telemetries.map(formatTelemetry);

    // Ensure aliases (EQ1001 <-> EQX1001) are also populated in the list
    const existingIds = new Set(formattedList.map((t) => t.equipmentId));
    const augmented = [...formattedList];

    formattedList.forEach((item) => {
      const possible = getPossibleEquipmentIds(item.equipmentId);
      possible.forEach((aliasId) => {
        if (!existingIds.has(aliasId)) {
          existingIds.add(aliasId);
          augmented.push({
            ...item,
            equipmentId: aliasId,
          });
        }
      });
    });

    return res.json(augmented);
  } catch (err) {
    return res.status(500).json({
      message: "Failed to fetch all telemetry records",
      error: err.message,
    });
  }
});

module.exports = router;
