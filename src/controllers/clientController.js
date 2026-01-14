import Client from "../models/Client.js";
import Otp from "../models/Otp.js";
import { sendOtp } from "../services/otpService.js";
import jwt from "jsonwebtoken";

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

// REGISTER
export const registerClient = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ msg: "Phone required" });

    let client = await Client.findOne({ phone });
    if (!client) client = await Client.create({ phone });

    await sendOtp(phone);

    return res.json({
      success: true,
      message: "OTP sent",
      phone,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// LOGIN — Send OTP
export const loginClient = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ msg: "Phone required" });

    const exists = await Client.findOne({ phone });
    if (!exists) return res.status(404).json({ msg: "Client not registered" });

    await sendOtp(phone);

    return res.json({
      success: true,
      message: "OTP sent",
      phone,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// VERIFY OTP
export const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ msg: "Missing fields" });

    // Convert phone to +254 format
    const fullPhone = phone.startsWith("0")
      ? `+254${phone.substring(1)}`
      : phone;

    const record = await Otp.findOne({ phone: fullPhone, code: otp });

    if (!record) return res.status(400).json({ msg: "Wrong OTP" });

    // Check expiry
    if (record.expiresAt < Date.now()) {
      await Otp.deleteMany({ phone: fullPhone });
      return res.status(400).json({ msg: "Expired OTP" });
    }

    const client = await Client.findOne({ phone });
    await Otp.deleteMany({ phone: fullPhone }); // delete used OTPS

    return res.json({
      success: true,
      message: "OTP Verified Successfully",
      token: generateToken(client._id),
    });
  } catch (error) {
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
