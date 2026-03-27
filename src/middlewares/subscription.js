import Rider from "../models/Rider.js";

export const checkSubscription = async (req, res, next) => {
  try {
    const rider = await Rider.findById(req.rider.id);

    if (!rider)
      return res.status(404).json({ message: "Rider not found" });

    // Check for 2-month free trial
    const twoMonths = 60 * 24 * 60 * 60 * 1000; // 60 days in milliseconds
    const registrationDate = new Date(rider.createdAt).getTime();
    if (Date.now() - registrationDate < twoMonths) {
      return next();
    }

    // subscription expired?
    if (!rider.subscriptionActive || !rider.subscriptionExpiresAt || rider.subscriptionExpiresAt < Date.now()) {
      return res.status(403).json({
        success: false,
        message: "Subscription expired. Please pay KES 100 to continue."
      });
    }

    next(); // allow request
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error });
  }
};
