/**
 * subscriptionService.ts
 *
 * Talks to /api/subscriptions on the backend. Handles:
 *  - Fetching the plan the current user qualifies for (age-based)
 *  - Creating a Razorpay subscription
 *  - Verifying payment after Checkout success
 *  - Cancelling autopay
 *  - Reading current subscription status
 */

import { apiClient } from './apiClient';

export type SubscriptionStatus =
  | 'created'
  | 'authenticated'
  | 'active'
  | 'paused'
  | 'halted'
  | 'cancelled'
  | 'completed'
  | 'expired';

export type PlanTier = 'tier1' | 'tier2';

export interface PlanInfo {
  label:        string;
  amountPaise:  number;
  amountRupees: number;
  currency:     'INR';
  period:       'monthly';
  interval:     1;
}

export interface SubscriptionRecord {
  _id:                    string;
  razorpaySubscriptionId: string;
  status:                 SubscriptionStatus;
  tier:                   PlanTier;
  amount:                 number;
  currency:               string;
  currentStart?:          string | null;
  currentEnd?:            string | null;
  chargeAt?:              string | null;
  cancelAtPeriodEnd:      boolean;
  cancelledAt?:           string | null;
  paidCount:              number;
}

export interface MyPlanResponse {
  tier: PlanTier;
  plan: PlanInfo;
}

export interface MySubscriptionResponse {
  isActive:     boolean;
  subscription: SubscriptionRecord | null;
}

export interface CreateSubscriptionResponse {
  subscription: {
    _id:                    string;
    razorpaySubscriptionId: string;
    status:                 SubscriptionStatus;
    amount:                 number;
    currency:               string;
    tier:                   PlanTier;
  };
  keyId: string;
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function getMyPlan(): Promise<MyPlanResponse> {
  const { data } = await apiClient.get('/subscriptions/plan-for-me');
  return { tier: data.tier, plan: data.plan };
}

export async function getMySubscription(): Promise<MySubscriptionResponse> {
  const { data } = await apiClient.get('/subscriptions/me');
  return { isActive: data.isActive, subscription: data.subscription };
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

export async function createSubscription(): Promise<CreateSubscriptionResponse> {
  const { data } = await apiClient.post('/subscriptions');
  return { subscription: data.subscription, keyId: data.keyId };
}

export async function verifySubscriptionPayment(opts: {
  razorpay_payment_id:      string;
  razorpay_subscription_id: string;
  razorpay_signature:       string;
}): Promise<{ isActive: boolean; status: SubscriptionStatus }> {
  const { data } = await apiClient.post('/subscriptions/verify', opts);
  return { isActive: data.isActive, status: data.subscription.status };
}

/**
 * Cancel autopay. Default keeps access until the current period ends; pass
 * `immediate: true` to revoke access right away.
 */
export async function cancelSubscription(immediate = false): Promise<{
  cancelAtPeriodEnd: boolean;
  status:            SubscriptionStatus;
  currentEnd?:       string | null;
}> {
  const { data } = await apiClient.post('/subscriptions/cancel', { immediate });
  return {
    cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    status:            data.status,
    currentEnd:        data.currentEnd,
  };
}
