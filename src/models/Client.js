import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
  {
    profilePhoto: String,
name: String,
email: String,

homeAddress: String,
workAddress: String,

    phone: { type: String, unique: true, required: true },
    password: { type: String }, // optional future use
  },
  { timestamps: true }
);

export default mongoose.model("Client", clientSchema);


