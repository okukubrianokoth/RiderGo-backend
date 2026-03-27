import Rider from "../models/Rider.js";
import Client from "../models/Client.js";
import Trip from "../models/Trip.js";
import RiderPerformance from "../models/RiderPerformance.js";
import ClientBehavior from "../models/ClientBehavior.js";

/**
 * Fraud Detection Engine
 * Detects suspicious behavior and potential fraud
 */

class FraudDetectionService {
  /**
   * Analyze rider for fraud signals
   */
  static async analyzeRiderFraud(riderId) {
    try {
      const rider = await Rider.findById(riderId);
      const performance = await RiderPerformance.findOne({ riderId });
      const trips = await Trip.find({ riderId });
      
      if (!rider || !performance) {
        return { score: 0, signals: [] };
      }

      const signals = [];
      let fraudScore = 0;
      
      // Signal 1: Too many cancellations (>50%)
      const cancellationRate = performance.cancellationRate || 0;
      if (cancellationRate > 50) {
        signals.push({
          type: 'HIGH_CANCELLATION_RATE',
          severity: 'high',
          message: `Cancellation rate: ${cancellationRate}%`,
          impact: 25
        });
        fraudScore += 25;
      } else if (cancellationRate > 30) {
        signals.push({
          type: 'MODERATE_CANCELLATION_RATE',
          severity: 'medium',
          message: `Cancellation rate: ${cancellationRate}%`,
          impact: 15
        });
        fraudScore += 15;
      }
      
      // Signal 2: Extremely low rating with many trips
      if (performance.averageRating < 2.5 && performance.totalTrips > 20) {
        signals.push({
          type: 'LOW_RATING_WITH_VOLUME',
          severity: 'high',
          message: `Rating: ${performance.averageRating}/5 on ${performance.totalTrips} trips`,
          impact: 20
        });
        fraudScore += 20;
      }
      
      // Signal 3: Multiple accounts from same phone/location
      const otherRidersWithPhone = await Rider.countDocuments({
        phone: rider.phone,
        _id: { $ne: riderId }
      });
      
      if (otherRidersWithPhone > 0) {
        signals.push({
          type: 'DUPLICATE_PHONE',
          severity: 'high',
          message: `Found ${otherRidersWithPhone} other accounts with this phone`,
          impact: 30
        });
        fraudScore += 30;
      }
      
      // Signal 4: Suspicious acceptance pattern (always accepts then cancels)
      const suspiciousPattern = trips.filter(t => 
        t.status === 'cancelled' && t.createdAt > new Date(Date.now() - 86400000)
      ).length;
      
      if (suspiciousPattern > 5) {
        signals.push({
          type: 'ACCEPT_CANCEL_PATTERN',
          severity: 'medium',
          message: `${suspiciousPattern} cancellations in last 24 hours`,
          impact: 18
        });
        fraudScore += 18;
      }
      
      // Signal 5: Location jumping (teleporting between locations)
      const locationJumps = this.detectLocationJumps(trips);
      if (locationJumps > 3) {
        signals.push({
          type: 'SUSPICIOUS_LOCATION_JUMPS',
          severity: 'medium',
          message: `${locationJumps} impossible location jumps detected`,
          impact: 20
        });
        fraudScore += 20;
      }
      
      // Signal 6: Unverified documents
      if (!rider.isVerified || !rider.nationalIdImage || !rider.drivingLicenseImage) {
        signals.push({
          type: 'UNVERIFIED_DOCUMENTS',
          severity: 'low',
          message: 'Documents not verified',
          impact: 10
        });
        fraudScore += 10;
      }
      
      // Signal 7: Fake identity
      if (this.isSuspiciousName(rider.firstName + ' ' + rider.lastName)) {
        signals.push({
          type: 'SUSPICIOUS_NAME',
          severity: 'low',
          message: 'Name contains suspicious patterns',
          impact: 5
        });
        fraudScore += 5;
      }
      
      // Cap score at 100
      fraudScore = Math.min(fraudScore, 100);
      
      return {
        score: fraudScore,
        riskLevel: fraudScore > 70 ? 'high' : fraudScore > 40 ? 'medium' : 'low',
        signals,
        recommendation: this.getFraudRecommendation(fraudScore),
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error("Error analyzing rider fraud:", error);
      throw error;
    }
  }

  /**
   * Analyze client for fraud signals
   */
  static async analyzeClientFraud(clientId) {
    try {
      const client = await Client.findById(clientId);
      const behavior = await ClientBehavior.findOne({ clientId });
      const trips = await Trip.find({ clientId });
      
      if (!client || !behavior) {
        return { score: 0, signals: [] };
      }

      const signals = [];
      let fraudScore = 0;
      
      // Signal 1: High cancellation rate
      const cancellationRate = behavior.cancellationRate || 0;
      if (cancellationRate > 60) {
        signals.push({
          type: 'HIGH_CANCELLATION_RATE',
          severity: 'high',
          message: `Cancellation rate: ${cancellationRate}%`,
          impact: 25
        });
        fraudScore += 25;
      } else if (cancellationRate > 40) {
        signals.push({
          type: 'MODERATE_CANCELLATION_RATE',
          severity: 'medium',
          message: `Cancellation rate: ${cancellationRate}%`,
          impact: 15
        });
        fraudScore += 15;
      }
      
      // Signal 2: Pattern of giving bad ratings
      const badRatingsCount = trips.filter(t => t.riderRating < 3).length;
      if (badRatingsCount > 10 && trips.length > 20) {
        const badRatingRate = (badRatingsCount / trips.length) * 100;
        if (badRatingRate > 40) {
          signals.push({
            type: 'EXCESSIVE_BAD_RATINGS',
            severity: 'medium',
            message: `${badRatingsCount} bad ratings (${badRatingRate.toFixed(1)}%)`,
            impact: 20
          });
          fraudScore += 20;
        }
      }
      
      // Signal 3: No-show pattern
      const noShowRate = behavior.noShowRate || 0;
      if (noShowRate > 30) {
        signals.push({
          type: 'HIGH_NO_SHOW_RATE',
          severity: 'high',
          message: `No-show rate: ${noShowRate}%`,
          impact: 25
        });
        fraudScore += 25;
      }
      
      // Signal 4: Multiple accounts from same IP/location
      const otherClientsWithPhone = await Client.countDocuments({
        phone: client.phone,
        _id: { $ne: clientId }
      });
      
      if (otherClientsWithPhone > 0) {
        signals.push({
          type: 'DUPLICATE_PHONE',
          severity: 'high',
          message: `Found ${otherClientsWithPhone} other accounts with this phone`,
          impact: 30
        });
        fraudScore += 30;
      }
      
      // Signal 5: Payment chargeback history
      // (would need payment data to implement fully)
      
      // Signal 6: Rapid account cycling (multiple trips in very short time)
      const recentTrips = trips.filter(t => 
        t.createdAt > new Date(Date.now() - 3600000) // Last hour
      );
      if (recentTrips.length > 10) {
        signals.push({
          type: 'RAPID_TRIP_BOOKING',
          severity: 'medium',
          message: `${recentTrips.length} trips in last hour`,
          impact: 15
        });
        fraudScore += 15;
      }
      
      // Signal 7: Destination spoofing (route too expensive for distance)
      const expensiveTrips = trips.filter(t => {
        const fare = t.estimatedValue || 0;
        const distance = this.calculateDistance(
          t.pickupLocation?.lat, t.pickupLocation?.lng,
          t.dropoffLocation?.lat, t.dropoffLocation?.lng
        );
        return distance >0 && fare / distance > 100; // >100 KES/km is suspicious
      });
      
      if (expensiveTrips.length > trips.length * 0.3) {
        signals.push({
          type: 'SUSPICIOUS_FARES',
          severity: 'low',
          message: `${expensiveTrips.length} unusually expensive trips`,
          impact: 10
        });
        fraudScore += 10;
      }
      
      fraudScore = Math.min(fraudScore, 100);
      
      return {
        score: fraudScore,
        riskLevel: fraudScore > 70 ? 'high' : fraudScore > 40 ? 'medium' : 'low',
        signals,
        recommendation: this.getFraudRecommendation(fraudScore),
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error("Error analyzing client fraud:", error);
      throw error;
    }
  }

  /**
   * Detect impossible location jumps
   */
  static detectLocationJumps(trips, maxSpeedKPH = 150) {
    let jumps = 0;
    
    for (let i = 1; i < trips.length; i++) {
      const trip1 = trips[i - 1];
      const trip2 = trips[i];
      
      if (!trip1.currentLocation || !trip2.currentLocation) continue;
      
      const distance = this.calculateDistance(
        trip1.currentLocation.lat, trip1.currentLocation.lng,
        trip2.currentLocation.lat, trip2.currentLocation.lng
      );
      
      const timeDiffMinutes = (trip2.createdAt - trip1.createdAt) / 60000;
      if (timeDiffMinutes === 0) continue;
      
      const speedKPH = (distance / timeDiffMinutes) * 60;
      
      if (speedKPH > maxSpeedKPH) {
        jumps++;
      }
    }
    
    return jumps;
  }

  /**
   * Calculate distance between two points
   */
  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Check for suspicious name patterns
   */
  static isSuspiciousName(name) {
    const suspiciousPatterns = [
      /test/i, /admin/i, /fake/i, /xxx/i, /aaaaaa/i, /123/,
      /[^a-z\s-]/gi, // Non-alphabetic characters
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(name));
  }

  /**
   * Get fraud recommendation
   */
  static getFraudRecommendation(score) {
    if (score > 80) {
      return {
        action: 'BLOCK_IMMEDIATELY',
        message: 'Account shows severe fraud indicators. Recommend immediate suspension.'
      };
    } else if (score > 60) {
      return {
        action: 'MANUAL_REVIEW',
        message: 'Account requires manual fraud review by support team.'
      };
    } else if (score > 40) {
      return {
        action: 'MONITOR',
        message: 'Account requires monitoring. Watch for patterns developing.'
      };
    } else {
      return {
        action: 'ALLOW',
        message: 'Account appears to be legitimate. Low fraud risk.'
      };
    }
  }

  /**
   * Get all high-risk users
   */
  static async getHighRiskUsers(threshold = 60) {
    try {
      const riderPerformances = await RiderPerformance.find({
        fraudSuspicionScore: { $gte: threshold }
      }).populate('riderId', 'firstName lastName phone');
      
      const clientBehaviors = await ClientBehavior.find({
        fraudSuspicionScore: { $gte: threshold }
      }).populate('clientId', 'firstName lastName phone');
      
      return {
        riders: riderPerformances,
        clients: clientBehaviors
      };
    } catch (error) {
      console.error("Error getting high risk users:", error);
      throw error;
    }
  }
}

export default FraudDetectionService;
