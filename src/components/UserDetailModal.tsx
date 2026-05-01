/**
 * UserDetailModal.tsx
 *
 * Full-screen profile view matching the reference design:
 *   • Cream/beige background
 *   • Name + age in large bold-italic, green "Active" dot
 *   • Main photo as a tall rounded card
 *   • Scrollable content: looking-for chip, bio, hobbies chips
 *   • Additional photos shown one-by-one as cards while scrolling
 *   • Block / Report at the very bottom
 *   • Sticky bottom action bar: Boost · Pass · Like · Super-like
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import { UserProfile } from '../types';
import { blockUser } from '../services/userService';
import UserAvatar from './UserAvatar';
import { resolvePhotoUrl } from '../utils/photoUrl';

const { width, height } = Dimensions.get('window');

const BG        = '#F2ECE4';        // cream background matching reference
const DARK      = '#1A1A1A';
const BRAND     = '#FF4B6E';
const CARD_R    = 20;               // photo card border-radius

// ─── helpers ──────────────────────────────────────────────────────────────────

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 60)  return 'Active today';
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return 'Active today';
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `Active ${days}d ago`;
  return 'Recently active';
}

const LOOKING_FOR_LABELS: Record<string, string> = {
  friendship: 'Friendship',
  casual:     'Casual dating',
  serious:    'Long-term relationship',
};

// Phase 3 — community label + emoji (mirrors PreferencesModal & backend enum)
const COMMUNITY_META: Record<string, { label: string; icon: string }> = {
  tech:      { label: 'Tech',             icon: '💻' },
  fitness:   { label: 'Fitness',          icon: '🏋️' },
  startup:   { label: 'Startup founders', icon: '🚀' },
  travel:    { label: 'Travelers',        icon: '✈️' },
  foodies:   { label: 'Foodies',          icon: '🍜' },
  creators:  { label: 'Creators',         icon: '🎬' },
  gamers:    { label: 'Gamers',           icon: '🎮' },
  bookworms: { label: 'Bookworms',        icon: '📚' },
  musicians: { label: 'Musicians',        icon: '🎸' },
  artists:   { label: 'Artists',          icon: '🎨' },
};

// ─── action button ────────────────────────────────────────────────────────────

function ActionBtn({
  onPress,
  bg,
  children,
}: {
  onPress: () => void;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor: bg }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {children}
    </TouchableOpacity>
  );
}

// ─── section heading ─────────────────────────────────────────────────────────

function SectionHead({ label }: { label: string }) {
  return <Text style={styles.sectionHead}>{label}</Text>;
}

// ─── chip ─────────────────────────────────────────────────────────────────────

function Chip({ label, filled }: { label: string; filled?: boolean }) {
  return (
    <View style={[styles.chip, filled && styles.chipFilled]}>
      <Text style={[styles.chipText, filled && styles.chipTextFilled]}>{label}</Text>
    </View>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  user:       UserProfile;
  crossing?:  { crossingCount: number; crossedAt: string };
  visible:    boolean;
  onClose:    () => void;
  onLike:     () => void;
  onPass:     () => void;
  onStar:     () => void;
}

export default function UserDetailModal({
  user,
  crossing,
  visible,
  onClose,
  onLike,
  onPass,
  onStar,
}: Props) {
  const [blocked, setBlocked] = useState(false);

  const photos = (
    user.photos?.length ? user.photos : user.photoURL ? [user.photoURL] : []
  ).filter(Boolean);

  const extraPhotos   = photos.slice(1);
  const activeLabel   = user.lastSeen ? timeSince(user.lastSeen) : 'Recently active';
  const lookingForLabels = (user as any).lookingFor
    ?.map((k: string) => LOOKING_FOR_LABELS[k] ?? k) ?? [];

  // ── block / report ─────────────────────────────────────────────────────────
  const handleBlock = () => {
    Alert.alert(
      'Block user',
      `Block ${user.displayName}? They won't be able to see you or contact you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(user._id);
              setBlocked(true);
              onClose();
            } catch {
              Alert.alert('Error', 'Could not block user. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleReport = () => {
    Alert.alert(
      'Report user',
      `Report ${user.displayName} for inappropriate behaviour?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report & Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(user._id);
              setBlocked(true);
              onClose();
            } catch {
              Alert.alert('Error', 'Could not report user. Please try again.');
            }
          },
        },
      ],
    );
  };

  if (blocked) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      presentationStyle="fullScreen"
    >
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <SafeAreaView style={styles.root}>

        {/* ── top bar ── */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topIconBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.topIconText}>‹</Text>
          </TouchableOpacity>
        </View>

        {/* ── name + active ── */}
        <View style={styles.nameRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.nameText}>
              {user.displayName}, {user.age}
            </Text>
            {(user as any).verification?.status === 'verified' && (
              <Text style={styles.verifiedTick}>✓</Text>
            )}
            {typeof (user as any).trustScore === 'number' && (user as any).trustScore > 0 && (
              <View style={styles.trustChip}>
                <Text style={styles.trustChipText}>Trust {(user as any).trustScore}</Text>
              </View>
            )}
          </View>
          <View style={styles.activeRow}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>{activeLabel}</Text>
          </View>
        </View>

        {/* ── scrollable body ── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* main photo — falls back to gender-themed avatar when missing/broken */}
          <View style={styles.photoCard}>
            <UserAvatar user={user} style={styles.photo} avatarSize={800} />
          </View>

          {/* looking for */}
          {lookingForLabels.length > 0 && (
            <View style={styles.section}>
              <SectionHead label="Looking for" />
              <View style={styles.chipRow}>
                {lookingForLabels.map((l: string) => (
                  <Chip key={l} label={l} filled />
                ))}
              </View>
            </View>
          )}

          {/* bio */}
          {!!user.bio && (
            <View style={styles.section}>
              <SectionHead label="About" />
              <Text style={styles.bioText}>{user.bio}</Text>
            </View>
          )}

          {/* occupation */}
          {!!user.occupation && (
            <View style={styles.section}>
              <SectionHead label="Occupation" />
              <Text style={styles.bioText}>{user.occupation}</Text>
            </View>
          )}

          {/* hobbies */}
          {(user as any).hobbies?.length > 0 && (
            <View style={styles.section}>
              <SectionHead label="Interests" />
              <View style={styles.chipRow}>
                {(user as any).hobbies.map((h: string) => (
                  <Chip key={h} label={h} />
                ))}
              </View>
            </View>
          )}

          {/* communities (Phase 3) */}
          {(user as any).communities?.length > 0 && (
            <View style={styles.section}>
              <SectionHead label="Communities" />
              <View style={styles.chipRow}>
                {(user as any).communities.map((c: string) => {
                  const meta = COMMUNITY_META[c];
                  if (!meta) return null;
                  return <Chip key={c} label={`${meta.icon} ${meta.label}`} filled />;
                })}
              </View>
            </View>
          )}

          {/* crossing badge */}
          {crossing && (
            <View style={styles.crossingBadge}>
              <Text style={styles.crossingText}>
                🚶 {crossing.crossingCount > 1
                  ? `Crossed paths ${crossing.crossingCount} times`
                  : 'Crossed paths recently'}
              </Text>
            </View>
          )}

          {/* extra photos — one per card. resolvePhotoUrl repairs stale LAN hosts. */}
          {extraPhotos.length > 0 && (
            <View style={styles.section}>
              <SectionHead label="More photos" />
              {extraPhotos.map((uri, i) => (
                <View key={i} style={[styles.photoCard, { marginBottom: 14 }]}>
                  <Image
                    source={{ uri: resolvePhotoUrl(uri) }}
                    style={styles.photo}
                    onError={(e) =>
                      console.warn('[UserDetailModal] extra photo failed', {
                        uri: resolvePhotoUrl(uri),
                        error: e.nativeEvent?.error,
                      })
                    }
                  />
                </View>
              ))}
            </View>
          )}

          {/* block / report */}
          <View style={styles.dangerZone}>
            <TouchableOpacity style={styles.dangerBtn} onPress={handleBlock} activeOpacity={0.7}>
              <Text style={styles.dangerBtnText}>🚫  Block {user.displayName}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerBtn} onPress={handleReport} activeOpacity={0.7}>
              <Text style={[styles.dangerBtnText, { color: '#ef4444' }]}>
                ⚑  Report {user.displayName}
              </Text>
            </TouchableOpacity>
          </View>

          {/* bottom padding for action bar */}
          <View style={{ height: 24 }} />
        </ScrollView>

        {/* ── sticky action bar ── */}
        <View style={styles.actionBar}>
          {/* Pass */}
          <ActionBtn bg={DARK} onPress={onPass}>
            <Text style={[styles.actionIcon, { color: '#F5A623' }]}>✕</Text>
          </ActionBtn>

          {/* Like */}
          <ActionBtn bg={DARK} onPress={onLike}>
            <Text style={[styles.actionIcon, { color: BRAND }]}>♥</Text>
          </ActionBtn>

          {/* Super-like */}
          <ActionBtn bg="#C9E8F0" onPress={onStar}>
            <Text style={[styles.actionIcon, { color: DARK }]}>★</Text>
          </ActionBtn>
        </View>

        {/* looking-for label beneath buttons */}
        {lookingForLabels.length > 0 && (
          <Text style={styles.lookingForLabel}>{lookingForLabels[0]}</Text>
        )}

      </SafeAreaView>
    </Modal>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  /* top bar */
  topBar: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingHorizontal: 16,
    paddingTop:     Platform.OS === 'android' ? 12 : 4,
    paddingBottom:  4,
  },
  topIconBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  topIconText: { fontSize: 22, color: DARK },

  /* name */
  nameRow: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 4 },
  nameText: {
    fontSize:   34,
    fontWeight: '800',  // '900' + italic has no matching iOS system font variant → crash
    color:      DARK,
    letterSpacing: -0.5,
  },
  activeRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  activeDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E' },
  activeText: { fontSize: 14, color: '#22C55E', fontWeight: '600' },

  // Verified tick + trust chip (Phase 2)
  verifiedTick: {
    fontSize: 18, fontWeight: '900', color: '#fff', backgroundColor: '#22C55E',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, overflow: 'hidden',
  },
  trustChip: {
    backgroundColor: '#EAF7EE', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  trustChipText: { fontSize: 11, fontWeight: '700', color: '#15803D' },

  /* scroll */
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16 },

  /* photo card */
  photoCard: {
    width:         '100%',
    height:        height * 0.52,
    borderRadius:  CARD_R,
    overflow:      'hidden',
    backgroundColor: '#ddd',
    marginBottom:  18,
    shadowColor:   '#000',
    shadowOpacity: 0.10,
    shadowRadius:  12,
    shadowOffset:  { width: 0, height: 4 },
    elevation:     4,
  },
  photo:       { width: '100%', height: '100%', resizeMode: 'cover' },
  noPhotoCard: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e5e5' },
  noPhotoText: { color: '#aaa', fontSize: 16 },

  /* section */
  section:     { marginBottom: 20 },
  sectionHead: {
    fontSize:    12,
    fontWeight:  '700',
    color:       '#999',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },

  /* bio */
  bioText: { fontSize: 15, color: '#444', lineHeight: 23 },

  /* chips */
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius:  20,
    borderWidth:   1.5,
    borderColor:   '#D8D0C8',
    backgroundColor: 'transparent',
  },
  chipFilled:     { backgroundColor: DARK, borderColor: DARK },
  chipText:       { fontSize: 13, fontWeight: '600', color: '#555' },
  chipTextFilled: { color: '#fff' },

  /* crossing */
  crossingBadge: {
    backgroundColor:   'rgba(0,0,0,0.06)',
    borderRadius:      14,
    paddingHorizontal: 14,
    paddingVertical:   10,
    alignSelf:         'flex-start',
    marginBottom:      20,
  },
  crossingText: { fontSize: 13, color: '#666', fontWeight: '600' },

  /* block / report */
  dangerZone: { gap: 10, marginBottom: 8, marginTop: 8 },
  dangerBtn: {
    paddingVertical:   14,
    borderRadius:      14,
    backgroundColor:   'rgba(0,0,0,0.04)',
    alignItems:        'center',
  },
  dangerBtnText: { fontSize: 14, fontWeight: '600', color: '#888' },

  /* action bar */
  actionBar: {
    flexDirection:     'row',
    justifyContent:    'center',
    alignItems:        'center',
    gap:               14,
    paddingHorizontal: 20,
    paddingTop:        14,
    paddingBottom:     Platform.OS === 'ios' ? 4 : 14,
    backgroundColor:   BG,
  },
  actionBtn: {
    width:        62,
    height:       62,
    borderRadius: 18,
    alignItems:   'center',
    justifyContent: 'center',
    shadowColor:  '#000',
    shadowOpacity: 0.12,
    shadowRadius:  6,
    shadowOffset:  { width: 0, height: 3 },
    elevation:     3,
  },
  actionIcon: { fontSize: 26, color: '#fff' },

  /* looking-for label beneath buttons */
  lookingForLabel: {
    textAlign:     'center',
    fontSize:      13,
    color:         '#888',
    fontWeight:    '500',
    paddingBottom: Platform.OS === 'ios' ? 10 : 16,
    backgroundColor: BG,
  },
});
