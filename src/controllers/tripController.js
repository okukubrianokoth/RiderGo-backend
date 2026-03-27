// src/controllers/tripController.js
import Trip from "../models/Trip.js";
import Message from "../models/Message.js";
import Rider from "../models/Rider.js";
import axios from "axios";
import RiderMatchingService from "../services/RiderMatchingService.js";
import DynamicPricingService from "../services/DynamicPricingService.js";

// 1. Get Available Trips (Pending & Unassigned)
export const getAvailableTrips = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    let trips = await Trip.find({
      status: "pending",
      riderId: null
    })
    .populate("clientId", "firstName lastName phone rating")
    .sort({ createdAt: -1 });

    // If rider location is provided, sort by proximity
    if (lat && lng) {
      const riderLat = parseFloat(lat);
      const riderLng = parseFloat(lng);

      trips = trips.map(trip => {
        const t = trip.toObject();
        if (t.pickupLocation?.lat && t.pickupLocation?.lng) {
          // Simple distance calc for sorting
          const dLat = t.pickupLocation.lat - riderLat;
          const dLon = t.pickupLocation.lng - riderLng;
          t.distanceToPickup = Math.sqrt(dLat*dLat + dLon*dLon);
        } else {
          t.distanceToPickup = 9999;
        }
        return t;
      }).sort((a, b) => a.distanceToPickup - b.distanceToPickup);
    }

    res.json({ success: true, trips });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 6. Location autocomplete helper
export const getLocationSuggestions = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.trim().length === 0) {
      return res.json({ success: true, suggestions: [] });
    }

    const token = process.env.LOCATIONIQ_ACCESS_TOKEN;
    if (!token) {
      return res.status(500).json({ message: 'LocationIQ API key not configured.' });
    }

    const response = await axios.get('https://us1.locationiq.com/v1/autocomplete.php', {
      params: {
        key: token,
        q: query,
        format: 'json',
        limit: 6,
        countrycodes: 'ke'
      }
    });

    const suggestions = (response.data || []).map((item) => ({
      display_name: item.display_name,
      lat: item.lat,
      lon: item.lon
    }));

    res.json({ success: true, suggestions });
  } catch (error) {
    console.error('Location suggestions error:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch location suggestions' });
  }
};

// 7. Price estimate (AI/ML) for client input
export const getPriceEstimate = async (req, res) => {
  try {
    const { pickup, dropoff, pickupLat, pickupLng, dropoffLat, dropoffLng } = req.body;

    let pLat = pickupLat;
    let pLng = pickupLng;
    let dLat = dropoffLat;
    let dLng = dropoffLng;

    const token = process.env.LOCATIONIQ_ACCESS_TOKEN;
    if (!token) {
      return res.status(500).json({ message: 'LocationIQ API key not configured.' });
    }

    const geocode = async (address) => {
      const r = await axios.get('https://us1.locationiq.com/v1/search.php', {
        params: { key: token, q: address, format: 'json', limit: 1, countrycodes: 'ke' }
      });
      if (r.data && r.data.length > 0) {
        const location = r.data[0];
        return { lat: parseFloat(location.lat), lng: parseFloat(location.lon), name: location.display_name };
      }
      return null;
    };

    if ((!pLat || !pLng) && pickup) {
      const pGeo = await geocode(pickup);
      if (pGeo) {
        pLat = pGeo.lat;
        pLng = pGeo.lng;
      }
    }

    if ((!dLat || !dLng) && dropoff) {
      const dGeo = await geocode(dropoff);
      if (dGeo) {
        dLat = dGeo.lat;
        dLng = dGeo.lng;
      }
    }

    if (!pLat || !pLng || !dLat || !dLng) {
      return res.status(400).json({ message: 'Unable to resolve both pickup and dropoff locations.' });
    }

    const getDistanceKm = (lat1, lon1, lat2, lon2) => {
      const toRad = (x) => (x * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    const distanceKm = getDistanceKm(pLat, pLng, dLat, dLng);
    const estimatedDuration = Math.max(5, Math.ceil((distanceKm / 30) * 60));

    const pickupArea = pickup ? pickup.split(',')[0].trim().toLowerCase() : 'unknown';
    const dropoffArea = dropoff ? dropoff.split(',')[0].trim().toLowerCase() : 'unknown';

    const priceRecommended = await DynamicPricingService.getPriceRecommendation({
      pickupLat: pLat,
      pickupLng: pLng,
      dropoffLat: dLat,
      dropoffLng: dLng,
      distanceKm,
      estimatedDuration,
      pickupArea,
      dropoffArea
    });

    res.json({
      success: true,
      price: priceRecommended,
      distanceKm: Number(distanceKm.toFixed(2)),
      durationMin: estimatedDuration,
      pickupCoords: { lat: pLat, lng: pLng },
      dropoffCoords: { lat: dLat, lng: dLng }
    });
  } catch (error) {
    console.error('Price estimate error:', error);
    res.status(500).json({ message: error.message || 'Failed to calculate price estimate' });
  }
};

// 8. Chat: Send Message
export const sendTripMessage = async (req, res) => {
  try {
    const { tripId, text, sender } = req.body; // sender: 'client' or 'rider'
    const message = await Message.create({ tripId, sender, text });
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 8. Chat: Get Messages
export const getTripMessages = async (req, res) => {
  try {
    const { tripId } = req.params;
    const messages = await Message.find({ tripId }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. Accept a Trip
export const acceptTrip = async (req, res) => {
  try {
    const { tripId } = req.body;
    const trip = await Trip.findById(tripId);

    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (trip.status !== "pending") return res.status(400).json({ message: "Trip already taken" });

    trip.riderId = req.rider.id;
    trip.status = "accepted";
    await trip.save();

    res.json({ success: true, message: "Trip accepted", trip });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. Start Trip (Arrived at pickup / Started journey)
export const startTrip = async (req, res) => {
  try {
    const { tripId } = req.body;
    const trip = await Trip.findOne({ _id: tripId, riderId: req.rider.id });

    if (!trip) return res.status(404).json({ message: "Trip not found or unauthorized" });

    trip.status = "in_progress"; // Ensure 'in_progress' is in your Trip model enum or use 'accepted'
    await trip.save();

    res.json({ success: true, message: "Trip started", trip });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3b. Arrived at Pickup
export const arrivedAtPickup = async (req, res) => {
  try {
    const { tripId } = req.body;
    const trip = await Trip.findOne({ _id: tripId, riderId: req.rider.id });

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    trip.status = "arrived_pickup";
    await trip.save();

    res.json({ success: true, message: "Rider arrived at pickup", trip });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3c. Confirm Pickup (Package Collected)
export const confirmPickup = async (req, res) => {
  try {
    const { tripId } = req.body;
    
    const updateData = { status: "picked_up" };
    if (req.file) {
      updateData.photoProofPickup = req.file.path;
    }

    const trip = await Trip.findOneAndUpdate(
      { _id: tripId, riderId: req.rider.id },
      updateData,
      { new: true }
    );
    res.json({ success: true, message: "Package picked up", trip });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. Complete Trip
export const endTrip = async (req, res) => {
  try {
    const { tripId } = req.body;
    
    const trip = await Trip.findOne({ _id: tripId, riderId: req.rider.id });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found or you are not the assigned rider." });
    }

    if (trip.status === 'completed') {
      return res.status(400).json({ message: "Trip is already completed." });
    }

    const updateData = { status: "completed", completedAt: new Date() };
    if (req.file) {
      updateData.photoProofDelivery = req.file.path;
    }

    const updatedTrip = await Trip.findByIdAndUpdate(
      tripId,
      updateData,
      { new: true }
    );

    // --- Wallet Logic (Bolt-like) ---
    const rider = await Rider.findById(req.rider.id);
    if (rider) {
      const tripAmount = updatedTrip.estimatedValue || 0;
      const earnings = updatedTrip.riderEarnings || 0;
      const commission = tripAmount - earnings;

      if (updatedTrip.paymentMethod === 'cash') {
        // Rider collected full cash.
        // They owe the platform the commission.
        // Wallet Balance decreases by commission.
        rider.walletBalance = (rider.walletBalance || 0) - commission;
      } else {
        // Payment was digital (Wallet/Card/Mpesa to System).
        // System owes rider their earnings.
        // Wallet Balance increases by earnings.
        rider.walletBalance = (rider.walletBalance || 0) + earnings;
      }
      
      await rider.save();
    }
    // --- End Wallet Logic ---

    res.json({ success: true, message: "Trip completed", trip: updatedTrip });
  } catch (error) {
    console.error('End trip error:', error);
    res.status(500).json({ message: error.message });
  }
};

// 5. Get Rider's Active Trips (Accepted/In Progress)
export const getRiderActiveTrips = async (req, res) => {
  try {
    const trips = await Trip.find({
      riderId: req.rider.id,
      status: { $in: ["accepted", "in_progress"] }
    }).populate("clientId", "firstName lastName phone");
    
    res.json({ success: true, trips });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 5b. Get Rider's History (Completed/Cancelled)
export const getRiderHistory = async (req, res) => {
  try {
    const trips = await Trip.find({
      riderId: req.rider.id,
      status: { $in: ["completed", "cancelled"] }
    })
    .populate("clientId", "firstName lastName phone")
    .sort({ createdAt: -1 });
    
    res.json({ success: true, trips });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 6. Update Trip Location (Rider sends GPS updates)
export const updateTripLocation = async (req, res) => {
  try {
    const { tripId, latitude, longitude } = req.body;
    
    await Trip.findByIdAndUpdate(tripId, {
      currentLocation: {
        lat: latitude,
        lng: longitude,
        updatedAt: new Date()
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 7. AI-Powered GPS Tracking with Route Optimization
export const getAIGPSTracking = async (req, res) => {
  try {
    const { tripId } = req.params;
    
    const trip = await Trip.findById(tripId)
      .populate('riderId', 'firstName lastName phone rating currentLocation')
      .populate('clientId', 'firstName lastName phone');
    
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }
    
    if (!trip.currentLocation || !trip.currentLocation.lat) {
      return res.status(400).json({ message: "Rider location not available yet" });
    }
    
    // Get AI-powered route optimization and ETA
    const aiTracking = await RiderMatchingService.optimizeRouteAndPredictETA({
      riderId: trip.riderId._id,
      tripId: trip._id,
      currentLat: trip.currentLocation.lat,
      currentLng: trip.currentLocation.lng,
      pickupLat: trip.pickupLocation.lat,
      pickupLng: trip.pickupLocation.lng,
      dropoffLat: trip.dropoffLocation.lat,
      dropoffLng: trip.dropoffLocation.lng
    });
    
    res.json({
      success: true,
      trip: {
        id: trip._id,
        status: trip.status,
        rider: {
          name: `${trip.riderId.firstName} ${trip.riderId.lastName}`,
          phone: trip.riderId.phone,
          rating: trip.riderId.rating,
          currentLocation: trip.currentLocation
        },
        pickup: trip.pickupLocation,
        dropoff: trip.dropoffLocation
      },
      aiTracking
    });
  } catch (error) {
    console.error("AI GPS tracking error:", error);
    res.status(500).json({ message: error.message });
  }
};
