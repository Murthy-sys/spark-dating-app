/**
 * SafetyScreen.tsx — Phase 2 women-first safety hub.
 *
 * Sections:
 *   • Panic button — large red CTA, deep-links into native SMS to all SOS contacts
 *   • SOS contacts — add up to 3 (name + phone)
 *   • Verification — upload selfie/video, shows status + trust score
 *   • Privacy — visibility, hide-photos-until-match, hide-from-search
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import {
  getSosContacts,
  setSosContacts,
  triggerPanic,
  getVerificationStatus,
  submitVerification,
  updatePrivacy,
} from '../../services/safetyService';
import { useLocation } from '../../hooks/useLocation';
import {
  PrivacySettings,
  SosContact,
  VerificationState,
  Visibility,
} from '../../types';

// ─── Colours ─────────────────────────────────────────────────────────────────
const PAGE = '#EDEBE4';
const WHITE = '#FFFFFF';
const DARK = '#1A1A1A';
const GRAY = '#777777';
const LGRAY = '#F2EFE9';
const BORDER = '#E0DDD8';
const PANIC = '#E11D2E';
const TRUST = '#22C55E';

const VISIBILITY_OPTIONS: { id: Visibility; label: string; desc: string }[] = [
  { id: 'everyone',      label: 'Everyone',         desc: 'Anyone nearby can see you' },
  { id: 'verified_only', label: 'Verified only',    desc: 'Only verified users see you' },
  { id: 'matches_only',  label: 'Matches only',     desc: 'You disappear from discovery — only existing matches see you' },
];

interface Props {
  onClose?: () => void;
}

export default function SafetyScreen({ onClose }: Props) {
  const { profile, setProfile } = useAuthStore();
  const { currentLocation }     = useLocation();

  const [contacts, setContacts] = useState<SosContact[]>([]);
  const [verif, setVerif]       = useState<VerificationState>({ status: 'unverified' });
  const [trust, setTrust]       = useState<number>(profile?.trustScore ?? 0);
  const [privacy, setPrivacy]   = useState<PrivacySettings>(
    profile?.privacy ?? { visibility: 'everyone', hidePhotosUntilMatch: false, hideFromSearch: false },
  );

  const [draftName, setDraftName]   = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [busy, setBusy]             = useState(false);
  const [uploading, setUploading]   = useState(false);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [c, v] = await Promise.all([getSosContacts(), getVerificationStatus()]);
        setContacts(c);
        setVerif(v.verification);
        setTrust(v.trustScore);
      } catch (err) {
        console.error('[SafetyScreen] initial load failed', err);
      }
    })();
  }, []);

  // ── Panic ─────────────────────────────────────────────────────────────────
  const handlePanic = () => {
    if (contacts.length === 0) {
      Alert.alert(
        'Add SOS contacts first',
        'Please add at least one trusted contact before using the panic button.',
      );
      return;
    }
    Alert.alert(
      '🚨 Send panic alert?',
      `This will open SMS pre-addressed to all ${contacts.length} of your SOS contacts with your live location.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send alert',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await triggerPanic(
                currentLocation
                  ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude }
                  : undefined,
              );
              const phones = res.contacts.map((c) => c.phone).join(',');
              const sep    = Platform.OS === 'ios' ? '&' : '?';
              const sms    = `sms:${phones}${sep}body=${encodeURIComponent(res.smsBody)}`;
              const ok     = await Linking.canOpenURL(sms);
              if (!ok) throw new Error('SMS not available');
              await Linking.openURL(sms);
            } catch (err) {
              console.error('[SafetyScreen] panic failed', err);
              Alert.alert('Error', 'Could not open SMS. Try calling your contact directly.');
            }
          },
        },
      ],
    );
  };

  // ── SOS Contacts ──────────────────────────────────────────────────────────
  const handleAddContact = async () => {
    const name  = draftName.trim();
    const phone = draftPhone.trim();
    if (!name || !phone) {
      Alert.alert('Missing info', 'Both name and phone are required.');
      return;
    }
    if (contacts.length >= 3) {
      Alert.alert('Limit reached', 'You can save up to 3 SOS contacts.');
      return;
    }
    setBusy(true);
    try {
      const next = [...contacts, { name, phone }];
      const saved = await setSosContacts(next);
      setContacts(saved);
      setDraftName('');
      setDraftPhone('');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save contact.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveContact = async (idx: number) => {
    setBusy(true);
    try {
      const next = contacts.filter((_, i) => i !== idx);
      const saved = await setSosContacts(next);
      setContacts(saved);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not remove contact.');
    } finally {
      setBusy(false);
    }
  };

  // ── Verification ──────────────────────────────────────────────────────────
  // Tapping the button opens the front camera straight to record. Gallery is
  // not an option (launchCameraAsync, not launchImageLibraryAsync).
  const handleStartVerification = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera required', 'Please allow camera access in Settings to record your selfie video.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes:       ['videos'],
      cameraType:       ImagePicker.CameraType.front,
      videoMaxDuration: 15,
      quality:          0.7,
    });
    if (result.canceled || !result.assets.length) return;

    setUploading(true);
    try {
      const res = await submitVerification(result.assets[0].uri);
      setVerif(res.verification);
      setTrust(res.trustScore);
      if (profile) {
        setProfile({ ...profile, verification: res.verification, trustScore: res.trustScore });
      }
      Alert.alert(
        res.verification.status === 'verified' ? 'Verified ✓' : 'Submitted',
        res.verification.status === 'verified'
          ? 'You are now verified. Trust score updated.'
          : 'Your submission is in review. We\u2019ll notify you when it\u2019s approved.',
      );
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Could not submit verification.');
    } finally {
      setUploading(false);
    }
  };

  // ── Privacy ───────────────────────────────────────────────────────────────
  const updatePriv = async (patch: Partial<PrivacySettings>) => {
    const prev = privacy;
    const next = { ...privacy, ...patch };
    setPrivacy(next);   // optimistic
    try {
      const saved = await updatePrivacy(patch);
      setPrivacy(saved);
      if (profile) setProfile({ ...profile, privacy: saved });
    } catch (err: any) {
      setPrivacy(prev);
      Alert.alert('Error', err?.message ?? 'Could not update privacy.');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={st.root}>
      <View style={st.header}>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={st.headerBack}>
            <Ionicons name="chevron-back" size={22} color={DARK} />
          </TouchableOpacity>
        )}
        <Text style={st.headerTitle}>Safety</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Panic Button ── */}
        <TouchableOpacity
          style={st.panicBtn}
          activeOpacity={0.85}
          onPress={handlePanic}
        >
          <Text style={st.panicEmoji}>🚨</Text>
          <Text style={st.panicLabel}>PANIC</Text>
          <Text style={st.panicSub}>Tap to alert your SOS contacts now</Text>
        </TouchableOpacity>

        {/* ── Trust score card ── */}
        <View style={st.card}>
          <View style={st.trustRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.cardLabel}>YOUR TRUST SCORE</Text>
              <Text style={st.trustNum}>{trust}<Text style={st.trustOf}>/100</Text></Text>
              <Text style={st.trustHint}>
                {verif.status === 'verified'
                  ? 'You\u2019re verified — your profile gets a green check.'
                  : 'Verify your profile to add 40 points and unlock the badge.'}
              </Text>
            </View>
            <View style={[st.trustBadge, verif.status === 'verified' && { backgroundColor: TRUST }]}>
              <Ionicons
                name={verif.status === 'verified' ? 'shield-checkmark' : 'shield-outline'}
                size={26}
                color={verif.status === 'verified' ? WHITE : GRAY}
              />
            </View>
          </View>
        </View>

        {/* ── SOS Contacts ── */}
        <Text style={st.section}>SOS CONTACTS</Text>
        <Text style={st.sectionSub}>Up to 3 trusted people. They\u2019ll be alerted via SMS when you tap PANIC.</Text>

        {contacts.map((c, idx) => (
          <View key={`${c.phone}-${idx}`} style={st.contactRow}>
            <View style={st.contactAvatar}>
              <Text style={st.contactInitial}>{c.name[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.contactName}>{c.name}</Text>
              <Text style={st.contactPhone}>{c.phone}</Text>
            </View>
            <TouchableOpacity
              style={st.contactRemove}
              onPress={() => handleRemoveContact(idx)}
              disabled={busy}
            >
              <Ionicons name="close" size={18} color={PANIC} />
            </TouchableOpacity>
          </View>
        ))}

        {contacts.length < 3 && (
          <View style={st.addContact}>
            <TextInput
              style={[st.input, { flex: 1 }]}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Name"
              placeholderTextColor="#BBB"
            />
            <TextInput
              style={[st.input, { flex: 1.2 }]}
              value={draftPhone}
              onChangeText={setDraftPhone}
              placeholder="+91 98xxx xxxxx"
              placeholderTextColor="#BBB"
              keyboardType="phone-pad"
            />
            <TouchableOpacity
              style={[st.addBtn, (!draftName || !draftPhone || busy) && { opacity: 0.4 }]}
              onPress={handleAddContact}
              disabled={!draftName || !draftPhone || busy}
            >
              {busy ? <ActivityIndicator color={WHITE} size="small" /> : <Text style={st.addBtnText}>Add</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Verification ── */}
        <Text style={st.section}>VERIFICATION</Text>
        <Text style={st.sectionSub}>
          Record a short selfie video (max 15s). It proves you\u2019re a real person — verified profiles get a green badge and rank higher.
        </Text>

        <View style={st.card}>
          <View style={st.verifRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.verifStatus}>
                Status: <Text style={{ fontWeight: '700', color: verif.status === 'verified' ? TRUST : DARK }}>
                  {verif.status[0].toUpperCase() + verif.status.slice(1)}
                </Text>
              </Text>
              {verif.submittedAt && (
                <Text style={st.verifMeta}>
                  Submitted {new Date(verif.submittedAt).toLocaleDateString()}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[st.verifBtn, uploading && { opacity: 0.5 }]}
              onPress={handleStartVerification}
              disabled={uploading}
            >
              {uploading
                ? <ActivityIndicator color={WHITE} size="small" />
                : <Text style={st.verifBtnText}>
                    {verif.status === 'verified' ? 'Re-submit video' : 'Record video'}
                  </Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Privacy ── */}
        <Text style={st.section}>WHO CAN SEE ME</Text>

        {VISIBILITY_OPTIONS.map((opt) => {
          const active = privacy.visibility === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[st.visCard, active && st.visCardActive]}
              onPress={() => updatePriv({ visibility: opt.id })}
              activeOpacity={0.85}
            >
              <View style={[st.visRadio, active && st.visRadioActive]}>
                {active && <View style={st.visRadioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.visLabel}>{opt.label}</Text>
                <Text style={st.visDesc}>{opt.desc}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={st.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={st.toggleLabel}>Hide my photos until we match</Text>
            <Text style={st.toggleSub}>People see a placeholder card until you both like each other.</Text>
          </View>
          <Toggle
            on={privacy.hidePhotosUntilMatch}
            onChange={(v) => updatePriv({ hidePhotosUntilMatch: v })}
          />
        </View>

        <View style={st.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={st.toggleLabel}>Hide me from discovery</Text>
            <Text style={st.toggleSub}>You\u2019ll only appear to people you\u2019ve already matched with.</Text>
          </View>
          <Toggle
            on={privacy.hideFromSearch}
            onChange={(v) => updatePriv({ hideFromSearch: v })}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Toggle ──────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <TouchableOpacity
      style={[st.toggle, on && st.toggleOn]}
      onPress={() => onChange(!on)}
      activeOpacity={0.8}
    >
      <View style={[st.toggleKnob, on && st.toggleKnobOn]} />
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root:   { flex: 1, backgroundColor: PAGE },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: WHITE,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  headerBack:  { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: DARK },

  scroll: { padding: 16, paddingBottom: 32 },

  // Panic
  panicBtn: {
    backgroundColor: PANIC,
    borderRadius: 20, paddingVertical: 22, alignItems: 'center',
    shadowColor: PANIC, shadowOpacity: 0.35, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
    marginBottom: 18,
  },
  panicEmoji: { fontSize: 38 },
  panicLabel: { color: WHITE, fontSize: 24, fontWeight: '800', letterSpacing: 4, marginTop: 4 },
  panicSub:   { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },

  // Generic card
  card: {
    backgroundColor: WHITE, borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4, elevation: 1,
  },
  cardLabel: { fontSize: 11, fontWeight: '700', color: GRAY, letterSpacing: 1, marginBottom: 4 },

  // Trust score
  trustRow:   { flexDirection: 'row', alignItems: 'center', gap: 14 },
  trustNum:   { fontSize: 36, fontWeight: '800', color: DARK, marginVertical: 2 },
  trustOf:    { fontSize: 16, color: GRAY, fontWeight: '700' },
  trustHint:  { fontSize: 12, color: GRAY, marginTop: 4 },
  trustBadge: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: LGRAY,
    alignItems: 'center', justifyContent: 'center',
  },

  // Section
  section:    { fontSize: 11, fontWeight: '700', color: GRAY, letterSpacing: 1, marginTop: 16, marginBottom: 4 },
  sectionSub: { fontSize: 12, color: GRAY, marginBottom: 10 },

  // Contact row
  contactRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: WHITE, borderRadius: 14, padding: 12, marginBottom: 8, gap: 12,
  },
  contactAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFE5EA',
    alignItems: 'center', justifyContent: 'center',
  },
  contactInitial: { fontWeight: '700', color: '#FF4B6E', fontSize: 14 },
  contactName:    { fontSize: 14, fontWeight: '700', color: DARK },
  contactPhone:   { fontSize: 12, color: GRAY, marginTop: 2 },
  contactRemove: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFEBEE',
    alignItems: 'center', justifyContent: 'center',
  },

  // Add contact row
  addContact: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
  input: {
    backgroundColor: WHITE, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: DARK, borderWidth: 1, borderColor: BORDER,
  },
  addBtn: {
    backgroundColor: '#FF4B6E', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center', minWidth: 56,
  },
  addBtnText: { color: WHITE, fontWeight: '700', fontSize: 14 },

  // Verification
  verifRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  verifStatus: { fontSize: 14, color: DARK },
  verifMeta:   { fontSize: 12, color: GRAY, marginTop: 4 },
  verifBtn: {
    backgroundColor: DARK, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  verifBtnText: { color: WHITE, fontWeight: '700', fontSize: 13 },

  // Visibility cards
  visCard: {
    flexDirection: 'row', backgroundColor: WHITE, borderRadius: 14, padding: 14,
    marginBottom: 8, alignItems: 'center', gap: 12, borderWidth: 2, borderColor: 'transparent',
  },
  visCardActive: { borderColor: '#FF4B6E', backgroundColor: '#FFF5F7' },
  visRadio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  visRadioActive: { borderColor: '#FF4B6E' },
  visRadioDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF4B6E' },
  visLabel:       { fontSize: 14, fontWeight: '700', color: DARK },
  visDesc:        { fontSize: 12, color: GRAY, marginTop: 2 },

  // Toggle row
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE,
    borderRadius: 14, padding: 14, marginBottom: 8, gap: 12,
  },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: DARK },
  toggleSub:   { fontSize: 12, color: GRAY, marginTop: 2 },

  // Toggle
  toggle: {
    width: 46, height: 26, borderRadius: 13, backgroundColor: '#D0D0D0',
    padding: 3, justifyContent: 'center',
  },
  toggleOn: { backgroundColor: '#22C55E' },
  toggleKnob: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: WHITE,
  },
  toggleKnobOn: { transform: [{ translateX: 20 }] },
});
