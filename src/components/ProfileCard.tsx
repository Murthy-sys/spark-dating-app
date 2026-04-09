/**
 * ProfileCard.tsx
 *
 * Grid card used in the Home (crossed paths) feed.
 * Shows photo, name, age, crossing count, and like/pass/crush actions.
 *
 * Fixes applied:
 *  - Removed `uid` usage — uses `_id` exclusively (matches MongoDB response)
 *  - `onMatch` now receives matchId from the API so MatchModal can navigate correctly
 *  - Removed unused `formatDistance` import
 *  - Placeholder image is handled gracefully without requiring a local asset
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { UserProfile } from '../types';
import { likeUser, passUser } from '../services/matchingService';

interface Props {
  user:     UserProfile;
  crossing: { crossingCount: number; crossedAt: string };
  onRemove: (userId: string) => void;
  /** Called on mutual match — passes user + real matchId from API */
  onMatch:  (user: UserProfile, matchId: string) => void;
}

const CARD_WIDTH = (Dimensions.get('window').width - 30) / 2;

export default function ProfileCard({ user, crossing, onRemove, onMatch }: Props) {
  const [liking, setLiking] = useState(false);

  // Defensive: fallback values for missing/null fields
  const displayName = user.displayName || 'Unknown';
  const age = typeof user.age === 'number' && user.age > 0 ? user.age : '-';
  const occupation = user.occupation || '';
  const photoURL =
    typeof user.photoURL === 'string' && user.photoURL.trim() !== ''
      ? user.photoURL
      : 'https://placehold.co/400x500/eee/ccc?text=No+Photo';

  const handleLike = async (isCrush = false) => {
    if (liking) return;
    setLiking(true);
    try {
      const { isMatch, matchId } = await likeUser(user._id, isCrush ? 'crushed' : 'liked');
      onRemove(user._id);
      if (isMatch && matchId) onMatch(user, matchId);
    } catch {
      Alert.alert('Error', 'Could not send like. Please try again.');
    } finally {
      setLiking(false);
    }
  };

  const handlePass = async () => {
    onRemove(user._id);
    await passUser(user._id).catch(() => {/* silent — pass is best-effort */});
  };

  const crossedLabel =
    crossing.crossingCount > 1
      ? `${crossing.crossingCount}× crossed paths`
      : 'Crossed paths';

  return (
    <View style={styles.card}>
      {/* Photo */}
      <Image
        source={{ uri: photoURL }}
        style={styles.photo}
        onError={() => {}}
      />

      {/* Crossed paths badge */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>🚶 {crossedLabel}</Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}, {age}
        </Text>
        {occupation ? (
          <Text style={styles.occupation} numberOfLines={1}>
            {occupation}
          </Text>
        ) : null}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.passBtn} onPress={handlePass} disabled={liking}>
          <Text style={styles.passIcon}>✕</Text>
        </TouchableOpacity>

        {/* Crush (super-like) */}
        <TouchableOpacity style={styles.crushBtn} onPress={() => handleLike(true)} disabled={liking}>
          <Text style={styles.crushIcon}>⭐</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.likeBtn} onPress={() => handleLike(false)} disabled={liking}>
          <Text style={styles.likeIcon}>❤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  photo: {
    width: '100%',
    height: CARD_WIDTH * 1.25,
    resizeMode: 'cover',
    backgroundColor: '#eee',
  },
  badge: {
    position: 'absolute',
    top: 10,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText:  { color: '#fff', fontSize: 11, fontWeight: '600' },
  info:       { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 },
  name:       { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  occupation: { fontSize: 12, color: '#999', marginTop: 2 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  passBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#f5f5f5',
    alignItems: 'center', justifyContent: 'center',
  },
  passIcon:  { fontSize: 14, color: '#aaa' },
  crushBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#FFF8E1',
    alignItems: 'center', justifyContent: 'center',
  },
  crushIcon: { fontSize: 16 },
  likeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#FF4B6E',
    alignItems: 'center', justifyContent: 'center',
  },
  likeIcon: { fontSize: 16, color: '#fff' },
});
