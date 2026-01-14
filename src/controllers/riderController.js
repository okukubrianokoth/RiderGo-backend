import Rider from "../models/Rider.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import otpGenerator from "otp-generator";
import { stkPushRequest } from "../services/mpesaService.js";

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
    const { phone } = req.body;

    const existing = await Rider.findOne({ phone });
    if (existing) return res.status(400).json({ message: "Phone already registered" });

    const otp = otpGenerator.generate(6, { digits: true });

    const rider = await Rider.create({
      phone,
      otp,
      otpExpireAt: Date.now() + 5 * 60 * 1000 // 5 mins
    });

    res.json({ success: true, message: "OTP sent", riderId: rider._id });
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

    if (rider.otp !== otp || rider.otpExpireAt < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    rider.isVerified = true;
    rider.otp = null;
    rider.otpExpireAt = null;
    await rider.save();

    res.json({ success: true, token: generateToken(rider) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ===========================
// Login
// ===========================
export const loginRider = async (req, res) => {
  try {
    const { phone } = req.body;
    const rider = await Rider.findOne({ phone });

    if (!rider) return res.status(400).json({ message: "Invalid phone" });

    res.json({
      success: true,
      token: generateToken(rider),
      rider
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
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

    const otp = otpGenerator.generate(6, { digits: true });
    rider.otp = otp;
    rider.otpExpireAt = Date.now() + 5 * 60 * 1000;
    await rider.save();

    res.json({ success: true, message: "OTP resent" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ===========================
// Update Rider Profile
// ===========================
export const updateRiderProfile = async (req, res) => {
  try {
    const rider = await Rider.findById(req.rider.id);

    if (!rider) return res.status(404).json({ message: "Rider not found" });

    rider.name = req.body.name;
    rider.nationalId = req.body.nationalId;
    rider.motorcycleNumber = req.body.motorcycleNumber;

    if (req.files?.idImage) {
      rider.idImage = req.files.idImage[0].path;
    }
    if (req.files?.licenseImage) {
      rider.licenseImage = req.files.licenseImage[0].path;
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

    const formattedPhone = rider.phone.startsWith("254")
      ? rider.phone
      : `254${rider.phone.substring(1)}`;

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
    const rider = await Rider.findById(req.rider.id).select('subscriptionActive subscriptionExpiresAt lastPaymentRef');
    res.json({
      subscriptionActive: rider?.subscriptionActive || false,
      expiresAt: rider?.subscriptionExpiresAt,
      lastPaymentRef: rider?.lastPaymentRef
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
