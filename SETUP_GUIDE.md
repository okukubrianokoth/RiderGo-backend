# RiderGo - Complete Setup Guide

## 🚀 New Features Overview

You now have a complete delivery platform similar to Bolt with:

1. **Client Delivery Form** - Dynamic location autocomplete with Google Maps integration
2. **Admin Dashboard** - No-code configuration for pricing and peak hours
3. **Surge Pricing** - Automatic dynamic pricing based on peak hours and demand
4. **Peak Hours Management** - Admin can set custom peak hours without code changes

---

## 📋 Files Created/Updated

### New Files:
- `client-delivery-form.html` - Client-facing delivery request form
- `admin-dashboard.html` - Admin control panel for settings management
- `admin-login.html` - Admin login page

### Updated Files:
- `src/models/Settings.js` - Added peak hours support
- `src/controllers/adminController.js` - Added peak hours CRUD operations
- `src/controllers/clientController.js` - Updated surge calculation logic
- `src/routes/adminRoutes.js` - Added peak hours management endpoints

---

## 🔧 Installation & Setup

### 1. Install Dependencies (if not already installed)
```bash
npm install
```

### 2. Environment Variables
Make sure your `.env` file has these variables:
```bash
LOCATIONIQ_ACCESS_TOKEN=pk.22ba93d5b8dc86ba2e8660de987c5d41  # Use your own key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key  # Optional, but recommended
JWT_SECRET=your_secret_key
```

### 3. Start the Backend Server
```bash
npm start
```
Server runs on: `http://localhost:3000`

---

## 📱 Client Delivery Form

### How to Use
1. Open `client-delivery-form.html` in your browser
2. Fill in the delivery details:
   - **Pickup Location**: Start typing, autocomplete suggestions will appear
   - **Dropoff Location**: Start typing, autocomplete suggestions will appear
   - **Package Type**: Select from dropdown
   - **Recipient Details**: Enter name and phone
   - **Payment Method**: Choose payment option

### Features
- ✅ Real-time location autocomplete using LocationIQ API
- ✅ Automatic price estimation when both locations are selected
- ✅ Shows distance, time, and surge pricing
- ✅ Displays rider ETA
- ✅ Supports multiple payment methods

### API Endpoints Used
```
GET /api/client/search?query=location_name
POST /api/client/estimate
POST /api/client/delivery
```

---

## 👨‍💼 Admin Dashboard

### How to Access
1. Open `admin-login.html`
2. Login with credentials:
   - **Email**: admin@ridergo.com
   - **Password**: admin123

### Dashboard Features

#### 1. **Pricing Settings** 💰
Configure base pricing:
- **Base Fare**: Starting price for any delivery (default: KES 150)
- **Rate Per KM**: Price per kilometer (default: KES 40/km)
- **Rate Per Minute**: Price per minute of travel (default: KES 5/min)
- **Minimum Fare**: Lowest possible trip price (default: KES 200)
- **Commission Rate**: Platform commission percentage (default: 20%)

**Example Calculation:**
- 10 km journey, 15 minutes
- Price = 150 + (10 × 40) + (15 × 5) = KES 625

#### 2. **Surge Pricing** ⚡

##### Rush Hour Surge
- Enable/Disable surge during peak hours
- Set multiplier (e.g., 1.3x means 30% increase)
- Peak hours are configured in the Peak Hours tab

##### Demand-Based Surge
- Enable/Disable based on active orders
- Set threshold: When active orders exceed this, surge activates
- Set multiplier (e.g., 1.2x)

#### 3. **Peak Hours Configuration** 🕐

Set custom rush hours without touching code:

**Steps:**
1. Go to "Peak Hours" tab
2. Select day of week (Monday-Sunday)
3. Set start time and end time
4. Click "Add Peak Hour"

**Example:**
- Monday 7:00 AM - 9:00 AM (Morning rush)
- Monday 5:00 PM - 7:00 PM (Evening rush)
- Friday 5:00 PM - 8:00 PM (Weekend starts early)

The system automatically applies rush hour multiplier during these times!

#### 4. **Dashboard Overview** 📊
View real-time statistics:
- Total rides completed
- Active riders online
- Active clients
- Pending orders

---

## 💻 Backend API Reference

### Admin Settings Endpoints

#### Get Settings
```bash
GET /api/admin/settings
Headers: Authorization: Bearer {token}
```

#### Update Settings
```bash
PUT /api/admin/settings
Headers: Authorization: Bearer {token}
Body: {
  "baseFare": 150,
  "ratePerKm": 40,
  "ratePerMin": 5,
  "minFare": 200,
  "commissionRate": 0.2,
  "enableRushHourSurge": true,
  "rushHourMultiplier": 1.3,
  "enableDemandSurge": true,
  "activeTripsThreshold": 50,
  "demandMultiplier": 1.2
}
```

### Peak Hours Endpoints

#### Get All Peak Hours
```bash
GET /api/admin/peak-hours
Headers: Authorization: Bearer {token}
```

#### Add Peak Hour
```bash
POST /api/admin/peak-hours
Headers: Authorization: Bearer {token}
Body: {
  "day": "monday",
  "startTime": "07:00",
  "endTime": "09:00",
  "multiplier": 1.3
}
```

#### Update Peak Hour
```bash
PUT /api/admin/peak-hours/{peakHourId}
Headers: Authorization: Bearer {token}
Body: {
  "day": "monday",
  "startTime": "07:30",
  "endTime": "09:30",
  "multiplier": 1.5
}
```

#### Delete Peak Hour
```bash
DELETE /api/admin/peak-hours/{peakHourId}
Headers: Authorization: Bearer {token}
```

---

## 🔄 Pricing Calculation Logic

The system calculates prices using this formula:

```
Base Price = BaseFare + (Distance × RatePerKm) + (Duration × RatePerMin)

// Apply surge if applicable
Final Price = Base Price × SurgeMultiplier

// Enforce minimum
If Final Price < MinFare then Final Price = MinFare

// Rider earnings (after commission)
RiderEarnings = Final Price × (1 - CommissionRate)
```

### Surge Multiplier Logic

The system applies the highest applicable surge:

1. **Peak Hour Surge** (if enabled and current time is in peak hours)
   - Time: Based on configured peak hours
   - Multiplier: Configured per peak hour (usually 1.3x)

2. **Demand Surge** (if enabled)
   - Trigger: Active orders >= threshold
   - Multiplier: Usually 1.2x

**Example:**
- Base price: KES 625
- If peak hour surge is 1.3x: KES 812.50
- If also demand surge is 1.2x: KES 812.50 × 1.2 = KES 975 (highest multiplier is used)

---

## 🛠️ Customization Guide

### Change API Base URL
Edit the `API_BASE_URL` variable in the HTML files:

```javascript
const API_BASE_URL = 'http://your-backend-url/api';
```

### Customize UI Colors
The dashboard uses CSS variables. Edit the gradient colors:

```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### Add More Payment Methods
In `client-delivery-form.html`, add to the payment method dropdown:

```html
<option value="your_payment">Your Payment Method</option>
```

### Change Peak Hour Days
In `admin-dashboard.html`, modify the day options:

```html
<select id="peakDay">
  <option value="monday">Monday</option>
  <!-- Add more days -->
</select>
```

---

## 🧪 Testing the System

### 1. Test Client Form
1. Open `client-delivery-form.html`
2. Try autocomplete:
   - Type "Nairobi"
   - Select a location
3. Try estimate calculation:
   - Select different locations
   - Watch price update automatically
4. Submit a delivery request

### 2. Test Admin Dashboard
1. Open `admin-login.html`
2. Login with demo credentials
3. Try updating pricing:
   - Change base fare to 200
   - Change rate per km to 50
   - Click Save
4. Add peak hours:
   - Select Monday
   - Set 7:00 AM - 9:00 AM
   - Click Add

### 3. Test Surge Pricing
1. Check current time
2. If within peak hours configured, test an estimate
3. Should show "SURGE" badge if applicable

---

## 📊 Database Schema

### Settings Collection
```javascript
{
  _id: ObjectId,
  baseFare: 150,
  ratePerKm: 40,
  ratePerMin: 5,
  minFare: 200,
  commissionRate: 0.2,
  enableRushHourSurge: true,
  rushHourMultiplier: 1.3,
  peakHours: [
    {
      day: "monday",
      startTime: "07:00",
      endTime: "09:00",
      multiplier: 1.3
    }
  ],
  enableDemandSurge: true,
  activeTripsThreshold: 50,
  demandMultiplier: 1.2,
  autoAssignRadius: 5,
  payoutEnabled: true,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🚀 Deployment Checklist

Before going live:

- [ ] Update API URLs in HTML files (change localhost to production URL)
- [ ] Set up proper authentication tokens
- [ ] Configure LocationIQ API key
- [ ] Configure Google Maps API key (optional but recommended)
- [ ] Test all pricing calculations
- [ ] Test surge pricing during peak hours
- [ ] Configure appropriate peak hours for your market
- [ ] Set realistic pricing for your region (Kenya)
- [ ] Test payment integration
- [ ] Enable HTTPS for production
- [ ] Set up proper CORS headers

---

## 🐛 Troubleshooting

### "API not reaching" Error
- Check if backend server is running on port 3000
- Update `API_BASE_URL` in HTML files
- Check browser console for CORS errors

### Location Autocomplete Not Working
- Verify LocationIQ API key in environment
- Check .env file is loaded
- Try typing more specific location names

### Surge Not Applying
- Check current time matches peak hours exactly
- Verify peak hours are saved in database
- Check rush hour surge is enabled in settings

### Admin Login Fails
- Verify admin account exists in database
- Check JWT_SECRET is set in environment
- Check token expiration time

---

## 📞 Support & Documentation

- **LocationIQ API**: https://locationiq.com/
- **Google Maps API**: https://developers.google.com/maps
- **MongoDB Documentation**: https://docs.mongodb.com/

---

## 📝 Future Enhancements

Consider adding:

1. **Real-time Tracking** - Map view with rider location
2. **Rating System** - Clients and riders rate each other
3. **Promo Codes** - Discount code management
4. **Analytics Dashboard** - Revenue reports and charts
5. **SMS Notifications** - Update customers via SMS
6. **Push Notifications** - Real-time app notifications
7. **Multi-language Support** - Support multiple languages
8. **Invoice Generation** - Automated invoices for business users

---

## 📄 License

RiderGo Backend © 2026. All rights reserved.

---

**Last Updated:** February 18, 2026
