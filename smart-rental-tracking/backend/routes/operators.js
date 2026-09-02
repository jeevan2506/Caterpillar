const express = require("express");
const router = express.Router();
const Operator = require("../models/Operator");
const Booking = require("../models/Booking");

// GET /api/operators?type=Excavator
// Returns operators certified for the type AND currently available.
// Without a type it returns all operators (used by the Admin operators panel).
router.get("/", async (req, res) => {
  try {
    const { type } = req.query;

    // Determine operators actively assigned to active rentals
    const activeBookings = await Booking.find({
      qrStatus: { $in: ["unused", "checked-out"] },
      approvalStatus: { $ne: "rejected" },
      assignedOperatorId: { $ne: null },
    }).select("assignedOperatorId");

    const assignedOpIds = new Set(
      activeBookings.map((b) => b.assignedOperatorId).filter(Boolean)
    );

    // Sync database state so availability matches active assignments
    const all = await Operator.find().sort({ operatorId: 1 });
    for (const op of all) {
      const shouldBeAssigned = assignedOpIds.has(op.operatorId);
      const expectedStatus = shouldBeAssigned ? "assigned" : "available";
      if (op.availabilityStatus !== expectedStatus) {
        op.availabilityStatus = expectedStatus;
        await op.save();
      }
    }

    if (!type) {
      return res.json(all);
    }

    const filtered = all.filter(
      (op) =>
        op.certifiedEquipmentTypes.includes(type) &&
        op.availabilityStatus === "available"
    );

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch operators", error: err.message });
  }
});

// POST /api/operators
// Creates a new operator
router.post("/", async (req, res) => {
  try {
    const { operatorId, name, certifiedEquipmentTypes, availabilityStatus } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Operator name is required." });
    }

    let finalOperatorId = operatorId && operatorId.trim() ? operatorId.trim().toUpperCase() : null;

    if (!finalOperatorId) {
      const count = await Operator.countDocuments();
      finalOperatorId = `OP${100 + count + 1}`;
    }

    const existing = await Operator.findOne({ operatorId: finalOperatorId });
    if (existing) {
      return res.status(400).json({ message: `Operator ID ${finalOperatorId} already exists.` });
    }

    let types = [];
    if (Array.isArray(certifiedEquipmentTypes)) {
      types = certifiedEquipmentTypes.map((s) => String(s).trim()).filter(Boolean);
    } else if (typeof certifiedEquipmentTypes === "string") {
      types = certifiedEquipmentTypes.split(",").map((s) => s.trim()).filter(Boolean);
    }

    if (types.length === 0) {
      types = ["Excavator"]; // default if none specified
    }

    const op = new Operator({
      operatorId: finalOperatorId,
      name: name.trim(),
      certifiedEquipmentTypes: types,
      availabilityStatus: availabilityStatus || "available",
    });

    await op.save();
    return res.status(201).json(op);
  } catch (err) {
    return res.status(500).json({ message: "Failed to create operator", error: err.message });
  }
});

module.exports = router;
