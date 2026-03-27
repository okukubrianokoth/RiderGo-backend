import mongoose from "mongoose";

const riderSchema = new mongoose.Schema({
  phone: { type: String, unique: true, required: true },
  firstName: String,
  lastName: String,
  walletBalance: { type: Number, default: 0 },
  vehicleType: String,
  isVerified: { type: Boolean, default: false },
  status: { 
    type: String, 
    enum: ["pending", "approved", "rejected", "blocked"], 
    default: "pending" 
  },
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

  subscriptionActive: { type: Boolean, default: true },
  subscriptionExpiresAt: { type: Date }, // Unified subscription expiration field
  subscriptionLastRefreshed: { type: Date },

  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  currentLocation: {
    lat: Number,
    lng: Number,
    updatedAt: { type: Date, default: Date.now }
  },
});

export default mongoose.model("Rider", riderSchema);
