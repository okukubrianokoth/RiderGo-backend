import express from 'express';
import {
  getDashboardStats,
  getPendingRiders,
  getRiders,
  getClients,
  getTrips,
  verifyRider,
  getSettings,
  updateSettings,
  loginAdmin,
  getWithdrawals,
  approveWithdrawal,
  getPeakHours,
  addPeakHour,
  deletePeakHour,
  updatePeakHour,
  toggleRiderBlock,
  toggleClientBlock
} from '../controllers/adminController.js';
import { protectAdmin } from '../middlewares/adminAuth.js';

const router = express.Router();

router.post('/login', loginAdmin);

// Protected Routes
router.get('/dashboard', protectAdmin, getDashboardStats);
router.get('/stats', protectAdmin, getDashboardStats);
router.get('/riders/pending', protectAdmin, getPendingRiders);
router.get('/riders', protectAdmin, getRiders);
router.post('/verify-rider', protectAdmin, verifyRider); // Alias for frontend compatibility
router.post('/riders/verify', protectAdmin, verifyRider);
router.post('/riders/toggle-block', protectAdmin, toggleRiderBlock);
router.post('/clients/toggle-block', protectAdmin, toggleClientBlock);
router.get('/clients', protectAdmin, getClients);
router.get('/trips', protectAdmin, getTrips);
router.get('/settings', protectAdmin, getSettings);
router.put('/settings', protectAdmin, updateSettings);

// Peak Hours Management
router.get('/peak-hours', protectAdmin, getPeakHours);
router.post('/peak-hours', protectAdmin, addPeakHour);
router.put('/peak-hours/:peakHourId', protectAdmin, updatePeakHour);
router.delete('/peak-hours/:peakHourId', protectAdmin, deletePeakHour);

router.get('/withdrawals', protectAdmin, getWithdrawals);
router.post('/withdrawals/process', protectAdmin, approveWithdrawal);

export default router;