import mongoose from "mongoose";

const riderPerformanceSchema = new mongoose.Schema(
  {
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: "Rider", required: true },
    
    // Performance metrics
    totalTrips: { type: Number, default: 0 },
    completedTrips: { type: Number, default: 0 },
    cancelledTrips: { type: Number, default: 0 },
    acceptanceRate: { type: Number, default: 0 }, // percentage
    completionRate: { type: Number, default: 0 }, // percentage
    
    // Quality metrics
    averageRating: { type: Number, default: 5 },
    totalRatings: { type: Number, default: 0 },
    clientSatisfactionScore: { type: Number, default: 0 }, // 0-100
    
    // Earnings & efficiency
    totalEarnings: { type: Number, default: 0 },
    averageEarningsPerTrip: { type: Number, default: 0 },
    preferredAreas: [
      {
        area: String,
        tripCount: Number,
        rating: Number,
        lastVisited: Date
      }
    ],
    
    // Behavior patterns (for ML)
    averageTripDuration: Number, // in minutes
    averageAcceptanceTime: Number, // how quickly they accept trips
    cancellationPattern: {
      timeOfDay: [String], // when they typically cancel
      locations: [String] // where they cancel
    },
    
    // Learning & ML signals
    isRiskyRider: { type: Boolean, default: false },
    fraudSuspicionScore: { type: Number, default: 0 }, // 0-100, higher = more suspicious
    performanceTrend: { type: String, enum: ['improving', 'stable', 'declining'], default: 'stable' },
    recommendationScore: { type: Number, default: 0 }, // For matching to trips
    
    // Skills/preferences
    vehicleType: String,
    preferredServiceTypes: [String], // standard, premium, etc.
    workingHours: {
      startTime: String,
      endTime: String
    },
    
    // ML model predictions
    churnRisk: { type: Number, default: 0 }, // 0-1 probability of leaving platform
    predictedMonthlyEarnings: Number,
    
    lastUpdated: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

riderPerformanceSchema.index({ riderId: 1 });
riderPerformanceSchema.index({ averageRating: -1 });
riderPerformanceSchema.index({ fraudSuspicionScore: 1 });

export default mongoose.model("RiderPerformance", riderPerformanceSchema);
