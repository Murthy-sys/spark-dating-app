import { Response, NextFunction } from 'express';
import Like from '../models/Like';
import Match from '../models/Match';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { getIO } from '../socket';

// ─── Like a User ──────────────────────────────────────────────────────────────

export async function likeUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myId    = req.user!._id;
    const toId    = req.params.userId;
    const status  = req.body.status || 'liked'; // 'liked' | 'crushed' | 'passed'

    if (myId.toString() === toId) {
      return res.status(400).json({ success: false, message: 'Cannot like yourself' });
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
      match = await Match.findOneAndUpdate(
        { users: pair },
        { $setOnInsert: { users: pair, matchedAt: new Date() } },
        { upsert: true, new: true }
      );
      isMatch = true;
    }

    res.json({ success: true, isMatch, matchId: match?._id });
  } catch (err) {
    next(err);
  }
}

// ─── Get My Matches ───────────────────────────────────────────────────────────

export async function getMatches(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myId = req.user!._id;

    const matches = await Match.find({ users: myId, isActive: true })
      .sort({ lastMessageAt: -1 })
      .populate({
        path:   'users',
        match:  { _id: { $ne: myId } },
        select: 'displayName photoURL photos bio age occupation lastSeen',
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
    }).populate('from', 'displayName photoURL photos bio age occupation');

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

    match.isActive = false;
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
