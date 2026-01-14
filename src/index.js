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
// Connect DB & Start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    app.listen(process.env.PORT || 5000, () =>
      console.log(`Server running on port ${process.env.PORT || 5000}`)
    );
  })
  .catch((err) => console.error(err));
