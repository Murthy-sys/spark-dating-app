/**
 * Subscription plan configuration.
 *
 * Razorpay plans must be created in the dashboard (or via the seed-plans
 * admin endpoint) — the plan_id then goes into env. We map a user's age to
 * a tier and resolve the tier to a plan_id at runtime.
 */

export type PlanTier = 'tier1' | 'tier2';

export interface PlanConfig {
  tier:        PlanTier;
  label:       string;
  amountPaise: number;          // amount in paise (₹1 = 100 paise)
  amountRupees: number;
  ageMin:      number;
  ageMax:      number;          // inclusive; 999 = no upper bound
  currency:    'INR';
  period:      'monthly';
  interval:    1;
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  tier1: {
    tier:         'tier1',
    label:        'Spark Premium (18-25)',
    amountPaise:  49900,
    amountRupees: 499,
    ageMin:       18,
    ageMax:       25,
    currency:     'INR',
    period:       'monthly',
    interval:     1,
  },
  tier2: {
    tier:         'tier2',
    label:        'Spark Premium (26+)',
    amountPaise:  69900,
    amountRupees: 699,
    ageMin:       26,
    ageMax:       999,
    currency:     'INR',
    period:       'monthly',
    interval:     1,
  },
};

export function tierForAge(age: number): PlanTier {
  if (age <= PLANS.tier1.ageMax) return 'tier1';
  return 'tier2';
}

/**
 * Resolves the Razorpay plan_id for a given tier from env.
 * Throws if not configured — callers should fail loudly in dev.
 */
export function planIdForTier(tier: PlanTier): string {
  const id = tier === 'tier1'
    ? process.env.RAZORPAY_PLAN_ID_TIER1
    : process.env.RAZORPAY_PLAN_ID_TIER2;
  if (!id || id.startsWith('plan_xxx')) {
    throw new Error(
      `Razorpay plan id not configured for ${tier}. ` +
      `Set RAZORPAY_PLAN_ID_${tier === 'tier1' ? 'TIER1' : 'TIER2'} in backend/.env`
    );
  }
  return id;
}

// Statuses that grant premium access right now.
// 'authenticated' is included because the subscription has been authorized
// and the first charge will land on the schedule date — Razorpay's flow.
export const ACTIVE_SUB_STATUSES = ['active', 'authenticated'] as const;
