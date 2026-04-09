import 'dotenv/config';
import http from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { connectDB } from './config/db';
import { initSocket } from './socket';
import { errorHandler, notFound } from './middleware/errorHandler';
import { verifyEmailService } from './services/emailService';

// Routes
import authRoutes     from './routes/auth';
import userRoutes     from './routes/users';
import crossingRoutes from './routes/crossings';
import matchRoutes    from './routes/matches';
import messageRoutes  from './routes/messages';

const app    = express();
const server = http.createServer(app);

// ─── Connect Database ─────────────────────────────────────────────────────────
connectDB();

// ─── Socket.io ────────────────────────────────────────────────────────────────
initSocket(server);

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true,
}));

// Global rate limiter
// Development: 1000 req/15min — generous so physical-device testing over tunnel isn't blocked
// Production:  200 req/15min
const isDev = process.env.NODE_ENV === 'development';
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      isDev ? 1000 : 200,
  message:  { success: false, message: 'Too many requests, please try again later.' },
}));

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      isDev ? 200 : 10,
  message:  { success: false, message: 'Too many login attempts, please try again later.' },
});

// ─── Request Timeout ──────────────────────────────────────────────────────────
// If any request takes longer than 25 s, send a 408 instead of hanging forever.
// (Tunnels like localtunnel have ~30 s upstream timeout — responding before that
// prevents localtunnel itself from generating its own 408 upstream.)
app.use((req, res, next) => {
  res.setTimeout(25_000, () => {
    if (!res.headersSent) {
      res.status(408).json({ success: false, message: 'Request timed out. Please try again.' });
    }
  });
  next();
});

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logging ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Static file serving (local upload fallback) ──────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',      authLimiter, authRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/crossings', crossingRoutes);
app.use('/api/matches',   matchRoutes);
app.use('/api/messages',  messageRoutes);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
// Keep TCP connections alive longer — prevents tunnel/proxy from dropping idle sockets
server.keepAliveTimeout = 65_000;   // slightly above typical proxy 60 s timeout
server.headersTimeout   = 66_000;

// Default 5001 matches tunnel.ts so they stay in sync even without a .env
const PORT = Number(process.env.PORT) || 5001;

/**
 * Resolves once the HTTP server is fully listening AND MongoDB is connected.
 * tunnel.ts awaits this before opening the public tunnel so we never forward
 * requests to a port that isn't ready yet (which causes localtunnel 503s).
 */
export const serverReady: Promise<void> = new Promise((resolve) => {
  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    // Verify SMTP on boot so issues are caught immediately, not at send-time
    await verifyEmailService();
    resolve();   // ← signal that the server is ready to handle requests
  });
});

export default app;
