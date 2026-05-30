/**
 * wipe-subs.ts
 *
 * Deletes all subscription records from the local DB so every user reverts
 * to "not subscribed" for testing. Does NOT cancel anything on Razorpay's
 * side — but since most stale Razorpay subscriptions are in 'created' state,
 * they expire automatically and won't conflict with new test runs.
 *
 * Usage:
 *   npm run wipe-subs
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Subscription from './src/models/Subscription';

async function main() {
  await mongoose.connect(process.env.MONGO_URI!);
  const before = await Subscription.countDocuments();
  const result = await Subscription.deleteMany({});
  console.log(`🗑  Deleted ${result.deletedCount}/${before} subscription record(s).`);
  console.log('All users are now "not subscribed".');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
