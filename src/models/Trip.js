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

    // NEW RULES
    postingFeePaid: { type: Boolean, default: false },
    postingFeeAmount: { type: Number, default: 100 },
    clientWalletUsed: { type: Number, default: 0 },
    extraWalletStored: { type: Number, default: 0 },

    // Rider cash (NOT paid by app — only displayed)
    riderCashExpected: { type: Number, default: 0 },

    serviceType: { type: String, enum: ["delivery", "ride"], required: true },
    status: {
      type: String,
      enum: ["pending", "awaiting_payment", "assigned", "accepted", "rejected", "completed", "cancelled"],
      default: "awaiting_payment",
    },

    rejectedRiders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Rider" }],
  },
  { timestamps: true }
);

export default mongoose.model("Trip", tripSchema);
