const express = require("express");
const router = express.Router();

const Booking = require("../models/Booking");
const Equipment = require("../models/Equipment");
const Operator = require("../models/Operator");

// POST /api/scan/validate  { bookingId }
router.post("/validate", async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findOne({ bookingId });

    if (!booking) {
      return res.json({ success: false, message: "Invalid booking" });
    }

    if (booking.paymentStatus !== "paid") {
      return res.json({ success: false, message: "Payment not confirmed" });
    }

    const equipment = await Equipment.findOne({ equipmentId: booking.equipmentId });
    let operator = null;
    if (booking.assignedOperatorId) {
      operator = await Operator.findOne({ operatorId: booking.assignedOperatorId });
    }

    if (booking.qrStatus === "unused") {
      return res.json({
        success: true,
        action: "confirm-pickup",
        booking,
        equipment,
        operator,
      });
    }

    if (booking.qrStatus === "checked-out") {
      return res.json({
        success: true,
        action: "confirm-return",
        booking,
        equipment,
      });
    }

    // completed or expired
    return res.json({
      success: false,
      message: "Booking already completed/expired",
    });
  } catch (err) {
    res.status(500).json({ message: "Validation failed", error: err.message });
  }
});

// POST /api/scan/confirm-pickup  { bookingId, siteId, operatorId }
router.post("/confirm-pickup", async (req, res) => {
  try {
    const { bookingId, siteId, operatorId } = req.body;

    const booking = await Booking.findOne({ bookingId });
    if (!booking) return res.status(404).json({ message: "Invalid booking" });
    if (booking.qrStatus !== "unused") {
      return res.status(400).json({ message: "Booking is not ready for pickup" });
    }

    const equipment = await Equipment.findOne({ equipmentId: booking.equipmentId });
    if (!equipment) return res.status(404).json({ message: "Equipment not found" });

    const now = new Date();
    // Expected return = pickup time + the number of days the customer booked
    const expectedReturn = new Date(
      now.getTime() + (booking.rentalDays || 7) * 24 * 60 * 60 * 1000
    );

    booking.checkOutDate = now;
    booking.expectedReturnDate = expectedReturn;
    booking.qrStatus = "checked-out";

    equipment.checkOutDate = now;
    equipment.checkInDate = expectedReturn; // expected return date (drives overdue / due-soon)
    equipment.actualReturnDate = null;
    equipment.status = "active";
    if (siteId) equipment.siteId = siteId;

    // Operator handling — nothing is auto-assigned. Start clean each rental.
    equipment.lastOperatorId = null;
    equipment.operatorSource = null;
    if (operatorId) {
      if (booking.operatorRequest === "self") {
        // Customer's own operator — not tracked in our roster, just record the ID.
        equipment.lastOperatorId = operatorId;
        equipment.operatorSource = "self";
      } else {
        // Caterpillar operator picked by Admin — must be certified + available.
        const op = await Operator.findOne({ operatorId });
        if (!op) {
          return res.status(400).json({ message: `Operator ${operatorId} not found` });
        }
        if (!op.certifiedEquipmentTypes.includes(equipment.type)) {
          return res.status(400).json({
            message: `${op.name} is not certified for ${equipment.type}`,
          });
        }
        if (op.availabilityStatus !== "available") {
          return res.status(400).json({ message: `${op.name} is already assigned` });
        }
        op.availabilityStatus = "assigned";
        await op.save();
        booking.assignedOperatorId = op.operatorId;
        equipment.lastOperatorId = op.operatorId;
        equipment.operatorSource = "caterpillar-assigned";
      }
    }
    // If no operatorId was given, the machine goes out without an operator and
    // the Admin can assign one later via POST /api/scan/assign-operator.

    await booking.save();
    await equipment.save();

    res.json({ success: true, message: "Pickup confirmed", booking, equipment });
  } catch (err) {
    res.status(500).json({ message: "Failed to confirm pickup", error: err.message });
  }
});

// POST /api/scan/confirm-return  { bookingId }
router.post("/confirm-return", async (req, res) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findOne({ bookingId });
    if (!booking) return res.status(404).json({ message: "Invalid booking" });
    if (booking.qrStatus !== "checked-out") {
      return res.status(400).json({ message: "Booking is not checked out" });
    }

    const equipment = await Equipment.findOne({ equipmentId: booking.equipmentId });
    if (!equipment) return res.status(404).json({ message: "Equipment not found" });

    const now = new Date();

    booking.checkInDate = now; // actual return time
    booking.qrStatus = "completed";

    // keep equipment.checkInDate as the EXPECTED return date; record the actual one
    equipment.actualReturnDate = now;
    equipment.status = "available";

    if (equipment.operatorSource === "caterpillar-assigned" && booking.assignedOperatorId) {
      const operator = await Operator.findOne({ operatorId: booking.assignedOperatorId });
      if (operator) {
        operator.availabilityStatus = "available";
        await operator.save();
      }
    }

    await booking.save();
    await equipment.save();

    res.json({ success: true, message: "Return confirmed", booking, equipment });
  } catch (err) {
    res.status(500).json({ message: "Failed to confirm return", error: err.message });
  }
});

// POST /api/scan/assign-operator  { bookingId, operatorId }
// Admin assigns (or re-assigns) a Caterpillar operator to a booking. Only a
// certified + available operator can be chosen.
router.post("/assign-operator", async (req, res) => {
  try {
    const { bookingId, operatorId } = req.body;
    if (!bookingId || !operatorId) {
      return res.status(400).json({ message: "bookingId and operatorId are required" });
    }

    const booking = await Booking.findOne({ bookingId });
    if (!booking) return res.status(404).json({ message: "Invalid booking" });
    if (!["unused", "checked-out"].includes(booking.qrStatus)) {
      return res.status(400).json({ message: "Booking is not active" });
    }

    const equipment = await Equipment.findOne({ equipmentId: booking.equipmentId });
    if (!equipment) return res.status(404).json({ message: "Equipment not found" });

    const op = await Operator.findOne({ operatorId });
    if (!op) return res.status(400).json({ message: `Operator ${operatorId} not found` });
    if (!op.certifiedEquipmentTypes.includes(equipment.type)) {
      return res
        .status(400)
        .json({ message: `${op.name} is not certified for ${equipment.type}` });
    }
    if (op.availabilityStatus !== "available") {
      return res.status(400).json({ message: `${op.name} is already assigned` });
    }

    // Free the previously assigned operator, if any
    if (booking.assignedOperatorId && booking.assignedOperatorId !== operatorId) {
      const prev = await Operator.findOne({ operatorId: booking.assignedOperatorId });
      if (prev) {
        prev.availabilityStatus = "available";
        await prev.save();
      }
    }

    op.availabilityStatus = "assigned";
    await op.save();

    booking.assignedOperatorId = op.operatorId;
    booking.operatorRequest = "caterpillar-assigned";
    equipment.lastOperatorId = op.operatorId;
    equipment.operatorSource = "caterpillar-assigned";

    await booking.save();
    await equipment.save();

    res.json({ success: true, message: `Assigned ${op.name}`, booking, equipment, operator: op });
  } catch (err) {
    res.status(500).json({ message: "Failed to assign operator", error: err.message });
  }
});

module.exports = router;
