import Rider from "../models/Rider.js";
import Otp from "../models/Otp.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import otpGenerator from "otp-generator";
import { stkPushRequest } from "../services/mpesaService.js";
import { sendSimpleOtp } from "../services/otpService.js";

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

    // Send OTP via email or console (free and reliable)
    const otpResult = await sendSimpleOtp(phone, email);
    if (!otpResult.success) {
      return res.status(500).json({ message: "Failed to send OTP. Please try again." });
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
// ===========================
// Login Rider - Email/Password
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

    // Check password
    const isPasswordValid = await bcrypt.compare(password, rider.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid password"
      });
    }

    // Generate JWT token
    const token = generateToken(rider);

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
    
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const registrationDate = new Date(rider.createdAt).getTime();
    const isTrialActive = (Date.now() - registrationDate) < sevenDays;

    res.json({
      subscriptionActive: rider?.subscriptionActive || false,
      expiresAt: rider?.subscriptionExpiresAt,
      lastPaymentRef: rider?.lastPaymentRef,
      isTrialActive,
      trialExpiresAt: new Date(registrationDate + sevenDays)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
