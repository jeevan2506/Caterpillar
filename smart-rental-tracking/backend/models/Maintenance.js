const mongoose = require("mongoose");

const maintenanceSchema = new mongoose.Schema({
  equipmentId: { type: String, required: true, ref: "Equipment" },
  issueReported: { type: String },
  reportedDate: { type: Date, default: Date.now },
  resolvedDate: { type: Date, default: null },
  downtimeHours: { type: Number, default: 0 },
  technicianId: { type: String, default: null },
  status: {
    type: String,
    enum: ["pending", "in-progress", "resolved"],
    default: "pending",
  },
  // Where the report came from — "admin" (default) or "customer" (raised from
  // My Bookings while the machine is checked out).
  source: { type: String, enum: ["admin", "customer"], default: "admin" },
  reportedBy: { type: String, default: null },
  bookingId: { type: String, default: null },
  severity: { type: String, enum: ["low", "medium", "high", null], default: null },
});

module.exports = mongoose.model("Maintenance", maintenanceSchema);
