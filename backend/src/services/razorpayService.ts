/**
 * Razorpay client + wrappers for plan/subscription operations.
 *
 * All currency amounts are in paise on the Razorpay side. We expose helpers
 * that take paise so callers don't have to remember the unit.
 */

import crypto from 'crypto';
import Razorpay from 'razorpay';
import { PLANS, PlanTier } from '../constants/plans';

let cached: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (cached) return cached;
  const key_id     = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret || key_id.includes('xxx')) {
    throw new Error(
      'Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env'
    );
  }
  cached = new Razorpay({ key_id, key_secret });
  return cached;
}

/**
 * Create a Razorpay plan via API. Used by the admin/seed-plans endpoint to
 * provision the two age-tier plans without having to click in the dashboard.
 *
 * Returns { id } where id is the plan_id to store in env.
 */
export async function createPlan(tier: PlanTier): Promise<{ id: string }> {
  const cfg = PLANS[tier];
  const rzp = getRazorpay();
  const plan = await rzp.plans.create({
    period:   cfg.period,
    interval: cfg.interval,
    item: {
      name:        cfg.label,
      amount:      cfg.amountPaise,
      currency:    cfg.currency,
      description: `${cfg.label} — ₹${cfg.amountRupees}/month`,
    },
    notes: { tier },
  });
  return { id: plan.id };
}

/**
 * Create a recurring subscription. We use total_count = 120 (10 years monthly)
 * as a Razorpay-mandated finite cap. User-driven cancel takes precedence long
 * before that. customer_notify=1 lets Razorpay email/SMS the user payment
 * reminders.
 */
export async function createSubscription(opts: {
  planId:    string;
  userId:    string;
  notes?:    Record<string, string>;
}) {
  const rzp = getRazorpay();
  const sub = await rzp.subscriptions.create({
    plan_id:         opts.planId,
    total_count:     120,
    customer_notify: 1,
    notes: {
      userId: opts.userId,
      ...(opts.notes ?? {}),
    },
  });
  return sub;
}

export async function fetchSubscription(subscriptionId: string) {
  return getRazorpay().subscriptions.fetch(subscriptionId);
}

/**
 * Cancel autopay. cancelAtCycleEnd=true keeps access until currentEnd, then
 * the subscription transitions to 'cancelled'. false cancels immediately and
 * revokes access on the next webhook tick.
 */
export async function cancelSubscription(subscriptionId: string, cancelAtCycleEnd = true) {
  return getRazorpay().subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
}

/**
 * Verify a Razorpay webhook signature. Razorpay signs the raw request body
 * with the configured webhook secret using HMAC-SHA256. We MUST use the raw
 * bytes — JSON.stringify(req.body) won't byte-match.
 */
export function verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[razorpay] RAZORPAY_WEBHOOK_SECRET not set — rejecting webhook');
    return false;
  }
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  // Use timingSafeEqual to defeat timing attacks
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Verify a payment signature returned by the Checkout SDK after the user
 * authorizes recurring payments. Used in the client → server confirm step.
 */
export function verifyPaymentSignature(opts: {
  razorpayPaymentId:      string;
  razorpaySubscriptionId: string;
  razorpaySignature:      string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const payload = `${opts.razorpayPaymentId}|${opts.razorpaySubscriptionId}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(opts.razorpaySignature, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
