/**
 * Phase-1 limits — daily picks (no-swipe UX) + anti-ghosting timers.
 * Tweak in one place; surfaced to clients via /matches/daily-status.
 */

export const DAILY_LIKE_LIMIT     = 10;
export const REPLY_TIMER_HOURS    = 24;
export const AUTO_UNMATCH_DAYS    = 7;

// Engagement score deltas
export const ENGAGE_REPLY_FAST    = 5;   // replied within REPLY_TIMER
export const ENGAGE_REPLY_LATE    = -3;  // replied after REPLY_TIMER expired
export const ENGAGE_GHOSTED       = -8;  // applied at auto-unmatch time

export const REPLY_TIMER_MS    = REPLY_TIMER_HOURS * 60 * 60 * 1000;
export const AUTO_UNMATCH_MS   = AUTO_UNMATCH_DAYS  * 24 * 60 * 60 * 1000;

/**
 * Return midnight (UTC) of the next day after `from`.
 * Used to schedule the daily-like reset.
 */
export function nextMidnight(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCHours(24, 0, 0, 0); // bumps to next day at 00:00:00.000 UTC
  return d;
}
