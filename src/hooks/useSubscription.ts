/**
 * useSubscription.ts
 *
 * Lightweight Zustand store + hook that caches the user's premium status
 * so paywall checks don't re-hit /api/subscriptions/me on every render.
 *
 * Refresh is called:
 *  - On app start (after login)
 *  - After a successful checkout
 *  - After a cancel
 */

import { create } from 'zustand';
import { getMySubscription, SubscriptionRecord } from '../services/subscriptionService';

interface SubState {
  isActive:     boolean;
  subscription: SubscriptionRecord | null;
  loading:      boolean;
  refresh:      () => Promise<void>;
  clear:        () => void;
}

export const useSubscriptionStore = create<SubState>((set) => ({
  isActive:     false,
  subscription: null,
  loading:      false,

  refresh: async () => {
    try {
      set({ loading: true });
      const r = await getMySubscription();
      set({
        isActive:     r.isActive,
        subscription: r.subscription,
        loading:      false,
      });
    } catch {
      set({ loading: false });
      // Don't clobber existing state on transient errors.
    }
  },

  clear: () => set({ isActive: false, subscription: null }),
}));

export function useSubscription() {
  const isActive     = useSubscriptionStore((s) => s.isActive);
  const subscription = useSubscriptionStore((s) => s.subscription);
  const refresh      = useSubscriptionStore((s) => s.refresh);
  return { isActive, subscription, refresh };
}
