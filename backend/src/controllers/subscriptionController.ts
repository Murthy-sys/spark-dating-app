import { Request, Response, NextFunction } from 'express';
import Subscription, { ISubscription, SubscriptionStatus } from '../models/Subscription';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { hasActiveSubscription } from '../middleware/subscription';
import { PLANS, planIdForTier, tierForAge } from '../constants/plans';
import {
  cancelSubscription,
  createPlan,
  createSubscription,
  fetchSubscription,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from '../services/razorpayService';

// ─── GET /api/subscriptions/plan-for-me ───────────────────────────────────────
// Returns the plan the *current* user qualifies for (age-based).
// Frontend calls this before opening Razorpay Checkout.

export async function getMyPlan(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const me = req.user!;
    const tier = tierForAge(me.age);
    const cfg  = PLANS[tier];

    res.json({
      success: true,
      tier,
      plan: {
        label:        cfg.label,
        amountPaise:  cfg.amountPaise,
        amountRupees: cfg.amountRupees,
        currency:     cfg.currency,
        period:       cfg.period,
        interval:     cfg.interval,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/subscriptions/me ────────────────────────────────────────────────
// Frontend uses this to decide whether to show paywall vs premium features.
// Returns the most-recent subscription document, plus a derived `isActive`.

export async function getMySubscription(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myId = req.user!._id;
    const sub = await Subscription.findOne({ user: myId })
      .sort({ createdAt: -1 })
      .lean();

    const isActive = await hasActiveSubscription(myId);

    res.json({
      success: true,
      isActive,
      subscription: sub
        ? {
            _id:                  sub._id,
            razorpaySubscriptionId: sub.razorpaySubscriptionId,
            status:               sub.status,
            tier:                 sub.tier,
            amount:               sub.amount,
            currency:             sub.currency,
            currentStart:         sub.currentStart,
            currentEnd:           sub.currentEnd,
            chargeAt:             sub.chargeAt,
            cancelAtPeriodEnd:    sub.cancelAtPeriodEnd,
            cancelledAt:          sub.cancelledAt,
            paidCount:            sub.paidCount,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/subscriptions ──────────────────────────────────────────────────
// Creates a Razorpay subscription for the user (status='created') and returns
// the subscription_id + key_id so the client can launch Razorpay Checkout.

export async function createMySubscription(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const me = req.user!;
    const tier = tierForAge(me.age);
    const cfg  = PLANS[tier];

    // Refuse only if the user has a *paid* (or about-to-be-paid) subscription.
    // 'created' means Checkout was opened but never completed — those are
    // dead weight (Razorpay also expires them server-side), so we mark them
    // expired and let the user start fresh.
    const live = await Subscription.findOne({
      user:   me._id,
      status: { $in: ['authenticated', 'active', 'paused'] },
    });
    if (live) {
      return res.status(409).json({
        success: false,
        code:    'SUBSCRIPTION_EXISTS',
        message: 'You already have a subscription. Cancel it before creating a new one.',
        subscriptionId: live.razorpaySubscriptionId,
      });
    }
    await Subscription.updateMany(
      { user: me._id, status: 'created' },
      { $set: { status: 'expired', endedAt: new Date() } }
    );

    const planId = planIdForTier(tier);
    const rzpSub = await createSubscription({
      planId,
      userId: me._id.toString(),
      notes: { tier, email: me.email },
    });

    const sub = await Subscription.create({
      user:                   me._id,
      razorpaySubscriptionId: rzpSub.id,
      razorpayPlanId:         planId,
      status:                 (rzpSub.status as SubscriptionStatus) ?? 'created',
      tier,
      amount:                 cfg.amountPaise,
      currency:               cfg.currency,
      notes:                  { tier },
    });

    res.json({
      success: true,
      subscription: {
        _id:                    sub._id,
        razorpaySubscriptionId: sub.razorpaySubscriptionId,
        status:                 sub.status,
        amount:                 sub.amount,
        currency:               sub.currency,
        tier:                   sub.tier,
      },
      // Client needs key_id to launch Checkout
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/subscriptions/verify ───────────────────────────────────────────
// Called by the client right after Checkout success. We verify the payment
// signature and flip the local record to 'authenticated' optimistically —
// the webhook will reconcile authoritative state.

export async function verifySubscriptionPayment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myId = req.user!._id;
    const {
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature,
    } = req.body as {
      razorpay_payment_id?:      string;
      razorpay_subscription_id?: string;
      razorpay_signature?:       string;
    };

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing verification fields' });
    }

    const ok = verifyPaymentSignature({
      razorpayPaymentId:      razorpay_payment_id,
      razorpaySubscriptionId: razorpay_subscription_id,
      razorpaySignature:      razorpay_signature,
    });

    if (!ok) {
      return res.status(400).json({ success: false, code: 'INVALID_SIGNATURE', message: 'Signature mismatch' });
    }

    const sub = await Subscription.findOne({
      user: myId,
      razorpaySubscriptionId: razorpay_subscription_id,
    });
    if (!sub) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    // Optimistic flip — webhook will set the authoritative timestamps soon.
    if (sub.status === 'created') sub.status = 'authenticated';
    await sub.save();

    res.json({
      success: true,
      isActive: true,
      subscription: {
        _id:    sub._id,
        status: sub.status,
        tier:   sub.tier,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/subscriptions/cancel ───────────────────────────────────────────
// User-initiated cancel. Default behaviour: cancel-at-cycle-end so they keep
// access until currentEnd.

export async function cancelMySubscription(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myId = req.user!._id;
    const cancelImmediately = req.body?.immediate === true;

    const sub = await Subscription.findOne({
      user:   myId,
      status: { $in: ['authenticated', 'active', 'paused'] },
    });
    if (!sub) {
      return res.status(404).json({ success: false, message: 'No active subscription' });
    }

    await cancelSubscription(sub.razorpaySubscriptionId, !cancelImmediately);

    sub.cancelAtPeriodEnd = !cancelImmediately;
    if (cancelImmediately) {
      sub.status      = 'cancelled';
      sub.cancelledAt = new Date();
      sub.endedAt     = new Date();
    }
    await sub.save();

    res.json({
      success: true,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      status:            sub.status,
      currentEnd:        sub.currentEnd,
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/subscriptions/webhook ──────────────────────────────────────────
// Receives Razorpay webhook events and reconciles local state.
// Mounted with express.raw() so we can verify the HMAC signature.

export async function handleWebhook(req: Request, res: Response) {
  const signature = req.headers['x-razorpay-signature'] as string | undefined;
  const rawBody   = (req as any).rawBody as Buffer | string | undefined;

  if (!signature || !rawBody) {
    return res.status(400).json({ success: false, message: 'Missing signature or body' });
  }
  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ success: false, message: 'Invalid signature' });
  }

  // rawBody arrives as a Buffer (express.raw); parse it ourselves.
  let payload: any;
  try {
    payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ success: false, message: 'Bad JSON' });
  }

  const event = payload?.event as string | undefined;
  const sub   = payload?.payload?.subscription?.entity;

  if (!event || !sub?.id) {
    // Acknowledge silently — Razorpay sends events we don't subscribe to (e.g. order.*)
    return res.json({ ok: true, ignored: true });
  }

  try {
    await applyWebhookEvent(event, sub);
    res.json({ ok: true });
  } catch (err) {
    console.error('[razorpay webhook] failed to apply event', event, err);
    // 500 makes Razorpay retry; safer than a silent drop.
    res.status(500).json({ ok: false });
  }
}

// ─── Webhook reconciliation ───────────────────────────────────────────────────

async function applyWebhookEvent(event: string, rzpSub: any) {
  const local = await Subscription.findOne({ razorpaySubscriptionId: rzpSub.id });
  if (!local) {
    console.warn('[razorpay webhook] no local subscription for', rzpSub.id);
    return;
  }

  // Map Razorpay's status string straight through — values match our enum.
  if (typeof rzpSub.status === 'string') {
    local.status = rzpSub.status as SubscriptionStatus;
  }
  if (rzpSub.current_start)   local.currentStart   = new Date(rzpSub.current_start * 1000);
  if (rzpSub.current_end)     local.currentEnd     = new Date(rzpSub.current_end   * 1000);
  if (rzpSub.charge_at)       local.chargeAt       = new Date(rzpSub.charge_at     * 1000);
  if (rzpSub.start_at)        local.startAt        = new Date(rzpSub.start_at      * 1000);
  if (rzpSub.end_at)          local.endAt          = new Date(rzpSub.end_at        * 1000);
  if (rzpSub.ended_at)        local.endedAt        = new Date(rzpSub.ended_at      * 1000);
  if (typeof rzpSub.paid_count === 'number')      local.paidCount      = rzpSub.paid_count;
  if (typeof rzpSub.remaining_count === 'number') local.remainingCount = rzpSub.remaining_count;
  if (rzpSub.customer_id)     local.razorpayCustomerId = rzpSub.customer_id;

  switch (event) {
    case 'subscription.cancelled':
      local.cancelledAt = new Date();
      break;
    case 'subscription.completed':
      local.endedAt = local.endedAt ?? new Date();
      break;
    case 'subscription.charged':
      // paid_count already updated above; nothing extra needed.
      break;
  }

  await local.save();
}

// ─── Admin: seed plans ───────────────────────────────────────────────────────
// One-shot helper to create the two plans in Razorpay and print the IDs.
// Gate this in production — for now it only runs when SEED_TOKEN matches.

export async function seedPlans(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers['x-seed-token'];
    if (!process.env.SEED_TOKEN || token !== process.env.SEED_TOKEN) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const tier1 = await createPlan('tier1');
    const tier2 = await createPlan('tier2');

    res.json({
      success: true,
      message: 'Plans created. Copy the IDs into backend/.env as RAZORPAY_PLAN_ID_TIER1 / TIER2.',
      tier1,
      tier2,
    });
  } catch (err) {
    next(err);
  }
}
