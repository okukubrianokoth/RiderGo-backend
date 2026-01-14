import express from "express";
import {
  registerRider,
  loginRider,
  verifyRiderOtp,
  resendRiderOtp,
  updateRiderProfile,
  paySubscription,
  getSubscriptionStatus
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
router.put(
  "/profile",
  auth,
  upload.fields([
    { name: "idImage", maxCount: 1 },
    { name: "licenseImage", maxCount: 1 }
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

export default router;
