require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth");
const equipmentRoutes = require("./routes/equipment");
const operatorRoutes = require("./routes/operators");
const bookingRoutes = require("./routes/bookings");
const scanRoutes = require("./routes/scan");
const maintenanceRoutes = require("./routes/maintenance");
const userRoutes = require("./routes/users");
const chatbotRoutes = require("./routes/chatbot");
const chatRoutes = require("./routes/chat");
const telemetryRoutes = require("./routes/telemetry");
const forecastRoutes = require("./routes/forecast");
const razorpayRoutes = require("./routes/razorpay");
const rebalanceRoutes = require("./routes/rebalance");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Smart Rental Tracking API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/operators", operatorRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/scan", scanRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/forecast", forecastRoutes);
app.use("/api/rebalance", rebalanceRoutes);
app.use("/api", razorpayRoutes);
app.use("/api", chatbotRoutes);

// Fallback error handler so the server never crashes on an unexpected error
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Server error", error: err.message });
});

const { startAlertScheduler } = require("./services/alertService");

const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart-rental-tracking";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    startAlertScheduler();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });
