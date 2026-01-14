import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  phone: String,
  code: String,
  expiresAt: Number
});

export default mongoose.model("Otp", otpSchema);
