# Spark — Backend API

Node.js + Express + MongoDB + Socket.io backend for the Spark dating app.

---

## Tech Stack

| Layer         | Technology                  |
|---------------|-----------------------------|
| Runtime       | Node.js 18+                 |
| Framework     | Express.js + TypeScript     |
| Database      | MongoDB + Mongoose          |
| Real-time     | Socket.io                   |
| Auth          | JWT (jsonwebtoken)          |
| Media Upload  | Cloudinary                  |
| Security      | Helmet, CORS, Rate Limiting |

---

## Project Structure

```
backend/
├── src/
│   ├── server.ts               # Entry point — Express + HTTP server
│   ├── socket.ts               # Socket.io real-time chat server
│   ├── config/
│   │   └── db.ts               # MongoDB connection
│   ├── models/
│   │   ├── User.ts             # User schema (2dsphere index for geo queries)
│   │   ├── Crossing.ts         # Crossed-paths records
│   │   ├── Like.ts             # Like / crush / pass actions
│   │   ├── Match.ts            # Matched pairs
│   │   └── Message.ts          # Chat messages
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── userController.ts
│   │   ├── crossingController.ts
│   │   ├── matchController.ts
│   │   └── messageController.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   ├── crossings.ts
│   │   ├── matches.ts
│   │   └── messages.ts
│   ├── middleware/
│   │   ├── auth.ts             # JWT protect middleware
│   │   ├── errorHandler.ts     # Global error + 404 handler
│   │   └── upload.ts           # Multer + Cloudinary upload
│   └── utils/
│       ├── jwt.ts
│       └── distance.ts
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Install MongoDB locally

```bash
# macOS
brew tap mongodb/brew && brew install mongodb-community
brew services start mongodb-community

# Ubuntu
sudo apt install mongodb
sudo systemctl start mongod

# Or use MongoDB Atlas (free cloud tier) — update MONGO_URI in .env
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/spark_dating
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=30d

# Cloudinary (free tier at cloudinary.com)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 4. Run the server

```bash
npm run dev       # development with hot reload
npm run build     # compile TypeScript
npm start         # run compiled build
```

Server starts at: `http://localhost:5000`

---

## API Reference

### Auth

| Method | Endpoint                    | Description          | Auth |
|--------|-----------------------------|----------------------|------|
| POST   | `/api/auth/register`        | Create account       | ✗    |
| POST   | `/api/auth/login`           | Login                | ✗    |
| GET    | `/api/auth/me`              | Get current user     | ✓    |
| PATCH  | `/api/auth/update-password` | Change password      | ✓    |

### Users

| Method | Endpoint                    | Description              | Auth |
|--------|-----------------------------|--------------------------|------|
| GET    | `/api/users/:id`            | Get user profile         | ✓    |
| PATCH  | `/api/users/me`             | Update my profile        | ✓    |
| PATCH  | `/api/users/me/location`    | Update my location       | ✓    |
| POST   | `/api/users/me/photos`      | Upload profile photo     | ✓    |
| DELETE | `/api/users/me/photos/:idx` | Delete profile photo     | ✓    |
| POST   | `/api/users/:id/block`      | Block a user             | ✓    |
| DELETE | `/api/users/me`             | Deactivate account       | ✓    |

### Crossings

| Method | Endpoint                | Description                           | Auth |
|--------|-------------------------|---------------------------------------|------|
| POST   | `/api/crossings/location` | Report location + detect crossings  | ✓    |
| GET    | `/api/crossings`          | Get crossed-paths feed               | ✓    |

### Matches

| Method | Endpoint                       | Description            | Auth |
|--------|--------------------------------|------------------------|------|
| POST   | `/api/matches/like/:userId`    | Like / crush / pass    | ✓    |
| GET    | `/api/matches`                 | Get my matches         | ✓    |
| GET    | `/api/matches/likes-received`  | Who liked me           | ✓    |
| DELETE | `/api/matches/:matchId`        | Unmatch                | ✓    |

### Messages

| Method | Endpoint                        | Description         | Auth |
|--------|---------------------------------|---------------------|------|
| GET    | `/api/messages/:matchId`        | Get messages        | ✓    |
| POST   | `/api/messages/:matchId`        | Send text message   | ✓    |
| POST   | `/api/messages/:matchId/image`  | Send image message  | ✓    |

---

## Socket.io Events

Connect with:
```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:5000', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});
```

### Client → Server

| Event           | Payload                    | Description                   |
|-----------------|----------------------------|-------------------------------|
| `join_match`    | `{ matchId }`              | Join a chat room              |
| `send_message`  | `{ matchId, text }`        | Send a message via socket     |
| `typing`        | `{ matchId }`              | Show typing indicator         |
| `stop_typing`   | `{ matchId }`              | Hide typing indicator         |
| `read_messages` | `{ matchId }`              | Mark messages as read         |

### Server → Client

| Event            | Payload                       | Description                  |
|------------------|-------------------------------|------------------------------|
| `new_message`    | `{ message }`                 | New message received         |
| `typing`         | `{ userId }`                  | Other user is typing         |
| `stop_typing`    | `{ userId }`                  | Other user stopped typing    |
| `messages_read`  | `{ userId, matchId }`         | Other user read messages     |
| `error`          | `{ message }`                 | Error notification           |

---

## MongoDB Indexes

The models have these performance indexes pre-configured:

- `users.location` — **2dsphere** index (enables $near geospatial queries)
- `users.email` — unique index
- `crossings.users` — unique compound index (one doc per pair)
- `likes.from + likes.to` — unique compound index
- `messages.match + messages.createdAt` — for paginated chat queries

---

## Connecting the Mobile App

Update the mobile app's service files to point to this backend instead of Firebase:

```ts
// In your React Native app, set the base URL:
const API_BASE_URL = 'http://YOUR_LOCAL_IP:5000/api';
// e.g. http://192.168.1.5:5000/api  (use your machine's local IP, not localhost)
```

Use `EXPO_PUBLIC_API_URL` in your `.env` file.
