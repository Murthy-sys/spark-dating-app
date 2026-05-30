/**
 * HomeScreen.tsx — Nearby / Crossed-Paths discovery via a modern swipeable
 * card stack (see ProfileCardStack). Swipe right = like, left = pass,
 * up = crush. Tap a card to open the full detail modal.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
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
  isSubscriptionRequired,
} from '../../services/matchingService';
import { useLocation } from '../../hooks/useLocation';
import MatchModal from '../../components/MatchModal';
import UserDetailModal from '../../components/UserDetailModal';
import ProfileCardStack from '../../components/ProfileCardStack';
import PaywallSheet from '../../components/PaywallSheet';
import { UserProfile } from '../../types';

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
  const [paywall, setPaywall]       = useState<'star' | null>(null);

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
    try {
      const { isMatch, matchId } = await likeUser(
        item.user._id,
        isCrush ? 'crushed' : 'liked',
      );
      handleRemove(item.user._id);
      setDetailItem(null);
      if (isMatch && matchId) handleMatch(item.user, matchId);
    } catch (err) {
      Alert.alert('Error', 'Could not send like. Please try again.');
    }
  };

  const handlePass = async (item: FeedItem) => {
    handleRemove(item.user._id);
    setDetailItem(null);
    await passUser(item.user._id).catch(() => {});
  };

  const handleStar = async (item: FeedItem) => {
    try {
      await starUser(item.user._id);
      await handleLike(item, true);
    } catch (err: any) {
      if (isSubscriptionRequired(err)) {
        setDetailItem(null);
        setPaywall('star');
        return;
      }
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

      {feed.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🚶</Text>
          <Text style={styles.emptyTitle}>No one nearby yet</Text>
          <Text style={styles.emptyText}>
            Go explore! People will appear here when they are within your distance range.
          </Text>
        </View>
      ) : (
        <ProfileCardStack
          items={safeFeed}
          disabled={false}
          onTap={(item) => setDetailItem(item)}
          onLike={(item) => handleLike(item)}
          onPass={(item) => handlePass(item)}
          onStar={(item) => handleStar(item)}
        />
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

      {/* Paywall (premium gate for stars / likes-received) */}
      <PaywallSheet
        visible={paywall !== null}
        feature={paywall ?? 'star'}
        onClose={() => setPaywall(null)}
      />
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

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#333', marginBottom: 10 },
  emptyText:  { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22 },
});
