/**
 * ProfileScreen.tsx
 *
 * Redesigned to match reference:
 *   – Cream/warm off-white page background
 *   – Large name heading + Edit button
 *   – "Basic profile" completion card  (pink progress bar + avatar)
 *   – "Spark Premium" dark card        (features list + upsell)
 *   – "My Boosts" feature card
 *   – "My SuperCrushes" feature card
 *   – Menu rows: Preferences, Settings, Safety, Help
 *   – Log Out row
 *
 * iOS-safe: no fontStyle italic, fontWeight capped at '800'.
 */

import React, { useState, useCallback } from 'react';
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
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { updateUserProfile, uploadProfilePhoto } from '../../services/userService';

// ─── Colours ──────────────────────────────────────────────────────────────────

const PAGE   = '#EDEBE4';   // warm cream — matches reference background
const WHITE  = '#FFFFFF';
const BRAND  = '#FF4B6E';   // Spark pink (replaces reference gold)
const DARK   = '#1A1A1A';
const GRAY   = '#777777';
const LGRAY  = '#F2EFE9';   // light cream — icon container bg, borders
const DGRAY  = '#E5E2DC';   // separator

// ─── Profile-completion helper ────────────────────────────────────────────────

function getCompletion(profile: any): number {
  let score = 0;
  if (profile.photoURL || profile.photos?.[0]) score += 30;
  if (profile.bio?.trim())                     score += 25;
  if (profile.occupation?.trim())              score += 15;
  if ((profile.hobbies?.length ?? 0) > 0)     score += 15;
  if ((profile.lookingFor?.length ?? 0) > 0)  score += 15;
  return Math.min(score, 100);
}

function completionMessage(pct: number): string {
  if (pct < 40)  return 'Add a photo and bio to start getting matches!';
  if (pct < 70)  return "You're on the verge of standing out. Keep going!";
  if (pct < 100) return "Almost there! Complete your profile for more matches.";
  return 'Your profile is complete — you are ready to Spark!';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** White rounded card wrapper */
function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[st.card, style]}>{children}</View>;
}

/** Menu row: icon + label + chevron */
function MenuRow({
  iconName,
  label,
  onPress,
  danger,
}: {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  label:    string;
  onPress:  () => void;
  danger?:  boolean;
}) {
  return (
    <TouchableOpacity style={st.menuRow} onPress={onPress} activeOpacity={0.7}>
      <View style={st.menuIconWrap}>
        <Ionicons name={iconName} size={20} color={danger ? BRAND : DARK} />
      </View>
      <Text style={[st.menuLabel, danger && { color: BRAND }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={GRAY} />
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { profile, setProfile, logout } = useAuthStore();

  const [editing,        setEditing]        = useState(false);
  const [bio,            setBio]            = useState(profile?.bio || '');
  const [occupation,     setOccupation]     = useState(profile?.occupation || '');
  const [maxDistance,    setMaxDistance]    = useState(
    String(profile?.settings?.maxDistance || 10),
  );
  const [saving,         setSaving]         = useState(false);
  const [uploadingIdx,   setUploadingIdx]   = useState<number | null>(null);
  const [photoVersions,  setPhotoVersions]  = useState<Record<number, number>>({});

  if (!profile) return null;

  const pct      = getCompletion(profile);
  const avatarUri =
    (profile.photos?.[0]
      ? (photoVersions[0] ? `${profile.photos[0]}?v=${photoVersions[0]}` : profile.photos[0])
      : undefined) ?? profile.photoURL;

  // ── Save edits ──────────────────────────────────────────────────────────────
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

  // ── Photo pick ──────────────────────────────────────────────────────────────
  const handlePickPhoto = async (index: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo library access in Settings.');
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
        setUploadingIdx(index);
        const serverUrl = await uploadProfilePhoto(result.assets[0].uri, index);
        const photos = [...(profile.photos || [])];
        photos[index] = serverUrl;
        setProfile({
          ...profile,
          photos,
          photoURL: index === 0 ? serverUrl : (profile.photoURL || photos[0]),
        });
        setPhotoVersions((prev) => ({ ...prev, [index]: Date.now() }));
      } catch (err: any) {
        Alert.alert('Upload failed', err?.message ?? 'Could not upload photo.');
      } finally {
        setUploadingIdx(null);
      }
    }
  };

  // ── Logout ──────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };

  const comingSoon = (feature: string) =>
    Alert.alert(feature, `${feature} is coming soon!`);

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={st.root}>
      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header: Name + Edit ── */}
        <View style={st.headerRow}>
          <View style={st.nameRow}>
            <Text style={st.nameText} numberOfLines={1}>
              {profile.displayName}
            </Text>
            {/* verified badge (shown when profile ≥ 70% complete) */}
            {pct >= 70 && (
              <Ionicons name="checkmark-circle" size={24} color="#4B9EFF" style={{ marginLeft: 6 }} />
            )}
          </View>

          {editing ? (
            <TouchableOpacity
              style={st.editBtn}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator size="small" color={WHITE} />
                : <Text style={st.editBtnText}>Save</Text>
              }
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={st.editBtn} onPress={() => setEditing(true)} activeOpacity={0.8}>
              <Ionicons name="pencil-outline" size={14} color={DARK} style={{ marginRight: 4 }} />
              <Text style={st.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Basic Profile completion card ── */}
        <Card style={{ marginBottom: 14 }}>
          <View style={st.completionTop}>
            <View style={{ flex: 1 }}>
              <Text style={st.cardTitle}>Basic profile</Text>
              <Text style={st.pctText}>{pct}<Text style={st.pctSymbol}>%</Text></Text>
              {/* Progress bar */}
              <View style={st.progressTrack}>
                <View style={[st.progressFill, { width: `${pct}%` as any }]} />
              </View>
              <Text style={st.completionMsg}>{completionMessage(pct)}</Text>
            </View>

            {/* Avatar */}
            <TouchableOpacity
              style={st.avatarWrap}
              onPress={() => handlePickPhoto(0)}
              disabled={uploadingIdx !== null}
              activeOpacity={0.85}
            >
              {uploadingIdx === 0 ? (
                <View style={st.avatarInner}>
                  <ActivityIndicator size="large" color={BRAND} />
                </View>
              ) : avatarUri ? (
                <Image key={avatarUri} source={{ uri: avatarUri }} style={st.avatarInner} />
              ) : (
                <View style={[st.avatarInner, st.avatarFallback]}>
                  <Text style={st.avatarInitial}>
                    {profile.displayName?.[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
              )}
              {/* camera badge */}
              <View style={st.cameraBadge}>
                <Ionicons name="camera" size={11} color={WHITE} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Edit fields (bio + occupation) when editing */}
          {editing && (
            <View style={st.editFields}>
              <Text style={st.fieldLabel}>Bio</Text>
              <TextInput
                style={[st.input, st.bioInput]}
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={200}
                placeholder="Write something about yourself…"
                placeholderTextColor="#BBB"
              />
              <Text style={st.fieldLabel}>Occupation</Text>
              <TextInput
                style={st.input}
                value={occupation}
                onChangeText={setOccupation}
                placeholder="e.g. Designer"
                placeholderTextColor="#BBB"
              />
              <Text style={st.fieldLabel}>Max discovery distance (km)</Text>
              <TextInput
                style={st.input}
                value={maxDistance}
                onChangeText={setMaxDistance}
                keyboardType="number-pad"
              />
            </View>
          )}

          {/* CTA */}
          {!editing && pct < 100 && (
            <TouchableOpacity
              style={st.completionCTA}
              onPress={() => setEditing(true)}
              activeOpacity={0.85}
            >
              <Text style={st.completionCTAText}>Complete your profile</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* ── Spark Premium card ── */}
        <View style={[st.premiumCard, { marginBottom: 14 }]}>
          <Text style={st.premiumTitle}>Spark Premium</Text>
          <View style={st.premiumFeatures}>
            {[
              'See who likes your profile',
              'Send unlimited likes',
              '5 free SuperCrushes every day',
            ].map((f) => (
              <View key={f} style={st.featureRow}>
                <Ionicons name="checkmark" size={16} color={BRAND} style={{ marginRight: 8 }} />
                <Text style={st.featureText}>{f}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => comingSoon('Spark Premium')}
            activeOpacity={0.8}
          >
            <Text style={st.premiumSeeMore}>See my features</Text>
          </TouchableOpacity>
          <View style={st.premiumActiveRow}>
            <Ionicons name="checkmark-circle" size={18} color={BRAND} style={{ marginRight: 6 }} />
            <Text style={st.premiumActiveText}>Coming soon</Text>
          </View>
          {/* decorative swirl */}
          <Text style={st.swirl}>✦</Text>
        </View>

        {/* ── My Boosts card ── */}
        <Card style={{ marginBottom: 10 }}>
          <View style={st.featureCardRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.featureCardTitle}>My Boosts</Text>
              <Text style={st.featureCardSubtitle}>
                Your visibility will skyrocket for 24h
              </Text>
              <TouchableOpacity
                style={st.featureChip}
                onPress={() => comingSoon('Boosts')}
                activeOpacity={0.8}
              >
                <Text style={st.featureChipText}>Get a Boost</Text>
              </TouchableOpacity>
            </View>
            <Text style={st.featureEmoji}>⚡</Text>
          </View>
        </Card>

        {/* ── My SuperCrushes card ── */}
        <Card style={{ marginBottom: 22 }}>
          <View style={st.featureCardRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.featureCardTitle}>My SuperCrushes</Text>
              <Text style={st.featureCardSubtitle}>
                5x more chances of finding a date
              </Text>
              <View style={st.superChip}>
                <Text style={st.superChipText}>5 SuperCrushes left</Text>
              </View>
            </View>
            <Text style={[st.featureEmoji, { color: '#5FB8FF' }]}>★</Text>
          </View>
        </Card>

        {/* ── Menu rows ── */}
        <View style={st.menuSection}>
          <MenuRow
            iconName="options-outline"
            label="Preferences"
            onPress={() => comingSoon('Preferences')}
          />
          <View style={st.menuSep} />
          <MenuRow
            iconName="settings-outline"
            label="Settings"
            onPress={() => comingSoon('Settings')}
          />
          <View style={st.menuSep} />
          <MenuRow
            iconName="shield-checkmark-outline"
            label="Safety guide"
            onPress={() => comingSoon('Safety guide')}
          />
          <View style={st.menuSep} />
          <MenuRow
            iconName="help-circle-outline"
            label="Help center"
            onPress={() => comingSoon('Help center')}
          />
        </View>

        {/* ── Log Out ── */}
        <View style={[st.menuSection, { marginTop: 16, marginBottom: 36 }]}>
          <MenuRow
            iconName="log-out-outline"
            label="Log Out"
            onPress={handleLogout}
            danger
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root:   { flex: 1, backgroundColor: PAGE },
  scroll: { paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 16 : 8, paddingBottom: 20 },

  /* ── Header row ── */
  headerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   20,
    marginTop:      8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    flex: 1,
  },
  nameText: {
    fontSize:      34,
    fontWeight:    '800',
    color:         DARK,
    letterSpacing: -0.5,
  },
  editBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  WHITE,
    borderRadius:     20,
    paddingHorizontal: 14,
    paddingVertical:   8,
    // shadow
    shadowColor:   '#000',
    shadowOpacity: 0.08,
    shadowOffset:  { width: 0, height: 2 },
    shadowRadius:  6,
    elevation: 3,
  },
  editBtnText: { fontSize: 14, fontWeight: '600', color: DARK },

  /* ── Generic card ── */
  card: {
    backgroundColor:  WHITE,
    borderRadius:     20,
    padding:          18,
    shadowColor:      '#000',
    shadowOpacity:    0.06,
    shadowOffset:     { width: 0, height: 2 },
    shadowRadius:     8,
    elevation: 2,
  },
  cardTitle: {
    fontSize:   14,
    fontWeight: '600',
    color:      GRAY,
    marginBottom: 8,
  },

  /* ── Completion card ── */
  completionTop: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           12,
  },
  pctText: {
    fontSize:   48,
    fontWeight: '800',
    color:      BRAND,
    lineHeight: 54,
  },
  pctSymbol: {
    fontSize:   24,
    fontWeight: '700',
    color:      BRAND,
  },
  progressTrack: {
    height:          6,
    backgroundColor: LGRAY,
    borderRadius:    3,
    marginVertical:  10,
    overflow:        'hidden',
  },
  progressFill: {
    height:          6,
    backgroundColor: BRAND,
    borderRadius:    3,
  },
  completionMsg: {
    fontSize:   13,
    color:      GRAY,
    lineHeight: 18,
    marginTop:  4,
  },

  /* Avatar in completion card */
  avatarWrap: {
    position:     'relative',
    width:         76,
    height:        76,
    flexShrink:    0,
  },
  avatarInner: {
    width:        76,
    height:       76,
    borderRadius: 16,
    resizeMode:   'cover',
    borderWidth:  2.5,
    borderColor:  BRAND,
    overflow:     'hidden',
  },
  avatarFallback: {
    backgroundColor: LGRAY,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarInitial: { fontSize: 28, fontWeight: '700', color: BRAND },
  cameraBadge: {
    position:        'absolute',
    bottom:          -4,
    right:           -4,
    width:           22,
    height:          22,
    borderRadius:    11,
    backgroundColor: BRAND,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     WHITE,
  },

  /* Edit fields */
  editFields: { marginTop: 16 },
  fieldLabel: {
    fontSize:   12,
    fontWeight: '600',
    color:      GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom:  6,
    marginTop:     12,
  },
  input: {
    borderWidth:       1,
    borderColor:       DGRAY,
    borderRadius:      12,
    paddingHorizontal: 14,
    paddingVertical:   10,
    fontSize:          15,
    backgroundColor:   LGRAY,
    color:             DARK,
  },
  bioInput: { height: 80, textAlignVertical: 'top' },

  /* CTA button inside completion card */
  completionCTA: {
    marginTop:       16,
    backgroundColor: DARK,
    borderRadius:    30,
    paddingVertical: 14,
    alignItems:      'center',
  },
  completionCTAText: {
    color:      WHITE,
    fontSize:   15,
    fontWeight: '700',
  },

  /* ── Premium card ── */
  premiumCard: {
    backgroundColor: DARK,
    borderRadius:    20,
    padding:         20,
    borderWidth:     1.5,
    borderColor:     BRAND,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOpacity:   0.18,
    shadowOffset:    { width: 0, height: 4 },
    shadowRadius:    12,
    elevation: 6,
  },
  premiumTitle: {
    fontSize:      26,
    fontWeight:    '800',
    color:         WHITE,
    marginBottom:  14,
  },
  premiumFeatures: { marginBottom: 10 },
  featureRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  8,
  },
  featureText: { fontSize: 14, color: WHITE, fontWeight: '500' },
  premiumSeeMore: {
    fontSize:     13,
    color:        GRAY,
    marginBottom: 14,
  },
  premiumActiveRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  premiumActiveText: {
    fontSize:   14,
    fontWeight: '700',
    color:      BRAND,
  },
  swirl: {
    position:  'absolute',
    right:     20,
    bottom:    16,
    fontSize:  60,
    color:     BRAND,
    opacity:   0.18,
  },

  /* ── Feature cards (Boosts / SuperCrushes) ── */
  featureCardRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  featureCardTitle: {
    fontSize:     18,
    fontWeight:   '700',
    color:        DARK,
    marginBottom: 4,
  },
  featureCardSubtitle: {
    fontSize:     13,
    color:        GRAY,
    marginBottom: 12,
    lineHeight:   18,
  },
  featureEmoji: {
    fontSize: 42,
    color:    '#FF7043',   // orange for boost
  },
  featureChip: {
    alignSelf:         'flex-start',
    backgroundColor:   LGRAY,
    borderRadius:      20,
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderWidth:       1,
    borderColor:       DGRAY,
  },
  featureChipText: { fontSize: 13, fontWeight: '600', color: DARK },
  superChip: {
    alignSelf:         'flex-start',
    backgroundColor:   '#DDF0FF',
    borderRadius:      20,
    paddingHorizontal: 14,
    paddingVertical:   8,
  },
  superChipText: { fontSize: 13, fontWeight: '600', color: '#3A8BCC' },

  /* ── Menu section ── */
  menuSection: {
    backgroundColor: WHITE,
    borderRadius:    20,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOpacity:   0.05,
    shadowOffset:    { width: 0, height: 1 },
    shadowRadius:    6,
    elevation: 1,
  },
  menuRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   16,
  },
  menuIconWrap: {
    width:            40,
    height:           40,
    borderRadius:     12,
    backgroundColor:  LGRAY,
    alignItems:       'center',
    justifyContent:   'center',
    marginRight:      14,
  },
  menuLabel: {
    flex:       1,
    fontSize:   16,
    fontWeight: '500',
    color:      DARK,
  },
  menuSep: {
    height:      1,
    backgroundColor: DGRAY,
    marginLeft:  70,
  },
});
