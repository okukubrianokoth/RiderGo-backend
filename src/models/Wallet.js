import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", default: null },
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: "Rider", default: null },

    balance: { type: Number, default: 0 },

    transactions: [
      {
        amount: Number,
        type: { type: String, enum: ["credit", "debit"] },
        reference: String,
        date: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

const Wallet = mongoose.model("Wallet", walletSchema);
export default Wallet;
