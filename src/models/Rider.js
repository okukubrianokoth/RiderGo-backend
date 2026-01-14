import mongoose from "mongoose";

const riderSchema = new mongoose.Schema({
  phone: { type: String, unique: true, required: true },
  name: String,
  vehicleType: String,
  numberPlate: String,
  otpAttempts: { type: Number, default: 0 },
lastOtpSent: Date,
profilePhoto: String,
name: String,
email: String,

nationalIdNumber: String,
nationalIdImage: String,

drivingLicenseNumber: String,
drivingLicenseImage: String,

motorbikePlate: String,

  otp: String,
  otpExpires: Date,

  subscriptionActive: Boolean,
subscriptionExpires: Date,
lastPaymentRef: String,
subscriptionExpiresAt: { type: Date }

}, { timestamps: true });

export default mongoose.model("Rider", riderSchema);
