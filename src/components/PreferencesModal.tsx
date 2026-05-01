/**
 * PreferencesModal.tsx
 *
 * Full-screen slide-up modal that lets the user update the same
 * preferences they set during onboarding:
 *   • Looking for       (friendship / casual / serious — multi-select)
 *   • My hobbies        (chip grid — multi-select + custom)
 *   • Interested in     (gender filter — multi-select)
 *   • Discovery         (max distance km, age range min–max)
 *
 * Saves via PATCH /users/me.
 * iOS-safe: no fontStyle italic, fontWeight ≤ '800'.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { updateUserProfile } from '../services/userService';

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND  = '#FF4B6E';
const DARK   = '#1A1A1A';
const GRAY   = '#777777';
const PAGE   = '#EDEBE4';
const WHITE  = '#FFFFFF';
const LGRAY  = '#F2EFE9';
const DGRAY  = '#E5E2DC';
const BORDER = '#E0DDD8';

const LOOKING_FOR_OPTIONS = [
  { id: 'friendship', label: 'Friendship',           icon: '🤝', desc: 'Looking for meaningful connections' },
  { id: 'casual',     label: 'Casual Dating',        icon: '☕', desc: 'Fun, low-pressure meetups'          },
  { id: 'serious',    label: 'Serious Relationship', icon: '💜', desc: 'Ready for something real'           },
] as const;

type LookingForId = 'friendship' | 'casual' | 'serious';

const INTENT_OPTIONS = [
  { id: 'serious'    as const, label: 'Serious', icon: '💍' },
  { id: 'casual'     as const, label: 'Casual',  icon: '🍷' },
  { id: 'friends'    as const, label: 'Friends', icon: '🤝' },
  { id: 'networking' as const, label: 'Network', icon: '💼' },
];

type IntentId = 'serious' | 'casual' | 'friends' | 'networking';

// Phase 3 — micro-communities (mirrors backend enum)
const COMMUNITY_OPTIONS = [
  { id: 'tech'       as const, label: 'Tech',            icon: '💻' },
  { id: 'fitness'    as const, label: 'Fitness',         icon: '🏋️' },
  { id: 'startup'    as const, label: 'Startup founders', icon: '🚀' },
  { id: 'travel'     as const, label: 'Travelers',       icon: '✈️' },
  { id: 'foodies'    as const, label: 'Foodies',         icon: '🍜' },
  { id: 'creators'   as const, label: 'Creators',        icon: '🎬' },
  { id: 'gamers'     as const, label: 'Gamers',          icon: '🎮' },
  { id: 'bookworms'  as const, label: 'Bookworms',       icon: '📚' },
  { id: 'musicians'  as const, label: 'Musicians',       icon: '🎸' },
  { id: 'artists'    as const, label: 'Artists',         icon: '🎨' },
];

type CommunityId = typeof COMMUNITY_OPTIONS[number]['id'];

const HOBBY_SUGGESTIONS = [
  'Music', 'Travel', 'Fitness', 'Movies', 'Reading', 'Cooking',
  'Photography', 'Gaming', 'Hiking', 'Dancing', 'Yoga', 'Art',
  'Sports', 'Writing', 'Gardening', 'Tech', 'Fashion', 'Meditation',
];

const GENDER_OPTIONS = [
  { id: 'male',       label: 'Men'       },
  { id: 'female',     label: 'Women'     },
  { id: 'non-binary', label: 'Non-binary'},
  { id: 'other',      label: 'Other'     },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible:  boolean;
  onClose:  () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PreferencesModal({ visible, onClose }: Props) {
  const { profile, setProfile } = useAuthStore();

  // ── local state, seeded from current profile ──────────────────────────────
  const [lookingFor,    setLookingFor]    = useState<LookingForId[]>([]);
  const [hobbies,       setHobbies]       = useState<string[]>([]);
  const [interestedIn,  setInterestedIn]  = useState<string[]>([]);
  const [intent,        setIntent]        = useState<IntentId | null>(null);
  const [communities,   setCommunities]   = useState<CommunityId[]>([]);
  const [maxDistance,   setMaxDistance]   = useState('');
  const [ageMin,        setAgeMin]        = useState('');
  const [ageMax,        setAgeMax]        = useState('');
  const [customHobby,   setCustomHobby]   = useState('');
  const [saving,        setSaving]        = useState(false);

  // Re-seed whenever the modal opens so values are always fresh
  useEffect(() => {
    if (visible && profile) {
      setLookingFor((profile.lookingFor ?? []) as LookingForId[]);
      setHobbies(profile.hobbies ?? []);
      setInterestedIn(profile.interestedIn ?? ['male', 'female', 'non-binary', 'other']);
      setIntent((profile.intent ?? null) as IntentId | null);
      setCommunities((profile.communities ?? []) as CommunityId[]);
      setMaxDistance(String(profile.settings?.maxDistance ?? 10));
      setAgeMin(String(profile.settings?.ageRangeMin ?? 18));
      setAgeMax(String(profile.settings?.ageRangeMax ?? 45));
    }
  }, [visible]);

  // ── helpers ───────────────────────────────────────────────────────────────

  const toggleLookingFor = (id: LookingForId) =>
    setLookingFor((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleHobby = (h: string) =>
    setHobbies((prev) =>
      prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]
    );

  const toggleGender = (g: string) =>
    setInterestedIn((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );

  const addCustomHobby = () => {
    const t = customHobby.trim();
    if (t && !hobbies.includes(t)) {
      setHobbies((prev) => [...prev, t]);
      setCustomHobby('');
    }
  };

  // ── save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (lookingFor.length === 0) {
      Alert.alert('Preferences', 'Please select at least one relationship type.');
      return;
    }
    const minVal = Number(ageMin) || 18;
    const maxVal = Number(ageMax) || 45;

    setSaving(true);
    try {
      const updates = {
        lookingFor,
        hobbies,
        interestedIn,
        intent,
        communities,
        settings: {
          ...(profile?.settings ?? {}),
          maxDistance: Math.max(1, Number(maxDistance) || 10),
          ageRangeMin: Math.min(minVal, maxVal),
          ageRangeMax: Math.max(minVal, maxVal),
        },
      };
      const updated = await updateUserProfile(updates);
      setProfile({ ...profile!, ...updates, ...updated });
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={st.root}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >

          {/* ── Header ── */}
          <View style={st.header}>
            <TouchableOpacity style={st.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={DARK} />
            </TouchableOpacity>
            <Text style={st.headerTitle}>Preferences</Text>
            <TouchableOpacity
              style={[st.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator size="small" color={WHITE} />
                : <Text style={st.saveBtnText}>Save</Text>
              }
            </TouchableOpacity>
          </View>

          <View style={st.divider} />

          <ScrollView
            contentContainerStyle={st.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Section: Primary Intent (single-choice) ── */}
            <Text style={st.sectionLabel}>PRIMARY INTENT</Text>
            <Text style={st.sectionHint}>Used to surface people looking for the same thing</Text>

            <View style={st.genderRow}>
              {INTENT_OPTIONS.map((opt) => {
                const active = intent === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[st.genderChip, active && st.genderChipActive]}
                    onPress={() => setIntent(active ? null : opt.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[st.genderChipText, active && st.genderChipTextActive]}>
                      {opt.icon} {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Section: Communities ── */}
            <Text style={[st.sectionLabel, { marginTop: 28 }]}>COMMUNITIES</Text>
            <Text style={st.sectionHint}>People sharing your communities rank higher in your feed</Text>

            <View style={st.chipRow}>
              {COMMUNITY_OPTIONS.map((opt) => {
                const active = communities.includes(opt.id);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={active ? st.chipOn : st.chipOff}
                    onPress={() =>
                      setCommunities((prev) =>
                        prev.includes(opt.id)
                          ? prev.filter((x) => x !== opt.id)
                          : [...prev, opt.id]
                      )
                    }
                    activeOpacity={0.8}
                  >
                    <Text style={active ? st.chipOnTxt : st.chipOffTxt}>
                      {opt.icon} {opt.label}{active ? '  ✕' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Section: Looking For ── */}
            <Text style={[st.sectionLabel, { marginTop: 28 }]}>LOOKING FOR</Text>
            <Text style={st.sectionHint}>Select all that apply</Text>

            {LOOKING_FOR_OPTIONS.map((opt) => {
              const active = lookingFor.includes(opt.id);
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[st.optCard, active && st.optCardActive]}
                  onPress={() => toggleLookingFor(opt.id)}
                  activeOpacity={0.8}
                >
                  <Text style={st.optIcon}>{opt.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.optLabel, active && st.optLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={st.optDesc}>{opt.desc}</Text>
                  </View>
                  <View style={[st.check, active && st.checkActive]}>
                    {active && <Text style={st.checkTick}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* ── Section: Hobbies ── */}
            <Text style={[st.sectionLabel, { marginTop: 28 }]}>MY HOBBIES</Text>
            <Text style={st.sectionHint}>Tap to add or remove</Text>

            {/* selected hobbies */}
            {hobbies.length > 0 && (
              <View style={st.chipRow}>
                {hobbies.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={st.chipOn}
                    onPress={() => toggleHobby(h)}
                    activeOpacity={0.8}
                  >
                    <Text style={st.chipOnTxt}>{h}  ✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* custom hobby input */}
            <View style={st.customRow}>
              <TextInput
                style={st.customInput}
                value={customHobby}
                onChangeText={setCustomHobby}
                onSubmitEditing={addCustomHobby}
                placeholder="Add your own…"
                placeholderTextColor="#BBB"
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[st.addBtn, !customHobby.trim() && st.addBtnOff]}
                onPress={addCustomHobby}
                disabled={!customHobby.trim()}
                activeOpacity={0.8}
              >
                <Text style={[st.addBtnTxt, !customHobby.trim() && { color: '#CCC' }]}>
                  Add
                </Text>
              </TouchableOpacity>
            </View>

            {/* suggestions */}
            <Text style={st.subLabel}>SUGGESTIONS</Text>
            <View style={st.chipRow}>
              {HOBBY_SUGGESTIONS.filter((h) => !hobbies.includes(h)).map((h) => (
                <TouchableOpacity
                  key={h}
                  style={st.chipOff}
                  onPress={() => toggleHobby(h)}
                  activeOpacity={0.7}
                >
                  <Text style={st.chipOffTxt}>{h}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Section: Interested In ── */}
            <Text style={[st.sectionLabel, { marginTop: 28 }]}>INTERESTED IN</Text>
            <Text style={st.sectionHint}>Who would you like to meet?</Text>

            <View style={st.genderRow}>
              {GENDER_OPTIONS.map((g) => {
                const active = interestedIn.includes(g.id);
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[st.genderChip, active && st.genderChipActive]}
                    onPress={() => toggleGender(g.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[st.genderChipText, active && st.genderChipTextActive]}>
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Section: Discovery Settings ── */}
            <Text style={[st.sectionLabel, { marginTop: 28 }]}>DISCOVERY</Text>

            {/* Max distance */}
            <View style={st.settingCard}>
              <View style={st.settingRow}>
                <Text style={st.settingLabel}>Max distance</Text>
                <View style={st.settingInputWrap}>
                  <TextInput
                    style={st.settingInput}
                    value={maxDistance}
                    onChangeText={setMaxDistance}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                  <Text style={st.settingUnit}>km</Text>
                </View>
              </View>

              <View style={st.settingDivider} />

              {/* Age range */}
              <Text style={st.settingLabel}>Age range</Text>
              <View style={[st.settingRow, { marginTop: 10 }]}>
                <View style={st.ageInputWrap}>
                  <Text style={st.ageLabel}>Min</Text>
                  <TextInput
                    style={st.ageInput}
                    value={ageMin}
                    onChangeText={setAgeMin}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <Text style={{ color: GRAY, fontSize: 16, marginHorizontal: 8 }}>–</Text>
                <View style={st.ageInputWrap}>
                  <Text style={st.ageLabel}>Max</Text>
                  <TextInput
                    style={st.ageInput}
                    value={ageMax}
                    onChangeText={setAgeMax}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root:   { flex: 1, backgroundColor: PAGE },

  /* ── header ── */
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
    backgroundColor:   WHITE,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: LGRAY,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18, fontWeight: '700', color: DARK,
  },
  saveBtn: {
    backgroundColor:   BRAND,
    borderRadius:      20,
    paddingHorizontal: 18,
    paddingVertical:   8,
    minWidth:          60,
    alignItems:        'center',
  },
  saveBtnText: { color: WHITE, fontWeight: '700', fontSize: 14 },
  divider: { height: 1, backgroundColor: BORDER },

  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20 },

  /* ── section labels ── */
  sectionLabel: {
    fontSize:      11,
    fontWeight:    '700',
    color:         GRAY,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom:  4,
  },
  sectionHint: {
    fontSize:     13,
    color:        GRAY,
    marginBottom: 14,
  },
  subLabel: {
    fontSize:      10,
    fontWeight:    '700',
    color:         '#BBBBBB',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom:  10,
    marginTop:     16,
  },

  /* ── looking-for option cards ── */
  optCard: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   WHITE,
    borderRadius:      16,
    padding:           16,
    marginBottom:      10,
    borderWidth:       2,
    borderColor:       'transparent',
    shadowColor:       '#000',
    shadowOpacity:     0.04,
    shadowOffset:      { width: 0, height: 1 },
    shadowRadius:      4,
    elevation: 1,
    gap: 12,
  },
  optCardActive: {
    borderColor: BRAND,
    backgroundColor: '#FFF5F7',
  },
  optIcon:  { fontSize: 28 },
  optLabel: { fontSize: 16, fontWeight: '600', color: DARK, marginBottom: 2 },
  optLabelActive: { color: BRAND },
  optDesc:  { fontSize: 12, color: GRAY },
  check: {
    width:           24,
    height:          24,
    borderRadius:    12,
    borderWidth:     2,
    borderColor:     BORDER,
    alignItems:      'center',
    justifyContent:  'center',
  },
  checkActive: { backgroundColor: BRAND, borderColor: BRAND },
  checkTick:   { color: WHITE, fontSize: 13, fontWeight: '700' },

  /* ── hobby chips ── */
  chipRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
    marginBottom:  12,
  },
  chipOn: {
    backgroundColor:   BRAND,
    borderRadius:      20,
    paddingHorizontal: 14,
    paddingVertical:   8,
  },
  chipOnTxt:  { color: WHITE, fontSize: 13, fontWeight: '600' },
  chipOff: {
    backgroundColor:   WHITE,
    borderRadius:      20,
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderWidth:       1.5,
    borderColor:       BORDER,
  },
  chipOffTxt: { color: DARK, fontSize: 13 },

  /* custom hobby row */
  customRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginBottom:  14,
  },
  customInput: {
    flex:              1,
    borderWidth:       1,
    borderColor:       BORDER,
    borderRadius:      12,
    paddingHorizontal: 14,
    paddingVertical:   10,
    fontSize:          15,
    backgroundColor:   WHITE,
    color:             DARK,
  },
  addBtn: {
    backgroundColor:   BRAND,
    borderRadius:      12,
    paddingHorizontal: 16,
    paddingVertical:   10,
  },
  addBtnOff: { backgroundColor: LGRAY },
  addBtnTxt: { color: WHITE, fontSize: 14, fontWeight: '700' },

  /* ── interested in chips ── */
  genderRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           10,
    marginBottom:  4,
  },
  genderChip: {
    paddingHorizontal: 18,
    paddingVertical:   10,
    borderRadius:      24,
    backgroundColor:   WHITE,
    borderWidth:       2,
    borderColor:       BORDER,
  },
  genderChipActive: {
    backgroundColor: BRAND,
    borderColor:     BRAND,
  },
  genderChipText:       { fontSize: 14, fontWeight: '600', color: DARK },
  genderChipTextActive: { color: WHITE },

  /* ── discovery settings card ── */
  settingCard: {
    backgroundColor: WHITE,
    borderRadius:    16,
    padding:         16,
    marginTop:       12,
    shadowColor:     '#000',
    shadowOpacity:   0.04,
    shadowOffset:    { width: 0, height: 1 },
    shadowRadius:    4,
    elevation: 1,
  },
  settingRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  settingLabel: { fontSize: 15, color: DARK, fontWeight: '500' },
  settingInputWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  settingInput: {
    width:             56,
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
    paddingVertical:   4,
    fontSize:          16,
    fontWeight:        '700',
    color:             BRAND,
    textAlign:         'center',
  },
  settingUnit: { fontSize: 14, color: GRAY },
  settingDivider: { height: 1, backgroundColor: DGRAY, marginVertical: 14 },

  /* age range */
  ageInputWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  ageLabel: { fontSize: 14, color: GRAY },
  ageInput: {
    width:             48,
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
    paddingVertical:   4,
    fontSize:          16,
    fontWeight:        '700',
    color:             BRAND,
    textAlign:         'center',
  },
});
