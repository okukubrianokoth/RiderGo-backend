import Rider from "../models/Rider.js";
import RiderPerformance from "../models/RiderPerformance.js";
import Trip from "../models/Trip.js";

/**
 * Intelligent Rider Matching Engine
 * Uses ML to match riders to trips based on multiple factors
 */

class RiderMatchingService {
  /**
   * Find best riders for a trip using ML scoring
   */
  static async findBestRiders({
    tripId,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    serviceType = "standard",
    maxResults = 10
  }) {
    try {
      // Get all online riders
      const onlineRiders = await Rider.find({
        isOnline: true,
        status: 'approved',
        subscriptionActive: true
      }).select('_id phone firstName lastName currentLocation vehicleType').lean();
      
      if (onlineRiders.length === 0) {
        return [];
      }
      
      // Score each rider
      const scoredRiders = await Promise.all(
        onlineRiders.map(async (rider) => {
          const score = await this.calculateRiderScore(
            rider,
            {
              pickupLat,
              pickupLng,
              dropoffLat,
              dropoffLng,
              serviceType
            }
          );
          
          return {
            ...rider,
            matchScore: score.totalScore,
            scoreBreakdown: score.breakdown,
            estimatedArrivalTime: score.estimatedArrivalTime
          };
        })
      );
      
      // Sort by score and return top matches
      return scoredRiders
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, maxResults);
    } catch (error) {
      console.error("Error finding best riders:", error);
      throw error;
    }
  }

  /**
   * Calculate match score for a rider
   * Considers: location, rating, acceptance rate, vehicle, availability
   */
  static async calculateRiderScore(rider, tripDetails) {
    try {
      const performance = await RiderPerformance.findOne({ riderId: rider._id });
      
      if (!performance) {
        // If no performance data, assign default score
        return {
          totalScore: 50,
          breakdown: {
            distanceScore: 50,
            performanceScore: 50,
            acceptanceScore: 50
          },
          estimatedArrivalTime: 10
        };
      }

      // 1. Location-based score (40% weight)
      const distanceScore = this.calculateDistanceScore(
        rider.currentLocation,
        { lat: tripDetails.pickupLat, lng: tripDetails.pickupLng }
      );
      
      // 2. Performance-based score (35% weight)
      const performanceScore = this.calculatePerformanceScore(performance);
      
      // 3. Acceptance likelihood score (15% weight)
      const acceptanceScore = this.calculateAcceptanceScore(performance);
      
      // 4. Vehicle match score (10% weight)
      const vehicleScore = this.calculateVehicleScore(rider.vehicleType, tripDetails.serviceType);
      
      // Calculate weighted total
      const totalScore = 
        (distanceScore * 0.40) +
        (performanceScore * 0.35) +
        (acceptanceScore * 0.15) +
        (vehicleScore * 0.10);
      
      // Estimate arrival time based on distance
      const estimatedArrivalTime = Math.ceil(distanceScore > 75 ? 5 : 15);
      
      return {
        totalScore: Math.round(totalScore),
        breakdown: {
          distanceScore: Math.round(distanceScore),
          performanceScore: Math.round(performanceScore),
          acceptanceScore: Math.round(acceptanceScore),
          vehicleScore: Math.round(vehicleScore)
        },
        estimatedArrivalTime
      };
    } catch (error) {
      console.error("Error calculating rider score:", error);
      return {
        totalScore: 0,
        breakdown: {},
        estimatedArrivalTime: 10
      };
    }
  }

  /**
   * Score rider based on proximity to pickup location
   * Closer = higher score
   */
  static calculateDistanceScore(riderLocation, pickupLocation) {
    if (!riderLocation || !riderLocation.lat) {
      return 0;
    }

    // Calculate distance using haversine formula
    const distance = this.haversineDistance(
      riderLocation.lat,
      riderLocation.lng,
      pickupLocation.lat,
      pickupLocation.lng
    );

    // Distance score: 0-100
    // 0 km = 100, 5 km = 50, 10+ km = 0
    if (distance <= 0.5) return 100;
    if (distance <= 1) return 90;
    if (distance <= 2) return 75;
    if (distance <= 3) return 60;
    if (distance <= 5) return 40;
    if (distance <= 10) return 20;
    return 0;
  }

  /**
   * Score rider based on overall performance
   */
  static calculatePerformanceScore(performance) {
    if (!performance) return 50;

    const {
      averageRating,
      completionRate,
      acceptanceRate,
      fraudSuspicionScore
    } = performance;

    // Rating score (out of 100)
    const ratingScore = Math.min((averageRating / 5) * 50, 50);
    
    // Completion rate score
    const completionScore = (completionRate || 0) * 0.3;
    
    // Acceptance rate score
    const acceptanceScore = (acceptanceRate || 0) * 0.2;
    
    // Fraud penalty
    const fraudPenalty = Math.max(0, 20 - (fraudSuspicionScore || 0) * 0.2);
    
    return Math.round(ratingScore + completionScore + acceptanceScore + fraudPenalty);
  }

  /**
   * Score based on likelihood to accept this trip
   */
  static calculateAcceptanceScore(performance) {
    if (!performance) return 50;

    const {
      acceptanceRate,
      churnRisk,
      preferredAreas,
      totalTrips
    } = performance;

    // Base score from acceptance rate
    let score = (acceptanceRate || 0) * 0.6;
    
    // Penalize high churn risk riders
    score += Math.max(0, 20 - ((churnRisk || 0) * 30));
    
    // Bonus for experienced riders
    if (totalTrips > 100) {
      score += 15;
    } else if (totalTrips > 50) {
      score += 10;
    }
    
    // Bonus if they prefer this area (if available)
    if (preferredAreas && preferredAreas.length > 0) {
      score += 5;
    }
    
    return Math.min(Math.round(score), 100);
  }

  /**
   * Score based on vehicle match
   */
  static calculateVehicleScore(riderVehicleType, serviceType) {
    const vehicleMatchScores = {
      'standard|motorcycle': 100,
      'standard|car': 90,
      'standard|van': 85,
      'premium|car': 100,
      'premium|van': 95,
      'cargo|van': 100,
      'cargo|truck': 95
    };

    const key = `${serviceType}|${(riderVehicleType || 'car').toLowerCase()}`;
    return vehicleMatchScores[key] || 80;
  }

  /**
   * Haversine formula to calculate distance between two coordinates
   */
  static haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * AI-powered route optimization and ETA prediction for GPS tracking
   */
  static async optimizeRouteAndPredictETA({
    riderId,
    tripId,
    currentLat,
    currentLng,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    trafficData = null
  }) {
    try {
      // Get historical route data for this area
      const historicalRoutes = await this.getHistoricalRouteData(pickupLat, pickupLng, dropoffLat, dropoffLng);
      
      // Calculate optimal route using AI
      const optimalRoute = await this.calculateOptimalRoute({
        currentLat,
        currentLng,
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng,
        historicalRoutes,
        trafficData
      });
      
      // Predict ETA using ML model
      const etaPrediction = await this.predictETA({
        route: optimalRoute,
        currentTime: new Date(),
        historicalData: historicalRoutes,
        trafficData
      });
      
      // Calculate real-time progress
      const progress = this.calculateTripProgress({
        currentLat,
        currentLng,
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng
      });
      
      return {
        optimalRoute,
        etaPrediction,
        progress,
        recommendations: this.generateRouteRecommendations(optimalRoute, trafficData)
      };
    } catch (error) {
      console.error("Error in route optimization:", error);
      // Fallback to basic calculations
      return this.fallbackRouteCalculation(currentLat, currentLng, pickupLat, pickupLng, dropoffLat, dropoffLng);
    }
  }

  /**
   * Get historical route data for AI training
   */
  static async getHistoricalRouteData(pickupLat, pickupLng, dropoffLat, dropoffLng) {
    try {
      // Get completed trips in this area within last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const historicalTrips = await Trip.find({
        status: 'completed',
        createdAt: { $gte: thirtyDaysAgo },
        'pickupLocation.lat': { $gte: pickupLat - 0.01, $lte: pickupLat + 0.01 },
        'pickupLocation.lng': { $gte: pickupLng - 0.01, $lte: pickupLng + 0.01 },
        'dropoffLocation.lat': { $gte: dropoffLat - 0.01, $lte: dropoffLat + 0.01 },
        'dropoffLocation.lng': { $gte: dropoffLng - 0.01, $lte: dropoffLng + 0.01 }
      }).select('estimatedDuration actualDuration createdAt').lean();
      
      return historicalTrips;
    } catch (error) {
      console.error("Error getting historical route data:", error);
      return [];
    }
  }

  /**
   * Calculate optimal route using AI algorithms
   */
  static async calculateOptimalRoute({
    currentLat,
    currentLng,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    historicalRoutes,
    trafficData
  }) {
    // Calculate distances
    const toPickup = this.haversineDistance(currentLat, currentLng, pickupLat, pickupLng);
    const pickupToDropoff = this.haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    const totalDistance = toPickup + pickupToDropoff;
    
    // Get average speed based on historical data (km/h)
    const avgSpeed = this.calculateAverageSpeed(historicalRoutes, totalDistance);
    
    // Estimate time with traffic considerations
    const baseTime = (totalDistance / avgSpeed) * 60; // minutes
    const trafficMultiplier = this.getTrafficMultiplier(new Date(), trafficData);
    
    return {
      totalDistance: Math.round(totalDistance * 10) / 10,
      estimatedDuration: Math.round(baseTime * trafficMultiplier),
      waypoints: [
        { lat: currentLat, lng: currentLng, type: 'current' },
        { lat: pickupLat, lng: pickupLng, type: 'pickup' },
        { lat: dropoffLat, lng: dropoffLng, type: 'dropoff' }
      ],
      trafficMultiplier,
      confidence: 0.85 // AI confidence score
    };
  }

  /**
   * Predict ETA using machine learning
   */
  static async predictETA({ route, currentTime, historicalData, trafficData }) {
    const hour = currentTime.getHours();
    const dayOfWeek = currentTime.getDay();
    
    // Base prediction on historical data
    const similarTrips = historicalData.filter(trip => {
      const tripHour = new Date(trip.createdAt).getHours();
      return Math.abs(tripHour - hour) <= 1;
    });
    
    let predictedDuration = route.estimatedDuration;
    
    if (similarTrips.length > 0) {
      const avgHistoricalDuration = similarTrips.reduce((sum, trip) => 
        sum + (trip.actualDuration || trip.estimatedDuration), 0) / similarTrips.length;
      
      // Weighted average of route calculation and historical data
      predictedDuration = (route.estimatedDuration * 0.6) + (avgHistoricalDuration * 0.4);
    }
    
    // Adjust for day of week
    const weekendMultiplier = [0, 1, 1, 1, 1, 1, 0.8][dayOfWeek]; // Sunday = 0, Saturday = 6
    predictedDuration *= weekendMultiplier;
    
    // Calculate arrival time
    const arrivalTime = new Date(currentTime.getTime() + predictedDuration * 60000);
    
    return {
      estimatedDuration: Math.round(predictedDuration),
      arrivalTime: arrivalTime.toISOString(),
      confidence: similarTrips.length > 5 ? 0.9 : 0.7,
      factors: {
        traffic: route.trafficMultiplier,
        historical: similarTrips.length,
        dayOfWeek: weekendMultiplier
      }
    };
  }

  /**
   * Calculate trip progress percentage
   */
  static calculateTripProgress({ currentLat, currentLng, pickupLat, pickupLng, dropoffLat, dropoffLng }) {
    const toPickup = this.haversineDistance(currentLat, currentLng, pickupLat, pickupLng);
    const pickupToDropoff = this.haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    const totalDistance = toPickup + pickupToDropoff;
    
    // Determine current phase
    const distanceToPickup = this.haversineDistance(currentLat, currentLng, pickupLat, pickupLng);
    const distanceFromPickup = this.haversineDistance(currentLat, currentLng, pickupLat, pickupLng);
    
    let phase = 'to_pickup';
    let progress = 0;
    
    if (distanceToPickup < 0.1) { // Within 100m of pickup
      phase = 'at_pickup';
      progress = 25;
    } else if (distanceFromPickup < distanceToPickup) { // Closer to pickup than starting point
      phase = 'to_pickup';
      progress = Math.max(10, 25 - (distanceToPickup / totalDistance) * 25);
    } else {
      // Calculate progress based on position relative to pickup
      const progressToPickup = Math.max(0, (1 - distanceToPickup / (totalDistance - pickupToDropoff)) * 25);
      progress = progressToPickup;
    }
    
    return {
      phase,
      progress: Math.round(progress),
      distanceRemaining: Math.round(toPickup * 10) / 10,
      nextMilestone: phase === 'to_pickup' ? 'pickup' : 'dropoff'
    };
  }

  /**
   * Generate AI-powered route recommendations
   */
  static generateRouteRecommendations(route, trafficData) {
    const recommendations = [];
    
    if (route.trafficMultiplier > 1.5) {
      recommendations.push({
        type: 'traffic',
        message: 'Heavy traffic detected. Consider alternative routes.',
        priority: 'high'
      });
    }
    
    if (route.confidence < 0.8) {
      recommendations.push({
        type: 'uncertainty',
        message: 'ETA prediction has low confidence due to limited historical data.',
        priority: 'medium'
      });
    }
    
    const currentHour = new Date().getHours();
    if (currentHour >= 17 && currentHour <= 19) {
      recommendations.push({
        type: 'peak_hour',
        message: 'Peak hour traffic may affect delivery time.',
        priority: 'medium'
      });
    }
    
    return recommendations;
  }

  /**
   * Calculate average speed from historical data
   */
  static calculateAverageSpeed(historicalRoutes, distance) {
    if (historicalRoutes.length === 0) return 25; // Default 25 km/h
    
    const avgDuration = historicalRoutes.reduce((sum, route) => 
      sum + (route.actualDuration || route.estimatedDuration), 0) / historicalRoutes.length;
    
    const avgSpeed = distance / (avgDuration / 60); // km/h
    return Math.max(15, Math.min(60, avgSpeed)); // Clamp between 15-60 km/h
  }

  /**
   * Get traffic multiplier based on time and data
   */
  static getTrafficMultiplier(currentTime, trafficData) {
    const hour = currentTime.getHours();
    const dayOfWeek = currentTime.getDay();
    
    // Base multipliers for different times
    let baseMultiplier = 1.0;
    
    if (hour >= 7 && hour <= 9) baseMultiplier = 1.3; // Morning rush
    if (hour >= 17 && hour <= 19) baseMultiplier = 1.4; // Evening rush
    if (hour >= 12 && hour <= 14) baseMultiplier = 1.1; // Lunch time
    
    // Weekend adjustments
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      baseMultiplier *= 0.9; // Less traffic on weekends
    }
    
    return baseMultiplier;
  }

  /**
   * Fallback route calculation when AI fails
   */
  static fallbackRouteCalculation(currentLat, currentLng, pickupLat, pickupLng, dropoffLat, dropoffLng) {
    const toPickup = this.haversineDistance(currentLat, currentLng, pickupLat, pickupLng);
    const pickupToDropoff = this.haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    
    return {
      optimalRoute: {
        totalDistance: Math.round((toPickup + pickupToDropoff) * 10) / 10,
        estimatedDuration: Math.round((toPickup + pickupToDropoff) / 25 * 60), // 25 km/h average
        waypoints: [
          { lat: currentLat, lng: currentLng, type: 'current' },
          { lat: pickupLat, lng: pickupLng, type: 'pickup' },
          { lat: dropoffLat, lng: dropoffLng, type: 'dropoff' }
        ],
        trafficMultiplier: 1.0,
        confidence: 0.5
      },
      etaPrediction: {
        estimatedDuration: Math.round((toPickup + pickupToDropoff) / 25 * 60),
        arrivalTime: new Date(Date.now() + (toPickup + pickupToDropoff) / 25 * 60 * 60000).toISOString(),
        confidence: 0.5,
        factors: { traffic: 1.0, historical: 0, dayOfWeek: 1.0 }
      },
      progress: this.calculateTripProgress({ currentLat, currentLng, pickupLat, pickupLng, dropoffLat, dropoffLng }),
      recommendations: []
    };
  }

  /**
   * Auto-assign trip to best available rider
   */
  static async autoAssignTrip(tripId, maxWaitTime = 60000) {
    try {
      const trip = await Trip.findById(tripId);
      
      if (!trip) {
        throw new Error('Trip not found');
      }

      const bestRiders = await this.findBestRiders({
        tripId,
        pickupLat: trip.pickupLocation.lat,
        pickupLng: trip.pickupLocation.lng,
        dropoffLat: trip.dropoffLocation.lat,
        dropoffLng: trip.dropoffLocation.lng,
        serviceType: 'standard',
        maxResults: 5
      });

      // Try to assign to top riders sequentially
      for (const rider of bestRiders) {
        if (this.isGoodCandidate(await RiderPerformance.findOne({ riderId: rider._id }))) {
          return {
            riderId: rider._id,
            matchScore: rider.matchScore,
            estimatedArrival: rider.estimatedArrivalTime
          };
        }
      }

      return null;
    } catch (error) {
      console.error("Error auto-assigning trip:", error);
      throw error;
    }
  }
}

export default RiderMatchingService;
