/**
 * userService.ts — profile CRUD + photo uploads via Node.js backend
 */

import { apiClient } from './apiClient';
import { UserProfile } from '../types';

// ─── Get Any Profile ──────────────────────────────────────────────────────────

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data } = await apiClient.get(`/users/${userId}`);
    return data.user as UserProfile;
  } catch {
    return null;
  }
}

// ─── Update My Profile ────────────────────────────────────────────────────────

export async function updateUserProfile(
  updates: Partial<UserProfile>
): Promise<UserProfile> {
  const { data } = await apiClient.patch('/users/me', updates);
  return data.user as UserProfile;
}

// ─── Upload Profile Photo ─────────────────────────────────────────────────────

export async function uploadProfilePhoto(
  localUri: string,
  index: number
): Promise<string> {
  const formData = new FormData();

  // React Native requires this specific object shape for FormData file entries
  formData.append('photo', {
    uri:  localUri,
    type: 'image/jpeg',
    name: `photo_${index}.jpg`,
  } as any);
  formData.append('index', String(index));

  const { data } = await apiClient.post('/users/me/photos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return data.url as string;
}

// ─── Delete Photo ─────────────────────────────────────────────────────────────

export async function deleteProfilePhoto(index: number): Promise<void> {
  await apiClient.delete(`/users/me/photos/${index}`);
}

// ─── Block User ───────────────────────────────────────────────────────────────

export async function blockUser(userId: string): Promise<void> {
  await apiClient.post(`/users/${userId}/block`);
}
