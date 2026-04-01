const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  userData: {
    name: String,
    email: String,
    password: String,
    role: String,
    mobile: String,
    location: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300
  }
});

module.exports = mongoose.model('OTP', otpSchema);
