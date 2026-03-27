import mongoose from "mongoose";

const priceHistorySchema = new mongoose.Schema(
  {
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
    
    // Trip details for ML training
    baseFareAmount: Number,
    distanceKm: Number,
    durationMinutes: Number,
    
    // Pricing factors
    basePrice: Number,
    distancePrice: Number,
    timePrice: Number,
    surgePricingMultiplier: { type: Number, default: 1.0 },
    finalPrice: Number,
    
    // Contextual data for ML
    requestedAt: Date,
    acceptedAt: Date,
    completedAt: Date,
    
    timeOfDay: Number, // 0-23 hour
    dayOfWeek: Number, // 0-6
    isHoliday: Boolean,
    isWeekend: Boolean,
    
    // Location data
    pickupArea: String,
    dropoffArea: String,
    pickupCoords: {
      lat: Number,
      lng: Number
    },
    dropoffCoords: {
      lat: Number,
      lng: Number
    },
    
    // Demand context
    requestsInAreaAtTime: Number, // number of other requests nearby
    availableRidersAtTime: Number,
    demandLevel: { type: String, enum: ['low', 'medium', 'high', 'surge'], default: 'medium' },
    
    // Environmental factors
    weatherCondition: String,
    trafficCondition: String,
    
    // Outcome for supervised learning
    clientAccepted: Boolean,
    tripCompleted: Boolean,
    clientRating: Number,
    riderRating: Number,
    
    // ML features (pre-computed)
    isOutlier: Boolean,
    anomalyScore: Number
  },
  { timestamps: true }
);

priceHistorySchema.index({ requestedAt: -1 });
priceHistorySchema.index({ pickupArea: 1, demandLevel: 1 });
priceHistorySchema.index({ dayOfWeek: 1, timeOfDay: 1 });

export default mongoose.model("PriceHistory", priceHistorySchema);
