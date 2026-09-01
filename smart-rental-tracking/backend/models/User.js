const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true, required: true },
  username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  name: { type: String, required: true },
  passwordHash: { type: String, default: null },
  role: {
    type: String,
    enum: ["user", "admin", "operator"],
    default: "user",
  },
  phone: { type: String, default: null },
});

module.exports = mongoose.model("User", userSchema);
