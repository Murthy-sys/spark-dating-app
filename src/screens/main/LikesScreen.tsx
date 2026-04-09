/**
 * LikesScreen.tsx
 *
 * Fixes applied:
 *  - keyExtractor uses `u._id` (not `u.uid`)
 *  - filter uses `u._id` (not `u._id`)
 *  - MatchModal receives `matchId` prop
 *  - `MatchState` type holds user + matchId
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { getLikesReceived, likeUser } from '../../services/matchingService';
import { UserProfile } from '../../types';
import MatchModal from '../../components/MatchModal';

type MatchState = { user: UserProfile; matchId: string } | null;

export default function LikesScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [likers, setLikers]         = useState<UserProfile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [matchState, setMatchState] = useState<MatchState>(null);

  useEffect(() => {
    if (!profile) return;
    getLikesReceived()
      .then((results) => setLikers(results.map((r) => r.from)))
      .finally(() => setLoading(false));
  }, [profile?._id]);

  const handleLikeBack = async (other: UserProfile) => {
    const { isMatch, matchId } = await likeUser(other._id, 'liked');
    setLikers((prev) => prev.filter((u) => u._id !== other._id));
    if (isMatch && matchId) setMatchState({ user: other, matchId });
  };

  const handlePass = async (other: UserProfile) => {
    await likeUser(other._id, 'passed');
    setLikers((prev) => prev.filter((u) => u._id !== other._id));
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
      <View style={styles.header}>
        <Text style={styles.title}>People who liked you</Text>
        <Text style={styles.subtitle}>{likers.length} waiting for you</Text>
      </View>

      {likers.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>💝</Text>
          <Text style={styles.emptyTitle}>No likes yet</Text>
          <Text style={styles.emptyText}>
            Like people on the nearby screen to increase your chances!
          </Text>
        </View>
      ) : (
        <FlatList
          data={likers}
          keyExtractor={(u) => u._id}   // ← fixed: was u.uid
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Image source={{ uri: item.photoURL || undefined }} style={styles.photo} />
              <View style={styles.info}>
                <Text style={styles.name}>{item.displayName}, {item.age}</Text>
                {item.occupation ? (
                  <Text style={styles.occupation}>{item.occupation}</Text>
                ) : null}
                {item.bio ? (
                  <Text style={styles.bio} numberOfLines={2}>{item.bio}</Text>
                ) : null}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.passBtn]}
                  onPress={() => handlePass(item)}
                >
                  <Text style={styles.passBtnText}>✕</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.likeBtn]}
                  onPress={() => handleLikeBack(item)}
                >
                  <Text style={styles.likeBtnText}>❤</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {matchState && profile && (
        <MatchModal
          myProfile={profile}
          matchedUser={matchState.user}
          matchId={matchState.matchId}          // ← fixed: real matchId from API
          onClose={() => setMatchState(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title:     { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  subtitle:  { fontSize: 14, color: '#999', marginTop: 2 },
  list:      { padding: 12, gap: 12, paddingBottom: 80 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  photo:      { width: 70, height: 70, borderRadius: 35, backgroundColor: '#eee' },
  info:       { flex: 1, marginHorizontal: 12 },
  name:       { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  occupation: { fontSize: 13, color: '#888', marginTop: 2 },
  bio:        { fontSize: 13, color: '#999', marginTop: 4 },
  actions:    { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passBtn:      { backgroundColor: '#f5f5f5' },
  passBtnText:  { fontSize: 16, color: '#999' },
  likeBtn:      { backgroundColor: '#FF4B6E' },
  likeBtnText:  { fontSize: 16, color: '#fff' },
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
