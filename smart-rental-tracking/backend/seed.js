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
    equipmentId: "EQ1001",
    type: "Excavator",
    siteId: "S003",
    status: "available",
    checkOutDate: new Date("2025-04-01"),
    checkInDate: new Date("2025-04-16"),
    engineHoursPerDay: 1.5,
    idleHoursPerDay: 10,
    operatingDays: 15,
    lastOperatorId: "OP101",
  },
  {
    equipmentId: "EQ1002",
    type: "Crane",
    siteId: null,
    status: "available",
    checkOutDate: new Date("2025-03-10"),
    checkInDate: new Date("2025-03-30"),
    engineHoursPerDay: 0,
    idleHoursPerDay: 11,
    operatingDays: 20,
    lastOperatorId: null,
  },
  {
    equipmentId: "EQ1003",
    type: "Bulldozer",
    siteId: "S002",
    status: "available",
    checkOutDate: new Date("2025-02-15"),
    checkInDate: new Date("2025-03-11"),
    engineHoursPerDay: 7.5,
    idleHoursPerDay: 0.5,
    operatingDays: 25,
    lastOperatorId: "OP203",
  },
  {
    equipmentId: "EQ1004",
    type: "Excavator",
    siteId: "S004",
    status: "available",
    checkOutDate: new Date("2025-05-05"),
    checkInDate: new Date("2025-05-15"),
    engineHoursPerDay: 2,
    idleHoursPerDay: 9,
    operatingDays: 10,
    lastOperatorId: "OP106",
  },
  {
    equipmentId: "EQ1005",
    type: "Bulldozer",
    siteId: "S006",
    status: "available",
    checkOutDate: new Date("2025-01-01"),
    checkInDate: new Date("2025-01-31"),
    engineHoursPerDay: 8,
    idleHoursPerDay: 0,
    operatingDays: 30,
    lastOperatorId: "OP301",
  },
  {
    equipmentId: "EQ1006",
    type: "Grader",
    siteId: "S001",
    status: "available",
    checkOutDate: new Date("2025-04-05"),
    checkInDate: new Date("2025-04-23"),
    engineHoursPerDay: 3,
    idleHoursPerDay: 6,
    operatingDays: 18,
    lastOperatorId: "OP114",
  },
  {
    equipmentId: "EQ1007",
    type: "Excavator",
    siteId: null,
    status: "available",
    checkOutDate: new Date("2025-03-20"),
    checkInDate: new Date("2025-04-01"),
    engineHoursPerDay: 0,
    idleHoursPerDay: 12,
    operatingDays: 12,
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

  const maintenanceData = [
    {
      equipmentId: "EQ1002",
      issueReported: "Hydraulic leak in boom cylinder",
      reportedDate: new Date("2025-04-02"),
      resolvedDate: null,
      downtimeHours: 0,
      technicianId: null,
      status: "pending",
    },
    {
      equipmentId: "EQ1005",
      issueReported: "Engine overheating under load",
      reportedDate: new Date("2025-02-05"),
      resolvedDate: new Date("2025-02-07"),
      downtimeHours: 12,
      technicianId: "TECH01",
      status: "resolved",
    },
    {
      equipmentId: "EQ1001",
      issueReported: "Track misalignment causing uneven wear",
      reportedDate: new Date("2025-04-18"),
      resolvedDate: null,
      downtimeHours: 4,
      technicianId: "TECH02",
      status: "in-progress",
    },
  ];
  await Maintenance.insertMany(maintenanceData);

  console.log("Seed complete:");
  console.log(`  ${equipmentData.length} equipment`);
  console.log(`  ${usersToInsert.length} users (with hashed passwords)`);
  console.log(`  ${operatorData.length} operators`);
  console.log(`  ${maintenanceData.length} maintenance records`);

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
