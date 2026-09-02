const express = require("express");
const router = express.Router();
const QRCode = require("qrcode");

const Booking = require("../models/Booking");
const Equipment = require("../models/Equipment");
const Operator = require("../models/Operator");
const User = require("../models/User");

// Helper: make a QR code (data URL) that encodes ONLY the bookingId
async function makeQr(bookingId) {
  return QRCode.toDataURL(bookingId, { width: 300, margin: 2 });
}

// GET /api/bookings/all - Admin route to fetch all bookings (active, pending, completed history)
router.get("/all", async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });

    const result = await Promise.all(
      bookings.map(async (b) => {
        const equipment = await Equipment.findOne({ equipmentId: b.equipmentId });
        let operator = null;
        if (b.assignedOperatorId) {
          operator = await Operator.findOne({ operatorId: b.assignedOperatorId });
        }
        let user = null;
        if (b.userId) {
          user = await User.findOne({ userId: b.userId }, "userId name username phone role");
        }
        return { booking: b, equipment, operator, user };
      })
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch all bookings", error: err.message });
  }
});

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

    if (equipment.status !== "available") {
      return res
        .status(400)
        .json({ message: "Equipment is already booked or not available" });
    }

    const bookingId = "BOOK-" + Date.now();

    // Stage 1 & 2: User requests & completes payment.
    // Booking is stored as pending_approval; QR code is NOT issued until Admin approves.
    const booking = await Booking.create({
      bookingId,
      userId,
      equipmentId,
      operatorRequest,
      assignedOperatorId: null,
      rentalDays,
      paymentStatus: "paid",
      approvalStatus: "pending_approval",
      qrStatus: "unapproved",
    });

    equipment.status = "booked";
    await equipment.save();

    res.status(201).json({
      booking,
      qrCode: null,
      equipment,
      operator: null,
      message: "Payment received. Booking request submitted for Admin approval.",
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to create booking", error: err.message });
  }
});

// GET /api/bookings/pending/all - Admin route to fetch all pending requests
router.get("/pending/all", async (req, res) => {
  try {
    const pendingBookings = await Booking.find({
      approvalStatus: "pending_approval",
      qrStatus: { $nin: ["completed", "checked-out"] },
    }).sort({
      createdAt: -1,
    });

    const result = await Promise.all(
      pendingBookings.map(async (b) => {
        const equipment = await Equipment.findOne({ equipmentId: b.equipmentId });
        return { booking: b, equipment };
      })
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch pending bookings", error: err.message });
  }
});

// POST /api/bookings/:bookingId/approve - Admin approves booking
router.post("/:bookingId/approve", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { approvedBy, assignedOperatorId } = req.body;

    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.approvalStatus !== "pending_approval") {
      return res
        .status(400)
        .json({ message: `Booking is already ${booking.approvalStatus}` });
    }

    booking.approvalStatus = "approved";
    booking.qrStatus = "unused";
    booking.approvedAt = new Date();
    booking.approvedBy = approvedBy || "Admin";

    const equipment = await Equipment.findOne({ equipmentId: booking.equipmentId });

    if (assignedOperatorId && booking.operatorRequest === "caterpillar-assigned") {
      const op = await Operator.findOne({ operatorId: assignedOperatorId });
      if (op) {
        op.availabilityStatus = "assigned";
        await op.save();
        booking.assignedOperatorId = assignedOperatorId;
        if (equipment) {
          equipment.lastOperatorId = assignedOperatorId;
          equipment.operatorSource = "caterpillar-assigned";
        }
      }
    }

    await booking.save();
    if (equipment) await equipment.save();

    const qrCode = await makeQr(booking.bookingId);

    res.json({
      success: true,
      message: "Booking approved successfully. Dynamic QR is now active.",
      booking,
      qrCode,
      equipment,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to approve booking", error: err.message });
  }
});

// POST /api/bookings/:bookingId/reject - Admin rejects booking
router.post("/:bookingId/reject", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { rejectionReason } = req.body;

    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    booking.approvalStatus = "rejected";
    booking.paymentStatus = "refunded";
    booking.qrStatus = "unapproved";
    booking.rejectionReason = rejectionReason || "Rejected by administrator";
    await booking.save();

    // Release equipment back to available
    const equipment = await Equipment.findOne({ equipmentId: booking.equipmentId });
    if (equipment) {
      equipment.status = "available";
      await equipment.save();
    }

    res.json({
      success: true,
      message: "Booking rejected and refund processed. Equipment released to fleet.",
      booking,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to reject booking", error: err.message });
  }
});

// GET /api/bookings/:bookingId/dynamic-qr - Generate / Refresh dynamic QR for approved bookings
router.get("/:bookingId/dynamic-qr", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findOne({ bookingId });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.approvalStatus !== "approved") {
      return res.status(403).json({
        message: "QR code cannot be generated until booking is approved by Admin.",
      });
    }

    const qrCode = await makeQr(booking.bookingId);

    res.json({
      bookingId: booking.bookingId,
      qrCode,
      generatedAt: new Date().toISOString(),
      qrStatus: booking.qrStatus,
      approvalStatus: booking.approvalStatus,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to generate dynamic QR", error: err.message });
  }
});

// GET /api/bookings/:userId - Fetch user bookings
router.get("/:userId", async (req, res) => {
  try {
    const bookings = await Booking.find({
      userId: req.params.userId,
      qrStatus: { $nin: ["completed", "expired"] },
      approvalStatus: { $ne: "rejected" },
    }).sort({
      createdAt: -1,
    });

    const result = await Promise.all(
      bookings.map(async (b) => {
        const equipment = await Equipment.findOne({ equipmentId: b.equipmentId });
        let operator = null;
        if (b.assignedOperatorId) {
          operator = await Operator.findOne({ operatorId: b.assignedOperatorId });
        }
        // ONLY generate QR code if the booking is approved
        let qrCode = null;
        if (b.approvalStatus === "approved") {
          qrCode = await makeQr(b.bookingId);
        }
        return { booking: b, equipment, operator, qrCode };
      })
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch bookings", error: err.message });
  }
});

// GET /api/bookings/:userId/history - Fetch ALL bookings for a user (order history)
router.get("/:userId/history", async (req, res) => {
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
        return { booking: b, equipment, operator };
      })
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch order history", error: err.message });
  }
});

// POST /api/bookings/:bookingId/send-reminder-sms - Send remaining time SMS alert to customer
router.post("/:bookingId/send-reminder-sms", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { customPhone, customMessage } = req.body || {};

    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const equipment = await Equipment.findOne({ equipmentId: booking.equipmentId });
    const user = await User.findOne({
      $or: [{ userId: booking.userId }, { username: booking.userId }],
    });

    const targetPhone = customPhone || (user ? user.phone : null);
    if (!targetPhone) {
      return res.status(400).json({
        message: "Customer phone number is missing. Please enter a valid phone number.",
      });
    }

    const now = new Date();
    const expectedReturn = booking.expectedReturnDate
      ? new Date(booking.expectedReturnDate)
      : booking.checkOutDate
      ? new Date(new Date(booking.checkOutDate).getTime() + (booking.rentalDays || 7) * 86400000)
      : new Date(now.getTime() + (booking.rentalDays || 7) * 86400000);

    const diffMs = expectedReturn.getTime() - now.getTime();
    const { formatDuration } = require("../services/alertService");
    const { sendSms } = require("../services/smsService");

    const durationStr = formatDuration(Math.abs(diffMs));
    const equipmentType = equipment ? equipment.type : "Equipment";

    let message = customMessage;
    if (!message || !message.trim()) {
      if (diffMs < 0) {
        message = `Smart Rental Tracking: Your rental of ${booking.equipmentId} (${equipmentType}) is OVERDUE by ${durationStr}. Return date was ${expectedReturn.toLocaleDateString()}. Please return the vehicle immediately. Thank you.`;
      } else {
        message = `Smart Rental Tracking: Reminder \u2014 You have ${durationStr} remaining on your rental of ${booking.equipmentId} (${equipmentType}). Due date: ${expectedReturn.toLocaleDateString()}. Thank you.`;
      }
    }

    const smsResult = await sendSms({
      to: targetPhone,
      message,
    });

    booking.lastSmsStatus = smsResult.success ? "sent" : "failed";
    booking.lastSmsError = smsResult.success ? null : smsResult.error;
    if (diffMs < 0) {
      booking.overdueSmsSent = true;
      booking.overdueSmsSentAt = now;
    } else {
      booking.dueSoonSmsSent = true;
      booking.dueSoonSmsSentAt = now;
    }
    await booking.save();

    if (!smsResult.success) {
      return res.status(502).json({
        success: false,
        message: `Failed to dispatch SMS: ${smsResult.error || "Twilio error"}`,
        error: smsResult.error,
        details: { phone: targetPhone, message },
      });
    }

    res.json({
      success: true,
      message: `SMS alert successfully sent to ${targetPhone}.`,
      messageSid: smsResult.messageSid,
      details: {
        to: targetPhone,
        remainingTime: diffMs < 0 ? `Overdue by ${durationStr}` : `${durationStr} remaining`,
        expectedReturnDate: expectedReturn,
        message,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to send SMS alert", error: err.message });
  }
});

module.exports = router;
