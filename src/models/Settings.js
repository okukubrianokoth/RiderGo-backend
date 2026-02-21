import mongoose from "mongoose";

const peakHourSchema = new mongoose.Schema({
  day: { 
    type: String, 
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true 
  },
  startTime: { type: String, required: true }, // HH:MM format
  endTime: { type: String, required: true },   // HH:MM format
  multiplier: { type: Number, default: 1.3 }
});

const settingsSchema = new mongoose.Schema({
  baseFare: { type: Number, default: 150 },
  ratePerKm: { type: Number, default: 40 },
  ratePerMin: { type: Number, default: 5 },
  minFare: { type: Number, default: 200 },
  surgeMultiplier: { type: Number, default: 1.0 },
  commissionRate: { type: Number, default: 0.2 }, // 20%

  // Dynamic Surge Settings
  enableRushHourSurge: { type: Boolean, default: true },
  rushHourMultiplier: { type: Number, default: 1.3 }, // 1.3x during rush hour
  peakHours: [peakHourSchema], // Array of peak hour configurations
  
  enableDemandSurge: { type: Boolean, default: true },
  activeTripsThreshold: { type: Number, default: 50 }, // If > 50 trips, surge
  demandMultiplier: { type: Number, default: 1.2 },
  
  // System settings
  autoAssignRadius: { type: Number, default: 5 }, // km
  payoutEnabled: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("Settings", settingsSchema);