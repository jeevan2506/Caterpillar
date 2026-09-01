const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, unique: true, required: true },
  userId: { type: String, required: true },
  equipmentId: { type: String, required: true, ref: "Equipment" },
  paymentStatus: {
    type: String,
    enum: ["paid", "pending", "refunded"],
    default: "pending",
  },
  qrStatus: {
    type: String,
    enum: ["unused", "checked-out", "completed", "expired"],
    default: "unused",
  },
  operatorRequest: {
    type: String,
    enum: ["self", "caterpillar-assigned"],
  },
  assignedOperatorId: { type: String, default: null },
  rentalDays: { type: Number, default: 7, min: 1 },
  checkOutDate: { type: Date, default: null },
  expectedReturnDate: { type: Date, default: null },
  checkInDate: { type: Date, default: null },
  overdueSmsSent: { type: Boolean, default: false },
  overdueSmsSentAt: { type: Date, default: null },
  dueSoonSmsSent: { type: Boolean, default: false },
  dueSoonSmsSentAt: { type: Date, default: null },
  lastSmsStatus: {
    type: String,
    enum: ["sent", "failed", null],
    default: null,
  },
  lastSmsError: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Booking", bookingSchema);
