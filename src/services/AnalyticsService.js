import Analytics from "../models/Analytics.js";
import RiderPerformance from "../models/RiderPerformance.js";
import ClientBehavior from "../models/ClientBehavior.js";
import Trip from "../models/Trip.js";
import Rider from "../models/Rider.js";
import Client from "../models/Client.js";

/**
 * Analytics and Insights Service
 * Provides real-time and historical analytics for the platform
 */

class AnalyticsService {
  /**
   * Calculate and record hourly analytics
   */
  static async recordHourlyAnalytics() {
    try {
      const now = new Date();
      const hour = now.getHours();
      
      // Get data for the current hour
      const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0);
      const hourEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 59, 59);
      
      // Count trips
      const trips = await Trip.find({
        createdAt: { $gte: hourStart, $lte: hourEnd }
      });
      
      const completedTrips = trips.filter(t => t.status === 'completed').length;
      const acceptedTrips = trips.filter(t => t.status === 'accepted').length;
      const cancelledTrips = trips.filter(t => t.status === 'cancelled').length;
      
      // Count active riders and clients
      const activeRiders = await Rider.countDocuments({
        isOnline: true,
        status: 'approved'
      });
      
      const activeClients = await Trip.distinct('clientId', {
        createdAt: { $gte: hourStart, $lte: hourEnd }
      });
      
      // Calculate demand score (0-100)
      const demandScore = Math.min(Math.round((trips.length / 50) * 100), 100);
      
      // Calculate average price for completed trips
      const completedTripPrices = trips
        .filter(t => t.status === 'completed')
        .map(t => t.fareBreakdown?.distanceFare || 0);
      
      const averagePrice = completedTripPrices.length > 0
        ? Math.round(completedTripPrices.reduce((a, b) => a + b, 0) / completedTripPrices.length)
        : 0;
      
      // Calculate total revenue
      const totalRevenue = trips.reduce((sum, trip) => {
        const price = trip.fareBreakdown?.distanceFare || 0;
        return sum + price;
      }, 0);
      
      // Record analytics
      await Analytics.create({
        date: now,
        hour,
        demandScore,
        tripsRequested: trips.length,
        tripsCompleted: completedTrips,
        tripsAccepted: acceptedTrips,
        tripsCancelled: cancelledTrips,
        activeRiders,
        activeClients: activeClients.length,
        averagePrice,
        totalRevenue,
        dayOfWeek: now.getDay(),
        holidayFlag: this.isHoliday(now)
      });
    } catch (error) {
      console.error("Error recording hourly analytics:", error);
    }
  }

  /**
   * Get platform dashboard metrics
   */
  static async getDashboardMetrics() {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Today's metrics
      const todayTrips = await Trip.find({
        createdAt: { $gte: today }
      });
      
      const todayCompleted = todayTrips.filter(t => t.status === 'completed').length;
      const todayRevenue = todayTrips.reduce((sum, trip) => {
        return sum + (trip.estimatedValue || 0);
      }, 0);
      
      // This month metrics
      const monthTrips = await Trip.find({
        createdAt: { $gte: thisMonth }
      });
      
      const monthCompleted = monthTrips.filter(t => t.status === 'completed').length;
      const monthRevenue = monthTrips.reduce((sum, trip) => {
        return sum + (trip.estimatedValue || 0);
      }, 0);
      
      // User metrics
      const totalRiders = await Rider.countDocuments();
      const activeRiders = await Rider.countDocuments({ isOnline: true });
      const verifiedRiders = await Rider.countDocuments({ isVerified: true });
      
      const totalClients = await Client.countDocuments();
      const activeClients = await Client.countDocuments();
      
      // Rating metrics
      const riderPerformances = await RiderPerformance.find();
      const avgRiderRating = riderPerformances.length > 0
        ? (riderPerformances.reduce((sum, r) => sum + (r.averageRating || 0), 0) / riderPerformances.length).toFixed(2)
        : 0;
      
      return {
        today: {
          trips: todayTrips.length,
          completed: todayCompleted,
          revenue: todayRevenue,
          completionRate: todayTrips.length > 0 ? ((todayCompleted / todayTrips.length) * 100).toFixed(1) : 0
        },
        month: {
          trips: monthTrips.length,
          completed: monthCompleted,
          revenue: monthRevenue,
          completionRate: monthTrips.length > 0 ? ((monthCompleted / monthTrips.length) * 100).toFixed(1) : 0
        },
        users: {
          totalRiders,
          activeRiders,
          verifiedRiders,
          totalClients,
          activeClients
        },
        quality: {
          avgRiderRating,
          totalReviews: riderPerformances.reduce((sum, r) => sum + (r.totalRatings || 0), 0)
        }
      };
    } catch (error) {
      console.error("Error getting dashboard metrics:", error);
      throw error;
    }
  }

  /**
   * Get rider analytics
   */
  static async getRiderAnalytics(riderId) {
    try {
      const performance = await RiderPerformance.findOne({ riderId });
      const trips = await Trip.find({ riderId });
      
      const completedTrips = trips.filter(t => t.status === 'completed').length;
      const totalEarnings = trips.reduce((sum, trip) => {
        return sum + (trip.riderEarnings || 0);
      }, 0);
      
      return {
        performance: performance || {},
        trips: {
          total: trips.length,
          completed: completedTrips,
          cancelled: trips.filter(t => t.status === 'cancelled').length,
          completionRate: trips.length > 0 ? ((completedTrips / trips.length) * 100).toFixed(1) : 0
        },
        earnings: {
          total: totalEarnings,
          average: trips.length > 0 ? (totalEarnings / trips.length).toFixed(2) : 0
        }
      };
    } catch (error) {
      console.error("Error getting rider analytics:", error);
      throw error;
    }
  }

  /**
   * Get client analytics
   */
  static async getClientAnalytics(clientId) {
    try {
      const behavior = await ClientBehavior.findOne({ clientId });
      const trips = await Trip.find({ clientId });
      
      const completedTrips = trips.filter(t => t.status === 'completed').length;
      const totalSpent = trips.reduce((sum, trip) => {
        return sum + (trip.estimatedValue || 0);
      }, 0);
      
      return {
        behavior: behavior || {},
        trips: {
          total: trips.length,
          completed: completedTrips,
          cancelled: trips.filter(t => t.status === 'cancelled').length,
          completionRate: trips.length > 0 ? ((completedTrips / trips.length) * 100).toFixed(1) : 0
        },
        spending: {
          total: totalSpent,
          average: trips.length > 0 ? (totalSpent / trips.length).toFixed(2) : 0
        }
      };
    } catch (error) {
      console.error("Error getting client analytics:", error);
      throw error;
    }
  }

  /**
   * Get demand heatmap data
   */
  static async getDemandHeatmap(hours = 24) {
    try {
      const startDate = new Date(Date.now() - hours * 3600000);
      
      const analytics = await Analytics.find({
        date: { $gte: startDate }
      }).sort({ date: -1 });
      
      // Group by area and calculate demand
      const heatmapData = {};
      
      analytics.forEach(record => {
        if (record.location && record.location.area) {
          const area = record.location.area;
          if (!heatmapData[area]) {
            heatmapData[area] = {
              area,
              lat: record.location.lat,
              lng: record.location.lng,
              totalDemand: 0,
              avgDemandScore: 0,
              tripCount: 0
            };
          }
          
          heatmapData[area].totalDemand += record.demandScore || 0;
          heatmapData[area].tripCount += record.tripsRequested || 0;
        }
      });
      
      // Calculate averages
      Object.values(heatmapData).forEach(item => {
        item.avgDemandScore = item.totalDemand > 0 ? Math.round(item.totalDemand / analytics.length) : 0;
      });
      
      return Object.values(heatmapData);
    } catch (error) {
      console.error("Error getting demand heatmap:", error);
      throw error;
    }
  }

  /**
   * Get revenue breakdown
   */
  static async getRevenueBreakdown(days = 30) {
    try {
      const startDate = new Date(Date.now() - days * 86400000);
      
      const trips = await Trip.find({
        createdAt: { $gte: startDate },
        status: 'completed'
      });
      
      const breakdown = {
        totalRevenue: 0,
        platformFees: 0,
        riderEarnings: 0,
        byDay: {}
      };
      
      trips.forEach(trip => {
        const amount = trip.estimatedValue || 0;
        const riderShare = trip.riderEarnings || 0;
        const platformShare = amount - riderShare;
        
        breakdown.totalRevenue += amount;
        breakdown.platformFees += platformShare;
        breakdown.riderEarnings += riderShare;
        
        const day = new Date(trip.createdAt).toLocaleDateString();
        if (!breakdown.byDay[day]) {
          breakdown.byDay[day] = { revenue: 0, riders: 0, platform: 0 };
        }
        breakdown.byDay[day].revenue += amount;
        breakdown.byDay[day].riders += riderShare;
        breakdown.byDay[day].platform += platformShare;
      });
      
      return breakdown;
    } catch (error) {
      console.error("Error getting revenue breakdown:", error);
      throw error;
    }
  }

  /**
   * Get top performers
   */
  static async getTopRiders(limit = 10) {
    try {
      const topRiders = await RiderPerformance.find()
        .sort({ averageRating: -1, totalTrips: -1 })
        .limit(limit)
        .populate('riderId', 'firstName lastName phone averageRating');
      
      return topRiders;
    } catch (error) {
      console.error("Error getting top riders:", error);
      throw error;
    }
  }

  /**
   * Check if a date is a holiday
   */
  static isHoliday(date) {
    const holidays = [
      '01-01', // New Year
      '04-10', // Good Friday
      '04-13', // Easter Monday
      '04-25', // Labour Day (Kenya)
      '06-17', // Madaraka Day
      '10-20', // Kenyatta Day
      '12-25', // Christmas
      '12-26'  // Boxing Day
    ];
    
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${month}-${day}`;
    
    return holidays.includes(dateStr);
  }
}

export default AnalyticsService;
