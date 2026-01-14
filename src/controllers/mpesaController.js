// src/controllers/mpesaController.js
import { stkPushRequest } from "../services/mpesaService.js";
import Rider from "../models/Rider.js";

export const initiateMpesaPayment = async (req, res) => {
  try {
    const { phone, amount } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ message: "Phone and amount required" });
    }

    const formattedPhone = phone.startsWith("254")
      ? phone
      : `254${phone.substring(1)}`;

    const mpesaResponse = await stkPushRequest(
      formattedPhone,
      amount,
      "RIDERGO",
      "Rider Subscription Payment"
    );

    return res.status(200).json({
      success: true,
      message: "STK push sent — check phone",
      data: mpesaResponse,
    });
  } catch (err) {
    console.error("MPESA ERROR:", err?.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: "Payment request failed",
      error: err?.response?.data,
    });
  }
};

// CALLBACK RECEIVER
export const mpesaCallback = async (req, res) => {
  try {
    const { Body } = req.body;
    const { stkCallback } = Body;

    if (!stkCallback) {
      console.log("Invalid callback structure");
      return res.status(400).json({ message: "Invalid callback" });
    }

    const { ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    if (ResultCode !== 0) {
      console.log("Payment failed:", ResultDesc);
      return res.status(200).json({ message: "Payment failed" });
    }

    // Extract payment details
    const metadata = CallbackMetadata.Item;
    const amount = metadata.find(item => item.Name === "Amount")?.Value;
    const receiptNumber = metadata.find(item => item.Name === "MpesaReceiptNumber")?.Value;
    const phoneNumber = metadata.find(item => item.Name === "PhoneNumber")?.Value;

    if (!phoneNumber) {
      console.log("Phone number not found in callback");
      return res.status(400).json({ message: "Phone number missing" });
    }

    // Find rider by phone
    const rider = await Rider.findOne({ phone: phoneNumber.toString() });

    if (!rider) {
      console.log("Rider not found for phone:", phoneNumber);
      return res.status(404).json({ message: "Rider not found" });
    }

    // Update subscription
    const subscriptionDuration = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    rider.subscriptionActive = true;
    rider.subscriptionExpiresAt = new Date(Date.now() + subscriptionDuration);
    rider.lastPaymentRef = receiptNumber;

    await rider.save();

    console.log(`Subscription activated for rider ${rider.name} (${rider.phone})`);

    res.status(200).json({ message: "Payment processed successfully" });
  } catch (error) {
    console.error("Callback processing error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
