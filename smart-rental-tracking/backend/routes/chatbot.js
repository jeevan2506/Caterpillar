const express = require("express");
const router = express.Router();

const Equipment = require("../models/Equipment");
const Maintenance = require("../models/Maintenance");
const Booking = require("../models/Booking");
const Operator = require("../models/Operator");
const EquipmentTelemetry = require("../models/EquipmentTelemetry");
const { buildSummary: buildForecastSummary } = require("./forecast");

const getTimeoutSeconds = () =>
  parseInt(process.env.TELEMETRY_TIMEOUT_SECONDS || "10", 10);

// GET /api/chatbot-context
// Combined snapshot consumed by the n8n chatbot workflow.
router.get("/chatbot-context", async (req, res) => {
  try {
    const [equipment, maintenance, bookings, operators, rawTelemetry] =
      await Promise.all([
        Equipment.find(),
        Maintenance.find(),
        Booking.find(),
        Operator.find(),
        EquipmentTelemetry.find(),
      ]);

    const timeoutSec = getTimeoutSeconds();
    const now = Date.now();

    const telemetry = rawTelemetry.map((t) => {
      const obj = t.toObject ? t.toObject() : { ...t };
      const lastSeenMs = obj.lastSeen ? new Date(obj.lastSeen).getTime() : 0;
      const diffSec = lastSeenMs > 0 ? Math.floor((now - lastSeenMs) / 1000) : null;
      const isOnline = diffSec !== null && diffSec <= timeoutSec;
      return {
        ...obj,
        connectionStatus: isOnline ? "online" : "offline",
        offlineDurationSeconds: isOnline ? 0 : diffSec,
      };
    });

    let demandForecast = null;
    try {
      demandForecast = await buildForecastSummary();
    } catch (e) {
      console.warn("forecast unavailable for chatbot-context:", e.message);
    }

    res.json({ equipment, maintenance, bookings, operators, telemetry, demandForecast });
  } catch (err) {
    res.status(500).json({ message: "Failed to build chatbot context", error: err.message });
  }
});

module.exports = router;
