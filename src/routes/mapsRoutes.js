import express from "express";
import { autocomplete, getPlaceDetails } from "../controllers/mapsController.js";

const router = express.Router();

router.get("/autocomplete", autocomplete);
router.get("/details", getPlaceDetails);

export default router;