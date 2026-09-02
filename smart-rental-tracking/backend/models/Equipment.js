const mongoose = require("mongoose");

const equipmentSchema = new mongoose.Schema({
  equipmentId: { type: String, unique: true, required: true },
  type: {
    type: String,
    enum: ["Excavator", "Crane", "Bulldozer", "Grader"],
    required: true,
  },
  siteId: { type: String, default: null },
  status: {
    type: String,
    enum: ["available", "booked", "active", "overdue"],
    default: "available",
  },
  checkOutDate: { type: Date, default: null },
  checkInDate: { type: Date, default: null },
  actualReturnDate: { type: Date, default: null },
  engineHoursPerDay: { type: Number, default: 0 },
  idleHoursPerDay: { type: Number, default: 0 },
  operatingDays: { type: Number, default: 0 },
  lastOperatorId: { type: String, default: null },
  operatorSource: {
    type: String,
    enum: ["self", "caterpillar-assigned", null],
    default: null,
  },
});

module.exports = mongoose.model("Equipment", equipmentSchema);
