const mongoose = require("mongoose");

const equipmentTelemetrySchema = new mongoose.Schema(
  {
    equipmentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    machineStatus: {
      type: String,
      enum: ["running", "idle", "stopped", "unknown"],
      default: "unknown",
    },
    engineHours: {
      type: Number,
      default: 0,
    },
    idleHours: {
      type: Number,
      default: 0,
    },
    fuelLevel: {
      type: Number,
      default: 100,
    },
    fuelConsumed: {
      type: Number,
      default: 0,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    siteId: {
      type: String,
      default: null,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EquipmentTelemetry", equipmentTelemetrySchema);
