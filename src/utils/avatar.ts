/**
 * avatar.ts — fallback avatar for users without a photo.
 *
 * One curated illustration per gender — same image for every user of that
 * gender (no per-user variation). Picked for being clean, modern, and
 * confident-looking, with a tasteful gradient backdrop.
 *
 *   female       → "lorelei"   style, fixed seed "Aria"
 *   male         → "avataaars" style, fixed seed "Knox"
 *   non-binary   → "notionists-neutral", fixed seed "Sky"
 *   other / ?    → same as non-binary
 */

const DICEBEAR_BASE = 'https://api.dicebear.com/7.x';

interface AvatarPreset {
  style: string;
  seed:  string;
  bg:    [string, string]; // gradient stops
}

const AVATAR_BY_GENDER: Record<string, AvatarPreset> = {
  female: {
    style: 'lorelei',
    seed:  'Aria',
    bg:    ['FF8FB1', 'FFD0DC'], // rose → blush
  },
  male: {
    style: 'avataaars',
    seed:  'Knox',
    bg:    ['5E8BFF', 'B6D0FF'], // royal blue → sky
  },
  'non-binary': {
    style: 'notionists-neutral',
    seed:  'Sky',
    bg:    ['B095FF', 'E0D4FF'], // violet → lilac
  },
  other: {
    style: 'notionists-neutral',
    seed:  'Sky',
    bg:    ['B095FF', 'E0D4FF'],
  },
};

interface AvatarUser {
  _id?:    string;
  gender?: string;
}

export function getDefaultAvatarUrl(user: AvatarUser, size = 400): string {
  const key = (user.gender ?? '') as keyof typeof AVATAR_BY_GENDER;
  const p   = AVATAR_BY_GENDER[key] ?? AVATAR_BY_GENDER.other;
  return (
    `${DICEBEAR_BASE}/${p.style}/png` +
    `?seed=${encodeURIComponent(p.seed)}` +
    `&size=${size}` +
    `&backgroundType=gradientLinear` +
    `&backgroundColor=${p.bg[0]},${p.bg[1]}` +
    `&backgroundRotation=45`
  );
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
