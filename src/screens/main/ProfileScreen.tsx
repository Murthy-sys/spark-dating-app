import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { updateUserProfile, uploadProfilePhoto } from '../../services/userService';
import {
  getLikedUsers,
  getStarredUsers,
  unlikeUser as apiUnlikeUser,
  unstarUser as apiUnstarUser,
} from '../../services/matchingService';
import { UserProfile } from '../../types';

export default function ProfileScreen() {
  const { profile, setProfile, logout } = useAuthStore();

  const [editing, setEditing]       = useState(false);
  const [bio, setBio]               = useState(profile?.bio || '');
  const [occupation, setOccupation] = useState(profile?.occupation || '');
  const [maxDistance, setMaxDistance] = useState(String(profile?.settings?.maxDistance || 10));
  const [saving, setSaving]         = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  // Timestamps per slot — bumped after each upload to bust RN's image cache
  const [photoVersions, setPhotoVersions] = useState<Record<number, number>>({});

  // — Lists —
  type ListTab = 'none' | 'liked' | 'starred';
  const [activeList, setActiveList] = useState<ListTab>('none');
  const [likedUsers, setLikedUsers] = useState<{ user: UserProfile; starred: boolean }[]>([]);
  const [starredUsers, setStarredUsers] = useState<UserProfile[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const loadLiked = useCallback(async () => {
    setListLoading(true);
    try { setLikedUsers(await getLikedUsers()); } catch {}
    setListLoading(false);
  }, []);

  const loadStarred = useCallback(async () => {
    setListLoading(true);
    try { setStarredUsers(await getStarredUsers()); } catch {}
    setListLoading(false);
  }, []);

  const handleListTab = (tab: ListTab) => {
    if (activeList === tab) { setActiveList('none'); return; }
    setActiveList(tab);
    if (tab === 'liked') loadLiked();
    if (tab === 'starred') loadStarred();
  };

  const handleUnlike = async (userId: string) => {
    await apiUnlikeUser(userId);
    setLikedUsers((prev) => prev.filter((l) => l.user._id !== userId));
  };

  const handleUnstar = async (userId: string) => {
    await apiUnstarUser(userId);
    setStarredUsers((prev) => prev.filter((u) => u._id !== userId));
  };

  if (!profile) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = {
        bio,
        occupation,
        settings: { ...profile.settings, maxDistance: Number(maxDistance) },
      };
      await updateUserProfile(updates);
      setProfile({ ...profile, ...updates });
      setEditing(false);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePickPhoto = async (index: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Please allow access to your photo library in Settings to upload photos.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      try {
        setUploadingIndex(index);

        const serverUrl = await uploadProfilePhoto(result.assets[0].uri, index);

        // Update the profile store with the new URL
        const photos = [...(profile.photos || [])];
        photos[index] = serverUrl;
        setProfile({
          ...profile,
          photos,
          photoURL: index === 0 ? serverUrl : (profile.photoURL || photos[0]),
        });

        // Bump version so Image re-mounts and bypasses the cache
        setPhotoVersions((prev) => ({ ...prev, [index]: Date.now() }));
      } catch (err: any) {
        Alert.alert('Upload failed', err?.message ?? 'Could not upload photo. Please try again.');
      } finally {
        setUploadingIndex(null);
      }
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };

  const photoUrl = (index: number): string | undefined => {
    const url = profile.photos?.[index];
    if (!url) return undefined;
    // Append version as query param to bust RN's image cache after re-upload
    const version = photoVersions[index];
    return version ? `${url}?v=${version}` : url;
  };

  const avatarUri = photoUrl(0) || profile.photoURL;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>My Profile</Text>
          {editing ? (
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#FF4B6E" />
                : <Text style={styles.saveBtn}>Save</Text>
              }
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.editBtn}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Main Profile Photo — large tappable avatar */}
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={() => handlePickPhoto(0)}
          disabled={uploadingIndex !== null}
          activeOpacity={0.8}
        >
          {uploadingIndex === 0 ? (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <ActivityIndicator size="large" color="#FF4B6E" />
            </View>
          ) : avatarUri ? (
            <Image
              key={avatarUri}           /* force remount on URL change */
              source={{ uri: avatarUri }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {profile.displayName?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
          <View style={styles.cameraBadge}>
            <Text style={styles.cameraIcon}>📷</Text>
          </View>
        </TouchableOpacity>

        {/* Photo Grid */}
        <Text style={styles.sectionLabel}>Photos</Text>
        <View style={styles.photoGrid}>
          {Array.from({ length: 6 }).map((_, i) => {
            const slotUri = photoUrl(i);
            return (
              <TouchableOpacity
                key={i}
                style={[styles.photoSlot, i === 0 && styles.photoSlotPrimary]}
                onPress={() => handlePickPhoto(i)}
                disabled={uploadingIndex !== null}
              >
                {uploadingIndex === i ? (
                  <ActivityIndicator size="small" color="#FF4B6E" />
                ) : slotUri ? (
                  <>
                    <Image
                      key={slotUri}     /* force remount on URL change */
                      source={{ uri: slotUri }}
                      style={styles.photo}
                    />
                    {i === 0 && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Main</Text>
                      </View>
                    )}
                    <View style={styles.editOverlay}>
                      <Text style={styles.editOverlayText}>✎</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.addPhotoInner}>
                    <Text style={styles.photoAdd}>+</Text>
                    <Text style={styles.photoAddLabel}>
                      {i === 0 ? 'Main photo' : 'Add photo'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Name & Age */}
        <Text style={styles.name}>
          {profile.displayName}, {profile.age}
        </Text>
        {profile.occupation ? (
          <Text style={styles.occupation}>{profile.occupation}</Text>
        ) : null}

        {/* Bio */}
        <Text style={styles.sectionLabel}>About me</Text>
        {editing ? (
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={200}
            placeholder="Write something about yourself…"
            placeholderTextColor="#aaa"
          />
        ) : (
          <Text style={styles.bioText}>{bio || 'No bio yet. Tap Edit to add one.'}</Text>
        )}

        {editing && (
          <>
            <Text style={styles.sectionLabel}>Occupation</Text>
            <TextInput
              style={styles.input}
              value={occupation}
              onChangeText={setOccupation}
              placeholder="e.g. Designer"
              placeholderTextColor="#aaa"
            />
          </>
        )}

        {/* Settings */}
        <Text style={styles.sectionLabel}>Discovery settings</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Max distance</Text>
          {editing ? (
            <TextInput
              style={styles.settingInput}
              value={maxDistance}
              onChangeText={setMaxDistance}
              keyboardType="number-pad"
            />
          ) : (
            <Text style={styles.settingValue}>{profile.settings?.maxDistance} km</Text>
          )}
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Age range</Text>
          <Text style={styles.settingValue}>
            {profile.settings?.ageRangeMin}–{profile.settings?.ageRangeMax}
          </Text>
        </View>

        {/* Liked & Starred */}
        <Text style={styles.sectionLabel}>My Activity</Text>
        <View style={styles.listTabs}>
          <TouchableOpacity
            style={[styles.listTab, activeList === 'liked' && styles.listTabActive]}
            onPress={() => handleListTab('liked')}
          >
            <Text style={[styles.listTabText, activeList === 'liked' && styles.listTabTextActive]}>
              ❤ Liked
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.listTab, activeList === 'starred' && styles.listTabActive]}
            onPress={() => handleListTab('starred')}
          >
            <Text style={[styles.listTabText, activeList === 'starred' && styles.listTabTextActive]}>
              ⭐ Favorites
            </Text>
          </TouchableOpacity>
        </View>

        {activeList !== 'none' && (
          <View style={styles.listSection}>
            {listLoading ? (
              <ActivityIndicator size="small" color="#FF4B6E" style={{ padding: 20 }} />
            ) : activeList === 'liked' ? (
              likedUsers.length === 0 ? (
                <Text style={styles.listEmpty}>You haven't liked anyone yet.</Text>
              ) : (
                likedUsers.map((item) => (
                  <View key={item.user._id} style={styles.listCard}>
                    <Image
                      source={{ uri: item.user.photoURL || undefined }}
                      style={styles.listPhoto}
                    />
                    <View style={styles.listInfo}>
                      <Text style={styles.listName}>{item.user.displayName}, {item.user.age}</Text>
                      {item.user.occupation ? <Text style={styles.listOcc}>{item.user.occupation}</Text> : null}
                    </View>
                    <TouchableOpacity
                      style={styles.listRemoveBtn}
                      onPress={() => handleUnlike(item.user._id)}
                    >
                      <Text style={styles.listRemoveText}>Unlike</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )
            ) : (
              starredUsers.length === 0 ? (
                <Text style={styles.listEmpty}>No favorites yet.</Text>
              ) : (
                starredUsers.map((u) => (
                  <View key={u._id} style={styles.listCard}>
                    <Image
                      source={{ uri: u.photoURL || undefined }}
                      style={styles.listPhoto}
                    />
                    <View style={styles.listInfo}>
                      <Text style={styles.listName}>{u.displayName}, {u.age}</Text>
                      {u.occupation ? <Text style={styles.listOcc}>{u.occupation}</Text> : null}
                    </View>
                    <TouchableOpacity
                      style={styles.listRemoveBtn}
                      onPress={() => handleUnstar(u._id)}
                    >
                      <Text style={styles.listRemoveText}>Unstar</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )
            )}
          </View>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  inner:     { padding: 20, paddingBottom: 80 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title:   { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  editBtn: { fontSize: 16, color: '#FF4B6E', fontWeight: '600' },
  saveBtn: { fontSize: 16, color: '#FF4B6E', fontWeight: '700' },

  // Avatar
  avatarWrapper: {
    alignSelf: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    resizeMode: 'cover',
    borderWidth: 3,
    borderColor: '#FF4B6E',
  },
  avatarPlaceholder: {
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 40, fontWeight: '700', color: '#ccc' },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#fff',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 3,
  },
  cameraIcon: { fontSize: 15 },

  // Photo grid
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  photoSlot: {
    width: '30.5%',
    aspectRatio: 4 / 5,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  photoSlotPrimary: { borderColor: '#FF4B6E', borderStyle: 'solid' },
  photo: { width: '100%', height: '100%', resizeMode: 'cover' },
  primaryBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#FF4B6E',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  primaryBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  editOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    paddingVertical: 4,
  },
  editOverlayText: { color: '#fff', fontSize: 14 },
  addPhotoInner:   { alignItems: 'center' },
  photoAdd:        { fontSize: 28, color: '#ccc' },
  photoAddLabel:   { fontSize: 10, color: '#bbb', marginTop: 2 },

  // Text
  name:       { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  occupation: { fontSize: 15, color: '#888', marginTop: 2, marginBottom: 16 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#1a1a1a',
  },
  bioInput:  { height: 80, textAlignVertical: 'top' },
  bioText:   { fontSize: 15, color: '#555', lineHeight: 22 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingLabel: { fontSize: 15, color: '#333' },
  settingValue: { fontSize: 15, color: '#FF4B6E', fontWeight: '600' },
  settingInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#FF4B6E',
    fontSize: 15,
    color: '#FF4B6E',
    minWidth: 50,
    textAlign: 'right',
  },
  logoutBtn: {
    marginTop: 32,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FF4B6E',
    alignItems: 'center',
  },
  logoutText: { fontSize: 16, color: '#FF4B6E', fontWeight: '600' },

  // List tabs
  listTabs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  listTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  listTabActive: {
    backgroundColor: '#FF4B6E',
  },
  listTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  listTabTextActive: {
    color: '#fff',
  },
  listSection: {
    marginBottom: 8,
  },
  listEmpty: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    paddingVertical: 20,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  listPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eee',
  },
  listInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  listName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  listOcc: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  listRemoveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF4B6E',
  },
  listRemoveText: {
    fontSize: 12,
    color: '#FF4B6E',
    fontWeight: '600',
  },
});
