import jwt from "jsonwebtoken";
import Client from "../models/Client.js";

export const protect = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer")) {
    return res.status(401).json({ msg: "Not authorized, no token" });
  }

  const token = auth.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.client = await Client.findById(decoded.id).select("-otp -otpExpires");
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Invalid token" });
  }
};
