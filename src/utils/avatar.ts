/**
 * avatar.ts — gender-aware fallback avatar for users without a photo.
 *
 * Uses DiceBear's "personas" style — a semi-3D illustrated portrait that
 * looks better than a coloured initial. The seed is the user's _id so the
 * same user always gets the same avatar. Background tint is gender-themed.
 *
 * Free CDN, no API key, plain PNG so React Native's <Image> handles it.
 */

const DICEBEAR_BASE = 'https://api.dicebear.com/7.x/personas/png';

const BG_BY_GENDER: Record<string, string> = {
  male:         'b6e3f4',  // soft blue
  female:       'ffd5dc',  // soft pink
  'non-binary': 'd1d4f9',  // soft lavender
  other:        'e0e0e0',  // neutral
};

interface AvatarUser {
  _id?:    string;
  gender?: string;
}

export function getDefaultAvatarUrl(user: AvatarUser, size = 400): string {
  const seed = encodeURIComponent(user._id || 'spark-anon');
  const bg   = BG_BY_GENDER[user.gender ?? ''] ?? BG_BY_GENDER.other;
  return `${DICEBEAR_BASE}?seed=${seed}&backgroundColor=${bg}&size=${size}`;
}

/**
 * Returns the URI to render for a user:
 *   1. user.photoURL or user.photos[0] if present
 *   2. otherwise, a gender-themed DiceBear avatar
 *
 * Use the UserAvatar component (preferred) when you also want graceful
 * fallback if the real URL is unreachable (stale LAN IP, broken upload, etc).
 */
export function resolveAvatarUri(
  user: AvatarUser & { photoURL?: string; photos?: string[] },
  size = 400,
): string {
  const real = user.photos?.[0] || user.photoURL;
  return real || getDefaultAvatarUrl(user, size);
}
