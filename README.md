# 🌿 ElderCare — Full-Stack Marketplace

A production-ready three-sided marketplace connecting families with verified elder caregivers.

---

## Architecture

```
eldercare/
├── backend/       Node.js + Express + Prisma + PostgreSQL
├── web/           React + Vite (Customer Dashboard + Admin Panel)
└── mobile/        React Native + Expo (Customer App + Caregiver App)
```

### Tech Stack

| Layer | Stack |
|---|---|
| Backend API | Node.js 18+, Express 4, Prisma 5, PostgreSQL |
| Auth | OTP-based (no passwords), JWT sessions (30d), Redis rate-limiting |
| Payments | Razorpay (escrow model: HELD → RELEASED) |
| Storage | AWS S3 (pre-signed URLs — browser uploads directly, no server memory) |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| Caching | Redis (OTP, rate limits) |
| Web Frontend | React 18, React Router 7, TanStack Query 5, Zustand 5, Tailwind CSS 3, Recharts |
| Mobile App | Expo 52, Expo Router 4, TanStack Query 5, Zustand 5 |
| Background Jobs | node-cron (auto-offline, GPS cleanup, subscription expiry, booking reminders) |

---

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis (optional in dev — uses in-memory fallback)
- AWS S3 bucket
- Firebase project (FCM)
- Razorpay account

---

### Backend

```bash
cd eldercare/backend

# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in: DATABASE_URL, JWT_SECRET, RAZORPAY_*, FIREBASE_*, AWS_*, REDIS_URL

# 3. Run database migrations
npx prisma migrate dev --name init

# 4. Generate Prisma client
npx prisma generate

# 5. Seed with sample data
npm run db:seed

# 6. Start development server
npm run dev
# → http://localhost:4000
```

**Test credentials (from seed):**

| Role | Phone | Plan |
|---|---|---|
| Admin | +919000000001 | — |
| Customer | +919222222201 | Family Basic |
| Customer | +919222222202 | Family Premium |
| Caregiver | +919111111101 | Priya Sharma, Bangalore |
| Caregiver | +919111111102 | Ramesh Nair, Bangalore |
| Caregiver | +919111111103 | Sunita Patel, Mumbai |

> In dev, OTPs print to console — no SMS needed.

```bash
# Run tests
npm test

# Prisma Studio (DB browser)
npm run db:studio
```

---

### Web Frontend

```bash
cd eldercare/web

npm install
npm run dev
# → http://localhost:5173
```

> The Vite dev server proxies `/api` → `http://localhost:4000` automatically.

**Build for production:**
```bash
npm run build        # outputs to dist/
npm run preview      # preview the production build
```

---

### Mobile App

```bash
cd eldercare/mobile

# 1. Set your local IP in src/lib/api.js:
#    baseURL: 'http://YOUR_LOCAL_IP:4000/api'

npm install

# Start Expo
npm start          # → opens Expo DevTools
npm run android    # Android (emulator or device)
npm run ios        # iOS (macOS only)
```

**Build for stores (Expo Application Services):**
```bash
npm install -g eas-cli
eas login
eas build --platform android
eas build --platform ios
```

---

## API Endpoints

Base URL: `http://localhost:4000/api`

All endpoints require `Authorization: Bearer <token>` except auth routes.

### Authentication
| Method | Path | Access |
|---|---|---|
| POST | `/auth/send-otp` | Public |
| POST | `/auth/verify-otp` | Public |
| POST | `/auth/complete-signup` | Temp token |
| POST | `/auth/logout` | Authenticated |
| POST | `/auth/refresh-token` | Authenticated |
| GET | `/auth/me` | Authenticated |

### Caregiver
| Method | Path | Access |
|---|---|---|
| GET | `/caregiver/search` | Authenticated |
| GET | `/caregiver/me` | CAREGIVER |
| GET | `/caregiver/:id` | Authenticated |
| PUT | `/caregiver/profile` | CAREGIVER |
| PUT | `/caregiver/availability` | CAREGIVER |
| PUT | `/caregiver/online-status` | CAREGIVER |
| POST | `/caregiver/documents/upload-url` | CAREGIVER |
| POST | `/caregiver/documents` | CAREGIVER |
| GET | `/caregiver/documents` | CAREGIVER |
| GET | `/caregiver/earnings` | CAREGIVER |
| POST | `/caregiver/payout-request` | CAREGIVER |

### Bookings
| Method | Path | Access |
|---|---|---|
| POST | `/bookings` | CUSTOMER |
| GET | `/bookings/customer` | CUSTOMER |
| GET | `/bookings/caregiver` | CAREGIVER |
| GET | `/bookings/:id` | Own booking or ADMIN |
| PUT | `/bookings/:id/confirm` | CAREGIVER |
| PUT | `/bookings/:id/cancel` | Any authenticated |
| POST | `/bookings/:id/check-in` | CAREGIVER |
| POST | `/bookings/:id/check-out` | CAREGIVER |
| POST | `/bookings/:id/gps-update` | CAREGIVER |
| POST | `/bookings/:id/review` | CUSTOMER |
| POST | `/bookings/:id/sos` | CUSTOMER (max 3/booking) |
| GET | `/bookings/:id/gps-history` | Authenticated |

### Payments
| Method | Path | Access |
|---|---|---|
| POST | `/payments/create-order` | CUSTOMER |
| POST | `/payments/verify` | Authenticated |
| POST | `/payments/subscribe` | CUSTOMER |
| GET | `/payments/subscription` | CUSTOMER |
| POST | `/payments/subscription/cancel` | CUSTOMER |

### Customer
| Method | Path | Access |
|---|---|---|
| GET | `/customer/profile` | CUSTOMER |
| PUT | `/customer/profile` | CUSTOMER |
| GET | `/customer/elders` | CUSTOMER |
| POST | `/customer/elders` | CUSTOMER |
| PUT | `/customer/elders/:id` | CUSTOMER |
| DELETE | `/customer/elders/:id` | CUSTOMER |
| POST | `/customer/reports` | CUSTOMER |

### Admin
| Method | Path | Access |
|---|---|---|
| GET | `/admin/dashboard` | ADMIN |
| GET | `/admin/caregivers/pending` | ADMIN |
| PUT | `/admin/caregivers/:id/verify` | ADMIN |
| GET | `/admin/caregivers` | ADMIN |
| PUT | `/admin/caregivers/:id/suspend` | ADMIN |
| GET | `/admin/bookings` | ADMIN |
| GET | `/admin/reports` | ADMIN |
| PUT | `/admin/reports/:id/resolve` | ADMIN |
| GET | `/admin/analytics` | ADMIN |
| GET | `/admin/settings` | ADMIN |

### Notifications
| Method | Path | Access |
|---|---|---|
| POST | `/notifications/subscribe` | Authenticated |
| GET | `/notifications` | Authenticated |
| PUT | `/notifications/read-all` | Authenticated |
| PUT | `/notifications/:id/read` | Authenticated |

---

## Business Rules

### Booking
- Min lead time: **1 hour** before booking
- Duration: **1–12 hours**, 1-hour increments
- Caregiver must be **VERIFIED** and **online**
- No overlapping bookings for same caregiver

### Refund Policy
| Time before booking | Refund |
|---|---|
| > 24 hours | 100% |
| 1 – 24 hours | 50% |
| < 1 hour or after check-in | 0% |

### Subscription Limits
| Plan | Price | Bookings/month | Discount |
|---|---|---|---|
| FREE | ₹0 | 2 | 0% |
| FAMILY_BASIC | ₹499 | 10 | 5% |
| FAMILY_PREMIUM | ₹999 | Unlimited | 10% |
| ENTERPRISE | ₹2999 | Unlimited | 10% |

### Payment Flow
```
PENDING → HELD (on payment verify) → RELEASED (on check-out)
                                   ↘ REFUNDED (on cancellation)
```

### SOS
- Max **3 alerts** per booking
- Each SOS logs an `EMERGENCY_INCIDENT` report in the database
- FCM push sent to caregiver immediately

### Caregiver Auto-Offline
- Cron runs every hour
- If caregiver has been online **> 12 hours** with no active booking → set offline

### GPS / Privacy
- Logs stored per booking, GPS update every **30 seconds** during active sessions
- GPS logs **auto-deleted after 90 days** (nightly cron)

---

## Deployment

### Backend (e.g. Railway / Render / EC2)

```bash
# Set NODE_ENV=production and all .env vars on the platform

npm run db:migrate    # run pending migrations
npm start             # or: pm2 start npm -- start
```

### Web (Vercel — recommended)

```bash
vercel deploy --prod
# Set VITE_API_URL=https://your-backend-api.com in Vercel env vars
```

### Mobile (EAS)

```bash
eas build --platform android --profile production
eas build --platform ios --profile production
eas submit --platform android
eas submit --platform ios
```

---

## Environment Variables

### Backend `.env`

```env
DATABASE_URL=postgresql://user:pass@host:5432/eldercare
JWT_SECRET=minimum-32-character-secret-key
REDIS_URL=redis://host:6379
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=ap-south-1
AWS_S3_BUCKET=eldercare-documents
FIREBASE_PROJECT_ID=xxx
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=xxx@xxx.iam.gserviceaccount.com
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx
OTP_PROVIDER=msg91        # console | msg91 | twilio
MSG91_AUTH_KEY=xxx
MSG91_TEMPLATE_ID=xxx
CORS_ORIGIN=https://admin.eldercare.in,https://app.eldercare.in
PORT=4000
NODE_ENV=production
```

### Web `.env`

```env
VITE_API_URL=https://api.eldercare.in
```

---

## Security

- All endpoints protected by JWT + DB session validation
- OTP rate limited: 5 requests/phone/hour (Redis)
- Razorpay signatures verified via HMAC-SHA256
- S3 documents never publicly accessible — time-limited signed URLs (1hr)
- Prisma ORM prevents SQL injection
- Helmet + CORS + global rate limiting on all routes
- Account soft-delete with 30-day grace period

---

## Running Tests

```bash
cd eldercare/backend
npm test

# With coverage
npm run test:coverage
```

Tests cover:
- OTP service: send, verify, rate limiting
- JWT: generation, verification, tamper detection
- Auth routes: phone validation, wrong OTP
- Booking logic: refund calculation, subscription limits, SOS cap
