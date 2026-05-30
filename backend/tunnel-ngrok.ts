/**
 * tunnel-ngrok.ts
 *
 * Same role as tunnel.ts (open a public URL for the backend) but uses the
 * system ngrok CLI binary rather than the buggy `ngrok` npm v5 beta package.
 *
 * Usage:
 *   cd backend && npm run dev:tunnel:ngrok
 *
 * Prereqs:
 *   - ngrok CLI installed (https://ngrok.com/download)
 *   - `ngrok config add-authtoken <token>` already run once
 *
 * The script spawns `ngrok http 5001` and queries ngrok's local API
 * (http://127.0.0.1:4040/api/tunnels) to discover the public URL.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';

import { serverReady } from './src/server';

const PORT              = Number(process.env.PORT) || 5001;
const NGROK_API_PORT    = 4040;
const FRONTEND_ENV_PATH = path.join(__dirname, '..', '.env');
const NGROK_DOMAIN      = process.env.NGROK_DOMAIN;   // optional reserved domain

let agent: ChildProcess | null = null;

// ─── Poll ngrok's local API until the public URL is ready ────────────────────
function fetchPublicUrl(timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  const tryOnce = (): Promise<string> => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: NGROK_API_PORT, path: '/api/tunnels' }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(body) as { tunnels: { public_url: string; proto: string }[] };
          const https = json.tunnels.find((t) => t.public_url.startsWith('https'));
          if (https) resolve(https.public_url);
          else reject(new Error('no https tunnel yet'));
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });

  return new Promise((resolve, reject) => {
    const attempt = () => {
      tryOnce()
        .then(resolve)
        .catch(() => {
          if (Date.now() > deadline) reject(new Error('Timed out waiting for ngrok URL'));
          else setTimeout(attempt, 500);
        });
    };
    attempt();
  });
}

async function start() {
  console.log('⏳  Waiting for backend to be ready...');
  await serverReady;
  console.log('✅  Backend ready. Spawning ngrok CLI...\n');

  // Build the ngrok args. `--log=stdout` prints structured logs we relay.
  const args = ['http', String(PORT), '--log=stdout'];
  if (NGROK_DOMAIN) args.push(`--domain=${NGROK_DOMAIN}`);

  agent = spawn('ngrok', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  agent.stdout?.on('data', (chunk) => {
    // Echo ngrok's structured logs (with "msg" field) line-by-line
    const text = chunk.toString();
    text.split('\n').forEach((line: string) => {
      if (line.trim()) console.log(`[ngrok] ${line}`);
    });
  });
  agent.stderr?.on('data', (chunk) => process.stderr.write(`[ngrok-err] ${chunk}`));

  agent.on('exit', (code) => {
    console.error(`⚠️   ngrok process exited with code ${code}`);
    process.exit(code ?? 1);
  });

  // Wait for the public URL to be advertised on the local API
  let url: string;
  try {
    url = await fetchPublicUrl();
  } catch (err: any) {
    console.error('❌  Could not read ngrok public URL:', err.message);
    agent?.kill();
    process.exit(1);
  }

  // Auto-update the frontend .env so Expo picks up the new URL
  fs.writeFileSync(
    FRONTEND_ENV_PATH,
    [
      `EXPO_PUBLIC_API_URL=${url}/api`,
      `EXPO_PUBLIC_SOCKET_URL=${url}`,
      '',
    ].join('\n'),
  );

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ngrok tunnel is live!');
  console.log(`  Public URL : ${url}`);
  console.log(`  Local port : ${PORT}`);
  console.log('');
  console.log('  Razorpay webhook URL — paste this into Razorpay Dashboard:');
  console.log(`    ${url}/api/subscriptions/webhook`);
  console.log('');
  console.log('  Frontend .env updated:');
  console.log(`    EXPO_PUBLIC_API_URL=${url}/api`);
  console.log(`    EXPO_PUBLIC_SOCKET_URL=${url}`);
  console.log('');
  console.log('  Now run:  npx expo start --lan');
  console.log('═══════════════════════════════════════════════════════\n');

  const shutdown = () => {
    console.log('\n⏏  Closing ngrok tunnel...');
    if (agent && !agent.killed) agent.kill('SIGINT');
    process.exit(0);
  };
  process.on('SIGINT',  shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Fatal:', err);
  if (agent && !agent.killed) agent.kill('SIGKILL');
  process.exit(1);
});
