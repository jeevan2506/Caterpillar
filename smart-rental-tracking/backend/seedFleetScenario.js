/**
 * seedFleetScenario.js — non-destructive demo scenario for the live fleet.
 *
 *   npm run seed:fleet
 *
 * Only touches the Equipment collection (no bookings / users / telemetry are
 * deleted). It sets engine/idle hours, operating days and operators so that:
 *
 *   • the Anomaly panel lights up with a spread of real flags
 *     (NEVER OPERATED, UNASSIGNED, UNDERUTILIZED), and
 *   • Fleet Rebalancing has idle machines to match against the demand-forecast
 *     shortages, so GET /api/rebalance returns an actual plan.
 *
 * EQX1001 is left healthy on purpose — it's the machine a customer has checked
 * out, used for the "report an issue" demo.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Equipment = require("./models/Equipment");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart-rental-tracking";

// equipmentId -> fields to set
const SCENARIO = {
  // In active use (checked out by USR001). Healthy utilisation, no anomaly.
  EQX1001: {
    siteId: "S005",
    lastOperatorId: "OP101",
    engineHoursPerDay: 6.5,
    idleHoursPerDay: 2,
    operatingDays: 5,
  },
  // Crane, never started + no operator on record.
  //  -> NEVER OPERATED (high) + UNASSIGNED
  //  -> rebalance: Crane S001 -> S002 (forecast Crane shortage)
  EQX1002: {
    siteId: "S001",
    lastOperatorId: null,
    engineHoursPerDay: 0,
    idleHoursPerDay: 11,
    operatingDays: 20,
    checkOutDate: new Date("2026-05-05"),
    checkInDate: new Date("2026-05-27"),
  },
  // Bulldozer, idle-heavy.  -> UNDERUTILIZED
  //  -> rebalance: Bulldozer S002 -> S001 (forecast Bulldozer shortage)
  EQX1003: {
    siteId: "S002",
    lastOperatorId: "OP203",
    engineHoursPerDay: 2.5,
    idleHoursPerDay: 8.5,
    operatingDays: 22,
    checkOutDate: new Date("2026-06-01"),
    checkInDate: new Date("2026-06-25"),
  },
  // Excavator, very idle.  -> UNDERUTILIZED (high)
  //  -> rebalance: Excavator S004 -> S003 (largest forecast shortage)
  EQX1004: {
    siteId: "S004",
    lastOperatorId: "OP106",
    engineHoursPerDay: 1.5,
    idleHoursPerDay: 10,
    operatingDays: 15,
    checkOutDate: new Date("2026-06-05"),
    checkInDate: new Date("2026-06-22"),
  },
  // Bulldozer, idle.  -> UNDERUTILIZED
  //  -> rebalance: Bulldozer S006 -> S005 (forecast Bulldozer shortage)
  EQX1005: {
    siteId: "S006",
    lastOperatorId: "OP301",
    engineHoursPerDay: 3,
    idleHoursPerDay: 7,
    operatingDays: 18,
    checkOutDate: new Date("2026-06-01"),
    checkInDate: new Date("2026-06-21"),
  },
  // Grader, healthy. No Grader shortage anywhere -> rebalance leaves it alone.
  // Acts as the "well-utilised, don't touch" control in the demo.
  EQX1006: {
    siteId: "S001",
    lastOperatorId: "OP114",
    engineHoursPerDay: 7.5,
    idleHoursPerDay: 1,
    operatingDays: 20,
    checkOutDate: new Date("2026-05-01"),
    checkInDate: new Date("2026-05-23"),
  },
  // Excavator, never started + no operator.
  //  -> NEVER OPERATED (high) + UNASSIGNED
  //  -> rebalance: Excavator S003 -> S004 (forecast Excavator shortage)
  EQX1007: {
    siteId: "S003",
    lastOperatorId: null,
    engineHoursPerDay: 0,
    idleHoursPerDay: 12,
    operatingDays: 12,
    checkOutDate: new Date("2026-06-10"),
    checkInDate: new Date("2026-06-24"),
  },
};

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected ->", MONGO_URI.replace(/\/\/[^@]*@/, "//***@"));

  let updated = 0;
  for (const [equipmentId, fields] of Object.entries(SCENARIO)) {
    const res = await Equipment.updateOne({ equipmentId }, { $set: fields });
    if (res.matchedCount === 0) {
      console.warn(`  ! ${equipmentId} not found — skipped`);
    } else {
      updated += 1;
      console.log(`  ✓ ${equipmentId}`);
    }
  }

  console.log(`\nDone. ${updated} equipment records updated.`);
  console.log("Bookings, users and telemetry were left untouched.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Fleet scenario seed failed:", err);
  process.exit(1);
});
