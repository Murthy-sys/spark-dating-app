# 🔥 Spark — Happn-Clone: Location-Based Social App

A production-ready full-stack mobile application built with **Expo (React Native)**, **Node.js/Express**, and **MongoDB**. Users cross paths in real life, appear in each other's feeds, and can like/match/chat — exactly like Happn.

---

## 📐 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      MOBILE APP (Expo)                          │
│                                                                 │
│  Screens: Welcome → Login/Register → Onboarding → Main Tabs    │
│  ├─ HomeScreen      (crossed-paths grid)                        │
│  ├─ LikesScreen     (who liked you)                             │
│  ├─ ChatListScreen  (matches + unread)                          │
│  ├─ ChatScreen      (real-time Socket.io)                       │
│  └─ ProfileScreen   (edit profile, settings)                   │
│                                                                 │
│  State: Zustand (authStore)                                     │
│  HTTP:  Axios (apiClient) → Bearer JWT                          │
│  WS:    Socket.io-client                                        │
│  Loc:   expo-location (foreground + background task)           │
└───────────────────┬─────────────────────────────────────────────┘
                    │ REST + WebSocket
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BACKEND (Node.js / Express)                   │
│                                                                 │
│  server.ts  ──►  Routes  ──►  Controllers  ──►  Services       │
│                                                                 │
│  Middleware: helmet, cors, rate-limiter, JWT protect, multer   │
│  Socket.io:  JWT auth → match rooms → real-time messages       │
│  Images:     multer (memory) → Cloudinary                      │
└───────────────────┬─────────────────────────────────────────────┘
                    │ Mongoose ODM
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        MONGODB ATLAS                            │
│                                                                 │
│  Collections:  users  (2dsphere geo index)                     │
│                crossings  (pair index)                          │
│                likes       (unique from→to)                    │
│                matches     (unique pair)                        │
│                messages    (match + createdAt index)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Project Structure

```
happn-clone/
├── backend/                        # Node.js API server
│   ├── src/
│   │   ├── config/
│   │   │   └── db.ts               # MongoDB connection
│   │   ├── controllers/
│   │   │   ├── authController.ts   # register, login, getMe, updatePassword
│   │   │   ├── userController.ts   # profile CRUD, photo upload, block
│   │   │   ├── crossingController.ts # location report + feed
│   │   │   ├── matchController.ts  # like, match, unmatch
│   │   │   └── messageController.ts # chat messages
│   │   ├── middleware/
│   │   │   ├── auth.ts             # JWT protect middleware
│   │   │   ├── errorHandler.ts     # global error + notFound
│   │   │   └── upload.ts           # multer + Cloudinary helpers
│   │   ├── models/
│   │   │   ├── User.ts             # GeoJSON + bcrypt + 2dsphere index
│   │   │   ├── Crossing.ts         # pair crossing record
│   │   │   ├── Like.ts             # liked/crushed/passed
│   │   │   ├── Match.ts            # mutual match + unreadCount
│   │   │   └── Message.ts          # chat messages
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── crossings.ts
│   │   │   ├── matches.ts
│   │   │   └── messages.ts
│   │   ├── utils/
│   │   │   └── jwt.ts              # signToken helper
│   │   ├── socket.ts               # Socket.io server (real-time chat)
│   │   └── server.ts               # Express app entry point
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── postman_collection.json     # Import into Postman to test all APIs
│
├── src/                            # Expo app source
│   ├── types/
│   │   └── index.ts                # Shared TypeScript types
│   ├── navigation/
│   │   └── AppNavigator.tsx        # Root + Auth + Onboarding + Tab navigators
│   ├── store/
│   │   └── authStore.ts            # Zustand global auth state
│   ├── services/
│   │   ├── apiClient.ts            # Axios + JWT interceptors
│   │   ├── userService.ts          # Profile API calls
│   │   ├── locationService.ts      # Foreground + background location
│   │   ├── matchingService.ts      # Crossings, likes, matches
│   │   └── chatService.ts          # Socket.io + REST messages
│   ├── hooks/
│   │   └── useLocation.ts          # Location permission + tracking hook
│   ├── components/
│   │   ├── ProfileCard.tsx          # Home feed card (like/crush/pass)
│   │   └── MatchModal.tsx           # "It's a Match!" animated overlay
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── WelcomeScreen.tsx
│   │   │   ├── LoginScreen.tsx
│   │   │   └── RegisterScreen.tsx
│   │   ├── onboarding/
│   │   │   └── SetupProfileScreen.tsx
│   │   └── main/
│   │       ├── HomeScreen.tsx       # Crossed-paths grid feed
│   │       ├── LikesScreen.tsx      # People who liked you
│   │       ├── ChatListScreen.tsx   # Matches list
│   │       ├── ChatScreen.tsx       # Real-time chat
│   │       └── ProfileScreen.tsx    # Edit profile
│   └── utils/
│       └── distance.ts              # Haversine formula helpers
├── App.tsx
├── .env.example
└── package.json
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- MongoDB (local or Atlas)
- Cloudinary account (free tier works)
- Expo CLI: `npm install -g expo-cli`

### 1. Clone & Install

```bash
git clone https://github.com/yourname/happn-clone.git
cd happn-clone

# Backend
cd backend
npm install
cp .env.example .env
# → Edit .env with your MongoDB URI, JWT secret, Cloudinary credentials

# Frontend
cd ..
npm install
cp .env.example .env
# → Edit .env with your backend IP/URL
```

### 2. Start MongoDB Locally

```bash
# macOS with Homebrew
brew services start mongodb-community

# Or use Docker
docker run -d -p 27017:27017 --name mongo mongo:7
```

### 3. Start the Backend

```bash
cd backend
npm run dev
# → Server running on http://localhost:5000
# → MongoDB connected
```

### 4. Start the Expo App

```bash
# From project root
npx expo start

# Scan QR with Expo Go app, or press:
# a → Android emulator
# i → iOS simulator
```

> **⚠️ Important:** In `.env`, use your machine's LAN IP (`192.168.x.x`), not `localhost`, so the phone can reach the backend.

---

## 🗃️ MongoDB Schema Design

### User — GeoJSON + 2dsphere index
```typescript
location: {
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: [Number]   // [longitude, latitude] — GeoJSON order!
}

// Indexes:
UserSchema.index({ location: '2dsphere' });  // enables $near, $geoNear
UserSchema.index({ email: 1 });
UserSchema.index({ 'settings.showMe': 1 });
```

### Crossing — detected when two users are within 250m
```typescript
users:         [ObjectId, ObjectId]  // always sorted for unique compound index
crossingCount: Number                // incremented each time they meet
crossedAt:     Date
location:      GeoJSON Point

CrossingSchema.index({ users: 1 }, { unique: true });
```

### Like — the swipe record
```typescript
from:   ObjectId  // who swiped
to:     ObjectId  // who was swiped on
status: 'liked' | 'crushed' | 'passed'

LikeSchema.index({ from: 1, to: 1 }, { unique: true });  // one record per pair
LikeSchema.index({ to: 1, status: 1 });                  // fast "who liked me" lookup
```

### Match — mutual likes
```typescript
users:         [ObjectId, ObjectId]   // sorted pair
matchedAt:     Date
lastMessage:   String
lastMessageAt: Date
unreadCount:   Map<userId, number>

MatchSchema.index({ users: 1 }, { unique: true });
MatchSchema.index({ lastMessageAt: -1 });             // sort matches by recency
```

### Message — chat history
```typescript
match:    ObjectId
sender:   ObjectId
text:     String
imageURL: String
readAt:   Date

MessageSchema.index({ match: 1, createdAt: 1 });      // paginate by match + time
```

---

## 🗺️ Location & Crossing Detection

The heart of the Happn experience lives in `crossingController.ts`:

```typescript
// Every 30s the app POSTs its GPS coordinates to POST /crossings/location
// The server then runs a MongoDB $near query:

const nearbyUsers = await User.find({
  _id:              { $ne: myId },
  'settings.showMe': true,
  isActive:         true,
  location: {
    $near: {
      $geometry:    { type: 'Point', coordinates: [longitude, latitude] },
      $maxDistance: 250,   // 250 meters
    },
  },
});

// Each nearby user gets an upserted Crossing document (count++):
await Crossing.bulkWrite(crossingOps);  // O(n) with one DB round-trip
```

**Why bulkWrite?** Instead of N individual upserts (one per nearby user), we batch them into a single MongoDB round-trip, which is critical for performance at scale.

---

## 🔌 Socket.IO Real-Time Chat

```
Client                              Server
  │                                   │
  ├──── connect (auth: { token }) ───►│  JWT verified
  │◄─── connected ────────────────────┤
  │                                   │
  ├──── join_match { matchId } ──────►│  Verify user is in match
  │◄─── joined match:xxx room ────────┤
  │                                   │
  ├──── send_message { matchId, text }►│  Save to MongoDB
  │                                   │  Broadcast to room
  │◄─── new_message { message } ──────┤  (both users receive)
  │                                   │
  ├──── typing { matchId } ──────────►│  Forward to other user
  │◄─── typing { userId } ────────────┤
  │                                   │
  ├──── stop_typing { matchId } ─────►│  Forward to other user
  │                                   │
  ├──── read_messages { matchId } ───►│  Reset unreadCount in DB
  │◄─── messages_read { userId } ─────┤  Other user notified
```

---

## 📡 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Create account |
| POST | `/api/auth/login` | ❌ | Login → JWT |
| GET | `/api/auth/me` | ✅ | Current user profile |
| PATCH | `/api/auth/update-password` | ✅ | Change password |
| GET | `/api/users/:id` | ✅ | View any profile |
| PATCH | `/api/users/me` | ✅ | Update my profile |
| PATCH | `/api/users/me/location` | ✅ | Update location only |
| POST | `/api/users/me/photos` | ✅ | Upload profile photo |
| DELETE | `/api/users/me/photos/:index` | ✅ | Remove a photo |
| POST | `/api/users/:id/block` | ✅ | Block a user |
| POST | `/api/crossings/location` | ✅ | Report GPS + detect crossings |
| GET | `/api/crossings` | ✅ | Get crossed-paths feed |
| POST | `/api/matches/like/:userId` | ✅ | Like/crush/pass a user |
| GET | `/api/matches` | ✅ | Get my matches |
| GET | `/api/matches/likes-received` | ✅ | Who liked me |
| DELETE | `/api/matches/:matchId` | ✅ | Unmatch |
| GET | `/api/messages/:matchId` | ✅ | Load chat history |
| POST | `/api/messages/:matchId` | ✅ | Send text message |
| POST | `/api/messages/:matchId/image` | ✅ | Send image message |

---

## 🔒 Security Checklist

- [x] **bcrypt** (12 rounds) for password hashing
- [x] **JWT** with 30-day expiry, verified on every protected route
- [x] **Helmet** — sets 11 security-related HTTP headers
- [x] **express-rate-limit** — 100 req/15min globally, 10 req/15min on auth
- [x] **CORS** — whitelist specific origins in production
- [x] `password` field has `select: false` — never returned in queries
- [x] All routes validate input before hitting the database
- [x] Cloudinary uploads replace local file storage (no disk exposure)
- [x] Socket.io connections require a valid JWT

---

## ☁️ Deployment Guide

### Backend → Railway / Render / Fly.io

```bash
# Build TypeScript
cd backend
npm run build    # outputs to dist/

# Push to Railway
railway login
railway init
railway up

# Set environment variables in Railway dashboard:
# NODE_ENV=production
# MONGO_URI=mongodb+srv://...
# JWT_SECRET=...
# CLOUDINARY_CLOUD_NAME=...
# CLOUDINARY_API_KEY=...
# CLOUDINARY_API_SECRET=...
```

**Render alternative (free tier available):**
1. Connect GitHub repo to Render
2. Set Build Command: `cd backend && npm install && npm run build`
3. Set Start Command: `cd backend && npm start`
4. Add environment variables in the Render dashboard

### MongoDB → Atlas (Free Tier)
1. Create account at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create a free M0 cluster
3. Create a database user with readWrite permissions
4. Allow connections from your server IP (or 0.0.0.0/0 for dev)
5. Copy the connection string to `MONGO_URI`

### Frontend → Expo EAS Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Login and configure
eas login
eas build:configure

# Build for Android (.aab for Play Store)
eas build --platform android --profile production

# Build for iOS (.ipa for App Store)  
eas build --platform ios --profile production

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

Update your production API URL in `.env`:
```
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api
EXPO_PUBLIC_SOCKET_URL=https://api.yourdomain.com
```

### Custom Domain + SSL (Nginx)

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass         http://localhost:5000;
        proxy_http_version 1.1;
        # Required for Socket.io WebSocket upgrade
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📈 Scaling Improvements

### Short Term
| Issue | Solution |
|-------|----------|
| Location spam | Debounce to 1 report/30s per user |
| Crossing detection N+1 | Already using `bulkWrite` — ✅ |
| Image delivery speed | Cloudinary CDN + auto format/quality — ✅ |
| Message delivery latency | Socket.io rooms — ✅ |

### Medium Term
- **Redis** — cache crossed-paths feed per user (TTL 5 min)
- **Bull queue** — move crossing detection to background workers
- **MongoDB Atlas Search** — full-text search on bios
- **Geospatial sharding** — partition by region for millions of users

### Long Term
- **Microservices** — split Chat, Location, and Matching into separate services
- **Kafka** — event streaming for location updates at scale
- **Push notifications** — Firebase FCM for match alerts when app is closed
- **CDN for Socket.io** — AWS API Gateway WebSockets or Ably for global scale

---

## 🧪 Testing the API (Postman)

1. Open Postman → Import → File → select `backend/postman_collection.json`
2. The collection uses variables (`authToken`, `userId`, `matchId`)
3. Run **Register** or **Login** first — the test script auto-saves your JWT
4. All other requests will automatically use the saved token
5. Use **Report Location** to simulate GPS updates
6. Test matching: register two users, each like the other → watch `isMatch: true`

---

## 🎁 Bonus: Sample .env Files

See `backend/.env.example` and `.env.example` in the project root.

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

