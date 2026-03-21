import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
  {
    profilePhoto: String,
    firstName: String,
    lastName: String,
    email: String,
    homeAddress: String,
    workAddress: String,
    phone: { type: String, unique: true, required: true },
    password: { type: String }, // optional future use
    isVerified: { type: Boolean, default: false },
    lastOtpSent: Date, // Track OTP sending for rate limiting
  },
  { timestamps: true }
);

export default mongoose.model("Client", clientSchema);
