import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { loadWallet, getWalletBalance } from "../controllers/walletController.js";

const router = express.Router();

router.post("/load", protect, loadWallet);
router.get("/balance", protect, getWalletBalance);

export default router;
