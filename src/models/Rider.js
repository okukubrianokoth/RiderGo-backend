import mongoose from "mongoose";

const riderSchema = new mongoose.Schema({
  phone: { type: String, unique: true, required: true },
  name: String,
  vehicleType: String,
  isVerified: { type: Boolean, default: false },
  otpAttempts: { type: Number, default: 0 },
lastOtpSent: Date,
profilePhoto: String,
email: String,
password: { type: String }, // Add password field

nationalIdNumber: String,
nationalIdImage: String,

drivingLicenseNumber: String,
drivingLicenseImage: String,

numberPlate: String,
vehicleMake: String,
vehicleModel: String,
vehicleImage: String,

emergencyContact: String,
emergencyPhone: String,

  otp: String,
  otpExpires: Date,

  subscriptionActive: Boolean,
subscriptionExpires: Date,
lastPaymentRef: String,
subscriptionExpiresAt: { type: Date }

}, { timestamps: true });

export default mongoose.model("Rider", riderSchema);
