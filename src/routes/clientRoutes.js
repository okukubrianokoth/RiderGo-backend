import express from 'express';
import {
  registerClient,
  loginClient,
  verifyClientOtp,
  createDelivery,
  getClientDeliveries,
  getDelivery,
  getDeliveryEstimate,
  searchLocation
} from '../controllers/clientController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Auth
router.post('/register', registerClient);
router.post('/login', loginClient);
router.post('/verify-otp', verifyClientOtp);

// Services
router.get('/search', searchLocation); // New Kenya-wide search
router.post('/estimate', getDeliveryEstimate);
router.post('/delivery', protect, createDelivery);
router.get('/deliveries', protect, getClientDeliveries);
router.get('/delivery/:id', protect, getDelivery);

export default router;