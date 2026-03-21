import Client from "../models/Client.js";
import Otp from "../models/Otp.js";
import { sendSimpleOtp } from "../services/otpService.js";
import Settings from "../models/Settings.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import axios from "axios";
import Wallet from "../models/Wallet.js";
import Trip from "../models/Trip.js";

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

// Helper: Calculate Distance (Haversine Formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const aLat = parseFloat(lat1);
  const aLon = parseFloat(lon1);
  const bLat = parseFloat(lat2);
  const bLon = parseFloat(lon2);
  if ([aLat, aLon, bLat, bLon].some(v => Number.isNaN(v))) return 0;

  const R = 6371; // Radius of earth in km
  const toRad = (v) => v * (Math.PI / 180);
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
};

// Helper: Get Real ETA & Distance from Google Maps
const getRouteDetails = async (pickupLat, pickupLng, dropoffLat, dropoffLng) => {
  try {
    const locationIqKey = process.env.LOCATIONIQ_ACCESS_TOKEN || 'pk.22ba93d5b8dc86ba2e8660de987c5d41';

    // 1. Try LocationIQ first 
    if (locationIqKey) {
      // LocationIQ expects: lon,lat;lon,lat
      const coordinates = `${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}`;
      const url = `https://us1.locationiq.com/v1/matrix/driving/${coordinates}?key=${locationIqKey}&sources=0&destinations=1&annotations=distance,duration`;

      const liqResp = await axios.get(url);
      const liqData = liqResp && liqResp.data;
      // be forgiving: check for distances/durations arrays instead of strict code value
      if (liqData && liqData.distances && liqData.durations && liqData.distances.length > 0) {
        const distMeters = liqData.distances[0][0];
        const durSeconds = liqData.durations[0][0];
        if (typeof distMeters === 'number' && typeof durSeconds === 'number') {
          return {
            distanceKm: distMeters / 1000,
            durationMin: durSeconds / 60
          };
        }
      }
    }

    // 2. Fallback to Google Maps
    if (!process.env.GOOGLE_MAPS_API_KEY) return null;

    const origin = `${pickupLat},${pickupLng}`;
    const destination = `${dropoffLat},${dropoffLng}`;
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

    const gResp = await axios.get(url);
    const gData = gResp && gResp.data;
    if (gData && gData.status === 'OK' && gData.rows && gData.rows[0] && gData.rows[0].elements && gData.rows[0].elements[0] && gData.rows[0].elements[0].status === 'OK') {
      const element = gData.rows[0].elements[0];
      return {
        distanceKm: element.distance.value / 1000,
        durationMin: element.duration.value / 60
      };
    }
  } catch (error) {
    console.error("Routing API Error:", error.message);
  }
  return null;
};

// Helper: Calculate Surge Multiplier
const calculateSurge = async (settings) => {
  let multiplier = settings.surgeMultiplier || 1.0;

  // 1. Time-based Surge (Peak Hours from database)
  if (settings.enableRushHourSurge && settings.peakHours && settings.peakHours.length > 0) {
    const now = new Date();
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // Check if current time falls within any peak hour
    for (const peakHour of settings.peakHours) {
      if (peakHour.day === dayName) {
        if (currentTime >= peakHour.startTime && currentTime < peakHour.endTime) {
          multiplier = Math.max(multiplier, peakHour.multiplier || settings.rushHourMultiplier);
          break;
        }
      }
    }
  } else if (settings.enableRushHourSurge) {
    // Fallback to hardcoded rush hours if no peak hours in database
    const now = new Date();
    const hour = now.getHours();
    const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
    
    // Rush hours: 7-9 AM and 5-7 PM (17-19)
    const isMorningRush = hour >= 7 && hour < 9;
    const isEveningRush = hour >= 17 && hour < 19;

    if (isWeekday && (isMorningRush || isEveningRush)) {
      multiplier = Math.max(multiplier, settings.rushHourMultiplier);
    }
  }

  // 2. Demand-based Surge
  if (settings.enableDemandSurge) {
    const activeTrips = await Trip.countDocuments({ status: { $in: ['pending', 'assigned', 'in_progress'] } });
    if (activeTrips >= settings.activeTripsThreshold) {
      multiplier = Math.max(multiplier, settings.demandMultiplier);
    }
  }

  return multiplier;
};

// REGISTER CLIENT - Email OTP with password
export const registerClient = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: firstName, lastName, email, phone, password"
      });
    }

    // Check if client already exists
    const existingClient = await Client.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingClient) {
      return res.status(400).json({
        success: false,
        message: "Client already exists with this email or phone"
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Send OTP via email
    const otpResult = await sendSimpleOtp(phone, email);
    if (!otpResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again."
      });
    }

    // Create client (will be verified after OTP)
    const client = await Client.create({
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      // isVerified will be set to true after OTP verification
    });

    return res.json({
      success: true,
      message: "OTP sent to your email",
      clientId: client._id
    });
  } catch (error) {
    console.error("Client registration error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// LOGIN CLIENT - Email/Password Authentication
export const loginClient = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Find client by email
    const client = await Client.findOne({ email });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found. Please register first."
      });
    }

    // Check if client has a password (for existing clients without passwords)
    if (!client.password) {
      return res.status(400).json({
        success: false,
        message: "Please use OTP verification for this account. Password not set."
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, client.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid password"
      });
    }

    // Generate JWT token
    const token = generateToken(client._id);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      client: {
        _id: client._id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone
      }
    });
  } catch (error) {
    console.error("Client login error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// VERIFY CLIENT OTP
export const verifyClientOtp = async (req, res) => {
  try {
    const { clientId, otp } = req.body;

    if (!clientId || !otp) {
      return res.status(400).json({
        success: false,
        message: "Client ID and OTP are required"
      });
    }

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found"
      });
    }

    // Check OTP from Otp collection
    const otpRecord = await Otp.findOne({
      phone: client.phone,
      code: otp,
      expiresAt: { $gt: Date.now() }
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP"
      });
    }

    // Mark client as verified
    client.isVerified = true;
    await client.save();

    // Delete used OTP
    await Otp.deleteOne({ _id: otpRecord._id });

    // Generate token for persistent login
    const token = generateToken(client._id);

    return res.json({
      success: true,
      message: "Email verified successfully",
      token: token,
      client: {
        id: client._id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone
      }
    });
  } catch (error) {
    console.error("Client OTP verification error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// RESEND CLIENT OTP
export const resendClientOtp = async (req, res) => {
  try {
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required"
      });
    }

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found"
      });
    }

    // Rate limiting: 2 minute cooldown
    const cooldown = 2 * 60 * 1000;
    if (client.lastOtpSent && Date.now() - client.lastOtpSent < cooldown) {
      return res.status(429).json({
        success: false,
        message: "Wait 2 minutes before requesting another OTP"
      });
    }

    // Send OTP via email
    const otpResult = await sendSimpleOtp(client.phone, client.email);
    if (!otpResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to resend OTP. Please try again."
      });
    }

    // Update last OTP sent timestamp
    client.lastOtpSent = new Date();
    await client.save();

    return res.json({
      success: true,
      message: "OTP resent successfully"
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
export const updateClientProfile = async (req, res) => {
  const client = await Client.findById(req.user.id);
  if (!client) return res.status(404).json({ message: "Client not found" });

  const { name, email, homeAddress, workAddress } = req.body;
  if (name) client.name = name;
  if (email) client.email = email;
  if (homeAddress) client.homeAddress = homeAddress;
  if (workAddress) client.workAddress = workAddress;

  if (req.file) client.profilePhoto = req.file.path;

  await client.save();
  res.json({ success: true, message: "Profile updated", client });
};

// GET DELIVERY ESTIMATE (Price Calculation)
export const getDeliveryEstimate = async (req, res) => {
  try {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng } = req.body;

    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
      return res.status(400).json({ success: false, message: "Coordinates required" });
    }

    // 1. Calculate Distance & Duration (Google or Fallback)
    let distance = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    let tripDurationMinutes = Math.ceil((distance / 30) * 60); // Fallback: 30km/h

    const routeDetails = await getRouteDetails(pickupLat, pickupLng, dropoffLat, dropoffLng);
    if (routeDetails) {
      distance = routeDetails.distanceKm;
      tripDurationMinutes = routeDetails.durationMin;
    }

    // --- Dynamic Pricing Logic (Bolt-like) ---
    // Fetch settings or use defaults
    let settings = await Settings.findOne();
    if (!settings) settings = new Settings(); // Use defaults from model

    const { baseFare, ratePerKm, ratePerMin, minFare, commissionRate } = settings;
    const surge = await calculateSurge(settings);

    // 2. Calculate Price
    // Formula: (Base + (Km * RateKm) + (Min * RateMin)) * Surge
    let price = baseFare + (distance * ratePerKm) + (tripDurationMinutes * ratePerMin);
    price = price * surge;

    // Enforce Minimum Fare
    if (price < minFare) price = minFare;

    const finalPrice = Math.ceil(price);
    // Rider earnings = Price - Commission
    const riderEarnings = Math.ceil(finalPrice * (1 - commissionRate));

    // 3. Calculate Rider Arrival Time (ETA to Pickup)
    // In a real scenario, this would calculate distance from the nearest available rider.
    // For now, we provide a realistic estimate (e.g., 3-8 minutes).
    const pickupEtaMinutes = Math.floor(Math.random() * 5) + 3; 

    res.json({ 
      success: true, 
      distance: distance.toFixed(1), 
      price: finalPrice, 
      riderEarnings, // Amount the rider will get
      time: `${tripDurationMinutes} min`, 
      eta: `${pickupEtaMinutes} min`,
      surgeApplied: surge > 1.0,
      surgeMultiplier: surge
    });
  } catch (error) {
    console.error("Estimate error:", error);
    res.status(500).json({ success: false, message: "Failed to calculate estimate" });
  }
};

// Create a new delivery request
export const createDelivery = async (req, res) => {
  try {
    const {
      pickup,
      pickupAddress,
      pickupLocation,
      pickupLat,
      pickupLng,
      dropoff,
      dropoffAddress,
      dropoffLocation,
      dropoffLat,
      dropoffLng,
      serviceType = "delivery",
      packageType,
      packageDescription,
      recipientName,
      recipientPhone,
      estimatedValue, // This can be an "offer price" from client if they don't use auto-calc
      instructions,
      specialInstructions,
      paymentMethod = 'cash'
    } = req.body;

    // Fix: Get clientId from the request body (frontend sends it) or fallback to token user
    const clientId = req.body.clientId || (req.user && req.user.id);

    // --- Pricing Logic ---
    // Fetch dynamic settings from DB
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({}); // Create defaults if missing

    const { baseFare, ratePerKm, ratePerMin, minFare, commissionRate } = settings;

    let calculatedPrice = 0;
    let surge = 1.0;
    let distance = 0;
    let durationMin = 0;

    if (pickupLat && pickupLng && dropoffLat && dropoffLng) {
      // Try Google first
      const routeDetails = await getRouteDetails(pickupLat, pickupLng, dropoffLat, dropoffLng);
      
      if (routeDetails) {
        distance = routeDetails.distanceKm;
        durationMin = routeDetails.durationMin;
      } else {
        // Fallback
        distance = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
        durationMin = (distance / 30) * 60;
      }

      surge = await calculateSurge(settings);

      // Bolt-like Formula: (Base + (Km * RateKm) + (Min * RateMin)) * Surge
      let price = baseFare + (distance * ratePerKm) + (durationMin * ratePerMin);
      price = price * surge;
      if (price < minFare) price = minFare;

      calculatedPrice = Math.ceil(price);
    }

    // Use automatically calculated price if coordinates are available, otherwise use client's offer (estimatedValue)
    const finalPrice = calculatedPrice > 0 ? calculatedPrice : (estimatedValue || 0);
    const riderEarnings = Math.ceil(finalPrice * (1 - commissionRate));

    // --- Wallet Payment Logic ---
    let clientWalletUsed = 0;
    if (paymentMethod === 'wallet') {
      const wallet = await Wallet.findOne({ clientId });
      if (!wallet || wallet.balance < finalPrice) {
        return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
      }
      
      // Deduct from wallet
      wallet.balance -= finalPrice;
      wallet.transactions.push({
        amount: finalPrice,
        type: 'debit',
        reference: `Trip Payment`,
        date: new Date()
      });
      await wallet.save();
      clientWalletUsed = finalPrice;
    }

    const newTrip = new Trip({
      clientId,
      pickupLocation: {
        address: pickup || pickupAddress || pickupLocation,
        lat: pickupLat,
        lng: pickupLng,
      },
      dropoffLocation: {
        address: dropoff || dropoffAddress || dropoffLocation,
        lat: dropoffLat,
        lng: dropoffLng,
      },
      serviceType,
      status: "pending",
      packageDescription: packageType || packageDescription,
      recipientName,
      recipientPhone,
      estimatedValue: finalPrice, // This is the total trip cost for the client
      riderEarnings: riderEarnings, // This is what the rider gets
      riderCashExpected: paymentMethod === 'cash' ? finalPrice : 0,
      paymentMethod,
      clientWalletUsed,
      fareBreakdown: {
        baseFare,
        distanceFare: distance * ratePerKm,
        timeFare: durationMin * ratePerMin,
        surge: surge
      },
      specialInstructions: instructions || specialInstructions,
      createdAt: new Date()
    });

    await newTrip.save();

    res.json({
      success: true,
      message: "Delivery request created successfully",
      delivery: newTrip
    });
  } catch (error) {
    console.error("Create delivery error:", error);
    res.status(500).json({ success: false, message: "Failed to create delivery request" });
  }
};

// Get all deliveries for a client
export const getClientDeliveries = async (req, res) => {
  try {
    const clientId = (req.user && req.user.id) || req.params.clientId;

    const deliveries = await Trip.find({ clientId })
      .populate('riderId', 'firstName lastName phone vehicleType numberPlate vehicleMake vehicleModel')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      deliveries
    });
  } catch (error) {
    console.error("Get deliveries error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch deliveries" });
  }
};

// Get a specific delivery by ID
export const getDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = (req.user && req.user.id);

    const delivery = await Trip.findOne({ _id: id, clientId })
      .populate('riderId', 'firstName lastName phone vehicleType numberPlate vehicleMake vehicleModel');

    if (!delivery) {
      return res.status(404).json({ success: false, message: "Delivery not found" });
    }

    res.json({
      success: true,
      delivery
    });
  } catch (error) {
    console.error("Get delivery error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch delivery" });
  }
};

// ===========================
// Location Search (LocationIQ)
// ===========================
export const searchLocation = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ success: false, message: "Query required" });
    const googleKey = process.env.GOOGLE_MAPS_API_KEY;
    const locationIqKey = process.env.LOCATIONIQ_ACCESS_TOKEN || 'pk.22ba93d5b8dc86ba2e8660de987c5d41';

    // Prefer Google Places Autocomplete when API key is provided
    if (googleKey) {
      try {
        const autoUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${googleKey}&components=country:ke&types=geocode`;
        const autoResp = await axios.get(autoUrl);
        if (autoResp && autoResp.data && autoResp.data.status === 'OK' && Array.isArray(autoResp.data.predictions)) {
          const preds = autoResp.data.predictions.slice(0, 5);
          const details = await Promise.all(preds.map(async (p) => {
            try {
              const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=formatted_address,name,geometry&key=${googleKey}`;
              const detResp = await axios.get(detUrl);
              if (detResp && detResp.data && detResp.data.status === 'OK' && detResp.data.result && detResp.data.result.geometry) {
                const r = detResp.data.result;
                return {
                  name: r.name || p.structured_formatting?.main_text || p.description,
                  address: r.formatted_address || p.description,
                  lat: r.geometry.location.lat,
                  lon: r.geometry.location.lng
                };
              }
            } catch (err) {
              // ignore per-item errors
            }
            return null;
          }));

          const results = details.filter(Boolean);
          if (results.length > 0) return res.json({ success: true, results });
        }
      } catch (err) {
        console.error('Google Places error:', err.message);
        // fallthrough to LocationIQ fallback
      }
    }

    // Fallback to LocationIQ
    const url = `https://us1.locationiq.com/v1/autocomplete?key=${locationIqKey}&q=${encodeURIComponent(query)}&countrycodes=ke&format=json`;
    const response = await axios.get(url);
    let results = Array.isArray(response.data) ? response.data.map(place => ({
      name: place.display_place || (place.display_name ? place.display_name.split(',')[0] : place.name || ''),
      address: place.display_address || place.display_name || place.address || '',
      lat: place.lat,
      lon: place.lon
    })) : [];

    // if still empty, provide a few hardcoded Kenyan landmark suggestions
    if (results.length === 0) {
      const lower = query.toLowerCase();
      const staticPlaces = [
        { name: 'Gate B, Embakasi', address: 'Embakasi, Nairobi', lat: -1.316, lon: 36.910 },
        { name: 'Gate B, Juja', address: 'Juja, Kiambu', lat: -1.165, lon: 37.019 },
        { name: 'Gate B, Ruiru', address: 'Ruiru, Kiambu', lat: -1.181, lon: 36.947 },
        { name: 'Gate B, Thika Road', address: 'Thika Road, Nairobi', lat: -1.232, lon: 36.942 }
      ];
      results = staticPlaces.filter(p => p.name.toLowerCase().includes(lower));
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error("Search error:", error.message);
    // Return empty results instead of error to avoid breaking frontend UI
    res.json({ success: true, results: [] });
  }
};
