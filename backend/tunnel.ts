/**
 * tunnel.ts
 *
 * Starts the backend dev server AND opens a public tunnel (via localtunnel)
 * so a physical device can reach the API over any network — not just LAN.
 *
 * The tunnel uses a FIXED subdomain ("spark-backend") so the URL is always:
 *   https://spark-backend.loca.lt
 *
 * This means you only set the .env ONCE and it works every time.
 *
 * Usage:
 *   cd backend && npm run dev:tunnel
 */

/**
 * tunnel.ts
 *
 * Starts the backend dev server AND opens a public tunnel (via localtunnel)
 * so a physical device can reach the API over any network — not just LAN.
 *
 * KEY FIX: we await `serverReady` before opening the tunnel so localtunnel
 * never forwards requests to a port that isn't listening yet (race condition
 * that caused 503 errors on registration).
 *
 * Usage:
 *   cd backend && npm run dev:tunnel
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import localtunnel from 'localtunnel';

// Import the server and wait for it to be fully ready before opening the tunnel.
import { serverReady } from './src/server';

// Must match server.ts default exactly
const PORT = Number(process.env.PORT) || 5001;
const SUBDOMAIN = process.env.TUNNEL_SUBDOMAIN || 'spark-backend';

const FRONTEND_ENV_PATH = path.join(__dirname, '..', '.env');

async function startTunnel() {
  // ── Wait for the HTTP server + MongoDB to be fully ready ──────────────────
  // Without this await, localtunnel opens before server.listen() fires, so
  // every request hits an empty port and loca.lt returns 503.
  console.log('⏳  Waiting for backend server to be ready...');
  await serverReady;
  console.log('✅  Backend server is ready. Opening public tunnel...');

  let tunnel: Awaited<ReturnType<typeof localtunnel>>;
  try {
    tunnel = await localtunnel({ port: PORT, subdomain: SUBDOMAIN });
  } catch (err) {
    console.error('❌  localtunnel failed to open:', err);
    console.error('    Retrying in 5 seconds...');
    setTimeout(startTunnel, 5_000);
    return;
  }

  // Auto-write the frontend .env so the URL is always current
  const envContent = [
    `EXPO_PUBLIC_API_URL=${tunnel.url}/api`,
    `EXPO_PUBLIC_SOCKET_URL=${tunnel.url}`,
    '',
  ].join('\n');
  fs.writeFileSync(FRONTEND_ENV_PATH, envContent);

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Backend tunnel is live!');
  console.log(`  Public URL : ${tunnel.url}`);
  console.log(`  Local port : ${PORT}`);
  console.log('');
  console.log('  Frontend .env updated:');
  console.log(`    EXPO_PUBLIC_API_URL=${tunnel.url}/api`);
  console.log(`    EXPO_PUBLIC_SOCKET_URL=${tunnel.url}`);
  console.log('');
  console.log('  Now run:  npx expo start --tunnel');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // Defensive reconnect — guard against double-restart.
  // localtunnel can fire 'error' AND 'close' for the same drop, and there are
  // also silent-zombie cases (Wi-Fi change, laptop sleep) where the local
  // client thinks it's connected but loca.lt is returning 503. We restart on
  // error too, and self-probe every 60s — if our own /health returns non-2xx
  // through the tunnel we tear down and reopen.
  let restarted = false;
  const restartOnce = (reason: string) => {
    if (restarted) return;
    restarted = true;
    console.log(`⚡  Tunnel ${reason} — reopening...`);
    try { tunnel.close(); } catch {}
    setTimeout(startTunnel, 1_000);
  };

  tunnel.on('close', () => restartOnce('closed'));
  tunnel.on('error', (err: Error) => {
    console.error('Tunnel error:', err.message);
    restartOnce('errored');
  });

  // Periodic health probe — catches silent zombies that don't fire 'error'/'close'
  const probe = setInterval(async () => {
    try {
      const res = await fetch(`${tunnel.url}/health`, {
        headers: { 'bypass-tunnel-reminder': 'true' },
      });
      if (!res.ok) {
        clearInterval(probe);
        restartOnce(`probe got ${res.status}`);
      }
    } catch (err: any) {
      clearInterval(probe);
      restartOnce(`probe failed: ${err.message}`);
    }
  }, 60_000);
}

startTunnel();
