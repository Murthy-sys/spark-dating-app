/**
 * seed-plans.ts
 *
 * One-shot script to provision the two Spark Premium subscription plans in
 * Razorpay (tier1 = ₹499/mo, tier2 = ₹699/mo) and print the IDs to copy into
 * backend/.env as RAZORPAY_PLAN_ID_TIER1 / TIER2.
 *
 * Usage:
 *   npm run seed-plans
 *
 * Idempotency: Razorpay does NOT dedupe plans by name. Running this twice
 * creates two more plans. Run only when you need fresh IDs.
 */

import 'dotenv/config';
import { createPlan } from './src/services/razorpayService';
import { PLANS } from './src/constants/plans';

async function main() {
  console.log('\n🌱 Seeding Razorpay plans...\n');

  for (const tier of ['tier1', 'tier2'] as const) {
    const cfg = PLANS[tier];
    process.stdout.write(`  ${tier} (${cfg.label}, ₹${cfg.amountRupees}/mo) … `);
    try {
      const { id } = await createPlan(tier);
      console.log(`✅ ${id}`);
      console.log(`     → set RAZORPAY_PLAN_ID_${tier.toUpperCase()}=${id} in backend/.env`);
    } catch (err: any) {
      console.log('❌');
      console.error(`     ${err?.error?.description ?? err?.message ?? err}`);
      process.exit(1);
    }
  }

  console.log('\nDone. Paste the two RAZORPAY_PLAN_ID_TIER* values into backend/.env, then restart the backend.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
