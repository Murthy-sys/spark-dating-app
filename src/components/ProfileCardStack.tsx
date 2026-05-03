/**
 * ProfileCardStack — vertical stack of profile cards with up/down navigation.
 *
 * The focused card sits centered; the next card peeks out behind it,
 * offset to the side and slightly tilted for a stacked-deck look. Swipe
 * up to advance to the next profile, swipe down to go back. Tap to open
 * detail. Action buttons (pass / crush / like) float on the right edge.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import UserAvatar from './UserAvatar';
import { resolvePhotoUrl } from '../utils/photoUrl';
import { UserProfile } from '../types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export interface CardItem {
  user: UserProfile;
  crossingCount: number;
  crossedAt: string;
}

interface Props {
  items: CardItem[];
  onLike: (item: CardItem) => void;
  onPass: (item: CardItem) => void;
  onStar: (item: CardItem) => void;
  onTap: (item: CardItem) => void;
  /** Like/star locked (e.g. daily-pick limit reached). Pass still works. */
  disabled?: boolean;
}

const INTENT_LABEL: Record<string, string> = {
  serious:    'Serious',
  casual:     'Casual',
  friends:    'Friends',
  networking: 'Networking',
};

function intentBadge(intent?: string | null): string | null {
  return intent ? INTENT_LABEL[intent] ?? null : null;
}

// Card sizing — leaves obvious breathing room around the deck.
const CARD_W = Math.min(SCREEN_W - 80, 320);
const CARD_H = Math.min(Math.round(CARD_W * 1.4), Math.round(SCREEN_H * 0.62));

// Peek (next-card) transform when at rest.
const PEEK_TRANSLATE_X = 18;   // sticks out to the right
const PEEK_TRANSLATE_Y = 10;
const PEEK_SCALE       = 0.94;
const PEEK_ROTATE_DEG  = 4;    // tilt clockwise

const SWIPE_THRESHOLD = 90;    // px before a swipe commits

export default function ProfileCardStack({
  items,
  onLike,
  onPass,
  onStar,
  onTap,
  disabled = false,
}: Props) {
  const [index, setIndex] = useState(0);
  const pan = useRef(new Animated.Value(0)).current;

  // Clamp the index when items shrinks (e.g. the current card was acted on
  // and removed from the feed by the parent).
  useEffect(() => {
    if (index >= items.length) {
      setIndex(Math.max(0, items.length - 1));
      pan.setValue(0);
    }
  }, [items.length, index, pan]);

  const previous = items[index - 1];
  const current  = items[index];
  const upcoming = items[index + 1];

  // Warm the image cache for the next few profiles so revealing them
  // feels instant instead of showing a blank frame while loading.
  useEffect(() => {
    for (let i = index; i <= index + 3 && i < items.length; i++) {
      const u = items[i]?.user;
      const url = u?.photoURL || u?.photos?.[0];
      if (url) Image.prefetch(resolvePhotoUrl(url)).catch(() => {});
    }
  }, [items, index]);

  const reset = () => {
    Animated.spring(pan, {
      toValue: 0,
      useNativeDriver: false,
      friction: 6,
      tension: 70,
    }).start();
  };

  const fly = (toValue: number, after: () => void) => {
    Animated.timing(pan, {
      toValue,
      duration: 220,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) after();
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
        onPanResponderMove: (_, g) => {
          // Rubber-band the gesture if there's nothing on that side.
          let dy = g.dy;
          if (dy < 0 && !upcoming) dy = dy / 4;
          if (dy > 0 && !previous) dy = dy / 4;
          pan.setValue(dy);
        },
        onPanResponderRelease: (_, g) => {
          if (!current) {
            reset();
            return;
          }
          // Swipe up → next profile (current flies off the top, upcoming centers)
          if (g.dy < -SWIPE_THRESHOLD && upcoming) {
            fly(-CARD_H * 1.4, () => {
              pan.setValue(0);
              setIndex((i) => Math.min(i + 1, items.length - 1));
            });
          // Swipe down → previous profile (the card that went up returns from above)
          } else if (g.dy > SWIPE_THRESHOLD && previous) {
            fly(CARD_H, () => {
              pan.setValue(0);
              setIndex((i) => Math.max(0, i - 1));
            });
          } else {
            reset();
          }
        },
        onPanResponderTerminate: () => reset(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, previous, upcoming, index, items.length],
  );

  // ─── Interpolations ────────────────────────────────────────────────────────
  //
  // The same `pan` value drives three cards. Direction matters:
  //   pan < 0 (swipe up):   current follows finger up; upcoming peek centers
  //   pan > 0 (swipe down): previous slides down from above; current morphs
  //                         into the next peek position
  //
  // Each interpolation is constructed so behavior is asymmetric — only the
  // appropriate cards move for each gesture direction.

  // ─── Current card ────────────────────────────────────────────────────────
  // Up: translateY follows pan 1:1 (slides off top).
  // Down: morphs toward the upcoming-peek transform (becomes the new peek).
  const currentTranslateY = pan.interpolate({
    inputRange:  [-CARD_H * 1.5, 0, CARD_H],
    outputRange: [-CARD_H * 1.5, 0, PEEK_TRANSLATE_Y],
    extrapolate: 'clamp',
  });
  const currentTranslateX = pan.interpolate({
    inputRange:  [-CARD_H, 0, CARD_H],
    outputRange: [0, 0, PEEK_TRANSLATE_X],
    extrapolate: 'clamp',
  });
  const currentScale = pan.interpolate({
    inputRange:  [-CARD_H, 0, CARD_H],
    outputRange: [1, 1, PEEK_SCALE],
    extrapolate: 'clamp',
  });
  const currentRotate = pan.interpolate({
    inputRange:  [-CARD_H, 0, CARD_H],
    outputRange: ['-3deg', '0deg', `${PEEK_ROTATE_DEG}deg`],
    extrapolate: 'clamp',
  });
  const currentOpacity = pan.interpolate({
    inputRange:  [-CARD_H * 0.9, -CARD_H * 0.3, 0],
    outputRange: [0.15, 1, 1],
    extrapolate: 'clamp',
  });

  // ─── Upcoming peek ───────────────────────────────────────────────────────
  // Up: animates from peek toward center as current leaves.
  // Down: stays at peek position (no motion).
  const peekTranslateX = pan.interpolate({
    inputRange:  [-CARD_H, 0, CARD_H],
    outputRange: [0, PEEK_TRANSLATE_X, PEEK_TRANSLATE_X],
    extrapolate: 'clamp',
  });
  const peekTranslateY = pan.interpolate({
    inputRange:  [-CARD_H, 0, CARD_H],
    outputRange: [0, PEEK_TRANSLATE_Y, PEEK_TRANSLATE_Y],
    extrapolate: 'clamp',
  });
  const peekScale = pan.interpolate({
    inputRange:  [-CARD_H, 0, CARD_H],
    outputRange: [1, PEEK_SCALE, PEEK_SCALE],
    extrapolate: 'clamp',
  });
  const peekRotate = pan.interpolate({
    inputRange:  [-CARD_H, 0, CARD_H],
    outputRange: ['0deg', `${PEEK_ROTATE_DEG}deg`, `${PEEK_ROTATE_DEG}deg`],
    extrapolate: 'clamp',
  });

  // ─── Previous card ───────────────────────────────────────────────────────
  // Hidden above the screen at rest. On swipe-down, slides into focus.
  const prevTranslateY = pan.interpolate({
    inputRange:  [-CARD_H, 0, CARD_H],
    outputRange: [-CARD_H, -CARD_H, 0],
    extrapolate: 'clamp',
  });

  // Container has a little extra width so the peek's lateral offset isn't
  // clipped by overflow:hidden.
  const deckExtraW = PEEK_TRANSLATE_X * 2 + 8;

  return (
    <View style={styles.root}>
      <View style={[styles.deck, { width: CARD_W + deckExtraW, height: CARD_H }]}>
        {/* Render each nearby item ONCE with a stable key (user._id) so React
            doesn't unmount/remount cards as roles shuffle — keeps the loaded
            <Image> in place across role transitions, eliminating flicker. */}
        {items.map((item, i) => {
          const offset = i - index;
          if (offset < -1 || offset > 1) return null;

          const isCurrent  = offset === 0;
          const isPrevious = offset === -1;
          const isUpcoming = offset === 1;

          let animStyle: any;
          let zIndex = 1;

          if (isCurrent) {
            animStyle = {
              opacity: currentOpacity,
              transform: [
                { translateX: currentTranslateX },
                { translateY: currentTranslateY },
                { rotate: currentRotate },
                { scale: currentScale },
              ],
            };
            zIndex = 2;
          } else if (isUpcoming) {
            animStyle = {
              transform: [
                { translateX: peekTranslateX },
                { translateY: peekTranslateY },
                { rotate: peekRotate },
                { scale: peekScale },
              ],
            };
            zIndex = 1;
          } else {
            // Previous — sits above-screen at rest, slides down on rewind.
            animStyle = {
              transform: [{ translateY: prevTranslateY }],
            };
            zIndex = 3;
          }

          return (
            <Animated.View
              key={item.user._id}
              {...(isCurrent ? panResponder.panHandlers : {})}
              pointerEvents={isCurrent ? 'box-none' : 'none'}
              style={[styles.cardLayer, animStyle, { zIndex }]}
            >
              <View style={styles.card}>
                <CardBody item={item} />

                {isCurrent && (
                  <>
                    <Pressable
                      style={StyleSheet.absoluteFill}
                      onPress={() => onTap(item)}
                    />
                    <View style={styles.actionsCol} pointerEvents="box-none">
                      <TouchableOpacity
                        style={styles.passBtn}
                        activeOpacity={0.85}
                        onPress={() => onPass(item)}
                      >
                        <Text style={styles.passIcon}>✕</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.starBtn, disabled && styles.btnLocked]}
                        activeOpacity={0.85}
                        disabled={disabled}
                        onPress={() => onStar(item)}
                      >
                        <Text style={styles.starIcon}>⭐</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.likeBtn, disabled && styles.btnLocked]}
                        activeOpacity={0.85}
                        disabled={disabled}
                        onPress={() => onLike(item)}
                      >
                        <Text style={styles.likeIcon}>❤</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </Animated.View>
          );
        })}
      </View>

      {/* Page-progress dots — vertical, on the left edge */}
      {items.length > 1 && items.length <= 12 && (
        <View pointerEvents="none" style={styles.progress}>
          {items.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i === index && styles.progressDotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Smooth gradient (no expo-linear-gradient) ───────────────────────────────

const FADE_BANDS  = 18;
const FADE_HEIGHT = 0.62;  // fraction of card covered by the fade
const FADE_MAX    = 0.78;  // peak black opacity at the very bottom

/**
 * Stacks N evenly-sized translucent bands to fake a linear gradient. Opacity
 * follows an ease-in curve (i^2.2) so the transition feels natural — light
 * at the top, opaque at the bottom — instead of the visible "stairsteps" of
 * just three bands.
 */
function SmoothFade() {
  const bandH = `${(FADE_HEIGHT * 100) / FADE_BANDS}%`;
  return (
    <View pointerEvents="none" style={fadeStyles.root}>
      {Array.from({ length: FADE_BANDS }).map((_, i) => {
        const t = i / (FADE_BANDS - 1);          // 0 (top) → 1 (bottom)
        const opacity = Math.pow(t, 2.2) * FADE_MAX;
        return (
          <View
            key={i}
            style={{
              height: bandH,
              backgroundColor: '#000',
              opacity,
            }}
          />
        );
      })}
    </View>
  );
}

const fadeStyles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: `${FADE_HEIGHT * 100}%`,
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
});

// ─── Card body ───────────────────────────────────────────────────────────────

function CardBody({ item }: { item: CardItem }) {
  const { user, crossingCount } = item;
  const intent = intentBadge((user as any).intent);
  const crossedLabel =
    crossingCount > 1 ? `${crossingCount}× crossed paths` : 'Crossed paths';

  return (
    <View style={bodyStyles.root}>
      <UserAvatar user={user} style={bodyStyles.photo} avatarSize={800} />

      <View style={bodyStyles.topRow} pointerEvents="none">
        <View style={bodyStyles.crossBadge}>
          <Text style={bodyStyles.crossBadgeText}>🚶 {crossedLabel}</Text>
        </View>
        {intent && (
          <View style={bodyStyles.intentBadge}>
            <Text style={bodyStyles.intentBadgeText}>{intent}</Text>
          </View>
        )}
      </View>

      <SmoothFade />

      <View style={bodyStyles.info} pointerEvents="none">
        <Text style={bodyStyles.name} numberOfLines={1}>
          {user.displayName || 'Unknown'}
          {typeof user.age === 'number' && user.age > 0 ? `, ${user.age}` : ''}
        </Text>
        {!!user.occupation && (
          <Text style={bodyStyles.sub} numberOfLines={1}>
            {user.occupation}
          </Text>
        )}
        {!!user.bio && (
          <Text style={bodyStyles.bio} numberOfLines={2}>
            {user.bio}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  deck: {
    alignItems: 'center',
    justifyContent: 'center',
    // Clip cards that slide above (off-top) or below (off-bottom) so a
    // dismissed card never peeks back into view from the wrong direction.
    overflow: 'hidden',
  },
  cardLayer: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 22,
    backgroundColor: '#222',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOpacity: 0.20,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },

  // Action column — sits inside the card edge, on top of the photo's bottom
  // gradient so it's legible without protruding beyond the card (which would
  // be clipped by the deck's overflow:hidden).
  actionsCol: {
    position: 'absolute',
    right: 10,
    bottom: 16,
    alignItems: 'center',
    gap: 10,
  },
  btnLocked: { opacity: 0.4 },
  passBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  passIcon: { fontSize: 18, color: '#FF4B6E', fontWeight: '700' },
  starBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  starIcon: { fontSize: 20 },
  likeBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#FF4B6E',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF4B6E',
    shadowOpacity: 0.40,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  likeIcon: { fontSize: 24, color: '#fff' },

  // Progress dots
  progress: {
    position: 'absolute',
    left: 14,
    top: '50%',
    flexDirection: 'column',
    gap: 6,
    transform: [{ translateY: -40 }],
  },
  progressDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  progressDotActive: {
    backgroundColor: '#FF4B6E',
    width: 6, height: 6, borderRadius: 3,
  },
});

const bodyStyles = StyleSheet.create({
  root: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#222',
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    backgroundColor: '#222',
  },
  topRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  crossBadge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  crossBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  intentBadge: {
    backgroundColor: 'rgba(255,75,110,0.95)',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  intentBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },

  info: {
    position: 'absolute',
    left: 16,
    right: 70, // leave room for the in-card action column on the right
    bottom: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  sub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.92)',
    marginTop: 2,
    fontWeight: '600',
  },
  bio: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 5,
    lineHeight: 16,
  },
});
