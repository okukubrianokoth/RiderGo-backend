import mongoose from "mongoose";

const clientBehaviorSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    
    // Usage metrics
    totalTripsRequested: { type: Number, default: 0 },
    totalTripsCompleted: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    averageSpentPerTrip: { type: Number, default: 0 },
    
    // Behavior patterns
    averageRating: { type: Number, default: 5 },
    totalRatings: { type: Number, default: 0 },
    riderSatisfactionTrend: [
      {
        date: Date,
        rating: Number,
        comment: String
      }
    ],
    
    // Usage patterns (for ML)
    peakUsageHours: [Number], // 0-23
    preferredAreas: [
      {
        area: String,
        tripCount: Number
      }
    ],
    favoriteDestinations: [
      {
        location: String,
        lat: Number,
        lng: Number,
        frequency: Number
      }
    ],
    
    // Payment behavior
    paymentMethods: [String], // mpesa, wallet, card
    defaultPaymentMethod: String,
    creditCardOnFile: { type: Boolean, default: false },
    
    // Risk assessment
    fraudSuspicionScore: { type: Number, default: 0 }, // 0-100
    cancellationRate: { type: Number, default: 0 }, // percentage
    noShowRate: { type: Number, default: 0 }, // percentage
    badRatingGivenRate: { type: Number, default: 0 }, // how often they rate riders badly
    isBlacklisted: { type: Boolean, default: false },
    
    // ML predictions
    predictedLifetimeValue: Number, // LTV prediction
    churnRisk: { type: Number, default: 0 }, // 0-1 probability of leaving
    recommendedServiceTier: String, // standard, premium, business
    nextTripPredictedDate: Date,
    
    // Engagement
    isActive: { type: Boolean, default: true },
    lastTripDate: Date,
    daysSinceLastTrip: Number,
    
    // Preferences (learned by ML)
    preferredRiderType: String, // experienced, verified, high-rated
    preferredVehicleTypes: [String],
    
    // Referral metrics
    referralCode: String,
    referralsCount: { type: Number, default: 0 },
    referralEarnings: { type: Number, default: 0 },
    
    lastUpdated: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

clientBehaviorSchema.index({ clientId: 1 });
clientBehaviorSchema.index({ fraudSuspicionScore: 1 });
clientBehaviorSchema.index({ isActive: 1, lastTripDate: -1 });

export default mongoose.model("ClientBehavior", clientBehaviorSchema);
