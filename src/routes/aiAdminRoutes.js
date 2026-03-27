import express from 'express';
import {
  getDashboardMetrics,
  getRevenueAnalytics,
  getDemandHeatmap,
  getTopPerformers,
  getHighRiskUsers,
  analyzeFraud,
  blockUser,
  unblockUser,
  getAllRiders,
  getRiderDetails,
  updateRiderStatus,
  getAllClients,
  getClientDetails,
  getAllTrips,
  getTripDetails,
  getPricingMetrics,
  getSystemHealth,
  generateReport
} from '../controllers/aiAdminController.js';
import { adminAuth } from '../middlewares/adminAuth.js';

const router = express.Router();

// Protect all admin routes with admin authentication
router.use(adminAuth);

// ===========================
// Dashboard & Analytics
// ===========================

/**
 * @route   GET /api/admin/dashboard/metrics
 * @desc    Get comprehensive dashboard metrics (KPIs)
 * @access  Private (Admin)
 */
router.get('/dashboard/metrics', getDashboardMetrics);

/**
 * @route   GET /api/admin/analytics/revenue
 * @desc    Get revenue analytics with breakdown
 * @access  Private (Admin)
 * @query   days (default: 30)
 */
router.get('/analytics/revenue', getRevenueAnalytics);

/**
 * @route   GET /api/admin/analytics/heatmap
 * @desc    Get demand heatmap (location-based demand data for ML)
 * @access  Private (Admin)
 * @query   hours (default: 24)
 */
router.get('/analytics/heatmap', getDemandHeatmap);

/**
 * @route   GET /api/admin/analytics/top-performers
 * @desc    Get top performing riders
 * @access  Private (Admin)
 * @query   limit (default: 10)
 */
router.get('/analytics/top-performers', getTopPerformers);

// ===========================
// Fraud Detection & Risk
// ===========================

/**
 * @route   GET /api/admin/fraud/high-risk
 * @desc    Get all high-risk users (riders & clients)
 * @access  Private (Admin)
 * @query   threshold (default: 60, 0-100 scale)
 */
router.get('/fraud/high-risk', getHighRiskUsers);

/**
 * @route   POST /api/admin/fraud/analyze
 * @desc    Analyze specific user for fraud
 * @access  Private (Admin)
 * @body    userId, userType ('rider' | 'client')
 */
router.post('/fraud/analyze', analyzeFraud);

/**
 * @route   POST /api/admin/users/block
 * @desc    Block a user (rider or client)
 * @access  Private (Admin)
 * @body    userId, userType, reason
 */
router.post('/users/block', blockUser);

/**
 * @route   POST /api/admin/users/unblock
 * @desc    Unblock a user
 * @access  Private (Admin)
 * @body    userId, userType
 */
router.post('/users/unblock', unblockUser);

// ===========================
// Rider Management
// ===========================

/**
 * @route   GET /api/admin/riders
 * @desc    Get all riders with pagination and filtering
 * @access  Private (Admin)
 * @query   status, page (default: 1), limit (default: 20)
 */
router.get('/riders', getAllRiders);

/**
 * @route   GET /api/admin/riders/:riderId
 * @desc    Get detailed rider information including performance metrics
 * @access  Private (Admin)
 */
router.get('/riders/:riderId', getRiderDetails);

/**
 * @route   PUT /api/admin/riders/:riderId/status
 * @desc    Update rider status (approve, reject, block)
 * @access  Private (Admin)
 * @body    status ('pending' | 'approved' | 'rejected' | 'blocked')
 */
router.put('/riders/:riderId/status', updateRiderStatus);

// ===========================
// Client Management
// ===========================

/**
 * @route   GET /api/admin/clients
 * @desc    Get all clients with pagination
 * @access  Private (Admin)
 * @query   page (default: 1), limit (default: 20)
 */
router.get('/clients', getAllClients);

/**
 * @route   GET /api/admin/clients/:clientId
 * @desc    Get detailed client information and behavior analysis
 * @access  Private (Admin)
 */
router.get('/clients/:clientId', getClientDetails);

// ===========================
// Trip Management
// ===========================

/**
 * @route   GET /api/admin/trips
 * @desc    Get all trips with filtering and pagination
 * @access  Private (Admin)
 * @query   status, page (default: 1), limit (default: 20)
 */
router.get('/trips', getAllTrips);

/**
 * @route   GET /api/admin/trips/:tripId
 * @desc    Get detailed trip information
 * @access  Private (Admin)
 */
router.get('/trips/:tripId', getTripDetails);

// ===========================
// Pricing & Dynamic Pricing Management
// ===========================

/**
 * @route   GET /api/admin/pricing/metrics
 * @desc    Get pricing metrics and surge pricing usage
 * @access  Private (Admin)
 * @query   days (default: 30)
 */
router.get('/pricing/metrics', getPricingMetrics);

// ===========================
// System Monitoring
// ===========================

/**
 * @route   GET /api/admin/system/health
 * @desc    Get system health status
 * @access  Private (Admin)
 */
router.get('/system/health', getSystemHealth);

// ===========================
// Reports & Exports
// ===========================

/**
 * @route   POST /api/admin/reports/generate
 * @desc    Generate custom reports
 * @access  Private (Admin)
 * @body    reportType ('revenue' | 'performance'), startDate, endDate
 */
router.post('/reports/generate', generateReport);

export default router;
