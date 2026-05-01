/**
 * UserAvatar — <Image> wrapper that picks the right photo to show:
 *   1. Real photo (photoURL / photos[0]) if present AND it loads
 *   2. Falls through to a gender-themed DiceBear avatar on either:
 *        - no photo at all
 *        - the real URL fails to load (stale LAN IP, broken file, etc.)
 *
 * Drop-in replacement for `<Image style={...} />` whenever the source is
 * a user. Keep raw <Image> for non-user content (chat photos, photo grids).
 */

import React, { useState } from 'react';
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
  // resolvePhotoUrl rewrites stale LAN/tunnel hosts onto the current API host.
  const realUri = resolvePhotoUrl(user.photos?.[0] || user.photoURL || '');
  const fallbackUri = getDefaultAvatarUrl(user, avatarSize);

  // Once the real URI fails, stay on the fallback to avoid flicker loops.
  const [realFailed, setRealFailed] = useState(false);

  const uri = realUri && !realFailed ? realUri : fallbackUri;

  return (
    <Image
      source={{ uri }}
      style={style}
      onError={(e) => {
        // Visible in Metro logs — tells us if real URLs are blocked / 404 / etc.
        console.warn(
          `[UserAvatar] Image failed to load`,
          { uri, userId: user._id, error: e.nativeEvent?.error },
        );
        if (realUri && !realFailed) setRealFailed(true);
      }}
    />
  );
}
