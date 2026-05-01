/**
 * apiClient.ts
 *
 * Central Axios instance that:
 *  - Points to the Node.js backend
 *  - Auto-detects the Mac's IP from Expo's Metro bundler (works on any WiFi)
 *  - Works reliably with `npx expo start --tunnel` on physical devices
 *  - Falls back to EXPO_PUBLIC_API_URL when deploying to a real server
 *  - Automatically attaches the JWT token to every request
 *  - Retries failed requests with exponential backoff for network resilience
 *  - Handles 401 responses by clearing auth state
 */

import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const BACKEND_PORT = 5001;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Extracts just the host/IP from Expo's Metro bundler URI.
 * e.g. "192.168.1.9:8081" → "192.168.1.9"
 *
 * In tunnel mode the hostUri looks like "tunnel-subdomain.expo.direct:443"
 * — that hostname is NOT the backend, so we detect and skip it.
 */
function getMetroHost(): string | undefined {
  try {
    const expoConfig = (Constants as any).expoConfig as { hostUri?: string } | null;
    const manifest   = Constants.manifest as { debuggerHost?: string } | null;

    const hostUri = expoConfig?.hostUri || manifest?.debuggerHost;
    if (typeof hostUri !== 'string') return undefined;

    const host = hostUri.split(':')[0];
    if (!host) return undefined;

    // In tunnel mode the host is an expo/ngrok domain, not a LAN IP.
    // We can't reach the backend on that domain, so return undefined
    // and let the caller fall back to EXPO_PUBLIC_API_URL or the
    // backend tunnel URL.
    const isIPAddress = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);

    if (!isIPAddress) {
      console.warn(
        `[apiClient] Tunnel/non-LAN host detected (host=${host}). ` +
        'Using EXPO_PUBLIC_API_URL from .env to reach backend. ' +
        'Start backend tunnel with: cd backend && npm run dev:tunnel',
      );
      return undefined;
    }

    return host;
  } catch (e) {
    console.warn('[apiClient] Failed to read Metro host:', e);
    return undefined;
  }
}

function getBaseUrl(): string {
  // 1. Explicit override (for deployed servers / tunnel mode)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Web browser — use current window host
  if (Platform.OS === 'web') {
    return `${window.location.protocol}//${window.location.hostname}:${BACKEND_PORT}/api`;
  }

  // 3. Auto-detect host from Expo Metro bundler (physical device + emulator on LAN)
  const host = getMetroHost();
  if (!host) {
    console.error(
      '[apiClient] ⚠️  Could not detect backend host! ' +
      'Set EXPO_PUBLIC_API_URL in .env or start the backend tunnel. ' +
      'Falling back to 10.0.2.2 (Android emulator) — this WILL fail on physical devices.',
    );
    // 10.0.2.2 is the Android emulator's alias for host machine localhost.
    // For physical devices this will still fail, but it's better than 'localhost'.
    const fallback = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
    return `http://${fallback}:${BACKEND_PORT}/api`;
  }
  return `http://${host}:${BACKEND_PORT}/api`;
}

function getSocketUrl(): string {
  if (process.env.EXPO_PUBLIC_SOCKET_URL) {
    return process.env.EXPO_PUBLIC_SOCKET_URL;
  }
  if (Platform.OS === 'web') {
    return `${window.location.protocol}//${window.location.hostname}:${BACKEND_PORT}`;
  }
  const host = getMetroHost();
  if (!host) {
    const fallback = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
    return `http://${fallback}:${BACKEND_PORT}`;
  }
  return `http://${host}:${BACKEND_PORT}`;
}

export const BASE_URL  = getBaseUrl();
export const SOCKET_URL = getSocketUrl();

console.log('[apiClient] BASE_URL =', BASE_URL);
console.log('[apiClient] SOCKET_URL =', SOCKET_URL);

// ── localtunnel bypass ──────────────────────────────────────────────────────
// loca.lt shows a "friendly reminder" verification page for unknown clients.
// Without this header every API call through a loca.lt tunnel gets intercepted
// and returns either an HTML page or a 408.  Setting the header tells localtunnel
// to skip the verification gate and forward the request directly.
const extraHeaders: Record<string, string> = {};
if (BASE_URL.includes('loca.lt') || SOCKET_URL.includes('loca.lt')) {
  extraHeaders['bypass-tunnel-reminder'] = 'true';
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,  // 30 s — tunnels add latency
  headers: { 'Content-Type': 'application/json', ...extraHeaders },
});

// ─── Retry helper ─────────────────────────────────────────────────────────────

// Multipart upload paths — we never retry these. A failed 10 MB upload would
// re-send the whole file 3× on cellular, which is cruel and slow.
const NO_RETRY_PATHS = ['/safety/verification', '/photos', '/image'];

function isRetryable(error: AxiosError): boolean {
  const url = error.config?.url ?? '';
  if (NO_RETRY_PATHS.some((p) => url.includes(p))) return false;
  if (!error.response) return true; // network error / timeout
  const status = error.response.status;
  // 408 = Request Timeout (localtunnel or proxy timed out) — safe to retry
  return status === 408 || status === 429 || status >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Request Interceptor — attach JWT ─────────────────────────────────────────
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Track retry count on the config object
    (config as any).__retryCount = (config as any).__retryCount ?? 0;
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor — retry + handle 401 ──────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as any;

    // Retry on network errors, 429, or 5xx
    if (config && isRetryable(error) && config.__retryCount < MAX_RETRIES) {
      config.__retryCount += 1;
      const backoff = INITIAL_RETRY_DELAY * Math.pow(2, config.__retryCount - 1);
      console.warn(
        `[apiClient] Retry ${config.__retryCount}/${MAX_RETRIES} after ${backoff}ms — ` +
        `${error.message} (${config.url})`,
      );
      await delay(backoff);
      return apiClient.request(config);
    }

    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['authToken', 'currentUserId']);
    }
    return Promise.reject(error);
  }
);

/** Convenience: save token and user ID after login/register */
export async function persistAuth(token: string, userId: string) {
  await AsyncStorage.multiSet([
    ['authToken',     token],
    ['currentUserId', userId],
  ]);
}

/** Convenience: clear auth storage on logout */
export async function clearAuth() {
  await AsyncStorage.multiRemove(['authToken', 'currentUserId']);
}
