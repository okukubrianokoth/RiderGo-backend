// src/routes/tripRoutes.js
import express from "express";
import { getAvailableTrips, acceptTrip, startTrip, endTrip, getRiderActiveTrips, getRiderHistory, updateTripLocation, sendTripMessage, getTripMessages } from "../controllers/tripController.js";
import { protectRider } from "../middlewares/auth.js";
import { checkSubscription } from "../middlewares/subscription.js";

const router = express.Router();

router.get("/available", protectRider, checkSubscription, getAvailableTrips);
router.get("/active", protectRider, checkSubscription, getRiderActiveTrips);
router.get("/history", protectRider, checkSubscription, getRiderHistory);
router.post("/accept", protectRider, checkSubscription, acceptTrip);
router.post("/start", protectRider, checkSubscription, startTrip);
router.post("/end", protectRider, checkSubscription, endTrip);
router.post("/location", protectRider, checkSubscription, updateTripLocation);

// Chat Routes (Public for simplicity, or add auth middleware as needed)
router.post("/message", sendTripMessage);
router.get("/messages/:tripId", getTripMessages);

export default router;
