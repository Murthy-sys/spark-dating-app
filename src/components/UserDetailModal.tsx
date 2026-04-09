/**
 * UserDetailModal.tsx
 *
 * Full-screen modal showing a user's detail profile with swipeable photos,
 * bio, age, occupation, and action buttons (pass, star, like).
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StatusBar,
} from 'react-native';
import { UserProfile } from '../types';

const { width, height } = Dimensions.get('window');

interface Props {
  user: UserProfile;
  crossing?: { crossingCount: number; crossedAt: string };
  visible: boolean;
  onClose: () => void;
  onLike: () => void;
  onPass: () => void;
  onStar: () => void;
}

export default function UserDetailModal({
  user,
  crossing,
  visible,
  onClose,
  onLike,
  onPass,
  onStar,
}: Props) {
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = (user.photos?.length ? user.photos : user.photoURL ? [user.photoURL] : []).filter(Boolean);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setPhotoIndex(idx);
  };

  const crossedLabel = crossing
    ? crossing.crossingCount > 1
      ? `${crossing.crossingCount}× crossed paths`
      : 'Crossed paths'
    : null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent presentationStyle="fullScreen">
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Photo Carousel */}
        <View style={styles.photoContainer}>
          {photos.length > 0 ? (
            <FlatList
              data={photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item }) => (
                <View style={styles.photoSlide}>
                  <Image source={{ uri: item }} style={styles.photo} />
                </View>
              )}
            />
          ) : (
            <View style={[styles.photo, styles.noPhoto]}>
              <Text style={styles.noPhotoText}>No Photo</Text>
            </View>
          )}

          {/* Photo dots */}
          {photos.length > 1 && (
            <View style={styles.dots}>
              {photos.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === photoIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}

          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          {/* Crossed badge */}
          {crossedLabel && (
            <View style={styles.crossedBadge}>
              <Text style={styles.crossedText}>🚶 {crossedLabel}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <ScrollView style={styles.infoContainer} contentContainerStyle={styles.infoContent}>
          <Text style={styles.name}>
            {user.displayName}, {user.age}
          </Text>
          {user.occupation ? (
            <Text style={styles.occupation}>{user.occupation}</Text>
          ) : null}
          {user.bio ? (
            <>
              <Text style={styles.sectionLabel}>About</Text>
              <Text style={styles.bio}>{user.bio}</Text>
            </>
          ) : null}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.passBtn} onPress={onPass}>
            <Text style={styles.passIcon}>✕</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.starBtn} onPress={onStar}>
            <Text style={styles.starIcon}>⭐</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.likeBtn} onPress={onLike}>
            <Text style={styles.likeIcon}>❤</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  photoContainer: {
    width,
    height: height * 0.55,
    backgroundColor: '#111',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  photoSlide: {
    width,
    height: height * 0.55,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  noPhoto: {
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhotoText: {
    color: '#666',
    fontSize: 18,
  },
  dots: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 54,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  crossedBadge: {
    position: 'absolute',
    top: 54,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  crossedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  infoContainer: {
    flex: 1,
  },
  infoContent: {
    padding: 20,
    paddingBottom: 10,
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  occupation: {
    fontSize: 16,
    color: '#888',
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 6,
  },
  bio: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 16,
    paddingBottom: 50,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  passBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  passIcon: { fontSize: 22, color: '#aaa' },
  starBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF8E1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  starIcon: { fontSize: 24 },
  likeBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF4B6E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF4B6E',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  likeIcon: { fontSize: 26, color: '#fff' },
});
