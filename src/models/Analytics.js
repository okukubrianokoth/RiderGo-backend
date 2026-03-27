import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    hour: Number, // 0-23 for hourly analytics
    
    // Demand metrics
    demandScore: { type: Number, default: 0 }, // 0-100 scale
    tripsRequested: { type: Number, default: 0 },
    tripsCompleted: { type: Number, default: 0 },
    tripsAccepted: { type: Number, default: 0 },
    tripsCancelled: { type: Number, default: 0 },
    
    // Location-based data
    location: {
      area: String,
      lat: Number,
      lng: Number,
      radius: Number // in meters
    },
    
    // Pricing data for ML
    averagePrice: Number,
    minPrice: Number,
    maxPrice: Number,
    sugePricingFactor: { type: Number, default: 1.0 },
    
    // Rider metrics
    activeRiders: Number,
    availableRiders: Number,
    averageRiderRating: Number,
    riderAcceptanceRate: Number,
    
    // Client metrics
    activeClients: Number,
    newClients: Number,
    clientSatisfaction: Number,
    
    // Traffic/Weather influence
    trafficLevel: { type: String, enum: ['low', 'moderate', 'high', 'severe'], default: 'low' },
    weatherCondition: { type: String, default: 'clear' },
    
    // Revenue metrics
    totalRevenue: Number,
    riderEarnings: Number,
    platformFees: Number,
    
    // Machine Learning signals
    seasonality: Number, // -1 to 1 (negative = below average, positive = above average)
    dayOfWeek: Number, // 0-6
    holidayFlag: Boolean
  },
  { timestamps: true }
);

analyticsSchema.index({ date: 1, 'location.area': 1 });
analyticsSchema.index({ hour: 1, date: 1 });

export default mongoose.model("Analytics", analyticsSchema);
