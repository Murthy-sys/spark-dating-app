/**
 * UserAvatar — <Image> wrapper that picks the right photo to show:
 *   1. Walks every candidate URL in order: photoURL first, then photos[0..n]
 *   2. On load failure, falls through to the next candidate
 *   3. Once all real candidates are exhausted, shows the gender-themed
 *      DiceBear fallback
 *
 * Drop-in replacement for `<Image style={...} />` whenever the source is
 * a user. Keep raw <Image> for non-user content (chat photos, photo grids).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { getDefaultAvatarUrl } from '../utils/avatar';
import { resolvePhotoUrl } from '../utils/photoUrl';

interface Props {
  user: {
    _id?:      string;
    gender?:   string;
    photoURL?: string;
    photos?:   string[];
  };
  style?: StyleProp<ImageStyle>;
  /** Pixel size requested from the avatar CDN (square). Defaults to 400. */
  avatarSize?: number;
}

export default function UserAvatar({ user, style, avatarSize = 400 }: Props) {
  // Build the ordered list of real photo URLs to try.
  // photoURL first because the backend mirrors photos[0] into it on upload,
  // so it's the canonical primary; the rest are gallery extras.
  const candidates = useMemo(() => {
    const raw = [user.photoURL, ...(user.photos ?? [])];
    const seen = new Set<string>();
    return raw
      .filter((u): u is string => typeof u === 'string' && u.trim() !== '')
      .map(resolvePhotoUrl)
      .filter((u) => {
        if (!u || seen.has(u)) return false;
        seen.add(u);
        return true;
      });
  }, [user.photoURL, user.photos]);

  const fallbackUri = getDefaultAvatarUrl(user, avatarSize);

  // Index into `candidates` we're currently trying. When all fail, we
  // switch to the fallback.
  const [tryIdx, setTryIdx] = useState(0);

  // Reset the cursor when the user (or their photo set) changes.
  useEffect(() => {
    setTryIdx(0);
  }, [user._id, candidates.length]);

  const uri = tryIdx < candidates.length ? candidates[tryIdx] : fallbackUri;

  return (
    <Image
      source={{ uri }}
      style={style}
      onError={(e) => {
        console.warn('[UserAvatar] Image failed to load', {
          uri,
          userId: user._id,
          error: e.nativeEvent?.error,
        });
        if (tryIdx < candidates.length) setTryIdx((i) => i + 1);
      }}
    />
  );
}
