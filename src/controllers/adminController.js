import Rider from "../models/Rider.js";
import Client from "../models/Client.js"; // Assuming this model exists
import Trip from "../models/Trip.js"; // Assuming this model exists
import Settings from "../models/Settings.js";
import Admin from "../models/Admin.js";
import Withdrawal from "../models/Withdrawal.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// ===========================
// Dashboard Stats
// ===========================
export const getDashboardStats = async (req, res) => {
  try {
    const totalRiders = await Rider.countDocuments();
    const totalClients = await Client.countDocuments();
    const totalTrips = await Trip.countDocuments();
    const pendingTrips = await Trip.countDocuments({ status: 'pending' });
    const completedTrips = await Trip.countDocuments({ status: 'completed' });

    // You can expand this with earnings, etc.
    const stats = {
      riders: {
        total: totalRiders,
        // could add: active, pending, etc.
      },
      clients: {
        total: totalClients,
      },
      trips: {
        total: totalTrips,
        pending: pendingTrips,
        completed: completedTrips,
      },
    };

    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===========================
// Withdrawal Management
// ===========================
export const getWithdrawals = async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    
    const withdrawals = await Withdrawal.find(query)
      .populate('riderId', 'firstName lastName phone walletBalance')
      .sort({ createdAt: -1 });
      
    res.json({ success: true, withdrawals });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const approveWithdrawal = async (req, res) => {
  try {
    const { withdrawalId, action } = req.body; // action: 'approve' or 'reject'
    
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) return res.status(404).json({ message: "Withdrawal not found" });
    if (withdrawal.status !== 'pending') return res.status(400).json({ message: "Request already processed" });

    const rider = await Rider.findById(withdrawal.riderId);
    if (!rider) return res.status(404).json({ message: "Rider no longer exists" });

    if (action === 'approve') {
      // Check balance again before final approval
      if (rider.walletBalance < withdrawal.amount) {
        return res.status(400).json({ message: "Insufficient wallet balance to approve" });
      }

      // Deduct from wallet
      rider.walletBalance -= withdrawal.amount;
      await rider.save();

      withdrawal.status = 'approved';
      // Here you would trigger the actual M-Pesa B2C payment logic
    } else {
      withdrawal.status = 'rejected';
    }

    await withdrawal.save();
    res.json({ success: true, message: `Withdrawal ${action}d`, withdrawal });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===========================
// Settings Management
// ===========================
export const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { 
      baseFare, ratePerKm, ratePerMin, minFare, surgeMultiplier, commissionRate,
      enableRushHourSurge, rushHourMultiplier, enableDemandSurge, activeTripsThreshold, demandMultiplier
    } = req.body;
    
    let settings = await Settings.findOne();
    if (!settings) settings = new Settings();

    if (baseFare !== undefined) settings.baseFare = baseFare;
    if (ratePerKm !== undefined) settings.ratePerKm = ratePerKm;
    if (ratePerMin !== undefined) settings.ratePerMin = ratePerMin;
    if (minFare !== undefined) settings.minFare = minFare;
    if (surgeMultiplier !== undefined) settings.surgeMultiplier = surgeMultiplier;
    if (commissionRate !== undefined) settings.commissionRate = commissionRate;

    if (enableRushHourSurge !== undefined) settings.enableRushHourSurge = enableRushHourSurge;
    if (rushHourMultiplier !== undefined) settings.rushHourMultiplier = rushHourMultiplier;
    if (enableDemandSurge !== undefined) settings.enableDemandSurge = enableDemandSurge;
    if (activeTripsThreshold !== undefined) settings.activeTripsThreshold = activeTripsThreshold;
    if (demandMultiplier !== undefined) settings.demandMultiplier = demandMultiplier;

    await settings.save();
    res.json({ success: true, message: "Pricing settings updated", settings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===========================
// Admin Auth
// ===========================
export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    const token = jwt.sign({ id: admin._id, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.json({ success: true, token, admin: { email: admin.email, name: admin.name } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createAdmin = async (req, res) => {
  // This should be a protected route or a seed script
  // Implementation omitted for brevity, similar to registerRider
};


// ===========================
// Rider Management
// ===========================

// Get all riders (with pagination in mind for the future)
export const getRiders = async (req, res) => {
  try {
    const riders = await Rider.find({}).select("-password -otp");
    res.json({ success: true, riders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all riders waiting for verification
export const getPendingRiders = async (req, res) => {
  try {
    const riders = await Rider.find({ status: "pending" }).select("-password -otp");
    res.json({ success: true, riders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Approve or Reject a rider
export const verifyRider = async (req, res) => {
  try {
    const { riderId, action } = req.body; // action: 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: "Invalid action. Use 'approve' or 'reject'." });
    }

    const rider = await Rider.findById(riderId);
    if (!rider) return res.status(404).json({ message: "Rider not found" });

    if (action === 'approve') {
      rider.status = 'approved';
      rider.isVerified = true;
      // Start their trial immediately upon approval?
      // rider.createdAt = new Date(); // Optional: reset trial start
    } else {
      // Potentially delete the rider or mark as rejected
      rider.status = 'rejected';
      rider.isVerified = false;
    }

    await rider.save();

    res.json({ success: true, message: `Rider ${action}d successfully`, rider });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ===========================
// Client Management
// ===========================
export const getClients = async (req, res) => {
  try {
    const clients = await Client.find({}).select("-password");
    res.json({ success: true, clients });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ===========================
// Trip Management
// ===========================
export const getTrips = async (req, res) => {
  try {
    const trips = await Trip.find({})
      .populate('clientId', 'firstName lastName phone')
      .populate('riderId', 'firstName lastName phone')
      .sort({ createdAt: -1 });
    res.json({ success: true, trips });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===========================
// Peak Hours Management
// ===========================
export const getPeakHours = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    
    res.json({ success: true, peakHours: settings.peakHours || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const addPeakHour = async (req, res) => {
  try {
    const { day, startTime, endTime, multiplier } = req.body;

    if (!day || !startTime || !endTime) {
      return res.status(400).json({ 
        success: false, 
        message: "Day, startTime, and endTime are required" 
      });
    }

    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});

    // Check if peak hour already exists for this day
    const existingIndex = settings.peakHours.findIndex(
      ph => ph.day === day && ph.startTime === startTime && ph.endTime === endTime
    );

    if (existingIndex >= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "This peak hour already exists" 
      });
    }

    settings.peakHours.push({
      day,
      startTime,
      endTime,
      multiplier: multiplier || 1.3
    });

    await settings.save();

    res.json({ success: true, message: "Peak hour added", peakHours: settings.peakHours });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deletePeakHour = async (req, res) => {
  try {
    const { peakHourId } = req.params;

    let settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({ success: false, message: "Settings not found" });
    }

    settings.peakHours = settings.peakHours.filter(ph => ph._id.toString() !== peakHourId);
    await settings.save();

    res.json({ success: true, message: "Peak hour deleted", peakHours: settings.peakHours });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePeakHour = async (req, res) => {
  try {
    const { peakHourId } = req.params;
    const { day, startTime, endTime, multiplier } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({ success: false, message: "Settings not found" });
    }

    const peakHour = settings.peakHours.id(peakHourId);
    if (!peakHour) {
      return res.status(404).json({ success: false, message: "Peak hour not found" });
    }

    if (day) peakHour.day = day;
    if (startTime) peakHour.startTime = startTime;
    if (endTime) peakHour.endTime = endTime;
    if (multiplier) peakHour.multiplier = multiplier;

    await settings.save();

    res.json({ success: true, message: "Peak hour updated", peakHours: settings.peakHours });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};