import Analytics from "../models/Analytics.js";
import PriceHistory from "../models/PriceHistory.js";

/**
 * Dynamic Pricing Engine using ML
 * Calculates surge pricing and optimal prices based on demand, time, location, and historical data
 */

class DynamicPricingService {
  /**
   * Calculate optimal price for a trip
   */
  static async calculateOptimalPrice({
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    distanceKm,
    estimatedDuration,
    serviceType = "standard",
    pickupArea,
    dropoffArea
  }) {
    try {
      // Base fare calculation
      const BASE_FARE = 100; // KES
      const DISTANCE_RATE = 15; // KES per km
      const TIME_RATE = 2; // KES per minute
      
      // Calculate base price
      const distanceFare = distanceKm * DISTANCE_RATE;
      const timeFare = estimatedDuration * TIME_RATE;
      const baseFare = BASE_FARE + distanceFare + timeFare;
      
      // Get surge pricing multiplier based on demand
      const surgeFactor = await this.calculateSurgeMultiplier(pickupArea);
      
      // Get time-based multiplier
      const timeMultiplier = this.getTimeMultiplier(new Date());
      
      // Get location-based discount/markup
      const locationMultiplier = this.getLocationMultiplier(pickupArea, dropoffArea);
      
      // Get seasonal/weather adjustment
      const seasonalMultiplier = await this.getSeasonalMultiplier();
      
      // Combine all multipliers
      const totalMultiplier = surgeFactor * timeMultiplier * locationMultiplier * seasonalMultiplier;
      
      const finalPrice = Math.round(baseFare * totalMultiplier);
      
      return {
        basePrice: baseFare,
        distancePrice: distanceFare,
        timePrice: timeFare,
        surgeFactor,
        timeMultiplier,
        locationMultiplier,
        seasonalMultiplier,
        finalPrice,
        currency: "KES",
        breakdown: {
          basicFare: BASE_FARE,
          distanceFare,
          timeFare,
          adjustedPrice: finalPrice
        }
      };
    } catch (error) {
      console.error("Error calculating price:", error);
      throw error;
    }
  }

  /**
   * Calculate surge multiplier based on demand-supply ratio
   */
  static async calculateSurgeMultiplier(area) {
    try {
      const now = new Date();
      const hour = now.getHours();
      
      // Get recent analytics for this area
      const recentAnalytics = await Analytics.findOne({
        'location.area': area,
        hour: hour,
        date: { $gte: new Date(Date.now() - 3600000) } // Last hour
      });
      
      if (!recentAnalytics) {
        return 1.0; // No surge by default
      }
      
      const { demandScore, activeRiders, tripsRequested } = recentAnalytics;
      
      // Calculate demand-supply ratio
      const demandSupplyRatio = activeRiders > 0 
        ? tripsRequested / activeRiders 
        : 1;
      
      // ML-based surge calculation
      let surgeFactor = 1.0;
      
      if (demandScore > 80) {
        surgeFactor = 2.5; // Very high demand
      } else if (demandScore > 60) {
        surgeFactor = 2.0; // High demand
      } else if (demandScore > 40) {
        surgeFactor = 1.5; // Medium-high demand
      } else if (demandScore > 20) {
        surgeFactor = 1.2; // Moderate demand
      }
      
      // Adjust based on demand-supply ratio
      surgeFactor *= (1 + demandSupplyRatio * 0.2);
      
      // Cap at maximum
      return Math.min(surgeFactor, 3.0);
    } catch (error) {
      console.error("Error calculating surge:", error);
      return 1.0;
    }
  }

  /**
   * Get time-based multiplier
   * Peak hours (7-9 AM, 5-8 PM): 1.3x
   * Night hours (10 PM - 5 AM): 1.5x
   * Regular hours: 1.0x
   */
  static getTimeMultiplier(date) {
    const hour = date.getHours();
    const day = date.getDay();
    
    // Night multiplier (10 PM to 5 AM)
    if (hour >= 22 || hour < 5) {
      return 1.5;
    }
    
    // Peak hours multiplier
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20)) {
      return 1.3;
    }
    
    // Weekend adjustment
    if (day === 0 || day === 6) {
      return 1.15;
    }
    
    return 1.0;
  }

  /**
   * Get location-based multiplier
   * Premium areas: 1.2x
   * Standard areas: 1.0x
   * Distant areas: 0.9x
   */
  static getLocationMultiplier(pickupArea, dropoffArea) {
    const premiumAreas = ['cbd', 'westlands', 'kilimani', 'karen', 'airport'];
    const distantAreas = ['outskirts', 'extendedarea'];
    
    let multiplier = 1.0;
    
    if (premiumAreas.includes(pickupArea?.toLowerCase())) {
      multiplier += 0.1;
    }
    
    if (distantAreas.includes(pickupArea?.toLowerCase())) {
      multiplier -= 0.1;
    }
    
    // If drop-off is far from pickup, increase price
    if (distantAreas.includes(dropoffArea?.toLowerCase())) {
      multiplier += 0.15;
    }
    
    return Math.max(multiplier, 0.8);
  }

  /**
   * Get seasonal/weather multiplier
   */
  static async getSeasonalMultiplier() {
    try {
      // Get today's analytics for weather/season impact
      const todayAnalytics = await Analytics.findOne({
        date: { 
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      });
      
      if (!todayAnalytics) return 1.0;
      
      let multiplier = 1.0;
      
      // Weather adjustments
      if (todayAnalytics.weatherCondition === 'rain') {
        multiplier = 1.25;
      } else if (todayAnalytics.weatherCondition === 'heavy_rain') {
        multiplier = 1.5;
      }
      
      // Holiday adjustment
      if (todayAnalytics.holidayFlag) {
        multiplier *= 1.2;
      }
      
      return multiplier;
    } catch (error) {
      return 1.0;
    }
  }

  /**
   * Record trip pricing for ML model training
   */
  static async recordTripPricing({
    tripId,
    baseFareAmount,
    distanceKm,
    durationMinutes,
    basePrice,
    distancePrice,
    timePrice,
    surgeFactor,
    finalPrice,
    pickupArea,
    dropoffArea,
    pickupCoords,
    dropoffCoords,
    demandLevel,
    weatherCondition
  }) {
    try {
      const now = new Date();
      
      await PriceHistory.create({
        tripId,
        baseFareAmount,
        distanceKm,
        durationMinutes,
        basePrice,
        distancePrice,
        timePrice,
        surgePricingMultiplier: surgeFactor,
        finalPrice,
        requestedAt: now,
        timeOfDay: now.getHours(),
        dayOfWeek: now.getDay(),
        isWeekend: now.getDay() === 0 || now.getDay() === 6,
        pickupArea,
        dropoffArea,
        pickupCoords,
        dropoffCoords,
        demandLevel,
        weatherCondition
      });
    } catch (error) {
      console.error("Error recording trip pricing:", error);
    }
  }

  /**
   * Get price recommendation for display to client
   */
  static async getPriceRecommendation({
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    distanceKm,
    estimatedDuration,
    pickupArea
  }) {
    const priceData = await this.calculateOptimalPrice({
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      distanceKm,
      estimatedDuration,
      pickupArea
    });

    return {
      estimatedPrice: priceData.finalPrice,
      priceRange: {
        min: Math.round(priceData.finalPrice * 0.9),
        max: Math.round(priceData.finalPrice * 1.1)
      },
      breakdown: priceData.breakdown,
      message: this.getSurgeMessage(priceData.surgeFactor)
    };
  }

  static getSurgeMessage(surgeFactor) {
    if (surgeFactor > 2.0) {
      return "🔥 Very high demand! Prices are 2x or more";
    } else if (surgeFactor > 1.5) {
      return "📈 High demand prices apply";
    } else if (surgeFactor > 1.2) {
      return "↑ Moderate demand adjustment";
    } else if (surgeFactor < 1.0) {
      return "✨ Great prices! Low demand";
    }
    return "✓ Standard prices";
  }
}

export default DynamicPricingService;
