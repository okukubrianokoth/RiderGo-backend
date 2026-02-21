# 🚀 RiderGo Quick Start Guide

Get your delivery platform running in 5 minutes!

## ⚡ Quick Start (5 Minutes)

### Step 1: Start Backend Server
```bash
npm start
```
✅ Server running on `http://localhost:3000`

### Step 2: Test Client Form
Open in browser: `client-delivery-form.html`
- Try autocomplete by typing a location
- Select pickup and dropoff
- See price calculation automatically

### Step 3: Access Admin Dashboard
1. Open: `admin-login.html`
2. Email: `admin@ridergo.com`
3. Password: `admin123`
4. Try updating pricing or adding peak hours

---

## 🎯 What Can You Do Now?

### For Clients:
✅ Request deliveries with location autocomplete
✅ Get instant price estimates
✅ See surge pricing in real-time
✅ Track delivery status

### For Admin:
✅ Configure pricing (base fare, per km, per minute)
✅ Set peak hours for rush pricing
✅ Enable/disable surge pricing
✅ Adjust commission rates
✅ View dashboard statistics

---

## 🔧 Configuration

### Basic Settings Example
```
Base Fare: KES 150
Rate per KM: KES 40/km
Rate per Minute: KES 5/min
Minimum Fare: KES 200
Commission: 20%
```

### Peak Hours Example
```
Monday    7:00 AM - 9:00 AM   (1.3x surge)
Monday    5:00 PM - 7:00 PM   (1.3x surge)
Friday    5:00 PM - 8:00 PM   (1.3x surge)
```

### Demand Surge Example
```
If active orders > 50:
  Apply 1.2x multiplier
```

---

## 📊 Price Calculation Example

**Scenario:** 10 km delivery, 15 minutes, during peak hours

```
Base Fare:           KES 150
Distance (10×40):    KES 400
Time (15×5):         KES 75
Subtotal:            KES 625

Peak Hour Surge (1.3x): KES 812.50

Minimum Fare Check:  KES 812.50 ✅ (above minimum)

Final Price:         KES 812.50
Rider Earnings:      KES 650 (after 20% commission)
Platform Earnings:   KES 162.50
```

---

## 📱 URLs to Use

| Page | URL | Purpose |
|------|-----|---------|
| Client Form | `client-delivery-form.html` | Request deliveries |
| Admin Login | `admin-login.html` | Admin access |
| Admin Dashboard | `admin-dashboard.html` | Manage settings |

---

## 🔐 Default Admin Credentials

```
Email:    admin@ridergo.com
Password: admin123
```

**⚠️ Change these in production!**

### To Change Admin Password:
1. Login to MongoDB
2. Find Admin document
3. Update password (hash with bcrypt)

---

## 🌍 Location Autocomplete

### How It Works
1. User types location name (e.g., "Nairobi")
2. System queries LocationIQ API
3. Shows dropdown suggestions
4. User clicks to select

### Supported Locations
Currently configured for **Kenya**. To change:

**In clientController.js:**
```javascript
// Change countrycodes parameter:
&countrycodes=ke  // Kenya
&countrycodes=ug  // Uganda
&countrycodes=tz  // Tanzania
```

---

## 💰 Pricing Features

### 1. Fixed Pricing
- Base fare for all deliveries
- Per km charges
- Per minute charges
- Minimum fare enforcement

### 2. Dynamic Surge Pricing
- **Peak Hour Surge**: Configure custom peak hours (e.g., 7-9 AM)
- **Demand Surge**: Automatically increase prices when busy
- Both surge types work together

### 3. Commission System
- Platform takes percentage of each delivery
- Remaining goes to rider
- Configurable commission rate

---

## 📡 API Integration

### Key Endpoints for Clients
```
GET  /api/client/search?query=location
POST /api/client/estimate
POST /api/client/delivery
```

### Key Endpoints for Admin
```
GET  /api/admin/settings
PUT  /api/admin/settings
GET  /api/admin/peak-hours
POST /api/admin/peak-hours
```

---

## ✨ Feature Highlights

| Feature | Status | Notes |
|---------|--------|-------|
| Location Autocomplete | ✅ | Uses LocationIQ API |
| Price Estimation | ✅ | Real-time calculation |
| Surge Pricing | ✅ | Peak hours + demand-based |
| Admin Dashboard | ✅ | No-code configuration |
| Payment Methods | ✅ | Cash, M-Pesa, Card, Wallet |
| Peak Hours Config | ✅ | Set custom times |
| Demand-based Pricing | ✅ | Auto-enabled when busy |
| Commission Management | ✅ | Configurable percentage |

---

## 🧪 Testing Checklist

- [ ] Test location autocomplete
- [ ] Calculate price for 10 km delivery
- [ ] Login to admin dashboard
- [ ] Add a peak hour
- [ ] Update pricing
- [ ] Submit a delivery request
- [ ] Verify surge applies during peak hours

---

## 🚨 Common Issues & Fixes

### Issue: "Cannot find module"
```bash
# Solution: Install dependencies
npm install
```

### Issue: "API not found"
```bash
# Solution: Check server is running
npm start
# Check API URL in HTML files
```

### Issue: "Location autocomplete empty"
```bash
# Solution: Check LocationIQ API key in .env
# Or try different search terms
```

### Issue: "Admin login fails"
```bash
# Solution: Check admin@ridergo.com exists in database
# Check JWT_SECRET in .env
```

---

## 📈 Monitor Performance

Add these to your monitoring:

1. **Response Times**: API should respond < 500ms
2. **Accuracy**: Verify price calculations
3. **Peak Hours**: Test at actual peak times
4. **Load Testing**: Test with multiple concurrent requests

---

## 🔒 Security Notes

Before production:

1. **Change admin password**
2. **Update API keys**
3. **Enable HTTPS**
4. **Add rate limiting**
5. **Implement input validation**
6. **Use environment variables**
7. **Add request logging**
8. **Enable CORS properly**

---

## 📚 Next Steps

1. **Customize Styling**: Edit CSS in HTML files
2. **Add Your Logo**: Replace icons/styling
3. **Configure Peak Hours**: Set for your market
4. **Set Realistic Pricing**: Based on your costs
5. **Test Thoroughly**: Before going live
6. **Deploy Backend**: On your server
7. **Deploy Frontend**: On web host
8. **Set Up Monitoring**: Track performance

---

## 💡 Pro Tips

### Optimize Peak Hours
- Morning rush: Usually 7-9 AM
- Evening rush: Usually 5-7 PM
- Weekend: Different hours
- Friday-Saturday: Often busier

### Pricing Strategy
- Cover your costs
- Be competitive
- Test different rates
- Monitor demand-supply

### Maximize Surge
- Use demand-based surge
- Set appropriate thresholds
- Don't surge too much
- Keep riders happy

---

## 🎓 Learning Resources

- [LocationIQ Documentation](https://locationiq.com/)
- [Express.js Guide](https://expressjs.com/)
- [MongoDB Tutorial](https://docs.mongodb.com/)
- [RESTful API Best Practices](https://restfulapi.net/)

---

## 📞 Getting Help

If you encounter issues:

1. Check the browser console for errors
2. Check server logs
3. Review SETUP_GUIDE.md for detailed info
4. Check API endpoints are correct
5. Verify environment variables

---

## 🎉 You're Ready!

Your delivery platform is now:
- ✅ Accepting orders
- ✅ Calculating prices dynamically
- ✅ Applying surge pricing
- ✅ Ready for configuration

**What to do next:**
1. Customize for your market
2. Set up payment processing
3. Test end-to-end flow
4. Deploy to production
5. Market to customers

Good luck! 🚀

---

**Last Updated:** February 18, 2026
