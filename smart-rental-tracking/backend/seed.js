require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const Equipment = require("./models/Equipment");
const Booking = require("./models/Booking");
const Maintenance = require("./models/Maintenance");
const User = require("./models/User");
const Operator = require("./models/Operator");
const EquipmentTelemetry = require("./models/EquipmentTelemetry");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart-rental-tracking";

const SALT_ROUNDS = 10;

const equipmentData = [
  {
    equipmentId: "EQX1001",
    type: "Excavator",
    siteId: "S003",
    status: "available",
    checkOutDate: null,
    checkInDate: null,
    engineHoursPerDay: 0,
    idleHoursPerDay: 0,
    operatingDays: 0,
    lastOperatorId: null,
  },
  {
    equipmentId: "EQX1002",
    type: "Crane",
    siteId: "S001",
    status: "available",
    checkOutDate: null,
    checkInDate: null,
    engineHoursPerDay: 0,
    idleHoursPerDay: 0,
    operatingDays: 0,
    lastOperatorId: null,
  },
  {
    equipmentId: "EQX1003",
    type: "Bulldozer",
    siteId: "S002",
    status: "available",
    checkOutDate: null,
    checkInDate: null,
    engineHoursPerDay: 0,
    idleHoursPerDay: 0,
    operatingDays: 0,
    lastOperatorId: null,
  },
  {
    equipmentId: "EQX1004",
    type: "Excavator",
    siteId: "S004",
    status: "available",
    checkOutDate: null,
    checkInDate: null,
    engineHoursPerDay: 0,
    idleHoursPerDay: 0,
    operatingDays: 0,
    lastOperatorId: null,
  },
  {
    equipmentId: "EQX1005",
    type: "Bulldozer",
    siteId: "S006",
    status: "available",
    checkOutDate: null,
    checkInDate: null,
    engineHoursPerDay: 0,
    idleHoursPerDay: 0,
    operatingDays: 0,
    lastOperatorId: null,
  },
  {
    equipmentId: "EQX1006",
    type: "Grader",
    siteId: "S001",
    status: "available",
    checkOutDate: null,
    checkInDate: null,
    engineHoursPerDay: 0,
    idleHoursPerDay: 0,
    operatingDays: 0,
    lastOperatorId: null,
  },
  {
    equipmentId: "EQX1007",
    type: "Excavator",
    siteId: "S003",
    status: "available",
    checkOutDate: null,
    checkInDate: null,
    engineHoursPerDay: 0,
    idleHoursPerDay: 0,
    operatingDays: 0,
    lastOperatorId: null,
  },
];

// Users with plain-text passwords — will be hashed before insertion
const rawUsers = [
  { userId: "USR001", username: "joy",   name: "Joy",   role: "user",     phone: "+919876543210", password: "tom123$"   },
  { userId: "USR002", username: "tom",   name: "Tom",   role: "user",     phone: "+919876543211", password: "tom123$"   },
  { userId: "ADM001", username: "jerry", name: "Jerry", role: "admin",    phone: "+919876543212", password: "jerry123$" },
  { userId: "OPR001",                    name: "Chris Bennett", role: "operator", phone: null }, // no login
];

const operatorData = [
  {
    operatorId: "OP101",
    name: "Ravi Kumar",
    certifiedEquipmentTypes: ["Excavator", "Grader"],
    availabilityStatus: "available",
  },
  {
    operatorId: "OP203",
    name: "Maria Gomez",
    certifiedEquipmentTypes: ["Bulldozer", "Crane"],
    availabilityStatus: "available",
  },
  {
    operatorId: "OP301",
    name: "Sam Lee",
    certifiedEquipmentTypes: ["Excavator", "Bulldozer", "Crane"],
    availabilityStatus: "available",
  },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  // Show which database is being seeded (helps catch local vs Atlas mix-ups)
  const target = MONGO_URI.replace(/\/\/[^@]*@/, "//***@");
  console.log("Connected for seeding ->", target);

  // Safely clear ALL old demo data (every collection the app writes to)
  await Promise.all([
    Equipment.deleteMany({}),
    Booking.deleteMany({}),
    Maintenance.deleteMany({}),
    User.deleteMany({}),
    Operator.deleteMany({}),
    EquipmentTelemetry.deleteMany({}),
  ]);
  console.log("Cleared old demo data");

  await Equipment.insertMany(equipmentData);

  // Hash passwords before inserting users
  const usersToInsert = await Promise.all(
    rawUsers.map(async (u) => {
      if (u.password) {
        const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);
        return { userId: u.userId, username: u.username, name: u.name, role: u.role, phone: u.phone, passwordHash };
      }
      // Operator — no username/password
      return { userId: u.userId, name: u.name, role: u.role, phone: u.phone };
    })
  );
  await User.insertMany(usersToInsert);
  console.log("Users seeded with hashed passwords");

  await Operator.insertMany(operatorData);

  const initialTelemetry = equipmentData.map((eq) => ({
    equipmentId: eq.equipmentId,
    machineStatus: "stopped",
    engineHours: 0,
    idleHours: 0,
    fuelLevel: 100,
    fuelConsumed: 0,
    siteId: eq.siteId,
    lastSeen: new Date(),
  }));
  await EquipmentTelemetry.insertMany(initialTelemetry);

  const maintenanceData = [
    {
      equipmentId: "EQX1002",
      issueReported: "Hydraulic pressure sensor inspection",
      reportedDate: new Date(),
      resolvedDate: null,
      downtimeHours: 0,
      technicianId: null,
      status: "pending",
    },
  ];
  await Maintenance.insertMany(maintenanceData);

  console.log("Seed complete:");
  console.log(`  ${equipmentData.length} equipment`);
  console.log(`  ${usersToInsert.length} users (with hashed passwords)`);
  console.log(`  ${operatorData.length} operators`);
  console.log(`  ${maintenanceData.length} maintenance records`);
  console.log(`  ${initialTelemetry.length} telemetry initial records`);

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
