import Rider from "../models/Rider.js";
import Otp from "../models/Otp.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import otpGenerator from "otp-generator";
import { stkPushRequest } from "../services/mpesaService.js";
import { sendSimpleOtp } from "../services/otpService.js";
import Withdrawal from "../models/Withdrawal.js";

// ===========================
// Generate JWT Token
// ===========================
const generateToken = (rider) => {
  return jwt.sign(
    { id: rider._id, role: "rider" },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
};

// ===========================
// Register Rider
// ===========================
export const registerRider = async (req, res) => {
  try {
    const { phone, firstName, lastName, email, password } = req.body;

    // Validate required fields
    if (!phone || !firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existing = await Rider.findOne({
      $or: [{ phone }, { email }]
    });
    if (existing) return res.status(400).json({ message: "Phone or email already registered" });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Send OTP via email (strict) with fallback disabled in production mode
    const otpResult = await sendSimpleOtp(phone, email, { requireEmail: false });
    if (!otpResult.success) {
      return res.status(500).json({ message: `Failed to send OTP email: ${otpResult.error}` });
    }

    // Create rider with basic info (will be updated after OTP verification)
    const rider = await Rider.create({
      phone,
      firstName,
      lastName,
      email,
      password: hashedPassword,
      // OTP will be verified separately
    });

    res.json({
      success: true,
      message: "OTP sent to your email",
      riderId: rider._id
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ===========================
// RIDER WALLET
// ===========================
export const getRiderWallet = async (req, res) => {
  try {
    // Also fetching transaction history would be a good addition here later
    const rider = await Rider.findById(req.rider.id).select('walletBalance');
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    res.json({
      success: true,
      balance: rider.walletBalance || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const requestWithdrawal = async (req, res) => {
  try {
    const { amount } = req.body;
    const riderId = req.rider.id;

    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "A valid amount is required." });
    }

    if ((rider.walletBalance || 0) < amount) {
      return res.status(400).json({ message: "Insufficient wallet balance." });
    }

    // Create a withdrawal request for admin to approve
    const withdrawal = await Withdrawal.create({
      riderId,
      amount,
      status: 'pending', // Admin will approve this
      phone: rider.phone // For M-Pesa payout
    });

    // Optionally, you could deduct the amount from the balance here, or wait for admin approval.
    // Waiting for approval is safer.

    res.status(201).json({
      success: true,
      message: "Withdrawal request submitted successfully. It will be processed by an admin.",
      withdrawal
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ===========================
// Verify OTP
// ===========================
export const verifyRiderOtp = async (req, res) => {
  try {
    const { riderId, otp } = req.body;

    const rider = await Rider.findById(riderId);
    if (!rider) return res.status(404).json({ message: "Rider not found" });

    // Check OTP from Otp collection
    const otpRecord = await Otp.findOne({
      phone: rider.phone,
      code: otp,
      expiresAt: { $gt: Date.now() }
    });

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Mark rider as verified
    rider.isVerified = true;
    await rider.save();

    // Delete used OTP
    await Otp.deleteOne({ _id: otpRecord._id });

    res.json({
      success: true,
      message: "Phone verified successfully",
      token: generateToken(rider)
    });
  } catch (err) {
    console.error("OTP verification error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ===========================
// Login
// ===========================
export const loginRider = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Find rider by email
    const rider = await Rider.findOne({ email });

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider not found. Please register first."
      });
    }

    // Check if rider has a password (for existing riders without passwords)
    if (!rider.password) {
      return res.status(400).json({
        success: false,
        message: "Please use OTP verification for this account. Password not set."
      });
    }

    if (rider.status === 'blocked') {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked. Please contact support."
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, rider.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid password"
      });
    }

    // Generate JWT token
    const token = generateToken(rider._id);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      rider: {
        _id: rider._id,
        firstName: rider.firstName,
        lastName: rider.lastName,
        email: rider.email,
        phone: rider.phone
      }
    });
  } catch (error) {
    console.error("Rider login error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===========================
// Resend OTP
// ===========================
export const resendRiderOtp = async (req, res) => {
  try {
    const { riderId } = req.body;
    const rider = await Rider.findById(riderId);
    if (!rider) return res.status(404).json({ message: "Rider not found" });

    // Rate limiting: 2 minute cooldown
    const cooldown = 2 * 60 * 1000;
    if (rider.lastOtpSent && Date.now() - rider.lastOtpSent < cooldown) {
      return res.status(429).json({
        success: false,
        message: "Wait 2 minutes before requesting another OTP"
      });
    }

    // Send OTP via the proper service
    const otpResult = await sendSimpleOtp(rider.phone, rider.email, { requireEmail: true });
    if (!otpResult.success) {
      return res.status(500).json({
        success: false,
        message: `Failed to resend OTP email: ${otpResult.error}`
      });
    }

    // Update rider metadata
    rider.lastOtpSent = Date.now();
    await rider.save();

    res.json({ success: true, message: "OTP resent successfully" });
  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ===========================
// Update Rider Profile
// ===========================
export const getRiderProfile = async (req, res) => {
  try {
    const rider = await Rider.findById(req.rider.id).select("-password -otp");
    if (!rider) return res.status(404).json({ message: "Rider not found" });
    res.json({ success: true, rider });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateRiderProfile = async (req, res) => {
  try {
    const rider = await Rider.findById(req.rider.id);

    if (!rider) return res.status(404).json({ message: "Rider not found" });

    // Map frontend fields to model fields
    const {
      idNumber,
      vehicleType,
      numberPlate,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      emergencyContact,
      emergencyPhone
    } = req.body;

    if (idNumber) rider.nationalIdNumber = idNumber;
    if (vehicleType) rider.vehicleType = vehicleType;
    if (numberPlate) rider.numberPlate = numberPlate;
    
    // Save additional info if needed (ensure model supports these or use a mixed field)
    if (vehicleMake) rider.vehicleMake = vehicleMake;
    if (vehicleModel) rider.vehicleModel = vehicleModel;
    if (emergencyContact) rider.emergencyContact = emergencyContact;
    if (emergencyPhone) rider.emergencyPhone = emergencyPhone;

    if (req.files?.idImage) {
      rider.nationalIdImage = req.files.idImage[0].path;
    }
    if (req.files?.licenseImage) {
      rider.drivingLicenseImage = req.files.licenseImage[0].path;
    }
    if (req.files?.vehicleImage) {
      rider.vehicleImage = req.files.vehicleImage[0].path;
    }

    await rider.save();
    res.json({ success: true, rider });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ===========================
// PAY MONTHLY SUBSCRIPTION
// ===========================
export const paySubscription = async (req, res) => {
  try {
    const rider = await Rider.findById(req.rider.id);
    if (!rider) return res.status(404).json({ message: "Rider not found" });

    const { amount = 100 } = req.body; // Default amount or from body

    // Remove all non-digit characters (spaces, +, -, etc)
    let formattedPhone = rider.phone.toString().replace(/\D/g, "");
    
    if (formattedPhone.startsWith("0")) {
      formattedPhone = `254${formattedPhone.substring(1)}`;
    }

    const mpesaResponse = await stkPushRequest(
      formattedPhone,
      amount,
      "RIDERGO",
      "Rider Subscription Payment"
    );

    res.json({
      success: true,
      message: "STK push sent — check phone to complete payment",
      data: mpesaResponse,
    });
  } catch (err) {
    console.error("Subscription payment error:", err?.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: "Payment request failed",
      error: err?.response?.data,
    });
  }
};

// ===========================
// GET SUBSCRIPTION STATUS
// ===========================
export const getSubscriptionStatus = async (req, res) => {
  try {
    const rider = await Rider.findById(req.rider.id).select('subscriptionActive subscriptionExpiresAt lastPaymentRef createdAt');
    
    const twoMonths = 60 * 24 * 60 * 60 * 1000; // 60 days in milliseconds
    const registrationDate = new Date(rider.createdAt).getTime();
    const isTrialActive = (Date.now() - registrationDate) < twoMonths;

    res.json({
      subscriptionActive: rider?.subscriptionActive || false,
      expiresAt: rider?.subscriptionExpiresAt,
      lastPaymentRef: rider?.lastPaymentRef,
      isTrialActive,
      trialExpiresAt: new Date(registrationDate + twoMonths)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// FORCE FREE 2-MONTH SUBSCRIPTION FOR TEST ACCOUNTS
export const grantFreeSubscription = async (req, res) => {
  // Backward compatibility: rider self-service route (if still used)
  try {
    const rider = await Rider.findById(req.rider.id);
    if (!rider) return res.status(404).json({ success: false, message: 'Rider not found' });

    const twoMonthsMs = 60 * 24 * 60 * 60 * 1000; // 60 days
    rider.subscriptionActive = true;
    rider.subscriptionExpiresAt = new Date(Date.now() + twoMonthsMs);
    rider.subscriptionLastRefreshed = new Date();
    await rider.save();

    res.json({
      success: true,
      message: 'Free 2-month subscription granted successfully',
      subscriptionExpiresAt: rider.subscriptionExpiresAt,
      subscriptionLastRefreshed: rider.subscriptionLastRefreshed
    });
  } catch (err) {
    console.error('Grant free subscription error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

import SubscriptionAudit from "../models/SubscriptionAudit.js";

export const adminGrantFreeSubscription = async (req, res) => {
  try {
    const { riderId } = req.params;
    const admin = req.admin;

    if (!riderId) {
      return res.status(400).json({ success: false, message: 'riderId is required' });
    }

    const rider = await Rider.findById(riderId);
    if (!rider) return res.status(404).json({ success: false, message: 'Rider not found' });

    const twoMonthsMs = 60 * 24 * 60 * 60 * 1000; // 60 days
    rider.subscriptionActive = true;
    rider.subscriptionExpiresAt = new Date(Date.now() + twoMonthsMs);
    rider.subscriptionLastRefreshed = new Date();
    await rider.save();

    await SubscriptionAudit.create({
      riderId: rider._id,
      adminId: admin._id,
      subscriptionExpiresAt: rider.subscriptionExpiresAt,
      subscriptionLastRefreshed: rider.subscriptionLastRefreshed,
      notes: req.body.notes || '2-month free trial granted by admin'
    });

    return res.json({
      success: true,
      message: 'Admin granted free 2-month subscription for rider',
      rider: {
        _id: rider._id,
        subscriptionActive: rider.subscriptionActive,
        subscriptionExpiresAt: rider.subscriptionExpiresAt,
        subscriptionLastRefreshed: rider.subscriptionLastRefreshed
      }
    });
  } catch (err) {
    console.error('Admin grant free subscription error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE RIDER ONLINE STATUS
export const updateRiderStatus = async (req, res) => {
  try {
    const { isOnline } = req.body;
    const rider = await Rider.findById(req.rider.id);
    
    if (!rider) return res.status(404).json({ message: "Rider not found" });
    
    rider.isOnline = isOnline;
    rider.lastSeen = new Date();
    await rider.save();
    
    res.json({ success: true, message: `Rider is now ${isOnline ? 'online' : 'offline'}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE RIDER LOCATION
export const updateRiderLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const rider = await Rider.findById(req.rider.id);
    
    if (!rider) return res.status(404).json({ message: "Rider not found" });
    
    rider.currentLocation = { lat, lng, updatedAt: new Date() };
    rider.lastSeen = new Date();
    await rider.save();
    
    res.json({ success: true, message: "Location updated" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET AVAILABLE TRIPS FOR RIDER
export const getAvailableTrips = async (req, res) => {
  try {
    const rider = await Rider.findById(req.rider.id);
    if (!rider) return res.status(404).json({ message: "Rider not found" });

    // Ensure rider is verified and approved to see available trips
    if (!rider.isVerified || rider.status !== 'approved') {
      return res.status(403).json({ message: "Rider not verified or approved to view trips" });
    }

    const trips = await Trip.find({ 
      status: { $in: ['pending', 'awaiting_payment'] }, // Include awaiting_payment for visibility
      riderId: null // Not assigned yet
    }).sort({ createdAt: -1 });

    res.json({ success: true, trips });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ACCEPT TRIP
export const acceptTrip = async (req, res) => {
  try {
    const { tripId } = req.body;
    const rider = await Rider.findById(req.rider.id);
    
    if (!rider) return res.status(404).json({ message: "Rider not found" });
    
    const trip = await Trip.findById(tripId);
    if (!trip || trip.status !== 'pending') {
      return res.status(400).json({ message: "Trip not available" });
    }
    
    trip.riderId = rider._id;
    trip.status = 'assigned';
    trip.assignedAt = new Date();
    await trip.save();
    
    res.json({ success: true, message: "Trip accepted", trip });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE TRIP STATUS
export const updateTripStatus = async (req, res) => {
  try {
    const { tripId, status, notes } = req.body;
    const rider = await Rider.findById(req.rider.id);
    
    if (!rider) return res.status(404).json({ message: "Rider not found" });
    
    const trip = await Trip.findOne({ _id: tripId, riderId: rider._id });
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    
    const validStatuses = ['assigned', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    
    trip.status = status;
    if (status === 'in_progress') trip.startedAt = new Date();
    if (status === 'completed') trip.completedAt = new Date();
    if (notes) trip.notes = notes;
    
    await trip.save();
    
    res.json({ success: true, message: "Trip status updated", trip });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET RIDER TRIPS
export const getRiderTrips = async (req, res) => {
  try {
    const trips = await Trip.find({ riderId: req.rider.id })
      .populate('clientId', 'firstName lastName phone')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, trips });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET RIDER EARNINGS
export const getRiderEarnings = async (req, res) => {
  try {
    const rider = await Rider.findById(req.rider.id);
    if (!rider) return res.status(404).json({ message: "Rider not found" });
    
    // Today's earnings
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEarnings = await Trip.aggregate([
      { $match: { riderId: rider._id, status: 'completed', completedAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$riderEarnings' } } }
    ]);
    
    // Weekly earnings
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyEarnings = await Trip.aggregate([
      { $match: { riderId: rider._id, status: 'completed', completedAt: { $gte: weekAgo } } },
      { $group: { _id: null, total: { $sum: '$riderEarnings' } } }
    ]);
    
    // Monthly earnings
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthlyEarnings = await Trip.aggregate([
      { $match: { riderId: rider._id, status: 'completed', completedAt: { $gte: monthAgo } } },
      { $group: { _id: null, total: { $sum: '$riderEarnings' } } }
    ]);
    
    res.json({
      success: true,
      earnings: {
        today: todayEarnings[0]?.total || 0,
        weekly: weeklyEarnings[0]?.total || 0,
        monthly: monthlyEarnings[0]?.total || 0,
        total: rider.walletBalance
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
