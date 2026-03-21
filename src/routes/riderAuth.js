import express from "express";
import {
  registerRider,
  loginRider,
  verifyRiderOtp,
  resendRiderOtp,
  updateRiderProfile,
  getRiderProfile,
  paySubscription,
  getSubscriptionStatus,
  updateRiderStatus,
  updateRiderLocation,
  getAvailableTrips,
  acceptTrip,
  updateTripStatus,
  getRiderTrips,
  getRiderEarnings
} from "../controllers/riderController.js";

import { auth, protectRider } from "../middlewares/auth.js";
import { upload } from "../middlewares/upload.js";
import { checkSubscription } from "../middlewares/subscription.js";

const router = express.Router();

// 🔐 Auth routes
router.post("/register", registerRider);
router.post("/login", loginRider);
router.post("/verify", verifyRiderOtp);
router.post("/resend-otp", resendRiderOtp);

// 🆔 Rider profile — requires login
router.get("/profile", protectRider, getRiderProfile);
router.put(
  "/profile",
  protectRider,
  upload.fields([
    { name: "idImage", maxCount: 1 },
    { name: "licenseImage", maxCount: 1 },
    { name: "vehicleImage", maxCount: 1 }
  ]),
  updateRiderProfile
);

// 💰 Subscription payment
router.post("/subscription/pay", protectRider, paySubscription);
router.get("/subscription/status", protectRider, getSubscriptionStatus);

// 🏁 Example protected route (rider must have active subscription)
router.get("/home", protectRider, checkSubscription, (req, res) => {
  res.json({ message: "Subscription valid – rider allowed to work" });
});

// Rider status and location
router.put("/status", protectRider, updateRiderStatus);
router.put("/location", protectRider, updateRiderLocation);

// Trip management
router.get("/trips/available", protectRider, checkSubscription, getAvailableTrips);
router.post("/trips/accept", protectRider, checkSubscription, acceptTrip);
router.put("/trips/status", protectRider, checkSubscription, updateTripStatus);
router.get("/trips", protectRider, getRiderTrips);

// Earnings
router.get("/earnings", protectRider, getRiderEarnings);

export default router;
