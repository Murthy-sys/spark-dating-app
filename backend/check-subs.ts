import 'dotenv/config';
import mongoose from 'mongoose';
import User from './src/models/User';
import Subscription from './src/models/Subscription';

async function main() {
  await mongoose.connect(process.env.MONGO_URI!);
  // Force-register the User model (otherwise TS tree-shakes the import)
  void User;
  // Dump ALL subscriptions in DB so we can see who's subscribed regardless of email casing
  const allSubs = await Subscription.find().populate('user', 'email displayName age').sort({ createdAt: -1 }).lean();
  console.log(`Found ${allSubs.length} subscription record(s) in DB:`);
  allSubs.forEach((s: any, i: number) => {
    console.log(`  [${i}] user=${s.user?.email ?? s.user} status=${s.status} tier=${s.tier} amount=${s.amount} rzpId=${s.razorpaySubscriptionId} currentEnd=${s.currentEnd} cancelAtPeriodEnd=${s.cancelAtPeriodEnd}`);
  });
  await mongoose.disconnect();
}
main().catch((err) => { console.error(err); process.exit(1); });
