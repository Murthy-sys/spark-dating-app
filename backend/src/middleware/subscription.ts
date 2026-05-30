import { Response, NextFunction } from 'express';
import Subscription from '../models/Subscription';
import { ACTIVE_SUB_STATUSES } from '../constants/plans';
import { AuthRequest } from './auth';

/**
 * Returns true if the user has a current paid subscription that grants
 * premium feature access. Reads only the cheapest projection to keep the
 * hot path on every premium endpoint fast.
 */
export async function hasActiveSubscription(userId: any): Promise<boolean> {
  const sub = await Subscription.findOne({
    user:   userId,
    status: { $in: ACTIVE_SUB_STATUSES as unknown as string[] },
  })
    .select('_id status currentEnd')
    .lean();

  if (!sub) return false;

  // If currentEnd is in the past, the autopay didn't renew — treat as expired.
  // Webhook will eventually flip the status, but until then we don't grant access.
  if (sub.currentEnd && sub.currentEnd.getTime() < Date.now()) return false;

  return true;
}

/**
 * Express middleware: gates a route behind an active subscription.
 * Returns 402 Payment Required with code SUBSCRIPTION_REQUIRED so the
 * client can show its paywall sheet.
 */
export async function requireActiveSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }
    const ok = await hasActiveSubscription(userId);
    if (!ok) {
      res.status(402).json({
        success: false,
        code:    'SUBSCRIPTION_REQUIRED',
        message: 'A Spark Premium subscription is required to use this feature.',
      });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
