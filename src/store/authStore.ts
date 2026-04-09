/**
 * authStore.ts
 *
 * Global auth + current-user state via Zustand.
 * Talks to the Node.js/MongoDB backend via apiClient (JWT-based).
 *
 * All user identity uses `_id` (MongoDB ObjectId string).
 * The `uid` alias has been removed from UserProfile — use `profile._id` everywhere.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, persistAuth, clearAuth } from '../services/apiClient';
import { UserProfile } from '../types';

/** Converts raw Axios errors into a human-readable string. */
function parseApiError(err: any): string {
  if (err.response?.data?.message) return err.response.data.message;
  if (err.response?.status === 408) {
    return 'Request timed out — the server took too long to respond. Check that the backend is running and retry.';
  }
  if (err.code === 'ECONNREFUSED' || err.message === 'Network Error') {
    return 'Cannot reach the server. Make sure the backend is running and your EXPO_PUBLIC_API_URL is correct.';
  }
  if (err.code === 'ECONNABORTED') return 'Request timed out. Check your network connection.';
  return err.message || 'Something went wrong. Please try again.';
}

interface AuthState {
  token:     string | null;
  profile:   UserProfile | null;
  isLoading: boolean;
  error:     string | null;

  initialize: () => Promise<void>;
  register:   (email: string, password: string, displayName: string, dateOfBirth: string) => Promise<void>;
  login:      (email: string, password: string) => Promise<void>;
  logout:     () => Promise<void>;
  setProfile: (profile: UserProfile) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token:     null,
  profile:   null,
  isLoading: true,
  error:     null,

  // ─── Restore session from AsyncStorage ────────────────────────────────────
  initialize: async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) { set({ isLoading: false }); return; }

      const { data } = await apiClient.get('/auth/me');
      set({ token, profile: data.user, isLoading: false });
    } catch {
      await clearAuth();
      set({ token: null, profile: null, isLoading: false });
    }
  },

  // ─── Register ─────────────────────────────────────────────────────────────
  register: async (email, password, displayName, dateOfBirth) => {
    try {
      set({ isLoading: true, error: null });
      const { data } = await apiClient.post('/auth/register', {
        email, password, displayName, dateOfBirth,
        age: 18, gender: 'other',   // completed properly in onboarding
      });
      await persistAuth(data.token, data.user._id);
      set({ token: data.token, profile: data.user, isLoading: false });
    } catch (err: any) {
      const msg = parseApiError(err);
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  // ─── Login ─────────────────────────────────────────────────────────────────
  login: async (email, password) => {
    try {
      set({ isLoading: true, error: null });
      const { data } = await apiClient.post('/auth/login', { email, password });
      await persistAuth(data.token, data.user._id);
      set({ token: data.token, profile: data.user, isLoading: false });
    } catch (err: any) {
      const msg = parseApiError(err);
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  // ─── Logout ────────────────────────────────────────────────────────────────
  logout: async () => {
    await clearAuth();
    set({ token: null, profile: null });
  },

  setProfile: (profile) => set({ profile }),
  clearError: ()        => set({ error: null }),
}));
