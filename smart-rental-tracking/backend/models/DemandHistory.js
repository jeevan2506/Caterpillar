const mongoose = require("mongoose");

const demandHistorySchema = new mongoose.Schema(
  {
    record_id: { type: String, unique: true, index: true },
    date: { type: Date },
    month: { type: String },   // e.g. "2024-01"
    site_id: { type: String, index: true },
    site_type: { type: String },
    region: { type: String },
    climate_zone: { type: String },
    equipment_type: { type: String, index: true },
    project_phase: { type: String },
    units_requested: { type: Number },
    units_available: { type: Number },
    units_fulfilled: { type: Number },
    unmet_demand: { type: Number },
    avg_engine_hours_per_day: { type: Number },
    avg_idle_hours_per_day: { type: Number },
    utilization_rate: { type: Number },
  },
  { collection: "demand_history", timestamps: false }
);

module.exports = mongoose.model("DemandHistory", demandHistorySchema);
