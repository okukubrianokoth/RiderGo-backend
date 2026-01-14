import Rider from "../models/Rider.js";

export const checkSubscription = async (req, res, next) => {
  try {
    const rider = await Rider.findById(req.rider.id);

    if (!rider)
      return res.status(404).json({ message: "Rider not found" });

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
