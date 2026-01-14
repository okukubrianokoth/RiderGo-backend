import crypto from "crypto";
import axios from "axios";
import Otp from "../models/Otp.js";

export const sendOtp = async (phone) => {
  const otp = crypto.randomInt(100000, 999999).toString();

  const instanceId = process.env.ULTRA_INSTANCE_ID;
  const token = process.env.ULTRA_TOKEN;

  const fullPhone =
    phone.startsWith("0") ? `+254${phone.substring(1)}` :
    phone.startsWith("+") ? phone :
    `+${phone}`;

  try {
    // 1️⃣ Delete previous OTPs
    await Otp.deleteMany({ phone: fullPhone });

    // 2️⃣ Save OTP in DB
    await Otp.create({
      phone: fullPhone,
      code: otp,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 min
    });

    // 3️⃣ Send WhatsApp OTP
    const url = `https://api.ultramsg.com/${instanceId}/messages/chat`;
    const data = {
      token,
      to: fullPhone,
      body: `Your RiderGo OTP is: *${otp}*`
    };

    const res = await axios.post(url, data);
    console.log("📨 WhatsApp OTP Sent:", otp);

    return otp;
  } catch (err) {
    console.error("❌ WhatsApp OTP Failed:", err.response?.data || err.message);
    return null;
  }
};
