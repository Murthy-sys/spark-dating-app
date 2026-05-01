/**
 * safetyService.ts — Phase 2: women-first safety endpoints.
 *
 * Surfaces:
 *   - SOS contacts CRUD (replace-only — small list)
 *   - Panic trigger (returns SMS body the client deep-links into native SMS)
 *   - Verification submission + status
 *   - Privacy settings
 */

import { apiClient } from './apiClient';
import {
  SosContact,
  VerificationState,
  PrivacySettings,
} from '../types';

// ─── SOS Contacts ────────────────────────────────────────────────────────────

export async function getSosContacts(): Promise<SosContact[]> {
  const { data } = await apiClient.get('/safety/sos-contacts');
  return data.contacts ?? [];
}

export async function setSosContacts(contacts: SosContact[]): Promise<SosContact[]> {
  const { data } = await apiClient.put('/safety/sos-contacts', { contacts });
  return data.contacts ?? [];
}

// ─── Panic Trigger ───────────────────────────────────────────────────────────

export interface PanicResponse {
  eventId:  string;
  contacts: SosContact[];
  smsBody:  string;
}

export async function triggerPanic(coords?: {
  latitude:  number;
  longitude: number;
}): Promise<PanicResponse> {
  const { data } = await apiClient.post('/safety/panic', coords ?? {});
  return {
    eventId:  data.eventId,
    contacts: data.contacts ?? [],
    smsBody:  data.smsBody  ?? '',
  };
}

// ─── Verification ────────────────────────────────────────────────────────────

/**
 * Submit a short selfie video for identity verification. Backend rejects
 * anything that isn't a video; the camera-only constraint is enforced by
 * the caller (front camera via expo-image-picker).
 */
export async function submitVerification(localUri: string): Promise<{
  verification: VerificationState;
  trustScore:   number;
}> {
  const formData = new FormData();
  const mime = localUri.endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
  const name = localUri.endsWith('.mov') ? 'verify.mov'      : 'verify.mp4';
  formData.append('media', { uri: localUri, type: mime, name } as any);

  const { data } = await apiClient.post('/safety/verification', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // Video uploads are slow on cellular — give them 90s before we give up.
    // Backend has a matching 90s timeout for /safety/verification.
    timeout: 90_000,
  });
  return { verification: data.verification, trustScore: data.trustScore };
}

export async function getVerificationStatus(): Promise<{
  verification: VerificationState;
  trustScore:   number;
}> {
  const { data } = await apiClient.get('/safety/verification');
  return { verification: data.verification, trustScore: data.trustScore };
}

// ─── Privacy ─────────────────────────────────────────────────────────────────

export async function updatePrivacy(
  patch: Partial<PrivacySettings>,
): Promise<PrivacySettings> {
  const { data } = await apiClient.patch('/safety/privacy', patch);
  return data.privacy as PrivacySettings;
}
