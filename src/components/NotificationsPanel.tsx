/**
 * NotificationsPanel.tsx
 *
 * Slide-down panel that shows recent likes (people who liked your profile).
 * Opened by tapping the bell icon in the global tab header.
 *
 * iOS-safe: no fontStyle italic, no heavy fontWeight on italic text.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  Modal,
  Animated,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLikesReceived } from '../services/matchingService';
import { UserProfile } from '../types';

const { height: SCREEN_H } = Dimensions.get('window');
const PANEL_H = SCREEN_H * 0.72;   // panel takes ~72% of screen height

const BG     = '#FFFFFF';
const BRAND  = '#FF4B6E';
const DARK   = '#1A1A1A';
const GRAY   = '#888888';
const BORDER = '#F0F0F0';
const LIGHT  = '#F8F8F8';

interface NotificationItem {
  id:   string;
  user: UserProfile;
  type: 'like';
  time: string;   // will be 'Recently' when backend doesn't send createdAt
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function NotificationsPanel({ visible, onClose }: Props) {
  const [items,   setItems]   = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Animate panel sliding down from top
  const slideAnim = useRef(new Animated.Value(-PANEL_H)).current;

  useEffect(() => {
    if (visible) {
      loadNotifications();
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 20,
        stiffness: 180,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -PANEL_H,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const likes = await getLikesReceived();
      const mapped: NotificationItem[] = likes.map((l: any, i: number) => ({
        id:   l.from._id ?? String(i),
        user: l.from,
        type: 'like' as const,
        time: formatTime(l.createdAt),   // undefined → 'Recently'
      }));
      setItems(mapped);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  function formatTime(isoDate?: string): string {
    if (!isoDate) return 'Recently';
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins  = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days  = Math.floor(diff / 86_400_000);
    if (mins  < 1)  return 'Just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <View style={st.notifRow}>
      {/* Avatar */}
      <View style={st.avatarWrap}>
        {item.user.photoURL ? (
          <Image source={{ uri: item.user.photoURL }} style={st.avatar} />
        ) : (
          <View style={[st.avatar, st.avatarFallback]}>
            <Text style={st.avatarInitial}>
              {item.user.displayName?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        )}
        <View style={st.likeIcon}>
          <Text style={{ fontSize: 10 }}>♥</Text>
        </View>
      </View>

      {/* Text */}
      <View style={st.notifInfo}>
        <Text style={st.notifName} numberOfLines={1}>
          {item.user.displayName}
          {item.user.age ? `, ${item.user.age}` : ''}
        </Text>
        <Text style={st.notifMsg}>liked your profile</Text>
      </View>

      {/* Time */}
      <Text style={st.notifTime}>{item.time}</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={st.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Slide-down panel */}
      <Animated.View
        style={[
          st.panel,
          { transform: [{ translateY: slideAnim }] },
        ]}
        pointerEvents="box-none"
      >
        <SafeAreaView style={{ flex: 1 }}>
          {/* Handle */}
          <View style={st.handleWrap}>
            <View style={st.handle} />
          </View>

          {/* Header row */}
          <View style={st.panelHeader}>
            <Text style={st.panelTitle}>Notifications</Text>
            <TouchableOpacity onPress={onClose} style={st.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={DARK} />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={st.divider} />

          {/* Content */}
          {loading ? (
            <View style={st.center}>
              <ActivityIndicator size="large" color={BRAND} />
            </View>
          ) : items.length === 0 ? (
            <View style={st.center}>
              <Text style={{ fontSize: 44, marginBottom: 14 }}>🔔</Text>
              <Text style={st.emptyTitle}>No notifications yet</Text>
              <Text style={st.emptyText}>
                When someone likes your profile,{'\n'}you'll see it here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              ItemSeparatorComponent={() => <View style={st.separator} />}
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  panel: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          PANEL_H,
    backgroundColor: BG,
    borderBottomLeftRadius:  24,
    borderBottomRightRadius: 24,
    // iOS shadow
    shadowColor:   '#000',
    shadowOpacity: 0.18,
    shadowOffset:  { width: 0, height: 6 },
    shadowRadius:  16,
    elevation: 12,
    overflow: 'hidden',
  },

  handleWrap: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 28 : 12,
    paddingBottom: 6,
  },
  handle: {
    width: 36, height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
  },

  panelHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   12,
  },
  panelTitle: {
    fontSize: 20, fontWeight: '800', color: DARK,
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: LIGHT,
    alignItems: 'center', justifyContent: 'center',
  },

  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: 0,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyTitle: {
    fontSize: 18, fontWeight: '700', color: DARK, marginBottom: 8,
  },
  emptyText: {
    fontSize: 14, color: GRAY, textAlign: 'center', lineHeight: 20,
  },

  /* ── notification row ── */
  notifRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 20,
    paddingVertical:   14,
  },

  avatarWrap: { position: 'relative', marginRight: 14 },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    resizeMode: 'cover',
  },
  avatarFallback: {
    backgroundColor: '#F0F0F0',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '700', color: GRAY },
  likeIcon: {
    position:        'absolute',
    bottom:          -2,
    right:           -2,
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: BRAND,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1.5,
    borderColor:     '#fff',
  },

  notifInfo: { flex: 1 },
  notifName: {
    fontSize: 15, fontWeight: '700', color: DARK, marginBottom: 2,
  },
  notifMsg: {
    fontSize: 13, color: GRAY,
  },
  notifTime: {
    fontSize: 12, color: '#BBBBBB', marginLeft: 8,
  },

  separator: {
    height: 1,
    backgroundColor: BORDER,
    marginLeft: 86,   // align with text (avatar 52 + margin 14 + padding 20)
  },
});
