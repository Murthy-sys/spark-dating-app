/**
 * socket.ts — Socket.io server for real-time chat
 *
 * Events emitted by client:
 *   join_match   { matchId }           → join a match room
 *   send_message { matchId, text }     → send a text message
 *   typing       { matchId }           → notify other user is typing
 *   stop_typing  { matchId }           → stop typing indicator
 *   read_messages { matchId }          → mark messages as read
 *
 * Events emitted to client:
 *   new_message  { message }           → new message in a match room
 *   typing       { userId }            → someone is typing
 *   stop_typing  { userId }            → typing stopped
 *   messages_read { userId, matchId }  → other user read messages
 *   error        { message }           → error notification
 */

import { Server as HTTPServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import Match from './models/Match';
import Message from './models/Message';
import User from './models/User';
import {
  REPLY_TIMER_MS,
  AUTO_UNMATCH_MS,
  ENGAGE_REPLY_FAST,
  ENGAGE_REPLY_LATE,
} from './constants/limits';

interface AuthSocket extends Socket {
  userId?: string;
}

let ioInstance: IOServer | null = null;

/** Get the global Socket.io instance (available after initSocket) */
export function getIO(): IOServer | null {
  return ioInstance;
}

export function initSocket(httpServer: HTTPServer): IOServer {
  const io = new IOServer(httpServer, {
    cors: {
      origin:      process.env.CORS_ORIGINS?.split(',') || '*',
      methods:     ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 10000,   // heartbeat every 10 s — keeps tunnel alive
    pingTimeout:  20000,   // wait 20 s for pong before declaring dead
    connectTimeout: 30000, // 30 s to complete handshake (tunnels are slow)
  });

  // ─── JWT Auth Middleware ───────────────────────────────────────────────────
  io.use((socket: AuthSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
      socket.userId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // ─── Connection Handler ────────────────────────────────────────────────────
  io.on('connection', (socket: AuthSocket) => {
    const userId = socket.userId!;
    console.log(`[Socket] User connected: ${userId}`);

    // Join personal room for direct notifications
    socket.join(`user:${userId}`);

    // ── Join Match Room ──────────────────────────────────────────────────────
    socket.on('join_match', async ({ matchId }: { matchId: string }) => {
      try {
        const match = await Match.findOne({ _id: matchId, users: userId });
        if (!match) {
          socket.emit('error', { message: 'Not authorized for this match' });
          return;
        }
        socket.join(`match:${matchId}`);
      } catch {
        socket.emit('error', { message: 'Failed to join match room' });
      }
    });

    // ── Send Message ─────────────────────────────────────────────────────────
    socket.on('send_message', async ({ matchId, text }: { matchId: string; text: string }) => {
      try {
        if (!text?.trim()) return;

        const match = await Match.findOne({ _id: matchId, users: userId, isActive: true });
        if (!match) {
          socket.emit('error', { message: 'Match not found' });
          return;
        }

        // Anti-ghosting: score the sender if this is a reply to the other party
        if (
          match.lastSenderId &&
          match.lastMessageAt &&
          match.lastSenderId.toString() !== userId
        ) {
          const elapsed = Date.now() - new Date(match.lastMessageAt).getTime();
          const delta   = elapsed <= REPLY_TIMER_MS ? ENGAGE_REPLY_FAST : ENGAGE_REPLY_LATE;
          await User.updateOne({ _id: userId }, { $inc: { engagementScore: delta } });
          await User.updateOne(
            { _id: userId, engagementScore: { $gt: 100 } },
            { $set: { engagementScore: 100 } }
          );
          await User.updateOne(
            { _id: userId, engagementScore: { $lt: 0 } },
            { $set: { engagementScore: 0 } }
          );
        }

        const message = await Message.create({
          match:  matchId,
          sender: userId,
          text:   text.trim(),
        });

        const otherUserId = match.users.find((id) => id.toString() !== userId)!;
        const now = new Date();

        await Match.findByIdAndUpdate(matchId, {
          lastMessage:   text.trim(),
          lastMessageAt: now,
          lastSenderId:  userId,
          replyDueAt:    new Date(now.getTime() + REPLY_TIMER_MS),
          autoUnmatchAt: new Date(now.getTime() + AUTO_UNMATCH_MS),
          $inc: { [`unreadCount.${otherUserId}`]: 1 },
        });

        // Broadcast to the match room (both users)
        io.to(`match:${matchId}`).emit('new_message', message);
      } catch {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ── Typing Indicators ────────────────────────────────────────────────────
    socket.on('typing', ({ matchId }: { matchId: string }) => {
      socket.to(`match:${matchId}`).emit('typing', { userId });
    });

    socket.on('stop_typing', ({ matchId }: { matchId: string }) => {
      socket.to(`match:${matchId}`).emit('stop_typing', { userId });
    });

    // ── Mark Messages as Read ────────────────────────────────────────────────
    socket.on('read_messages', async ({ matchId }: { matchId: string }) => {
      try {
        await Match.findByIdAndUpdate(matchId, {
          $set: { [`unreadCount.${userId}`]: 0 },
        });
        socket.to(`match:${matchId}`).emit('messages_read', { userId, matchId });
      } catch {
        // Ignore errors for read receipts
      }
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${userId}`);
    });
  });

  ioInstance = io;
  return io;
}
