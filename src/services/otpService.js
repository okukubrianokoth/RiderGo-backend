import crypto from "crypto";
import nodemailer from "nodemailer";
import Otp from "../models/Otp.js";

// Create email transporter with better configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  },
  // Add security options
  secure: true,
  tls: {
    rejectUnauthorized: false
  }
});

// Fallback: Simple in-app OTP (for testing)
export const sendSimpleOtp = async (phone, email, options = { requireEmail: false }) => {
  const otp = crypto.randomInt(100000, 999999).toString();

  const fullPhone =
    phone.startsWith("0") ? `+254${phone.substring(1)}` :
    phone.startsWith("+") ? phone :
    `+${phone}`;

  // If email is required, ensure env vars are present
  if (options.requireEmail && (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD)) {
    const msg = "SMTP_EMAIL and SMTP_PASSWORD must be set to send OTP email";
    console.error("❌", msg);
    return { success: false, error: msg };
  }

  try {
    // 1️⃣ Delete previous OTPs
    await Otp.deleteMany({ phone: fullPhone });

    // 2️⃣ Save OTP in DB
    await Otp.create({
      phone: fullPhone,
      code: otp,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    // 3️⃣ Try Email OTP first
    const mailOptions = {
      from: `"RiderGo" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: 'Your RiderGo Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; text-align: center;">RiderGo Verification</h2>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center;">
            <h3 style="margin: 0; color: #1f2937;">Your OTP Code</h3>
            <div style="font-size: 32px; font-weight: bold; color: #2563eb; margin: 20px 0; letter-spacing: 4px;">
              ${otp}
            </div>
            <p style="color: #6b7280; margin: 10px 0;">
              This code will expire in 10 minutes.
            </p>
            <p style="color: #6b7280; font-size: 14px;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
            RiderGo - Your Trusted Delivery Partner
          </p>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log("📧 Email OTP Sent:", otp);
      return { success: true, method: 'email', otp };
    } catch (emailError) {
      console.error("❌ Email OTP failed:", emailError.message);
      if (options.requireEmail) {
        return { success: false, error: `Email send error: ${emailError.message}` };
      }
      console.log("📧 Email failed, fallback to console OTP:", otp);
      console.log("🔥 TEST OTP CODE:", otp, "(Check server console)");
      return { success: true, method: 'console', otp };
    }

  } catch (err) {
    console.error("❌ OTP System Error:", err.message);
    return { success: false, error: err.message };
  }
};
