import { IUser } from '../models/User';

/**
 * Composite trust score (0–100). Recompute whenever a contributing field
 * changes — caller is responsible for persisting the new value.
 *
 * Weights chosen so video verification is the single biggest lever (40),
 * but a fully-completed profile + healthy engagement score also adds up.
 *
 *   Verified                    +40
 *   ≥3 photos uploaded          +20
 *   Bio + occupation + hobbies  +15
 *   SOS contacts saved          +10  (signals engaged-with-safety user)
 *   engagementScore / 10        +10  (max — hard cap)
 *   Account ≥7 days old         + 5
 *
 * Rejected verification subtracts 20 to make impersonation costly.
 */
export function computeTrustScore(u: IUser): number {
  let score = 0;

  if (u.verification?.status === 'verified') score += 40;
  if (u.verification?.status === 'rejected') score -= 20;

  if ((u.photos?.length ?? 0) >= 3) score += 20;

  const bioOk    = !!u.bio?.trim();
  const occOk    = !!u.occupation?.trim();
  const hobbyOk  = (u.hobbies?.length ?? 0) > 0;
  if (bioOk && occOk && hobbyOk) score += 15;

  if ((u.sosContacts?.length ?? 0) > 0) score += 10;

  score += Math.min(10, Math.floor((u.engagementScore ?? 0) / 10));

  if (u.createdAt) {
    const ageDays = (Date.now() - new Date(u.createdAt).getTime()) / 86_400_000;
    if (ageDays >= 7) score += 5;
  }

  return Math.max(0, Math.min(100, score));
}
