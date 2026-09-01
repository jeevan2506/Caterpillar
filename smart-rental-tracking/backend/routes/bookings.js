const express = require("express");
const router = express.Router();
const QRCode = require("qrcode");

const Booking = require("../models/Booking");
const Equipment = require("../models/Equipment");
const Operator = require("../models/Operator");

// Helper: make a QR code (data URL) that encodes ONLY the bookingId
async function makeQr(bookingId) {
  return QRCode.toDataURL(bookingId, { width: 300, margin: 2 });
}

// POST /api/bookings
router.post("/", async (req, res) => {
  try {
    const { userId, equipmentId, operatorRequest } = req.body;

    if (!userId || !equipmentId || !operatorRequest) {
      return res
        .status(400)
        .json({ message: "userId, equipmentId and operatorRequest are required" });
    }

    // How many days the customer wants the equipment (min 1, default 7)
    const rentalDays = Math.max(1, parseInt(req.body.rentalDays, 10) || 7);

    const equipment = await Equipment.findOne({ equipmentId });
    if (!equipment) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    // Operators are NOT auto-assigned at booking. If the customer wants a
    // Caterpillar operator, the Admin assigns a certified + available one at
    // (or after) pickup. "self" means the customer brings their own.
    const bookingId = "BOOK-" + Date.now();

    const booking = await Booking.create({
      bookingId,
      userId,
      equipmentId,
      operatorRequest,
      assignedOperatorId: null,
      rentalDays,
      paymentStatus: "paid", // mock payment
      qrStatus: "unused",
    });

    const qrCode = await makeQr(booking.bookingId);

    res.status(201).json({
      booking,
      qrCode,
      equipment,
      operator: null,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to create booking", error: err.message });
  }
});

// GET /api/bookings/:userId
router.get("/:userId", async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.params.userId }).sort({
      createdAt: -1,
    });

    const result = await Promise.all(
      bookings.map(async (b) => {
        const equipment = await Equipment.findOne({ equipmentId: b.equipmentId });
        let operator = null;
        if (b.assignedOperatorId) {
          operator = await Operator.findOne({ operatorId: b.assignedOperatorId });
        }
        const qrCode = await makeQr(b.bookingId);
        return { booking: b, equipment, operator, qrCode };
      })
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch bookings", error: err.message });
  }
});

module.exports = router;
