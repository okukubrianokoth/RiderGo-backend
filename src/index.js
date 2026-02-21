import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";

dotenv.config();

// Import Routes
import riderRoutes from "./routes/riderAuth.js";
import tripRoutes from "./routes/tripRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import mpesaRoutes from "./routes/mpesaPaymentRoutes.js";
import clientRoutes from "./routes/clientAuth.js";
import requestRoutes from "./routes/requestRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

// ...



// Initialize app
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/rider", riderRoutes);
app.use("/api/trip", tripRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/payments/mpesa", mpesaRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/admin", adminRoutes);
// Connect DB & Start server

if (!process.env.MONGO_URI) {
  console.error("Error: MONGO_URI is not defined. Please check your .env file.");
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error("Error: JWT_SECRET is not defined. Please check your .env file.");
  process.exit(1);
}

console.log("Attempting to connect to MongoDB...");

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    app.listen(process.env.PORT || 5000, () =>
      console.log(`Server running on port ${process.env.PORT || 5000}`)
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    console.error("💡 Tip: Ensure MongoDB is running (sudo systemctl start mongod) or check your MONGO_URI.");
    process.exit(1);
  });
