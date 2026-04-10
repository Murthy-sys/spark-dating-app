/**
 * HomeScreen.tsx — "Crossed Paths" feed (Happn-style)
 *
 * Modern horizontal card slider where the focused card is enlarged.
 * Tap a card to see full details. Like, crush (star), or pass from cards.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Animated,
  Dimensions,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { getCrossedPathsUsers, getNearbyUsers, likeUser, passUser, starUser } from '../../services/matchingService';
import { useLocation } from '../../hooks/useLocation';
import MatchModal from '../../components/MatchModal';
import UserDetailModal from '../../components/UserDetailModal';
import { UserProfile } from '../../types';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.72;
const CARD_SPACING = 12;
const SIDE_SPACING = (width - CARD_WIDTH) / 2;

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

  const scrollX = useRef(new Animated.Value(0)).current;

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
      const { isMatch, matchId } = await likeUser(item.user._id, isCrush ? 'crushed' : 'liked');
      handleRemove(item.user._id);
      setDetailItem(null);
      if (isMatch && matchId) handleMatch(item.user, matchId);
    } catch {
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

      {feed.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🚶</Text>
          <Text style={styles.emptyTitle}>No one nearby yet</Text>
          <Text style={styles.emptyText}>
            Go explore! People will appear here when they are within your distance range.
          </Text>
        </View>
      ) : (
        <Animated.FlatList
          data={safeFeed}
          keyExtractor={(item) => item.user._id}
          horizontal
          pagingEnabled={false}
          snapToInterval={CARD_WIDTH + CARD_SPACING}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: SIDE_SPACING,
            paddingTop: 16,
            paddingBottom: 80,
          }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          renderItem={({ item, index }: { item: FeedItem; index: number }) => {
            const inputRange = [
              (index - 1) * (CARD_WIDTH + CARD_SPACING),
              index * (CARD_WIDTH + CARD_SPACING),
              (index + 1) * (CARD_WIDTH + CARD_SPACING),
            ];
            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [0.88, 1, 0.88],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.6, 1, 0.6],
              extrapolate: 'clamp',
            });

            const crossedLabel =
              item.crossingCount > 1
                ? `${item.crossingCount}× crossed`
                : 'Nearby now';

            return (
              <Animated.View
                style={[
                  styles.card,
                  {
                    transform: [{ scale }],
                    opacity,
                    marginRight: CARD_SPACING,
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.95}
                  onPress={() => setDetailItem(item)}
                  style={styles.cardTouchable}
                >
                  <Image
                    source={
                      item.user.photoURL
                        ? { uri: item.user.photoURL }
                        : { uri: 'https://placehold.co/400x600/eee/ccc?text=No+Photo' }
                    }
                    style={styles.cardPhoto}
                  />

                  {/* Gradient overlay */}
                  <View style={styles.cardGradient} />

                  {/* Crossed badge */}
                  <View style={styles.crossedBadge}>
                    <Text style={styles.crossedText}>🚶 {crossedLabel}</Text>
                  </View>

                  {/* Info */}
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>
                      {item.user.displayName}, {item.user.age}
                    </Text>
                    {item.user.occupation ? (
                      <Text style={styles.cardOccupation}>{item.user.occupation}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>

                {/* Action Buttons */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.passBtn}
                    onPress={() => handlePass(item)}
                  >
                    <Text style={styles.passIcon}>✕</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.starBtn}
                    onPress={() => handleStar(item)}
                  >
                    <Text style={styles.starIcon}>⭐</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.likeBtn}
                    onPress={() => handleLike(item)}
                  >
                    <Text style={styles.likeIcon}>❤</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            );
          }}
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

  // Card
  card: {
    width: CARD_WIDTH,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  cardTouchable: {
    width: '100%',
  },
  cardPhoto: {
    width: '100%',
    height: CARD_WIDTH * 1.35,
    resizeMode: 'cover',
    backgroundColor: '#eee',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: CARD_WIDTH * 0.55,
    backgroundColor: 'transparent',
    // Simulated gradient using shadow
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  crossedBadge: {
    position: 'absolute',
    top: 12,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  crossedText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  cardInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cardName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  cardOccupation: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },

  // Actions
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
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
