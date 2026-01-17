import Client from "../models/Client.js";
import Otp from "../models/Otp.js";
import { sendSimpleOtp } from "../services/otpService.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

// Helper: Calculate Distance (Haversine Formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
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
export const resendRiderOtp = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ msg: "Phone number required" });

  const rider = await Rider.findOne({ phone });
  if (!rider) return res.status(404).json({ msg: "Rider not registered" });

  // cooldown 2 mins
  const cooldown = 2 * 60 * 1000;
  if (rider.lastOtpSent && Date.now() - rider.lastOtpSent < cooldown) {
    return res.status(429).json({
      success: false,
      message: "Wait 2 minutes before requesting another OTP"
    });
  }

  // max 3 per hour
  const hourLimit = 60 * 60 * 1000;
  if (rider.lastOtpSent && Date.now() - rider.lastOtpSent < hourLimit && rider.otpAttempts >= 3) {
    return res.status(429).json({
      success: false,
      message: "OTP limit reached. Try again after 1hr"
    });
  }

  const otp = await sendOtp(phone);
  rider.otp = otp;
  rider.otpExpires = Date.now() + 5 * 60 * 1000;
  rider.lastOtpSent = Date.now();
  rider.otpAttempts += 1;
  await rider.save();

  return res.json({ success: true, message: "OTP re-sent" });
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

// CLIENT DELIVERY FUNCTIONS
import Trip from "../models/Trip.js";

// Create a new delivery request
export const createDelivery = async (req, res) => {
  try {
    const {
      pickup,
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoff,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      serviceType = "delivery",
      packageType,
      packageDescription,
      recipientName,
      recipientPhone,
      estimatedValue,
      instructions,
      specialInstructions
    } = req.body;

    // Fix: Get clientId from the request body (frontend sends it) or fallback to token user
    const clientId = req.body.clientId || (req.user && req.user.id);

    // Calculate Price: Base KES 100 + KES 50 per KM
    let calculatedPrice = 0;
    if (pickupLat && pickupLng && dropoffLat && dropoffLng) {
      const distance = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
      // Minimum fare 150, otherwise 100 + 50/km
      calculatedPrice = Math.max(150, Math.ceil(100 + (distance * 50)));
    }

    // Use calculated price if available, otherwise use provided estimatedValue (Offer Price)
    const finalPrice = calculatedPrice > 0 ? calculatedPrice : (estimatedValue || 0);

    const newTrip = new Trip({
      clientId,
      pickupLocation: {
        address: pickup || pickupAddress,
        lat: pickupLat,
        lng: pickupLng,
      },
      dropoffLocation: {
        address: dropoff || dropoffAddress,
        lat: dropoffLat,
        lng: dropoffLng,
      },
      serviceType,
      status: "pending",
      packageDescription: packageType || packageDescription,
      recipientName,
      recipientPhone,
      estimatedValue: finalPrice,
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
