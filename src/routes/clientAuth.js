import express from "express";
import { registerClient, loginClient, verifyOtp } from "../controllers/clientController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { resendRiderOtp } from "../controllers/riderController.js";
import { updateClientProfile } from "../controllers/clientController.js";
import { auth } from "../middlewares/auth.js";
import { upload } from "../middlewares/upload.js";



const router = express.Router();

router.post("/register", registerClient);
router.post("/login", loginClient);
router.post("/verify", verifyOtp);
router.post("/resend-otp", resendRiderOtp);
router.put("/profile", auth, upload.single("profilePhoto"), updateClientProfile);

// Example protected route
router.get("/profile", protect, (req, res) => {
  res.json({ success: true, client: req.client });
});

export default router;
