import axios from "axios";

export async function sendOtpWhatsApp(phone, otp) {
  try {
    const { ULTRA_INSTANCE_ID, ULTRA_TOKEN } = process.env;

    const url = `https://api.ultramsg.com/${ULTRA_INSTANCE_ID}/messages/chat`;

    const payload = {
      token: ULTRA_TOKEN,
      to: `+254${phone}`,
      body: `Your RiderGo OTP is ${otp}`,
    };

    const res = await axios.post(url, payload);
    console.log("📩 WhatsApp OTP sent:", res.data);
    return true;

  } catch (err) {
    console.error("❌ WhatsApp OTP failed:", err.response?.data || err.message);
    return false;
  }
}
