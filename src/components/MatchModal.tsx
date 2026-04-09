/**
 * MatchModal.tsx
 *
 * Full-screen animated overlay shown when two users match each other.
 *
 * Fixes applied:
 *  - Removed `uid` usage — `matchId` now passed as explicit prop from the API response
 *  - Avatar fallback uses remote placeholder instead of broken local asset
 *  - Fixed Animated.spring TypeScript signature (useNativeDriver only, no bounciness)
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { UserProfile, ChatStackParamList } from '../types';

interface Props {
  myProfile:   UserProfile;
  matchedUser: UserProfile;
  /** Real matchId returned by the API — used to open the correct chat */
  matchId:     string;
  onClose:     () => void;
}

const { width } = Dimensions.get('window');

// Fixed confetti positions (avoid Math.random() in render — causes re-render flicker)
const CONFETTI_DOTS = [
  { color: '#FF4B6E', top: 12, left: 20 },
  { color: '#FFD700', top: 30, left: width * 0.22 },
  { color: '#00D4FF', top: 10, left: width * 0.44 },
  { color: '#FF6B35', top: 35, left: width * 0.66 },
  { color: '#C171EE', top: 15, left: width * 0.82 },
];

export default function MatchModal({ myProfile, matchedUser, matchId, onClose }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<ChatStackParamList>>();
  const scale   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue:        1,
        useNativeDriver: true,
        tension:         60,
        friction:        7,
      }),
      Animated.timing(opacity, {
        toValue:        1,
        duration:       300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSendMessage = () => {
    onClose();
    // Use the real matchId returned by POST /matches/like/:userId
    navigation.navigate('Chat', { matchId, otherUser: matchedUser });
  };

  const avatarUri = (url: string) =>
    url || 'https://placehold.co/220x220/eee/ccc?text=?';

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>

          {/* Confetti dots (decorative, fixed positions) */}
          <View style={styles.confetti} pointerEvents="none">
            {CONFETTI_DOTS.map((d, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: d.color, top: d.top, left: d.left }]}
              />
            ))}
          </View>

          <Text style={styles.matchLabel}>It's a Match! 🎉</Text>
          <Text style={styles.subtitle}>
            You and {matchedUser.displayName} liked each other!
          </Text>

          {/* Avatar pair */}
          <View style={styles.avatarRow}>
            <Image
              source={{ uri: avatarUri(myProfile.photoURL) }}
              style={[styles.avatar, styles.avatarLeft]}
            />
            <View style={styles.heartBubble}>
              <Text style={styles.heartIcon}>❤</Text>
            </View>
            <Image
              source={{ uri: avatarUri(matchedUser.photoURL) }}
              style={[styles.avatar, styles.avatarRight]}
            />
          </View>

          <TouchableOpacity style={styles.messageBtn} onPress={handleSendMessage}>
            <Text style={styles.messageBtnText}>Send a Message</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.skipBtn}>
            <Text style={styles.skipText}>Keep exploring</Text>
          </TouchableOpacity>

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    overflow: 'hidden',
  },
  confetti: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  dot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  matchLabel: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FF4B6E',
    marginTop: 24,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#eee',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarLeft:  { marginRight: -18, zIndex: 1 },
  avatarRight: { marginLeft:  -18 },
  heartBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF4B6E',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: '#FF4B6E',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 5,
  },
  heartIcon: { fontSize: 22, color: '#fff' },
  messageBtn: {
    backgroundColor: '#FF4B6E',
    borderRadius: 30,
    paddingVertical: 15,
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  messageBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipBtn:  { paddingVertical: 8 },
  skipText: { fontSize: 15, color: '#aaa', fontWeight: '500' },
});
