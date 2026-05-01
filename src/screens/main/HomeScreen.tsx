/**
 * HomeScreen.tsx — Nearby / Crossed-Paths discovery via a rotatable
 * pseudo-3D sphere of profile avatars (see ProfileSphere). Tap a face
 * to open details; like / star / pass acts on the front-most profile.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import {
  getCrossedPathsUsers,
  getNearbyUsers,
  likeUser,
  passUser,
  starUser,
  getDailyStatus,
  DailyLimitError,
} from '../../services/matchingService';
import { useLocation } from '../../hooks/useLocation';
import MatchModal from '../../components/MatchModal';
import UserDetailModal from '../../components/UserDetailModal';
import ProfileSphere from '../../components/ProfileSphere';
import { DailyStatus, UserProfile } from '../../types';

// ─── Intent labels (mirrors backend Intent type) ─────────────────────────────
const INTENT_LABEL: Record<string, string> = {
  serious:    'Serious',
  casual:     'Casual',
  friends:    'Friends',
  networking: 'Networking',
};

function intentBadge(intent?: string | null): string | null {
  return intent ? INTENT_LABEL[intent] ?? null : null;
}

function hoursUntil(iso?: string): string {
  if (!iso) return 'soon';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'soon';
  const h = Math.ceil(ms / 3_600_000);
  return h <= 1 ? '1h' : `${h}h`;
}

const { width } = Dimensions.get('window');
const SPHERE_SIZE = Math.min(width - 24, 380);

type FeedItem  = { user: UserProfile; crossingCount: number; crossedAt: string };
type MatchState = { user: UserProfile; matchId: string } | null;

export default function HomeScreen() {
  const profile = useAuthStore((s) => s.profile);
  const { currentLocation, error: locationError } = useLocation();

  const [feed, setFeed]             = useState<FeedItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matchState, setMatchState] = useState<MatchState>(null);
  const [detailItem, setDetailItem] = useState<FeedItem | null>(null);
  const [daily, setDaily]           = useState<DailyStatus | null>(null);
  const [frontItem, setFrontItem]   = useState<FeedItem | null>(null);

  // Initial fetch of daily-pick budget; refreshed on every successful like.
  useEffect(() => {
    getDailyStatus().then(setDaily).catch(() => {});
  }, []);

  const limitReached = daily ? daily.remaining <= 0 : false;

  const loadFeed = useCallback(async () => {
    if (!profile) return;
    try {
      const radiusKm = Number(profile.settings?.maxDistance || 10);
      const nearby = await getNearbyUsers(radiusKm, 30);

      if (nearby.length > 0) {
        const mapped = nearby.map((u) => ({
          user: u,
          crossingCount: 1,
          crossedAt: new Date().toISOString(),
        }));
        setFeed(mapped);
      } else {
        const crossed = await getCrossedPathsUsers();
        setFeed(crossed);
      }
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?._id]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  const onRefresh = () => { setRefreshing(true); loadFeed(); };

  const handleRemove = (userId: string) => {
    setFeed((prev) => prev.filter((item) => item.user._id !== userId));
  };

  const handleMatch = (user: UserProfile, matchId: string) => {
    setMatchState({ user, matchId });
  };

  const handleLike = async (item: FeedItem, isCrush = false) => {
    if (limitReached) {
      Alert.alert(
        'Daily picks used',
        `You've used all ${daily?.limit ?? 10} picks for today. Come back in ${hoursUntil(daily?.resetAt)}.`,
      );
      return;
    }
    try {
      const { isMatch, matchId, daily: d } = await likeUser(
        item.user._id,
        isCrush ? 'crushed' : 'liked',
      );
      if (d) setDaily(d);
      handleRemove(item.user._id);
      setDetailItem(null);
      if (isMatch && matchId) handleMatch(item.user, matchId);
    } catch (err) {
      if (err instanceof DailyLimitError) {
        // Refresh local state from server-truth so UI locks immediately
        setDaily({ used: 10, limit: 10, remaining: 0, resetAt: err.resetAt });
        Alert.alert('Daily picks used', err.message);
        return;
      }
      Alert.alert('Error', 'Could not send like. Please try again.');
    }
  };

  const handlePass = async (item: FeedItem) => {
    handleRemove(item.user._id);
    setDetailItem(null);
    await passUser(item.user._id).catch(() => {});
  };

  const handleStar = async (item: FeedItem) => {
    if (limitReached) {
      Alert.alert(
        'Daily picks used',
        `Crushes count toward your daily limit. Come back in ${hoursUntil(daily?.resetAt)}.`,
      );
      return;
    }
    try {
      await starUser(item.user._id);
      await handleLike(item, true);
    } catch {
      Alert.alert('Error', 'Could not star user.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF4B6E" />
      </View>
    );
  }

  // Defensive: filter out any invalid/null items or users
  const safeFeed = feed.filter(
    (item) => item && item.user && typeof item.user._id === 'string' && item.user._id.length > 0
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Sub-header */}
      <View style={styles.subHeader}>
        <Text style={styles.headerSub}>
          {currentLocation
            ? `${feed.length} people nearby`
            : 'Acquiring location…'}
        </Text>
        {/* Refresh button — replaces refreshControl which crashes on iOS
            when used with a horizontal FlatList */}
        <TouchableOpacity
          onPress={onRefresh}
          disabled={refreshing}
          style={styles.refreshBtn}
          activeOpacity={0.7}
        >
          {refreshing
            ? <ActivityIndicator size="small" color="#FF4B6E" />
            : <Text style={styles.refreshIcon}>↻</Text>
          }
        </TouchableOpacity>
      </View>

      {locationError ? (
        <View style={styles.locationWarning}>
          <Text style={styles.locationWarningText}>
            📍 Location access needed to find people near you.
          </Text>
        </View>
      ) : null}

      {/* Daily picks banner — anchors the no-swipe model */}
      {daily && (
        <View style={[styles.dailyBanner, limitReached && styles.dailyBannerLocked]}>
          <Text style={styles.dailyBannerText}>
            {limitReached
              ? `🔒 You've used all ${daily.limit} picks today — resets in ${hoursUntil(daily.resetAt)}`
              : `${daily.remaining} of ${daily.limit} picks left today`}
          </Text>
        </View>
      )}

      {feed.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🚶</Text>
          <Text style={styles.emptyTitle}>No one nearby yet</Text>
          <Text style={styles.emptyText}>
            Go explore! People will appear here when they are within your distance range.
          </Text>
        </View>
      ) : (
        <View style={styles.sphereWrapper}>
          <Text style={styles.sphereHint}>Drag to spin · tap a face to open</Text>

          <ProfileSphere
            items={safeFeed}
            size={SPHERE_SIZE}
            onItemTap={(item) => setDetailItem(item)}
            onFrontItemChange={setFrontItem}
          />

          {/* Front-most profile preview + actions */}
          {frontItem && (
            <View style={styles.frontPanel}>
              <View style={styles.frontInfoRow}>
                <Text style={styles.frontName} numberOfLines={1}>
                  {frontItem.user.displayName}, {frontItem.user.age}
                </Text>
                {intentBadge((frontItem.user as any).intent) && (
                  <View style={styles.intentBadge}>
                    <Text style={styles.intentBadgeText}>
                      {intentBadge((frontItem.user as any).intent)}
                    </Text>
                  </View>
                )}
              </View>
              {frontItem.user.occupation ? (
                <Text style={styles.frontOccupation} numberOfLines={1}>
                  {frontItem.user.occupation}
                </Text>
              ) : null}

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.passBtn}
                  onPress={() => handlePass(frontItem)}
                >
                  <Text style={styles.passIcon}>✕</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.starBtn, limitReached && styles.btnLocked]}
                  onPress={() => handleStar(frontItem)}
                  disabled={limitReached}
                >
                  <Text style={styles.starIcon}>⭐</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.likeBtn, limitReached && styles.btnLocked]}
                  onPress={() => handleLike(frontItem)}
                  disabled={limitReached}
                >
                  <Text style={styles.likeIcon}>❤</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* User Detail Modal */}
      {detailItem && (
        <UserDetailModal
          user={detailItem.user}
          crossing={{ crossingCount: detailItem.crossingCount, crossedAt: detailItem.crossedAt }}
          visible
          onClose={() => setDetailItem(null)}
          onLike={() => handleLike(detailItem)}
          onPass={() => handlePass(detailItem)}
          onStar={() => handleStar(detailItem)}
        />
      )}

      {/* Match Modal */}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerSub:   { fontSize: 13, color: '#999' },
  refreshBtn:  { padding: 4 },
  refreshIcon: { fontSize: 20, color: '#FF4B6E', fontWeight: '600' },
  locationWarning: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  locationWarningText: { fontSize: 13, color: '#856404', textAlign: 'center' },

  // Daily picks banner — anchors the no-swipe model
  dailyBanner: {
    backgroundColor: '#FFF0F4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  dailyBannerLocked: {
    backgroundColor: '#F0E6E8',
  },
  dailyBannerText: {
    fontSize: 13,
    color: '#FF4B6E',
    fontWeight: '600',
  },

  // Intent badge — used on the front-item panel
  intentBadge: {
    backgroundColor: 'rgba(255,75,110,0.92)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  intentBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Locked action buttons
  btnLocked: { opacity: 0.4 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#333', marginBottom: 10 },
  emptyText:  { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22 },

  // Sphere
  sphereWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 10,
  },
  sphereHint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
  },
  frontPanel: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 8,
    alignItems: 'center',
  },
  frontInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frontName: { fontSize: 20, fontWeight: '800', color: '#222' },
  frontOccupation: { fontSize: 13, color: '#777', marginTop: 2 },

  // Actions
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  passBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passIcon: { fontSize: 18, color: '#aaa' },
  starBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF8E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starIcon: { fontSize: 20 },
  likeBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FF4B6E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF4B6E',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  likeIcon: { fontSize: 22, color: '#fff' },
});
