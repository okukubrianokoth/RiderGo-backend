import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: "Rider", default: null },

    pickupLocation: {
      address: String,
      lat: Number,
      lng: Number,
    },
    dropoffLocation: {
      address: String,
      lat: Number,
      lng: Number,
    },
    
    photoProofPickup: String,
    photoProofDelivery: String,

    // Live Rider Location
    currentLocation: {
      lat: Number,
      lng: Number,
      updatedAt: Date
    },

    packageDescription: String,
    specialInstructions: String,
    recipientName: String,
    recipientPhone: String,
    estimatedValue: Number,
    riderEarnings: Number,
    
    // Pricing Breakdown
    fareBreakdown: {
      baseFare: Number,
      distanceFare: Number,
      timeFare: Number,
      surge: Number
    },

    // NEW RULES
    postingFeePaid: { type: Boolean, default: false },
    postingFeeAmount: { type: Number, default: 100 },
    clientWalletUsed: { type: Number, default: 0 },
    extraWalletStored: { type: Number, default: 0 },

    // Rider cash (NOT paid by app — only displayed)
    riderCashExpected: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ["cash", "wallet", "mpesa"], default: "cash" },

    serviceType: { type: String, enum: ["delivery", "ride"], required: true },
    status: {
      type: String,
      enum: ["pending", "awaiting_payment", "assigned", "accepted", "rejected", "completed", "cancelled", "in_progress", "arrived_pickup", "picked_up"],
      default: "awaiting_payment",
    },

    rejectedRiders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Rider" }],
  },
  { timestamps: true }
);

export default mongoose.model("Trip", tripSchema);
