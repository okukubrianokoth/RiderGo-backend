import mongoose from "mongoose";

const subscriptionAuditSchema = new mongoose.Schema({
  riderId: { type: mongoose.Schema.Types.ObjectId, ref: "Rider", required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  grantedAt: { type: Date, default: Date.now },
  subscriptionExpiresAt: { type: Date, required: true },
  subscriptionLastRefreshed: { type: Date, required: true },
  notes: { type: String }
}, { timestamps: true });

export default mongoose.model("SubscriptionAudit", subscriptionAuditSchema);
