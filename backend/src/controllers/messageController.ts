import { Response, NextFunction } from 'express';
import Match from '../models/Match';
import Message from '../models/Message';
import { AuthRequest } from '../middleware/auth';
import { uploadImage } from '../middleware/upload';

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

    const message = await Message.create({ match: matchId, sender: myId, text: text.trim() });

    // Update match preview + increment other user's unread count
    const otherUserId = match.users.find((id) => id.toString() !== myId.toString())!;
    await Match.findByIdAndUpdate(matchId, {
      lastMessage:   text.trim(),
      lastMessageAt: new Date(),
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

    const message = await Message.create({
      match: matchId,
      sender: myId,
      text: '',
      imageURL: url,
    });

    const otherUserId = match.users.find((id) => id.toString() !== myId.toString())!;
    await Match.findByIdAndUpdate(matchId, {
      lastMessage:   '📷 Photo',
      lastMessageAt: new Date(),
      $inc: { [`unreadCount.${otherUserId}`]: 1 },
    });

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
}
