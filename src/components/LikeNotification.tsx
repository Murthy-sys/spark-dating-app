/**
 * LikeNotification.tsx
 *
 * Toast-style in-app notification that appears when someone likes you.
 * Auto-dismisses after 3 seconds. Tap to go to Likes tab.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { connectSocket } from '../services/chatService';

const { width } = Dimensions.get('window');

interface LikeEvent {
  from: { _id: string; displayName: string; photoURL?: string };
  status: string;
}

interface Props {
  onTap?: () => void;
}

export default function LikeNotification({ onTap }: Props) {
  const [notification, setNotification] = useState<LikeEvent | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((evt: LikeEvent) => {
    setNotification(evt);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      Animated.timing(translateY, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setNotification(null));
    }, 3000);
  }, [translateY]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    connectSocket().then((s) => {
      const handler = (evt: LikeEvent) => show(evt);
      s.on('new_like', handler);
      cleanup = () => s.off('new_like', handler);
    }).catch(() => {});

    return () => {
      cleanup?.();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [show]);

  if (!notification) return null;

  const label =
    notification.status === 'crushed'
      ? `⭐ ${notification.from.displayName} sent you a crush!`
      : `❤ ${notification.from.displayName} liked you!`;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <TouchableOpacity
        style={styles.inner}
        activeOpacity={0.9}
        onPress={onTap}
      >
        <Image
          source={{
            uri: notification.from.photoURL || 'https://placehold.co/80x80/eee/ccc?text=?',
          }}
          style={styles.avatar}
        />
        <View style={styles.textWrap}>
          <Text style={styles.title}>New Like!</Text>
          <Text style={styles.body} numberOfLines={1}>{label}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#FF4B6E',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eee',
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF4B6E',
  },
  body: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
  },
});
