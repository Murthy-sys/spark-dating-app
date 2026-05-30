import { Response, NextFunction } from 'express';
import Like from '../models/Like';
import Match from '../models/Match';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { getIO } from '../socket';
import {
  AUTO_UNMATCH_MS,
  ENGAGE_GHOSTED,
} from '../constants/limits';

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

    // Likes are unlimited for all users — premium subscription unlocks
    // "see who liked me" and stars instead of capping likes.

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

    res.json({
      success: true,
      isMatch,
      matchId: match?._id,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Daily-Status Endpoint ────────────────────────────────────────────────────
// Kept for backward compatibility with older clients. Likes are now unlimited;
// we report a sentinel `unlimited: true` instead of a counter.

export async function getDailyStatus(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json({
      success:   true,
      unlimited: true,
      used:      0,
      limit:     null,
      remaining: null,
      resetAt:   null,
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
