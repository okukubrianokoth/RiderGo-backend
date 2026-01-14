import jwt from "jsonwebtoken";
import Rider from "../models/Rider.js";

// Generic Token Middleware
export const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Rider-only Authentication
export const protectRider = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Rider token required" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const rider = await Rider.findById(decoded.id).select("-otp -otpExpires");
    if (!rider) return res.status(404).json({ message: "Rider not found" });

    req.rider = rider;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized rider token" });
  }
};
