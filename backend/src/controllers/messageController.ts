import { Response, NextFunction } from 'express';
import Match from '../models/Match';
import Message from '../models/Message';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { uploadImage } from '../middleware/upload';
import {
  REPLY_TIMER_MS,
  AUTO_UNMATCH_MS,
  ENGAGE_REPLY_FAST,
  ENGAGE_REPLY_LATE,
} from '../constants/limits';

// ─── Engagement bookkeeping helper ───────────────────────────────────────────

/**
 * When a user sends a message that's a *reply* to the other party, adjust the
 * sender's engagement score based on how quickly they replied.
 *
 * Returns the score delta applied (0 if not a reply / nothing to do) so the
 * caller can include it in the response if useful for debugging.
 */
async function applyReplyEngagement(
  senderId: any,
  prevSenderId: any,
  prevMessageAt: Date | null
): Promise<number> {
  // Not a reply if there was no previous message, or sender == prev sender
  if (!prevSenderId || !prevMessageAt) return 0;
  if (senderId.toString() === prevSenderId.toString()) return 0;

  const elapsed = Date.now() - new Date(prevMessageAt).getTime();
  const delta   = elapsed <= REPLY_TIMER_MS ? ENGAGE_REPLY_FAST : ENGAGE_REPLY_LATE;

  await User.updateOne({ _id: senderId }, { $inc: { engagementScore: delta } });
  // Clamp 0–100 — Mongo $inc can't clamp directly
  await User.updateOne(
    { _id: senderId, engagementScore: { $gt: 100 } },
    { $set: { engagementScore: 100 } }
  );
  await User.updateOne(
    { _id: senderId, engagementScore: { $lt: 0 } },
    { $set: { engagementScore: 0 } }
  );
  return delta;
}

// ─── Get Messages for a Match ─────────────────────────────────────────────────

export async function getMessages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myId    = req.user!._id;
    const matchId = req.params.matchId;
    const before  = req.query.before as string | undefined;  // cursor-based pagination
    const limit   = Math.min(50, Number(req.query.limit) || 30);

    // Verify user is part of this match
    const match = await Match.findOne({ _id: matchId, users: myId, isActive: true });
    if (!match) return res.status(403).json({ success: false, message: 'Not authorized' });

    const query: any = { match: matchId };
    if (before) query.createdAt = { $lt: new Date(before) };

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Reset unread count for current user
    await Match.findByIdAndUpdate(matchId, {
      $set: { [`unreadCount.${myId}`]: 0 },
    });

    res.json({ success: true, data: messages.reverse() });
  } catch (err) {
    next(err);
  }
}

// ─── Send Text Message ────────────────────────────────────────────────────────

export async function sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myId    = req.user!._id;
    const matchId = req.params.matchId;
    const { text } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    const match = await Match.findOne({ _id: matchId, users: myId, isActive: true });
    if (!match) return res.status(403).json({ success: false, message: 'Not authorized' });

    // Compute engagement delta against the *previous* state before we overwrite it
    await applyReplyEngagement(myId, match.lastSenderId, match.lastMessageAt);

    const message = await Message.create({ match: matchId, sender: myId, text: text.trim() });

    // Update match preview, increment other user's unread, push the reply timer
    // and auto-unmatch deadline forward (the recipient now owes the next reply).
    const otherUserId = match.users.find((id) => id.toString() !== myId.toString())!;
    const now = new Date();
    await Match.findByIdAndUpdate(matchId, {
      lastMessage:   text.trim(),
      lastMessageAt: now,
      lastSenderId:  myId,
      replyDueAt:    new Date(now.getTime() + REPLY_TIMER_MS),
      autoUnmatchAt: new Date(now.getTime() + AUTO_UNMATCH_MS),
      $inc: { [`unreadCount.${otherUserId}`]: 1 },
    });

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
}

// ─── Send Image Message ───────────────────────────────────────────────────────

export async function sendImageMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myId    = req.user!._id;
    const matchId = req.params.matchId;

    if (!req.file) return res.status(400).json({ success: false, message: 'No image provided' });

    const match = await Match.findOne({ _id: matchId, users: myId, isActive: true });
    if (!match) return res.status(403).json({ success: false, message: 'Not authorized' });

    // Use uploadImage (not uploadToCloudinary) so it falls back to local disk
    // when Cloudinary env vars are not configured.
    const baseUrl   = `${req.protocol}://${req.get('host')}`;
    const publicId  = `chat_${matchId}_${Date.now()}`;
    const { url }   = await uploadImage(req.file.buffer, publicId, 'spark/chat', baseUrl);

    await applyReplyEngagement(myId, match.lastSenderId, match.lastMessageAt);

    const message = await Message.create({
      match: matchId,
      sender: myId,
      text: '',
      imageURL: url,
    });

    const otherUserId = match.users.find((id) => id.toString() !== myId.toString())!;
    const now = new Date();
    await Match.findByIdAndUpdate(matchId, {
      lastMessage:   '📷 Photo',
      lastMessageAt: now,
      lastSenderId:  myId,
      replyDueAt:    new Date(now.getTime() + REPLY_TIMER_MS),
      autoUnmatchAt: new Date(now.getTime() + AUTO_UNMATCH_MS),
      $inc: { [`unreadCount.${otherUserId}`]: 1 },
    });

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
}
