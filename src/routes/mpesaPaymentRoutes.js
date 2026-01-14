import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { initiateMpesaPayment, mpesaCallback } from "../controllers/mpesaController.js";


const router = express.Router();

router.post("/pay", initiateMpesaPayment);
router.post("/callback", mpesaCallback);

export default router;