const Booking = require("../models/Booking");
const Equipment = require("../models/Equipment");
const User = require("../models/User");
const { sendSms } = require("./smsService");

/**
 * Formats a millisecond duration into a clean, human-readable string.
 * Examples: "45 minutes", "1 hour", "2 hours 15 minutes", "1 day 3 hours".
 * Avoids raw decimal values such as 0.05 hours.
 * 
 * @param {number} diffMs - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
function formatDuration(diffMs) {
  const totalMinutes = Math.max(1, Math.round(Math.abs(diffMs) / (60 * 1000)));

  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (totalHours < 24) {
    if (remainingMinutes === 0) {
      return `${totalHours} hour${totalHours === 1 ? "" : "s"}`;
    }
    return `${totalHours} hour${totalHours === 1 ? "" : "s"} ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"
      }`;
  }

  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;

  if (remainingHours === 0) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  return `${days} day${days === 1 ? "" : "s"} ${remainingHours} hour${remainingHours === 1 ? "" : "s"
    }`;
}

/**
 * Checks all active bookings and dispatches Due-Soon or Overdue SMS alerts.
 * Ensures duplicate prevention by tracking sent flags directly on the booking document.
 */
async function checkRentalAlerts() {
  try {
    const now = new Date();

    // Due soon threshold in minutes (default 60 min / 1 hour)
    const dueSoonMinutes = parseInt(process.env.DUE_SOON_THRESHOLD_MINUTES || "60", 10);
    const dueSoonThresholdMs = dueSoonMinutes * 60 * 1000;

    // Find all checked-out (active) bookings that have an expected return date
    const activeBookings = await Booking.find({
      qrStatus: "checked-out",
      expectedReturnDate: { $ne: null },
    });

    if (!activeBookings.length) {
      return { checked: 0, overdueSent: 0, dueSoonSent: 0 };
    }

    let overdueSentCount = 0;
    let dueSoonSentCount = 0;

    for (const booking of activeBookings) {
      const expectedReturn = new Date(booking.expectedReturnDate);
      const equipment = await Equipment.findOne({ equipmentId: booking.equipmentId });
      const user = await User.findOne({ userId: booking.userId });

      const equipmentType = equipment ? equipment.type : "Equipment";
      const userPhone = user ? user.phone : null;

      // 1. OVERDUE CONDITION:
      // Current time is past expected return date AND overdue notification hasn't been sent yet
      if (now > expectedReturn) {
        if (!booking.overdueSmsSent) {
          const overdueDiffMs = now.getTime() - expectedReturn.getTime();
          const durationStr = formatDuration(overdueDiffMs);

          const message = `Smart Rental Tracking: Your rental of ${booking.equipmentId} (${equipmentType}) is overdue by ${durationStr}. Please return the equipment as soon as possible or contact the administrator. Thank you.`;

          console.log(
            `[Alert Service] Booking ${booking.bookingId} is overdue by ${durationStr}. Dispatching alert to user ${booking.userId}...`
          );

          if (!userPhone) {
            console.warn(
              `[Alert Service] User ${booking.userId} does not have a phone number configured. Marking notification attempt.`
            );
            booking.overdueSmsSent = true;
            booking.overdueSmsSentAt = now;
            booking.lastSmsStatus = "failed";
            booking.lastSmsError = "User phone number missing";
            await booking.save();
            continue;
          }

          const smsResult = await sendSms({
            to: userPhone,
            message,
          });

          booking.overdueSmsSent = true;
          booking.overdueSmsSentAt = now;
          booking.lastSmsStatus = smsResult.success ? "sent" : "failed";
          booking.lastSmsError = smsResult.success ? null : smsResult.error;
          await booking.save();

          if (smsResult.success) {
            overdueSentCount++;
          }
        }
        continue;
      }

      // 2. DUE-SOON CONDITION:
      // Expected return date is in future, within threshold, and due-soon notification hasn't been sent yet
      const timeUntilReturnMs = expectedReturn.getTime() - now.getTime();
      if (timeUntilReturnMs > 0 && timeUntilReturnMs <= dueSoonThresholdMs) {
        if (!booking.dueSoonSmsSent) {
          const durationStr = formatDuration(timeUntilReturnMs);

          const message = `Smart Rental Tracking: Reminder \u2014 your rental of ${booking.equipmentId} (${equipmentType}) is due in ${durationStr}. Please return the equipment on time. Thank you.`;

          console.log(
            `[Alert Service] Booking ${booking.bookingId} is due in ${durationStr}. Dispatching due-soon reminder to user ${booking.userId}...`
          );

          if (!userPhone) {
            console.warn(
              `[Alert Service] User ${booking.userId} has no phone number for due-soon notification.`
            );
            booking.dueSoonSmsSent = true;
            booking.dueSoonSmsSentAt = now;
            booking.lastSmsStatus = "failed";
            booking.lastSmsError = "User phone number missing";
            await booking.save();
            continue;
          }

          const smsResult = await sendSms({
            to: userPhone,
            message,
          });

          booking.dueSoonSmsSent = true;
          booking.dueSoonSmsSentAt = now;
          booking.lastSmsStatus = smsResult.success ? "sent" : "failed";
          booking.lastSmsError = smsResult.success ? null : smsResult.error;
          await booking.save();

          if (smsResult.success) {
            dueSoonSentCount++;
          }
        }
      }
    }

    return {
      checked: activeBookings.length,
      overdueSent: overdueSentCount,
      dueSoonSent: dueSoonSentCount,
    };
  } catch (err) {
    console.error("[Alert Service] Error during rental alerts check:", err);
    return { error: err.message };
  }
}

let schedulerTimer = null;

/**
 * Starts the background alert scheduler.
 */
function startAlertScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }

  const intervalSeconds = parseInt(process.env.ALERT_CHECK_INTERVAL_SECONDS || "60", 10);
  const intervalMs = Math.max(10000, intervalSeconds * 1000); // minimum 10 seconds

  console.log(`[Alert Service] Background rental alert scheduler started (interval: ${intervalSeconds}s).`);

  // Run immediate check
  checkRentalAlerts().catch((err) =>
    console.error("[Alert Service] Initial check error:", err.message)
  );

  // Schedule recurring checks
  schedulerTimer = setInterval(() => {
    checkRentalAlerts().catch((err) =>
      console.error("[Alert Service] Scheduled check error:", err.message)
    );
  }, intervalMs);

  return schedulerTimer;
}

/**
 * Stops the background scheduler (used for clean shutdown / testing).
 */
function stopAlertScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log("[Alert Service] Background rental alert scheduler stopped.");
  }
}

module.exports = {
  checkRentalAlerts,
  startAlertScheduler,
  stopAlertScheduler,
  formatDuration,
};
