# RiderGo Backend Code Review - Issues & Fixes

## 🔴 CRITICAL ISSUES

### 1. **Inconsistent Authentication Middleware** ⚠️ HIGH PRIORITY
**Problem:** Multiple auth middlewares with different names and inconsistent request properties.

- `authMiddleware.js` exports `protect` (sets `req.client`)
- `auth.js` exports `auth` (sets `req.user`) and `protectRider` (sets `req.rider`)
- Routes use both `protect` and `auth` inconsistently
- Controllers expect different properties: `req.user.id`, `req.client`, `req.rider`

**Files Affected:**
- `src/routes/clientAuth.js` - uses both `auth` and `protect`
- `src/controllers/clientController.js` - expects `req.user.id` and `req.user`
- Other route files have similar inconsistencies

**Fix:** Standardize to one auth pattern (suggest using `auth` middleware with `req.user` everywhere)

---

### 2. **Missing `isVerified` Field in Client Schema**
**Problem:** Code tries to set `client.isVerified = true` but field doesn't exist in model.

```javascript
// clientController.js line 176 tries to set:
client.isVerified = true;

// But Client.js schema doesn't define isVerified field
```

**Location:** `src/models/Client.js`
**Fix:** Add `isVerified: { type: Boolean, default: false }` to schema

---

### 3. **resendRiderOtp Placed in Wrong Controller**
**Problem:** `resendRiderOtp` is exported from `clientController.js` but it's a rider function.

```javascript
// clientAuth.js imports from clientController:
import { resendRiderOtp } from "../controllers/clientController.js";

// But resendRiderOtp is actually a rider-specific function
// AND it calls undefined sendOtp function
```

**Issues:**
- Function is in wrong file
- Uses undefined `sendOtp()` instead of `sendSimpleOtp()`
- Used for clients instead of riders

**Fix:** Move to `riderController.js` and fix the OTP sending logic

---

### 4. **Inconsistent Wallet Management**
**Problem:** Dual wallet systems cause confusion:

- `Rider` model has `walletBalance` field
- Separate `Wallet` model exists for clients
- `Trip.js` has `clientWalletUsed` and `riderEarnings`
- Inconsistent between client and rider implementations

**Recommendation:** Choose ONE pattern:
- Option A: Use separate `Wallet` collection for both clients and riders
- Option B: Use embedded `walletBalance` in both models
- Current: Mixed approach (confusing)

---

### 5. **Duplicate/Conflicting Fields in Rider Schema**
**Problem:** Rider model has overlapping subscription fields:

```javascript
subscriptionActive: Boolean,
subscriptionExpires: Date,      // one naming pattern
subscriptionExpiresAt: { type: Date } // different naming pattern
```

**Fix:** Keep ONE consistent field name (recommend `subscriptionExpiresAt`)

---

## 🟡 MEDIUM ISSUES

### 6. **Inconsistent Response Format**
**Problem:** Different endpoints return different response structures:

```javascript
// Some responses:
{ success: true, data: ... }
{ msg: "..." }
{ message: "..." }
{ success: false, message: "..." }
```

**Recommendation:** Standardize to:
```javascript
{
  success: true/false,
  message: "...",
  data: { ... } // optional
}
```

**Files to Update:**
- `src/controllers/riderController.js`
- `src/controllers/clientController.js`
- `src/controllers/adminController.js`

---

### 7. **Inconsistent Token Generation**
**Problem:** Different token payloads:

```javascript
// ClientController:
jwt.sign({ id }, process.env.JWT_SECRET, ...)

// RiderController:
jwt.sign({ id: rider._id, role: "rider" }, ...)

// AdminController likely needs:
jwt.sign({ id: admin._id, role: "admin" }, ...)
```

**Risk:** Frontend can't reliably determine user type from token

**Fix:** Standardize all tokens to include `role`:
```javascript
jwt.sign({ id, role: "client|rider|admin" }, ...)
```

---

### 8. **Phone Number Normalization Incomplete**
**Problem:** Phone formatting done in `otpService.js` but not consistently used:

```javascript
// otpService normalizes to +254...
const fullPhone = phone.startsWith("0") ? `+254${phone.substring(1)}` : ...

// But Trip queries and other operations may not use same format
```

**Recommendation:** 
- Create utility function `src/utils/phoneFormatter.js`
- Always normalize before database operations
- Document the standard format (+254XXX...)

---

### 9. **Missing Error Handling in createDelivery**
**Problem:** `createDelivery` uses coordinates but doesn't validate they're present before calculations

```javascript
// If coordinates missing, still tries to calculate but might produce wrong values
if (pickupLat && pickupLng && dropoffLat && dropoffLng) { 
  // calculations
}
// But afterward uses calculatedPrice which might be 0
const finalPrice = calculatedPrice > 0 ? calculatedPrice : (estimatedValue || 0);
```

**Risk:** Could allow trips with price 0 if neither coordinates nor estimatedValue provided

**Fix:** Add validation earlier in function

---

### 10. **Settings Model Not Guaranteed to Exist**
**Problem:** Code creates default settings if missing, but inconsistently:

```javascript
// getDeliveryEstimate:
let settings = await Settings.findOne();
if (!settings) settings = new Settings(); // Not saved!

// createDelivery:
let settings = await Settings.findOne();
if (!settings) settings = await Settings.create({}); // Saved
```

**Risk:** Unsaved defaults in one, saved in another

**Fix:** Create utility function `getOrCreateSettings()` used consistently

---

## 🟢 MINOR ISSUES

### 11. **Unused Imports**
- `clientController.js` imports mongoose but doesn't use it directly
- Various controllers import utilities not always used

### 12. **updateClientProfile Used for Riders?**
```javascript
// In clientAuth.js:
router.put("/profile", auth, upload.single("profilePhoto"), updateClientProfile);

// But updateClientProfile queries req.user not req.client
// Unclear if this works for both or is a bug
```

### 13. **Search Endpoint Returns Empty Array on Error**
```javascript
// searchLocation silently returns empty results on error
// Instead of returning 500 error - clients might think no results exist
```

---

## ✅ RECOMMENDATIONS

1. **Create a centralized utils folder with:**
   - `phoneFormatter.js` - phone normalization
   - `responseFormatter.js` - standard response format
   - `generateToken.js` - centralized token generation
   - `getSettings.js` - guaranteed settings

2. **Add a constants file for:**
   - Response messages
   - Error codes
   - Enum values (status, role, etc.)

3. **Create type/validation schemas** for request bodies using a library like Joi

4. **Add comprehensive error logging** - some errors logged, some not

5. **Document API contract** - which endpoints need which token, what they return

---

## 📋 PRIORITY FIX ORDER

1. **Fix Client.isVerified field** (blocks registration)
2. **Standardize auth middleware** (affects all protected routes)
3. **Move/fix resendRiderOtp** (broken function)
4. **Standardize response formats** (better for frontend)
5. **Consolidate wallet implementation** (prevents data issues)
6. **Fix Rider schema duplicates** (cleanup)
