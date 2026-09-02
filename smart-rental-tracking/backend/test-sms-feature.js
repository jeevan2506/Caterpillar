require("dotenv").config();
const mongoose = require("mongoose");
const { normalizePhoneNumber, sendSms } = require("./services/smsService");
const { formatDuration, checkRentalAlerts } = require("./services/alertService");
const Booking = require("./models/Booking");
const Equipment = require("./models/Equipment");
const User = require("./models/User");

async function runTests() {
  console.log("==================================================");
  console.log("STARTING SMS NOTIFICATION FEATURE INTEGRATION TESTS");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // TEST 1: Phone Normalization
  console.log("\n--- TEST 1: Phone Number Normalization ---");
  assert(normalizePhoneNumber("9876543210") === "+919876543210", "10-digit Indian number converts to +919876543210");
  assert(normalizePhoneNumber("09876543210") === "+919876543210", "11-digit number with leading 0 converts to +919876543210");
  assert(normalizePhoneNumber("+91 98765 43210") === "+919876543210", "Formatted +91 with spaces cleans properly");
  assert(normalizePhoneNumber("+18547770158") === "+18547770158", "US E.164 number preserved");
  assert(normalizePhoneNumber("invalid") === null, "Invalid text string returns null");
  assert(normalizePhoneNumber("") === null, "Empty string returns null");
  assert(normalizePhoneNumber(null) === null, "Null returns null");

  // TEST 2: Duration Formatting
  console.log("\n--- TEST 2: Duration Formatting ---");
  assert(formatDuration(45 * 60 * 1000) === "45 minutes", "45 mins formatted as '45 minutes'");
  assert(formatDuration(60 * 60 * 1000) === "1 hour", "60 mins formatted as '1 hour'");
  assert(formatDuration(120 * 60 * 1000) === "2 hours", "120 mins formatted as '2 hours'");
  assert(formatDuration(135 * 60 * 1000) === "2 hours 15 minutes", "135 mins formatted as '2 hours 15 minutes'");
  assert(formatDuration(26 * 60 * 60 * 1000) === "1 day 2 hours", "26 hours formatted as '1 day 2 hours'");
  assert(formatDuration(48 * 60 * 60 * 1000) === "2 days", "48 hours formatted as '2 days'");

  // Connect to DB for Live Integration Tests
  console.log("\n--- CONNECTING TO DATABASE FOR LIFECYCLE TESTS ---");
  const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart-rental-tracking";
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const testUserOverdue = await User.findOneAndUpdate(
    { userId: "TEST_USR_OVERDUE" },
    {
      userId: "TEST_USR_OVERDUE",
      username: "test_overdue",
      name: "Test Overdue User",
      role: "user",
      phone: "+919876543210",
    },
    { upsert: true, new: true }
  );

  const testUserDueSoon = await User.findOneAndUpdate(
    { userId: "TEST_USR_DUESOON" },
    {
      userId: "TEST_USR_DUESOON",
      username: "test_duesoon",
      name: "Test Due Soon User",
      role: "user",
      phone: "+919876543211",
    },
    { upsert: true, new: true }
  );

  const testUserNoPhone = await User.findOneAndUpdate(
    { userId: "TEST_USR_NOPHONE" },
    {
      userId: "TEST_USR_NOPHONE",
      username: "test_nophone",
      name: "Test No Phone User",
      role: "user",
      phone: null,
    },
    { upsert: true, new: true }
  );

  const now = new Date();

  // Test Booking A: Normal (Return in 5 days) -> No SMS
  const bookingNormal = await Booking.findOneAndUpdate(
    { bookingId: "TEST-BOOK-NORMAL" },
    {
      bookingId: "TEST-BOOK-NORMAL",
      userId: "TEST_USR_OVERDUE",
      equipmentId: "EQX1001",
      qrStatus: "checked-out",
      checkOutDate: now,
      expectedReturnDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      overdueSmsSent: false,
      dueSoonSmsSent: false,
    },
    { upsert: true, new: true }
  );

  // Test Booking B: Due-soon (Return in 30 minutes)
  const bookingDueSoon = await Booking.findOneAndUpdate(
    { bookingId: "TEST-BOOK-DUESOON" },
    {
      bookingId: "TEST-BOOK-DUESOON",
      userId: "TEST_USR_DUESOON",
      equipmentId: "EQX1002",
      qrStatus: "checked-out",
      checkOutDate: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      expectedReturnDate: new Date(now.getTime() + 30 * 60 * 1000), // due in 30 mins
      overdueSmsSent: false,
      dueSoonSmsSent: false,
    },
    { upsert: true, new: true }
  );

  // Test Booking C: Overdue (Return was 2 hours ago)
  const bookingOverdue = await Booking.findOneAndUpdate(
    { bookingId: "TEST-BOOK-OVERDUE" },
    {
      bookingId: "TEST-BOOK-OVERDUE",
      userId: "TEST_USR_OVERDUE",
      equipmentId: "EQX1003",
      qrStatus: "checked-out",
      checkOutDate: new Date(now.getTime() - 26 * 60 * 60 * 1000),
      expectedReturnDate: new Date(now.getTime() - 2 * 60 * 60 * 1000), // overdue by 2 hours
      overdueSmsSent: false,
      dueSoonSmsSent: false,
    },
    { upsert: true, new: true }
  );

  // Test Booking D: Overdue but missing phone
  const bookingNoPhone = await Booking.findOneAndUpdate(
    { bookingId: "TEST-BOOK-NOPHONE" },
    {
      bookingId: "TEST-BOOK-NOPHONE",
      userId: "TEST_USR_NOPHONE",
      equipmentId: "EQX1004",
      qrStatus: "checked-out",
      checkOutDate: new Date(now.getTime() - 26 * 60 * 60 * 1000),
      expectedReturnDate: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      overdueSmsSent: false,
      dueSoonSmsSent: false,
    },
    { upsert: true, new: true }
  );

  console.log("\n--- TEST 3: Alert Check Cycle 1 (Dispatches Due-Soon & Overdue) ---");
  const result1 = await checkRentalAlerts();
  console.log("Check result 1:", result1);

  const updatedNormal1 = await Booking.findOne({ bookingId: "TEST-BOOK-NORMAL" });
  assert(!updatedNormal1.overdueSmsSent && !updatedNormal1.dueSoonSmsSent, "Normal rental did NOT receive any SMS");

  const updatedDueSoon1 = await Booking.findOne({ bookingId: "TEST-BOOK-DUESOON" });
  assert(updatedDueSoon1.dueSoonSmsSent === true, "Due-soon rental marked dueSoonSmsSent = true");
  assert(updatedDueSoon1.dueSoonSmsSentAt !== null, "Due-soon timestamp recorded");

  const updatedOverdue1 = await Booking.findOne({ bookingId: "TEST-BOOK-OVERDUE" });
  assert(updatedOverdue1.overdueSmsSent === true, "Overdue rental marked overdueSmsSent = true");
  assert(updatedOverdue1.overdueSmsSentAt !== null, "Overdue timestamp recorded");

  const updatedNoPhone1 = await Booking.findOne({ bookingId: "TEST-BOOK-NOPHONE" });
  assert(updatedNoPhone1.lastSmsStatus === "failed", "Missing phone safely recorded lastSmsStatus = 'failed' without server crash");

  console.log("\n--- TEST 4: Duplicate Prevention on Repeated Checker Execution ---");
  const result2 = await checkRentalAlerts();
  console.log("Check result 2 (duplicate check):", result2);
  assert(result2.overdueSent === 0, "No duplicate overdue SMS dispatched on second run");
  assert(result2.dueSoonSent === 0, "No duplicate due-soon SMS dispatched on second run");

  console.log("\n--- TEST 5: Return Stops Future Overdue Notifications ---");
  updatedOverdue1.qrStatus = "completed";
  updatedOverdue1.checkInDate = new Date();
  await updatedOverdue1.save();

  const result3 = await checkRentalAlerts();
  assert(result3.overdueSent === 0, "Completed/returned booking ignored by alert service");

  // Cleanup test documents
  console.log("\n--- CLEANING UP TEST DATA ---");
  await Booking.deleteMany({ bookingId: { $regex: /^TEST-BOOK-/ } });
  await User.deleteMany({ userId: { $regex: /^TEST_USR_/ } });
  console.log("Cleaned test data from database.");

  await mongoose.disconnect();

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
