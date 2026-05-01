/**
 * ChatListScreen.tsx — List of mutual matches
 *
 * Fixes applied:
 *  - `getMatches()` takes no arguments (was wrongly called with profile.uid)
 *  - Backend populates `users` array already — we extract otherUser from match.users
 *    instead of making a second per-match API call (eliminates N+1 requests)
 *  - keyExtractor uses `match._id` (not `match.id`)
 *  - unreadCount lookup uses `profile._id` (not `profile.uid`)
 *  - navigate passes `match._id` (not `match.id`)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import { getMatches } from '../../services/matchingService';
import { Match, UserProfile, ChatStackParamList } from '../../types';
import UserAvatar from '../../components/UserAvatar';

type Nav = NativeStackNavigationProp<ChatStackParamList, 'MatchList'>;

export default function ChatListScreen() {
  const navigation = useNavigation<Nav>();
  const profile    = useAuthStore((s) => s.profile);

  const [matches, setMatches]       = useState<Match[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMatches = useCallback(async () => {
    try {
      // getMatches() needs no arguments — backend filters by JWT user
      const data = await getMatches();
      setMatches(data);
    } catch (err) {
      console.error('Failed to load matches:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  const onRefresh = () => { setRefreshing(true); loadMatches(); };

  const formatTime = (isoDate?: string | null): string => {
    if (!isoDate) return '';
    const d    = new Date(isoDate);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000)    return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString();
  };

  /**
   * Returns a "reply due" label when the *current* user owes a reply.
   * The user owes a reply when lastSenderId is the OTHER user.
   */
  const replyDueLabel = (match: Match): string | null => {
    if (!profile || !match.lastSenderId || !match.replyDueAt) return null;
    if (match.lastSenderId === profile._id) return null; // I sent last
    const ms = new Date(match.replyDueAt).getTime() - Date.now();
    if (ms <= 0) return 'Reply overdue';
    const h = Math.ceil(ms / 3_600_000);
    return h <= 1 ? 'Reply due in <1h' : `Reply due in ${h}h`;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF4B6E" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {matches.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <Text style={styles.emptyText}>
            Like people nearby and wait for them to like you back!
          </Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m._id}              // ← fixed: was match.id
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF4B6E" />
          }
          renderItem={({ item: match }) => {
            // Backend populates `users` — filter to get the OTHER user
            const otherUser = match.users.find((u) => u._id !== profile?._id);
            if (!otherUser) return null;

            const unread = match.unreadCount?.[profile!._id] ?? 0;

            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate('Chat', {
                    matchId:   match._id,
                    otherUser: otherUser,
                  })
                }
              >
                <View style={styles.avatarContainer}>
                  <UserAvatar
                    user={otherUser}
                    style={styles.avatar}
                    avatarSize={120}
                  />
                  {unread > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.info}>
                  <View style={styles.infoTop}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>{otherUser.displayName}</Text>
                      {otherUser.verification?.status === 'verified' && (
                        <Text style={styles.verifiedTick}>✓</Text>
                      )}
                    </View>
                    <Text style={styles.time}>{formatTime(match.lastMessageAt)}</Text>
                  </View>
                  {otherUser.occupation ? (
                    <Text style={styles.occupation} numberOfLines={1}>{otherUser.occupation}</Text>
                  ) : null}
                  <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
                    {match.lastMessage || 'Say hello! 👋'}
                  </Text>
                  {replyDueLabel(match) && (
                    <View
                      style={[
                        styles.replyDuePill,
                        replyDueLabel(match) === 'Reply overdue' && styles.replyDuePillOverdue,
                      ]}
                    >
                      <Text
                        style={[
                          styles.replyDueText,
                          replyDueLabel(match) === 'Reply overdue' && styles.replyDueTextOverdue,
                        ]}
                      >
                        ⏱ {replyDueLabel(match)}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:      { padding: 12, paddingBottom: 80, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  avatarContainer: { position: 'relative' },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#eee',
    borderWidth: 2,
    borderColor: '#FF4B6E',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF4B6E',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  info:       { flex: 1, marginLeft: 14 },
  infoTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nameRow:    { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8, gap: 6 },
  name:       { fontSize: 16, fontWeight: '700', color: '#1a1a1a', flexShrink: 1 },
  verifiedTick: {
    fontSize: 11, fontWeight: '900', color: '#fff', backgroundColor: '#22C55E',
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8, overflow: 'hidden',
  },
  time:       { fontSize: 11, color: '#bbb' },
  occupation: { fontSize: 12, color: '#aaa', marginTop: 1 },
  preview:    { fontSize: 13, color: '#999', marginTop: 3 },
  previewUnread: { color: '#1a1a1a', fontWeight: '600' },

  // Anti-ghosting reply-timer pill
  replyDuePill: {
    alignSelf:         'flex-start',
    marginTop:         6,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      10,
    backgroundColor:   '#FFF4E5',
  },
  replyDuePillOverdue: { backgroundColor: '#FFE4E4' },
  replyDueText:        { fontSize: 11, fontWeight: '700', color: '#B25E00' },
  replyDueTextOverdue: { color: '#C0223A' },
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
