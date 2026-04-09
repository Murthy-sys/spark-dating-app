/**
 * matchingService.ts
 *
 * Handles:
 *  - Fetching crossed-paths users (Happn-style home feed)
 *  - Like / crush / pass
 *  - Fetching matches and likes received
 *
 * All API responses use `_id` (MongoDB ObjectId) — no uid aliasing needed.
 */

import { apiClient } from './apiClient';
import { LikeStatus, Match, UserProfile } from '../types';

// ─── Crossed-Paths Feed ───────────────────────────────────────────────────────

export async function getCrossedPathsUsers(
  page  = 1,
  limit = 20
): Promise<{ user: UserProfile; crossingCount: number; crossedAt: string }[]> {
  const { data } = await apiClient.get('/crossings', { params: { page, limit } });
  return data.data as { user: UserProfile; crossingCount: number; crossedAt: string }[];
}

export async function getNearbyUsers(
  radius = 10,
  limit = 30
): Promise<UserProfile[]> {
  const { data } = await apiClient.get('/users/nearby', {
    params: { radius, limit },
  });
  return data.data as UserProfile[];
}

// ─── Like / Crush / Pass ──────────────────────────────────────────────────────

/**
 * Returns `isMatch: true` and `matchId` (MongoDB _id) when a mutual match is made.
 * matchId is guaranteed to be a string when isMatch is true.
 */
export async function likeUser(
  toUserId: string,
  status: LikeStatus = 'liked'
): Promise<{ isMatch: boolean; matchId?: string }> {
  const { data } = await apiClient.post(`/matches/like/${toUserId}`, { status });
  return {
    isMatch: data.isMatch as boolean,
    matchId: data.matchId as string | undefined,
  };
}

export async function passUser(toUserId: string): Promise<void> {
  await likeUser(toUserId, 'passed');
}

// ─── Fetch Matches ────────────────────────────────────────────────────────────
// Note: takes NO arguments — backend filters by the JWT user automatically.

export async function getMatches(): Promise<Match[]> {
  const { data } = await apiClient.get('/matches');
  return data.data as Match[];
}

// ─── Likes Received ───────────────────────────────────────────────────────────

export async function getLikesReceived(): Promise<{ from: UserProfile; status: LikeStatus }[]> {
  const { data } = await apiClient.get('/matches/likes-received');
  return data.data as { from: UserProfile; status: LikeStatus }[];
}

// ─── Unmatch ──────────────────────────────────────────────────────────────────

export async function unmatch(matchId: string): Promise<void> {
  await apiClient.delete(`/matches/${matchId}`);
}

// ─── Star / Unstar ────────────────────────────────────────────────────────────

export async function starUser(userId: string): Promise<void> {
  await apiClient.post(`/matches/star/${userId}`);
}

export async function unstarUser(userId: string): Promise<void> {
  await apiClient.delete(`/matches/star/${userId}`);
}

// ─── Unlike ───────────────────────────────────────────────────────────────────

export async function unlikeUser(userId: string): Promise<void> {
  await apiClient.delete(`/matches/unlike/${userId}`);
}

// ─── Get My Liked Users ───────────────────────────────────────────────────────

export async function getLikedUsers(): Promise<{ user: UserProfile; starred: boolean }[]> {
  const { data } = await apiClient.get('/matches/liked');
  return data.data as { user: UserProfile; starred: boolean }[];
}

// ─── Get Starred Users ────────────────────────────────────────────────────────

export async function getStarredUsers(): Promise<UserProfile[]> {
  const { data } = await apiClient.get('/matches/starred');
  return data.data as UserProfile[];
}
