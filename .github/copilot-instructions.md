# RiderGo Backend – AI Coding Instructions

This repository powers the RiderGo delivery platform. The backend is a **Node 18+ / Express API** with a handful of static HTML pages used for quick manual testing. The code is written using ES modules (`"type": "module"` in `package.json`).

---
## 🧭 High‑Level Architecture

1. **Entry point:** `src/index.js` – sets up Express, connects to MongoDB, mounts routes and validates required environment variables.
2. **Routes:** `src/routes/*.js` – each domain (client, rider, admin, mpesa, etc.) has its own router.  Add new endpoints here and import the router in `index.js`.
3. **Controllers:** `src/controllers/*.js` – business logic, database queries, external API calls.  Typical pattern:
   ```js
   export const someHandler = async (req, res) => {
     try {
       // validate req.body / req.query
       const result = await Model.find(...);
       res.json({ success: true, data: result });
     } catch (err) {
       console.error("someHandler error:", err);
       res.status(500).json({ success: false, message: err.message });
     }
   };
   ```
4. **Models:** `src/models/*.js` – Mongoose schemas.  There’s an opinionated single-document `Settings` model used by pricing logic.
5. **Middlewares:**
   * `authMiddleware.js` (`protect`) – verifies JWT and attaches `req.client`.
   * `adminAuth.js` (`protectAdmin`) – ensures token has `role: "admin"` and attaches `req.admin`.
6. **Services / utils:** external integrations (MPESA, OTP, OCR, etc.) live under `src/services` or `src/utils`.
7. **Static UI assets:** HTML files (`client-delivery-form.html`, `admin-login.html`, `admin-dashboard.html`) at the repo root make raw API calls; edit as necessary but they are not processed by any build tool.
8. Ignore the `ridergo-backend` subfolder – it’s a legacy zip copy and not used by the running app.

---
## 🔧 Developer Workflows

- **Install & run:**
  ```bash
  npm install
  npm start          # runs node src/index.js
  ```
  The server listens on `PORT` (default 5000) and prints helpful errors if `MONGO_URI` or `JWT_SECRET` are missing.
- **Environment variables:** set in a `.env` file (see `ridergo-backend/.env.example`). Key values:
  | Name | Purpose |
  |------|---------|
  | MONGO_URI | MongoDB connection string |
  | JWT_SECRET | secret for both client/admin tokens |
  | PORT | server port (optional) |
  | SMTP_EMAIL / SMTP_PASSWORD | Gmail creds used by OTP service (sendSimpleOtp) |
  | GOOGLE_MAPS_API_KEY | used for distance matrix & place search fallback |
  | LOCATIONIQ_ACCESS_TOKEN | preferred geocoding/search service (defaults to `ke` country code) |
  | MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET / MPESA_SHORTCODE / MPESA_PASSKEY / MPESA_CALLBACK_URL | M‑Pesa sandbox credentials |
  + any other provider keys seen in `src/config/*.js` or controllers.

- **Manual testing:** Use the provided HTML pages or tools like Postman/curl. Quick‑start instructions are in `QUICK_START.md` and often show example endpoints:
  ```bash
  GET /api/client/search?query=Nairobi
  POST /api/client/estimate
  POST /api/client/delivery   (auth required)
  POST /api/admin/settings    (admin auth)
  ```

- **JWT conventions:** tokens contain `{ id }` for clients, `{ id, role: 'admin' }` for admins. Use `generateToken(id)` helper or `jwt.sign` directly. Protect routes with the appropriate middleware.

- **Price/route logic:** see `clientController.js` helpers:
  * `calculateDistance(...)` – Haversine formula
  * `getRouteDetails(...)` – prefers LocationIQ, falls back to Google Maps
  * `calculateSurge(settings)` – combines time‑based peak hours (from DB or hardcoded) and demand‑based surge using the active trips count.

- **OTP flow:** `services/otpService.js` generates a 6‑digit code, stores it in the `Otp` model (expires in 10 min), and sends it by email using Gmail. On failure it logs the OTP to console for development. The project no longer uses SMS or WhatsApp channels.

- **M‑Pesa & callback:** The STK push is implemented in `services/mpesaService.js` and used by `controllers/mpesaController.js`. Callback endpoint `/api/payments/mpesa/callback` parses Safaricom’s JSON, finds the `Rider` by phone (formats normalized to +254), and updates subscription fields.

- **Admin features:** settings, rider verification, withdrawals, dashboard stats. Responses are always `{ success: true/false, ... }` except where noted.

- **Phone formatting:** Many controllers normalise Kenyan phone numbers (`0…` ➜ `+254…`). Reuse the helper logic or extend it if working with other countries.

- **Surge and pricing data:** Consolidated in one `Settings` document. Controllers call `Settings.findOne()` and create a default if missing. When adding new pricing fields, update both admin controller and client estimation code.

- **Error handling:** controllers log errors to console and reply with a 500 status containing the error message. Additional validation usually returns 400 with specific messages.

- **Adding new resources:**
  1. Create Mongoose schema in `src/models`.
  2. Add controller(s) with async functions exported by name.
  3. Define route(s) in appropriate router and mount in `src/index.js`.
  4. If needed, add middleware (e.g. new auth checks) or service modules.

- **No automated tests** currently exist. Write Jest/Mocha tests in a `test/` folder if adding CI; follow the async controller patterns for mocks.

---
## 📝 Project‑Specific Notes

- The entire platform targets Kenyan operations; country codes and currency (KES) are hardcoded in several places.
- Frontend HTML files assume API is served from the same host (no CORS issues). They use `fetch`/`axios` directly.
- The `Settings` schema stores complex nested arrays (e.g. `peakHours`) – mimic that structure when seeding or editing via MongoDB shell.
- `ridergo-backend/` folder is a downloaded copy; do **not** edit it. Work happens in the top‑level directory.
- The codebase uses modern JavaScript (ES2023) but avoids transpilation; keep imports/exports consistent with ESM.

---
## ✅ What AI Agents Should Know

- You can make meaningful changes immediately by editing controllers and models; the project boots with `npm start`.
- Environment variables drive most external integrations – always document any new keys you introduce.
- When tracking down bugs, check the console output — there are helpful `console.log` tips (e.g. Mongo connection error message suggests `sudo systemctl start mongod`).
- For external API calls (LocationIQ, Google, M‑Pesa), error handling is minimal; add retries or better logging if needed.

---
Please review these instructions and let me know if any areas are unclear or need more detail. I'm happy to iterate!