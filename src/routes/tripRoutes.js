// src/routes/tripRoutes.js
import express from "express";
import { startTrip, endTrip, cancelTrip } from "../controllers/tripController.js";
import { protectRider } from "../middlewares/auth.js";

const router = express.Router();

router.post("/start", protectRider, startTrip);
router.post("/end", protectRider, endTrip);
router.post("/cancel", protectRider, cancelTrip);

export default router;
