import Rider from "../models/Rider.js";
import Client from "../models/Client.js";
import Trip from "../models/Trip.js";
import RiderPerformance from "../models/RiderPerformance.js";
import ClientBehavior from "../models/ClientBehavior.js";
import Analytics from "../models/Analytics.js";
import Admin from "../models/Admin.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// Import AI/ML Services
import AnalyticsService from "../services/AnalyticsService.js";
import FraudDetectionService from "../services/FraudDetectionService.js";
import DynamicPricingService from "../services/DynamicPricingService.js";
import RiderMatchingService from "../services/RiderMatchingService.js";

/**
 * Admin Dashboard Controller with AI/ML Integration
 */

// ===========================
// DASHBOARD & ANALYTICS
// ===========================

export const getDashboardMetrics = async (req, res) => {
  try {
    const metrics = await AnalyticsService.getDashboardMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRevenueAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const revenue = await AnalyticsService.getRevenueBreakdown(parseInt(days));
    res.json({ success: true, data: revenue });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDemandHeatmap = async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const heatmap = await AnalyticsService.getDemandHeatmap(parseInt(hours));
    res.json({ success: true, data: heatmap });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTopPerformers = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const topRiders = await AnalyticsService.getTopRiders(parseInt(limit));
    res.json({ success: true, data: topRiders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===========================
// FRAUD DETECTION & RISK MANAGEMENT
// ===========================

export const getHighRiskUsers = async (req, res) => {
  try {
    const { threshold = 60 } = req.query;
    const highRiskUsers = await FraudDetectionService.getHighRiskUsers(parseInt(threshold));
    res.json({ success: true, data: highRiskUsers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const analyzeFraud = async (req, res) => {
  try {
    const { userId, userType } = req.body;
    
    let fraudAnalysis;
    if (userType === 'rider') {
      fraudAnalysis = await FraudDetectionService.analyzeRiderFraud(userId);
    } else if (userType === 'client') {
      fraudAnalysis = await FraudDetectionService.analyzeClientFraud(userId);
    } else {
      return res.status(400).json({ success: false, message: 'Invalid user type' });
    }

    res.json({ success: true, data: fraudAnalysis });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const blockUser = async (req, res) => {
  try {
    const { userId, userType, reason } = req.body;
    
    if (userType === 'rider') {
      await Rider.findByIdAndUpdate(userId, {
        status: 'blocked',
        isOnline: false
      });
      
      // Update fraud score
      await RiderPerformance.findOneAndUpdate(
        { riderId: userId },
        { fraudSuspicionScore: 100 }
      );
    } else if (userType === 'client') {
      await Client.findByIdAndUpdate(userId, {
        isBlacklisted: true
      });
      
      await ClientBehavior.findOneAndUpdate(
        { clientId: userId },
        { fraudSuspicionScore: 100 }
      );
    }
    
    res.json({ success: true, message: `${userType} user blocked successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const { userId, userType } = req.body;
    
    if (userType === 'rider') {
      await Rider.findByIdAndUpdate(userId, {
        status: 'approved'
      });
      
      await RiderPerformance.findOneAndUpdate(
        { riderId: userId },
        { fraudSuspicionScore: 0 }
      );
    } else if (userType === 'client') {
      await Client.findByIdAndUpdate(userId, {
        isBlacklisted: false
      });
      
      await ClientBehavior.findOneAndUpdate(
        { clientId: userId },
        { fraudSuspicionScore: 0 }
      );
    }
    
    res.json({ success: true, message: `${userType} user unblocked successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===========================
// RIDER MANAGEMENT
// ===========================

export const getAllRiders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const query = status ? { status } : {};
    
    const riders = await Rider.find(query)
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Rider.countDocuments(query);
    
    // Enrich with performance data
    const riersWithPerformance = await Promise.all(
      riders.map(async (rider) => {
        const performance = await RiderPerformance.findOne({ riderId: rider._id });
        return {
          ...rider,
          performance: performance || {}
        };
      })
    );
    
    res.json({
      success: true,
      data: riersWithPerformance,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRiderDetails = async (req, res) => {
  try {
    const { riderId } = req.params;
    
    const rider = await Rider.findById(riderId).select('-password');
    const performance = await RiderPerformance.findOne({ riderId });
    const analytics = await AnalyticsService.getRiderAnalytics(riderId);
    const fraud = await FraudDetectionService.analyzeRiderFraud(riderId);
    
    res.json({
      success: true,
      data: {
        rider,
        performance,
        analytics,
        fraud
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRiderStatus = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'approved', 'rejected', 'blocked'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    
    await Rider.findByIdAndUpdate(riderId, { status });
    
    res.json({ success: true, message: 'Rider status updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===========================
// CLIENT MANAGEMENT
// ===========================

export const getAllClients = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const clients = await Client.find()
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Client.countDocuments();
    
    // Enrich with behavior data
    const clientsWithBehavior = await Promise.all(
      clients.map(async (client) => {
        const behavior = await ClientBehavior.findOne({ clientId: client._id });
        return {
          ...client,
          behavior: behavior || {}
        };
      })
    );
    
    res.json({
      success: true,
      data: clientsWithBehavior,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getClientDetails = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const client = await Client.findById(clientId).select('-password');
    const behavior = await ClientBehavior.findOne({ clientId });
    const analytics = await AnalyticsService.getClientAnalytics(clientId);
    const fraud = await FraudDetectionService.analyzeClientFraud(clientId);
    
    res.json({
      success: true,
      data: {
        client,
        behavior,
        analytics,
        fraud
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===========================
// TRIP MANAGEMENT
// ===========================

export const getAllTrips = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const query = status ? { status } : {};
    
    const trips = await Trip.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('riderId', 'firstName lastName phone')
      .populate('clientId', 'firstName lastName phone')
      .lean();
    
    const total = await Trip.countDocuments(query);
    
    res.json({
      success: true,
      data: trips,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTripDetails = async (req, res) => {
  try {
    const { tripId } = req.params;
    
    const trip = await Trip.findById(tripId)
      .populate('riderId')
      .populate('clientId');
    
    res.json({ success: true, data: trip });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===========================
// PRICING MANAGEMENT
// ===========================

export const getPricingMetrics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const priceHistory = await Trip.find({
      createdAt: { $gte: new Date(Date.now() - days * 86400000) },
      status: 'completed'
    }).lean();
    
    const metrics = {
      totalTrips: priceHistory.length,
      averagePrice: 0,
      minPrice: Infinity,
      maxPrice: 0,
      totalRevenue: 0,
      surgePricingUsage: 0
    };
    
    priceHistory.forEach(trip => {
      const price = trip.estimatedValue || 0;
      metrics.totalRevenue += price;
      metrics.averagePrice += price;
      metrics.minPrice = Math.min(metrics.minPrice, price);
      metrics.maxPrice = Math.max(metrics.maxPrice, price);
      
      if (trip.fareBreakdown?.surge > 0) {
        metrics.surgePricingUsage++;
      }
    });
    
    metrics.averagePrice = metrics.totalTrips > 0 
      ? Math.round(metrics.averagePrice / metrics.totalTrips) 
      : 0;
    metrics.surgePricingIntensity = metrics.totalTrips > 0
      ? ((metrics.surgePricingUsage / metrics.totalTrips) * 100).toFixed(2)
      : 0;
    
    res.json({ success: true, data: metrics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===========================
// SYSTEM HEALTH & MONITORING
// ===========================

export const getSystemHealth = async (req, res) => {
  try {
    const onlineRiders = await Rider.countDocuments({ isOnline: true });
    const onlineClients = await Trip.countDocuments({ status: 'in_progress' });
    
    const recentTrips = await Trip.find({
      createdAt: { $gte: new Date(Date.now() - 3600000) }
    }).countDocuments();
    
    const errors = []; // In real implementation, fetch from error logs
    
    const health = {
      status: errors.length === 0 ? 'healthy' : 'degraded',
      activeRiders: onlineRiders,
      activeTrips: onlineClients,
      tripsLastHour: recentTrips,
      errorCount: errors.length,
      timestamp: new Date()
    };
    
    res.json({ success: true, data: health });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===========================
// REPORTS & EXPORTS
// ===========================

export const generateReport = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.body;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let report = {};
    
    if (reportType === 'revenue') {
      const trips = await Trip.find({
        createdAt: { $gte: start, $lte: end },
        status: 'completed'
      });
      
      report = {
        type: 'Revenue Report',
        period: { start, end },
        totalRevenue: trips.reduce((sum, t) => sum + (t.estimatedValue || 0), 0),
        tripCount: trips.length,
        averageTrip: trips.length > 0 ? trips.reduce((sum, t) => sum + (t.estimatedValue || 0), 0) / trips.length : 0
      };
    } else if (reportType === 'performance') {
      const riders = await RiderPerformance.find();
      
      report = {
        type: 'Rider Performance Report',
        period: { start, end },
        totalRiders: riders.length,
        averageRating: riders.length > 0 ? (riders.reduce((sum, r) => sum + (r.averageRating || 0), 0) / riders.length).toFixed(2) : 0,
        topRiders: riders.sort((a, b) => b.averageRating - a.averageRating).slice(0, 5)
      };
    }
    
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
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
};
