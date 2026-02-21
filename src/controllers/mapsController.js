import axios from "axios";

// Proxy for Google Places Autocomplete
export const autocomplete = async (req, res) => {
  try {
    const { input } = req.query;
    if (!input) return res.status(400).json({ message: "Input required" });

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    // Restrict to Kenya (components=country:ke)
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}&components=country:ke`;

    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error("Google Maps Error:", error.message);
    res.status(500).json({ message: "Failed to fetch location suggestions" });
  }
};

// Proxy for Place Details (to get Lat/Lng from Place ID)
export const getPlaceDetails = async (req, res) => {
  try {
    const { placeId } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}`;

    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch place details" });
  }
};