import { Response, NextFunction } from 'express';
import Like from '../models/Like';
import Match from '../models/Match';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { getIO } from '../socket';
import {
  DAILY_LIKE_LIMIT,
  AUTO_UNMATCH_MS,
  ENGAGE_GHOSTED,
  nextMidnight,
} from '../constants/limits';

// ─── Daily-like accounting ────────────────────────────────────────────────────

/**
 * Returns the user's current daily-like state, resetting the counter when the
 * window has rolled over. Persists the reset so the next read is cheap.
 */
async function consumeDailyState(userId: any) {
  const me = await User.findById(userId).select(
    'dailyLikesUsed dailyLikesResetAt'
  );
  if (!me) throw new Error('User not found');

  const now = new Date();
  if (!me.dailyLikesResetAt || me.dailyLikesResetAt <= now) {
    me.dailyLikesUsed    = 0;
    me.dailyLikesResetAt = nextMidnight(now);
    await me.save({ validateBeforeSave: false });
  }
  return me;
}

// ─── Auto-unmatch sweep (lazy, runs on getMatches) ────────────────────────────

/**
 * Marks matches inactive when their autoUnmatchAt has passed without any
 * activity. Pure side-effect; safe to call repeatedly.
 *
 * Why lazy instead of cron: keeps Phase-1 dependency-free. Once a real
 * scheduler is in place, this can move to a periodic job.
 */
async function sweepAutoUnmatched(myId: any) {
  const now = new Date();
  const stale = await Match.find({
    users: myId,
    isActive: true,
    autoUnmatchAt: { $ne: null, $lte: now },
  }).select('users lastSenderId');

  if (stale.length === 0) return;

  await Match.updateMany(
    { _id: { $in: stale.map((m) => m._id) } },
    { $set: { isActive: false, closedReason: 'auto_unmatched' } }
  );

  // Penalize the ghoster — the user who sent the last message is the one
  // *waiting*, so the OTHER user ghosted. If no message was ever sent, both
  // parties share the blame (no penalty either way — handled by skipping).
  for (const m of stale) {
    if (!m.lastSenderId) continue;
    const ghosterId = m.users.find(
      (u) => u.toString() !== m.lastSenderId!.toString()
    );
    if (!ghosterId) continue;
    await User.updateOne(
      { _id: ghosterId },
      { $inc: { engagementScore: ENGAGE_GHOSTED } }
    );
    // Clamp 0–100 in a follow-up update (Mongo $inc can't clamp)
    await User.updateOne(
      { _id: ghosterId, engagementScore: { $lt: 0 } },
      { $set: { engagementScore: 0 } }
    );
  }
}

// ─── Like a User ──────────────────────────────────────────────────────────────

export async function likeUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myId    = req.user!._id;
    const toId    = req.params.userId;
    const status  = req.body.status || 'liked'; // 'liked' | 'crushed' | 'passed'

    if (myId.toString() === toId) {
      return res.status(400).json({ success: false, message: 'Cannot like yourself' });
    }

    // Daily limit only applies to positive actions, not 'passed'
    if (status === 'liked' || status === 'crushed') {
      const me = await consumeDailyState(myId);
      if (me.dailyLikesUsed >= DAILY_LIKE_LIMIT) {
        return res.status(429).json({
          success:  false,
          code:     'DAILY_LIMIT_REACHED',
          message:  `You've used all ${DAILY_LIKE_LIMIT} daily picks. Come back tomorrow!`,
          resetAt:  me.dailyLikesResetAt,
        });
      }
      // Increment FIRST so concurrent calls can't overshoot
      me.dailyLikesUsed += 1;
      await me.save({ validateBeforeSave: false });
    }

    // Upsert the like record
    await Like.findOneAndUpdate(
      { from: myId, to: toId },
      { status },
      { upsert: true, new: true }
    );

    if (status === 'passed') {
      return res.json({ success: true, isMatch: false });
    }

    // Notify the liked user via socket
    const io = getIO();
    if (io) {
      const fromUser = await User.findById(myId).select('displayName photoURL');
      io.to(`user:${toId}`).emit('new_like', {
        from: { _id: myId, displayName: fromUser?.displayName, photoURL: fromUser?.photoURL },
        status,
      });
    }

    // Check for mutual like
    const reverseLike = await Like.findOne({
      from:   toId,
      to:     myId,
      status: { $in: ['liked', 'crushed'] },
    });

    let isMatch = false;
    let match   = null;

    if (reverseLike) {
      const pair = [myId, toId].sort();
      const now  = new Date();
      match = await Match.findOneAndUpdate(
        { users: pair },
        {
          $setOnInsert: {
            users:         pair,
            matchedAt:     now,
            autoUnmatchAt: new Date(now.getTime() + AUTO_UNMATCH_MS),
          },
        },
        { upsert: true, new: true }
      );
      isMatch = true;
    }

    // Surface the updated daily state so the client can refresh its counter
    const meAfter = await User.findById(myId).select('dailyLikesUsed dailyLikesResetAt');
    res.json({
      success: true,
      isMatch,
      matchId: match?._id,
      daily: {
        used:      meAfter?.dailyLikesUsed ?? 0,
        limit:     DAILY_LIKE_LIMIT,
        remaining: Math.max(0, DAILY_LIKE_LIMIT - (meAfter?.dailyLikesUsed ?? 0)),
        resetAt:   meAfter?.dailyLikesResetAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Daily-Status Endpoint ────────────────────────────────────────────────────

export async function getDailyStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const me = await consumeDailyState(req.user!._id);
    res.json({
      success:   true,
      used:      me.dailyLikesUsed,
      limit:     DAILY_LIKE_LIMIT,
      remaining: Math.max(0, DAILY_LIKE_LIMIT - me.dailyLikesUsed),
      resetAt:   me.dailyLikesResetAt,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Get My Matches ───────────────────────────────────────────────────────────

export async function getMatches(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myId = req.user!._id;

    // Lazily close stale matches before reading
    await sweepAutoUnmatched(myId);

    const matches = await Match.find({ users: myId, isActive: true })
      .sort({ lastMessageAt: -1 })
      .populate({
        path:   'users',
        match:  { _id: { $ne: myId } },
        select: 'displayName photoURL photos bio age occupation lastSeen intent engagementScore',
      });

    res.json({ success: true, data: matches });
  } catch (err) {
    next(err);
  }
}

// ─── Get Likes Received ───────────────────────────────────────────────────────

export async function getLikesReceived(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myId = req.user!._id;

    // People who liked me but I haven't responded to yet
    const interacted = await Like.find({ from: myId }).select('to');
    const interactedIds = interacted.map((l) => l.to);

    const likes = await Like.find({
      to:     myId,
      from:   { $nin: interactedIds },
      status: { $in: ['liked', 'crushed'] },
    }).populate('from', 'displayName photoURL photos bio age occupation intent');

    res.json({ success: true, data: likes });
  } catch (err) {
    next(err);
  }
}

// ─── Unmatch ──────────────────────────────────────────────────────────────────

export async function unmatch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myId    = req.user!._id;
    const matchId = req.params.matchId;

    const match = await Match.findOne({ _id: matchId, users: myId });
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });

    match.isActive    = false;
    match.closedReason = 'unmatched';
    await match.save();

    res.json({ success: true, message: 'Unmatched' });
  } catch (err) {
    next(err);
  }
}

// ─── Star / Unstar a User ─────────────────────────────────────────────────────

export async function starUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myId   = req.user!._id;
    const toId   = req.params.userId;

    const like = await Like.findOneAndUpdate(
      { from: myId, to: toId },
      { starred: true, $setOnInsert: { status: 'liked' } },
      { upsert: true, new: true }
    );

    res.json({ success: true, starred: true });
  } catch (err) {
    next(err);
  }
}

export async function unstarUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myId   = req.user!._id;
    const toId   = req.params.userId;

    await Like.findOneAndUpdate(
      { from: myId, to: toId },
      { starred: false }
    );

    res.json({ success: true, starred: false });
  } catch (err) {
    next(err);
  }
}

// ─── Get Starred Users ────────────────────────────────────────────────────────

export async function getStarredUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myId = req.user!._id;
    const likes = await Like.find({ from: myId, starred: true })
      .populate('to', 'displayName photoURL photos bio age occupation');

    res.json({ success: true, data: likes.map((l) => l.to) });
  } catch (err) {
    next(err);
  }
}

// ─── Get Users I Liked ────────────────────────────────────────────────────────

export async function getLikedUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myId = req.user!._id;
    const likes = await Like.find({ from: myId, status: { $in: ['liked', 'crushed'] } })
      .populate('to', 'displayName photoURL photos bio age occupation');

    res.json({ success: true, data: likes.map((l) => ({ user: l.to, starred: l.starred })) });
  } catch (err) {
    next(err);
  }
}

// ─── Unlike a User ───────────────────────────────────────────────────────────

export async function unlikeUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myId   = req.user!._id;
    const toId   = req.params.userId;

    await Like.findOneAndDelete({ from: myId, to: toId });

    res.json({ success: true, message: 'Unliked' });
  } catch (err) {
    next(err);
  }
}
