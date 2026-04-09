/**
 * chatService.ts
 *
 * Real-time chat via Socket.io + REST fallback via apiClient.
 *
 * Fixes applied:
 *  1. subscribeToMessages re-joins the match room on every socket reconnect,
 *     so messages keep flowing after an app refresh / background-foreground cycle.
 *  2. sendMessageSocket falls back to the REST API when the socket is
 *     disconnected, preventing silent message loss.
 */

import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, SOCKET_URL } from './apiClient';
import { Message } from '../types';

let socket: Socket | null = null;

// ─── Socket Connection ────────────────────────────────────────────────────────

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await AsyncStorage.getItem('authToken');

  // If a stale disconnected socket exists, remove it first
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    auth:                 { token },
    transports:           ['websocket', 'polling'],  // try WS first, fall back to polling on tunnels
    upgrade:              true,                       // upgrade polling→WS when possible
    reconnection:         true,
    reconnectionAttempts: Infinity,   // never stop trying
    reconnectionDelay:    1000,
    reconnectionDelayMax: 10000,      // cap at 10 s between attempts
    timeout:              30000,      // 30 s connection timeout (tunnels are slow)
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

// ─── Subscribe to Messages (real-time) ───────────────────────────────────────

export async function subscribeToMessages(
  matchId: string,
  onMessage: (msg: Message) => void
): Promise<() => void> {
  const s = await connectSocket();

  // Join the room immediately
  s.emit('join_match', { matchId });

  // BUG FIX: Re-join the room every time the socket reconnects.
  // Without this, after any disconnect/reconnect (app refresh, background→foreground)
  // the socket is no longer in the match room and new messages are never received.
  const handleReconnect = () => {
    console.log('[Socket] Reconnected — re-joining match room:', matchId);
    s.emit('join_match', { matchId });
  };

  s.on('connect', handleReconnect);
  s.on('new_message', onMessage);

  return () => {
    s.off('connect', handleReconnect);
    s.off('new_message', onMessage);
  };
}

// ─── Subscribe to Typing ──────────────────────────────────────────────────────

export function subscribeToTyping(
  onTyping: (userId: string) => void,
  onStopTyping: (userId: string) => void
): () => void {
  if (!socket) return () => {};
  const handleTyping     = ({ userId }: { userId: string }) => onTyping(userId);
  const handleStopTyping = ({ userId }: { userId: string }) => onStopTyping(userId);
  socket.on('typing',      handleTyping);
  socket.on('stop_typing', handleStopTyping);
  return () => {
    socket?.off('typing',      handleTyping);
    socket?.off('stop_typing', handleStopTyping);
  };
}

// ─── Send Message ─────────────────────────────────────────────────────────────

/**
 * BUG FIX: Previously used socket?.emit() which silently dropped the message
 * if the socket was disconnected — input cleared, message never saved.
 * Now falls back to the REST API when socket is not connected.
 */
export async function sendMessageSocket(matchId: string, text: string): Promise<Message | null> {
  if (socket?.connected) {
    socket.emit('send_message', { matchId, text });
    return null; // message will arrive via new_message event
  }
  // REST fallback — ensures message is always saved even if socket is down
  console.warn('[Socket] Not connected — falling back to REST for send');
  return sendMessage(matchId, text);
}

// ─── Send Message (REST) ──────────────────────────────────────────────────────

export async function sendMessage(matchId: string, text: string): Promise<Message> {
  const { data } = await apiClient.post(`/messages/${matchId}`, { text });
  return data.data as Message;
}

// ─── Send Image Message ───────────────────────────────────────────────────────

export async function sendImageMessage(
  matchId: string,
  localUri: string
): Promise<Message> {
  const formData = new FormData();
  formData.append('image', {
    uri:  localUri,
    type: 'image/jpeg',
    name: 'chat_image.jpg',
  } as any);

  const { data } = await apiClient.post(`/messages/${matchId}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data as Message;
}

// ─── Get Messages (paginated) ─────────────────────────────────────────────────

export async function getMessages(
  matchId: string,
  before?: string,
  limit = 30
): Promise<Message[]> {
  const { data } = await apiClient.get(`/messages/${matchId}`, {
    params: { before, limit },
  });
  return data.data as Message[];
}

// ─── Typing Indicators ────────────────────────────────────────────────────────

export function emitTyping(matchId: string): void {
  socket?.emit('typing', { matchId });
}

export function emitStopTyping(matchId: string): void {
  socket?.emit('stop_typing', { matchId });
}

// ─── Mark as Read ─────────────────────────────────────────────────────────────

export function markAsRead(matchId: string): void {
  socket?.emit('read_messages', { matchId });
}
