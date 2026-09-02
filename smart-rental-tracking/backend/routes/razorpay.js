const express = require("express");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const router = express.Router();

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return {
    instance: new Razorpay({ key_id: keyId, key_secret: keySecret }),
    keySecret,
  };
}

router.post("/create-order", async (req, res) => {
  try {
    const rzp = getRazorpay();
    if (!rzp) {
      return res.status(401).json({
        message: "Razorpay credentials are not configured on the backend.",
      });
    }

    const { amount, currency = "INR", receipt } = req.body || {};
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount < 100) {
      return res.status(400).json({
        message: "Amount must be at least 100 paise.",
      });
    }

    const order = await rzp.instance.orders.create({
      amount: Math.round(numericAmount),
      currency,
      receipt: String(receipt || `booking_${Date.now()}`),
    });

    return res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    const statusCode = err.statusCode || err.status || (err.error && err.error.code === "BAD_REQUEST_ERROR" ? 400 : 500);
    const message = err.error?.description || err.message || "Failed to create Razorpay order.";

    if (err.statusCode === 401 || err.status === 401) {
      return res.status(401).json({
        message: "Razorpay authentication failed.",
        error: message,
      });
    }

    return res.status(statusCode === 400 ? 400 : 500).json({
      message: statusCode === 400 ? message : "Razorpay order creation failed.",
      error: message,
    });
  }
});

router.post("/verify-payment", (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {};

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({
        message: "Missing payment verification fields.",
      });
    }

    const rzp = getRazorpay();
    if (!rzp) {
      return res.status(401).json({
        message: "Razorpay credentials are not configured on the backend.",
      });
    }
    const keySecret = rzp.keySecret;

    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment signature mismatch.",
      });
    }

    return res.json({
      success: true,
      message: "Payment verified successfully.",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Payment verification failed.",
      error: err.message,
    });
  }
});

module.exports = router;
