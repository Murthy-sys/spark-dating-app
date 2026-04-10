/**
 * LikesScreen.tsx  –  Light / white theme
 *
 * - White background (consistent with rest of the app)
 * - No TopBar (bell + avatar now live in the global tab header)
 * - No Boost button
 * - Large "Likes" heading in dark text
 * - 2-column photo grid with white cards + shadows
 * - Empty state with pink CTAs
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { getLikesReceived, likeUser } from '../../services/matchingService';
import { UserProfile } from '../../types';
import MatchModal from '../../components/MatchModal';
import UserDetailModal from '../../components/UserDetailModal';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;   // 2-col grid: 16px side padding + 16px gap

const BG    = '#FFFFFF';
const CARD  = '#FFFFFF';
const BRAND = '#FF4B6E';
const DARK  = '#1A1A1A';
const GRAY  = '#888888';
const LIGHT = '#F8F8F8';

type MatchState = { user: UserProfile; matchId: string } | null;

// ─── Like Card (grid item) ────────────────────────────────────────────────────

function LikeCard({
  item,
  onPress,
  onLike,
  onPass,
}: {
  item: UserProfile;
  onPress: () => void;
  onLike: () => void;
  onPass: () => void;
}) {
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.92}>
      {item.photoURL ? (
        <Image source={{ uri: item.photoURL }} style={s.cardPhoto} />
      ) : (
        <View style={[s.cardPhoto, s.cardNoPhoto]}>
          <Text style={{ color: GRAY, fontSize: 13 }}>No photo</Text>
        </View>
      )}

      {/* gradient overlay for name readability */}
      <View style={s.cardOverlay} />

      {/* name + age */}
      <View style={s.cardInfo}>
        <Text style={s.cardName} numberOfLines={1}>
          {item.displayName}, {item.age}
        </Text>
      </View>

      {/* pass / like buttons */}
      <View style={s.cardActions}>
        <TouchableOpacity style={s.cardPassBtn} onPress={onPass} activeOpacity={0.8}>
          <Text style={s.cardPassIcon}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.cardLikeBtn} onPress={onLike} activeOpacity={0.8}>
          <Text style={s.cardLikeIcon}>♥</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onImprove }: { onImprove: () => void }) {
  return (
    <View style={s.emptyWrap}>
      <Text style={s.catEmoji}>🐱</Text>
      <Text style={s.emptyTitle}>No Likes yet</Text>
      <Text style={s.emptyText}>
        Like people on the nearby screen to increase your chances!
      </Text>

      <View style={s.ctaWrap}>
        <TouchableOpacity style={s.ctaPrimary} onPress={onImprove} activeOpacity={0.85}>
          <Text style={s.ctaPrimaryText}>Improve my profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LikesScreen() {
  const profile    = useAuthStore((s) => s.profile);
  const navigation = useNavigation<any>();

  const [likers,     setLikers]     = useState<UserProfile[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [matchState, setMatchState] = useState<MatchState>(null);
  const [detailUser, setDetailUser] = useState<UserProfile | null>(null);

  const load = useCallback(() => {
    if (!profile) return;
    getLikesReceived()
      .then((results) => setLikers(results.map((r) => r.from)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile?._id]);

  useEffect(() => { load(); }, [load]);

  const handleLikeBack = async (other: UserProfile) => {
    const { isMatch, matchId } = await likeUser(other._id, 'liked');
    setLikers((prev) => prev.filter((u) => u._id !== other._id));
    setDetailUser(null);
    if (isMatch && matchId) setMatchState({ user: other, matchId });
  };

  const handlePass = async (other: UserProfile) => {
    await likeUser(other._id, 'passed').catch(() => {});
    setLikers((prev) => prev.filter((u) => u._id !== other._id));
    setDetailUser(null);
  };

  const goToProfile = () => navigation.navigate('Profile');

  // ── loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root}>

      {/* ── Heading ── */}
      <View style={s.headingWrap}>
        <Text style={s.heading}>Likes</Text>
        {likers.length > 0 && (
          <View style={s.countPill}>
            <Text style={s.countText}>{likers.length}</Text>
          </View>
        )}
      </View>

      {/* ── Sub-line ── */}
      <Text style={s.subLine}>People who liked your profile</Text>

      {/* ── Content ── */}
      {likers.length === 0 ? (
        <EmptyState onImprove={goToProfile} />
      ) : (
        <FlatList
          data={likers}
          keyExtractor={(u) => u._id}
          numColumns={2}
          contentContainerStyle={s.grid}
          columnWrapperStyle={s.row}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <LikeCard
              item={item}
              onPress={() => setDetailUser(item)}
              onLike={() => handleLikeBack(item)}
              onPass={() => handlePass(item)}
            />
          )}
        />
      )}

      {/* User detail modal */}
      {detailUser && (
        <UserDetailModal
          user={detailUser}
          visible
          onClose={() => setDetailUser(null)}
          onLike={() => handleLikeBack(detailUser)}
          onPass={() => handlePass(detailUser)}
          onStar={() => handleLikeBack(detailUser)}
        />
      )}

      {/* Match modal */}
      {matchState && profile && (
        <MatchModal
          myProfile={profile}
          matchedUser={matchState.user}
          matchId={matchState.matchId}
          onClose={() => setMatchState(null)}
        />
      )}

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  center: { alignItems: 'center', justifyContent: 'center' },

  /* ── heading ── */
  headingWrap: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 20,
    paddingTop:  Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 2,
    gap: 10,
  },
  heading: {
    fontSize:      40,
    fontWeight:    '800',
    color:         DARK,
    letterSpacing: -0.5,
  },
  countPill: {
    backgroundColor: BRAND,
    borderRadius:    20,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  countText: {
    color: '#fff', fontWeight: '700', fontSize: 14,
  },
  subLine: {
    fontSize: 14,
    color:    GRAY,
    paddingHorizontal: 20,
    marginBottom: 16,
  },

  /* ── grid ── */
  grid: { paddingHorizontal: 16, paddingBottom: 100 },
  row:  { justifyContent: 'space-between', marginBottom: 16 },

  /* ── like card ── */
  card: {
    width:         CARD_W,
    height:        CARD_W * 1.4,
    borderRadius:  18,
    overflow:      'hidden',
    backgroundColor: CARD,
    // iOS shadow
    shadowColor:   '#000',
    shadowOpacity: 0.10,
    shadowOffset:  { width: 0, height: 4 },
    shadowRadius:  10,
    // Android
    elevation: 4,
  },
  cardPhoto: {
    width: '100%', height: '100%',
    resizeMode: 'cover',
  },
  cardNoPhoto: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: LIGHT,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  cardInfo: {
    position: 'absolute', bottom: 52,
    left: 10, right: 10,
  },
  cardName: {
    color: '#fff', fontWeight: '700', fontSize: 14,
  },
  cardActions: {
    position: 'absolute', bottom: 10,
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  cardPassBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardPassIcon: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardLikeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: BRAND,
    alignItems: 'center', justifyContent: 'center',
  },
  cardLikeIcon: { color: '#fff', fontSize: 16 },

  /* ── empty state ── */
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 60,
  },
  catEmoji:   { fontSize: 80, marginBottom: 20 },
  emptyTitle: {
    fontSize: 24, fontWeight: '800',
    color: DARK, marginBottom: 10,
  },
  emptyText: {
    fontSize: 15, color: GRAY,
    textAlign: 'center', lineHeight: 22,
    marginBottom: 36,
  },
  ctaWrap: { width: '100%' },
  ctaPrimary: {
    backgroundColor: BRAND,
    borderRadius:    30,
    paddingVertical: 18,
    alignItems:      'center',
  },
  ctaPrimaryText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
