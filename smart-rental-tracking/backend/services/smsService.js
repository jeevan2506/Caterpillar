const twilio = require("twilio");

/**
 * Normalizes and validates a phone number into E.164 format.
 * Defaults 10-digit numbers to Indian country code (+91).
 * @param {string} rawPhone 
 * @returns {string|null} E.164 formatted phone number, or null if invalid.
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== "string") return null;

  // Remove whitespace, dashes, parentheses, dots
  let cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, "").trim();
  if (!cleaned) return null;

  // If starts with +, check E.164 format (7-15 digits after +)
  if (cleaned.startsWith("+")) {
    const e164Regex = /^\+[1-9]\d{6,14}$/;
    return e164Regex.test(cleaned) ? cleaned : null;
  }

  // If 11 digits starting with 0 (e.g. 09876543210), strip 0 and prepend +91
  if (/^0\d{10}$/.test(cleaned)) {
    return "+91" + cleaned.slice(1);
  }

  // If 10 digits (e.g. 9876543210), prepend +91
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return "+91" + cleaned;
  }

  // If already international digits without leading + (e.g. 919876543210)
  if (/^\d{11,15}$/.test(cleaned)) {
    return "+" + cleaned;
  }

  return null;
}

/**
 * Helper to get an initialized Twilio client if credentials are present.
 */
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return null;
  }

  return twilio(accountSid, authToken);
}

/**
 * Sends a real-time SMS using Twilio Messaging Service.
 * 
 * @param {Object} params
 * @param {string} params.to - Recipient phone number
 * @param {string} params.message - SMS body text
 * @returns {Promise<{success: boolean, messageSid?: string, error?: string}>}
 */
async function sendSms({ to, message }) {
  try {
    if (!message || typeof message !== "string" || !message.trim()) {
      return { success: false, error: "SMS message body cannot be empty" };
    }

    const normalizedPhone = normalizePhoneNumber(to);
    if (!normalizedPhone) {
      console.warn(`[SMS Service] Invalid or missing phone number provided. Message skipped.`);
      return { success: false, error: "Invalid or missing phone number" };
    }

    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromPhone = process.env.TWILIO_FROM || process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;
    const isSimulate = process.env.TWILIO_SIMULATE_SMS === "true";

    if (isSimulate) {
      console.log(`[SMS Service - SIMULATION] Dispatched mock SMS to ${normalizedPhone}: "${message.trim()}"`);
      return {
        success: true,
        messageSid: `SM_SIMULATED_${Date.now()}`,
        simulated: true,
      };
    }

    const client = getTwilioClient();
    if (!client) {
      console.warn("[SMS Service] Twilio credentials (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN) are missing in backend/.env.");
      return {
        success: false,
        error: "Twilio credentials missing. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in backend/.env (or set TWILIO_SIMULATE_SMS=true for local simulation)",
      };
    }

    if (!messagingServiceSid && !fromPhone) {
      console.warn("[SMS Service] Neither TWILIO_MESSAGING_SERVICE_SID nor TWILIO_PHONE_NUMBER is configured in backend/.env.");
      return {
        success: false,
        error: "TWILIO_MESSAGING_SERVICE_SID (or TWILIO_PHONE_NUMBER) is not configured in backend/.env (or set TWILIO_SIMULATE_SMS=true for local simulation)",
      };
    }

    // Mask phone number for safe logging (e.g. +91******3210)
    const maskedPhone =
      normalizedPhone.length > 6
        ? normalizedPhone.slice(0, 3) + "*".repeat(normalizedPhone.length - 7) + normalizedPhone.slice(-4)
        : normalizedPhone;

    console.log(`[SMS Service] Dispatching SMS to ${maskedPhone}...`);

    const payload = {
      body: message.trim(),
      to: normalizedPhone,
    };

    if (messagingServiceSid) {
      payload.messagingServiceSid = messagingServiceSid;
    } else if (fromPhone) {
      payload.from = fromPhone;
    }

    const result = await client.messages.create(payload);

    console.log(`[SMS Service] SMS sent successfully. SID: ${result.sid}`);
    return {
      success: true,
      messageSid: result.sid,
    };
  } catch (err) {
    console.error(`[SMS Service] Twilio send failed: ${err.message}`);
    return {
      success: false,
      error: err.message,
    };
  }
}

module.exports = {
  sendSms,
  normalizePhoneNumber,
};
