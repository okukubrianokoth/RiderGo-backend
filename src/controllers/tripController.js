// src/controllers/tripController.js
import Trip from "../models/Trip.js";
import Message from "../models/Message.js";

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

// 7. Chat: Send Message
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

// 4. Complete Trip
export const endTrip = async (req, res) => {
  try {
    const { tripId } = req.body;
    const trip = await Trip.findOneAndUpdate(
      { _id: tripId, riderId: req.rider.id },
      { status: "completed" },
      { new: true }
    );
    res.json({ success: true, message: "Trip completed", trip });
  } catch (error) {
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
