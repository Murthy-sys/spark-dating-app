/**
 * SetupProfileScreen.tsx
 *
 * 7-step onboarding / profile-completion flow.
 *   1. Gender
 *   2. About You (bio)
 *   3. Hobbies (chips)
 *   4. Relationship Preferences (multi-select)
 *   5. Conduct Acknowledgement (checkbox)
 *   6. Terms & Conditions (checkbox)
 *   7. Review & Complete
 *
 * On completion the profile is PATCH-ed via updateUserProfile().
 * The authStore.setProfile() call causes the AppNavigator to
 * re-evaluate hasCompletedSetup and automatically push to Main.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { updateUserProfile } from '../../services/userService';

/* ─────────────────────────────── constants ─────────────────────────────── */

const BRAND        = '#FF4B6E';
const BRAND_LIGHT  = 'rgba(255,75,110,0.08)';
const TOTAL_STEPS  = 7;
const ABOUT_MIN    = 10;
const ABOUT_MAX    = 300;

const HOBBY_SUGGESTIONS = [
  'Music', 'Travel', 'Fitness', 'Movies', 'Reading', 'Cooking',
  'Photography', 'Gaming', 'Hiking', 'Dancing', 'Yoga', 'Art',
  'Sports', 'Writing', 'Gardening', 'Tech', 'Fashion', 'Meditation',
] as const;

const RELATIONSHIP_OPTIONS = [
  { id: 'friendship' as const, label: 'Friendship',           icon: '🤝', desc: 'Looking for meaningful connections' },
  { id: 'casual'     as const, label: 'Casual Dating',        icon: '☕', desc: 'Fun, low-pressure meetups'          },
  { id: 'serious'    as const, label: 'Serious Relationship', icon: '💜', desc: 'Ready for something real'           },
];

/* ──────────────────────────────── types ────────────────────────────────── */

type RelOption = 'friendship' | 'casual' | 'serious';

interface FormData {
  gender:       'male' | 'female' | '';
  about:        string;
  hobbies:      string[];
  relationship: RelOption[];
  conduct:      boolean;
  terms:        boolean;
}

const INITIAL_FORM: FormData = {
  gender:       '',
  about:        '',
  hobbies:      [],
  relationship: [],
  conduct:      false,
  terms:        false,
};

/* ────────────────────────── shared sub-components ─────────────────────── */

/** Animated progress bar at the top of the screen. */
function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.round((step / total) * 100);
  return (
    <View style={s.progressWrap}>
      <View style={s.progressMeta}>
        <Text style={s.progressMeta}>Step {step} of {total}</Text>
        <Text style={s.progressMeta}>{pct}%</Text>
      </View>
      <View style={s.progressTrack}>
        {/* We use a nested View with fixed width% — Animated is optional here */}
        <View style={[s.progressFill, { width: `${pct}%` as any }]} />
      </View>
    </View>
  );
}

/** Reusable checkbox card. */
function CheckboxCard({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <TouchableOpacity
      style={[s.checkCard, checked && s.checkCardActive]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={[s.checkbox, checked && s.checkboxChecked]}>
        {checked && <Text style={s.checkboxTick}>✓</Text>}
      </View>
      <Text style={[s.checkLabel, checked && s.checkLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Bottom navigation row — back chevron + continue/complete button. */
function NavBar({
  step,
  disabled,
  loading,
  label,
  onBack,
  onNext,
}: {
  step:     number;
  disabled: boolean;
  loading:  boolean;
  label:    string;
  onBack:   () => void;
  onNext:   () => void;
}) {
  return (
    <View style={s.navBar}>
      {step > 1 && (
        <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={s.backBtnText}>‹</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[s.nextBtn, (disabled || loading) && s.nextBtnOff]}
        onPress={onNext}
        disabled={disabled || loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={[s.nextBtnTxt, (disabled || loading) && s.nextBtnTxtOff]}>{label}</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

/* ═══════════════════════════ step screens ══════════════════════════════ */

/* ── Step 1 ─ Gender ──────────────────────────────────────────────────── */
function GenderStep({
  value,
  onChange,
}: {
  value: FormData['gender'];
  onChange: (v: 'male' | 'female') => void;
}) {
  const OPTIONS = [
    { id: 'male'   as const, label: 'Male',   icon: '👨' },
    { id: 'female' as const, label: 'Female', icon: '👩' },
  ];
  return (
    <View style={s.stepPad}>
      {OPTIONS.map(o => {
        const active = value === o.id;
        return (
          <TouchableOpacity
            key={o.id}
            style={[s.optCard, active && s.optCardActive]}
            onPress={() => onChange(o.id)}
            activeOpacity={0.8}
          >
            <Text style={s.optIcon}>{o.icon}</Text>
            <Text style={[s.optLabel, active && s.optLabelActive]}>{o.label}</Text>
            {active && <Text style={s.optCheck}>✓</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ── Step 2 ─ About You ───────────────────────────────────────────────── */
function AboutStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const len      = value.length;
  const overMax  = len > ABOUT_MAX;
  const tooShort = len > 0 && len < ABOUT_MIN;

  return (
    <View style={[s.stepPad, { flex: 1 }]}>
      <View>
        <TextInput
          style={[s.textarea, overMax && s.textareaErr]}
          value={value}
          onChangeText={onChange}
          placeholder="e.g. Coffee lover, weekend hiker, and huge fan of sci-fi movies…"
          placeholderTextColor="#bbb"
          multiline
          textAlignVertical="top"
          blurOnSubmit
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
        />
        <Text
          style={[
            s.charCount,
            overMax              ? s.charErr  :
            len > ABOUT_MAX * 0.85 ? s.charWarn : null,
          ]}
        >
          {len}/{ABOUT_MAX}
        </Text>
      </View>

      {tooShort && (
        <Text style={s.hint}>At least {ABOUT_MIN} characters please.</Text>
      )}
      {overMax && (
        <Text style={[s.hint, { color: '#ef4444' }]}>
          Exceeds the {ABOUT_MAX}-character limit.
        </Text>
      )}
    </View>
  );
}

/* ── Step 3 ─ Hobbies ─────────────────────────────────────────────────── */
function HobbiesStep({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [custom, setCustom] = useState('');

  const toggle = (h: string) =>
    onChange(value.includes(h) ? value.filter(x => x !== h) : [...value, h]);

  const addCustom = () => {
    const t = custom.trim();
    if (t && !value.includes(t)) { onChange([...value, t]); setCustom(''); }
  };

  return (
    <ScrollView style={[s.stepPad, { flex: 1 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Selected chips ── */}
        {value.length > 0 && (
          <View style={s.chipRow}>
            {value.map(h => (
              <TouchableOpacity
                key={h}
                style={s.chipOn}
                onPress={() => toggle(h)}
                activeOpacity={0.8}
              >
                <Text style={s.chipOnTxt}>{h}  ✕</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Custom input ── */}
        <View style={s.customRow}>
          <TextInput
            style={s.customInput}
            value={custom}
            onChangeText={setCustom}
            onSubmitEditing={addCustom}
            placeholder="Add your own…"
            placeholderTextColor="#bbb"
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[s.addBtn, !custom.trim() && s.addBtnOff]}
            onPress={addCustom}
            disabled={!custom.trim()}
            activeOpacity={0.8}
          >
            <Text style={[s.addBtnTxt, !custom.trim() && s.addBtnTxtOff]}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* ── Suggestion chips ── */}
        <Text style={s.sectionLbl}>SUGGESTIONS</Text>
        <View style={s.chipRow}>
          {HOBBY_SUGGESTIONS.filter(h => !value.includes(h)).map(h => (
            <TouchableOpacity
              key={h}
              style={s.chipOff}
              onPress={() => toggle(h)}
              activeOpacity={0.7}
            >
              <Text style={s.chipOffTxt}>{h}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* bottom padding so last chip isn't hidden by nav bar */}
        <View style={{ height: 24 }} />
      </ScrollView>
  );
}

/* ── Step 4 ─ Relationship Preferences ───────────────────────────────── */
function RelationshipStep({
  value,
  onChange,
}: {
  value: RelOption[];
  onChange: (v: RelOption[]) => void;
}) {
  const toggle = (id: RelOption) =>
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);

  return (
    <View style={s.stepPad}>
      {RELATIONSHIP_OPTIONS.map(o => {
        const active = value.includes(o.id);
        return (
          <TouchableOpacity
            key={o.id}
            style={[s.optCard, active && s.optCardActive]}
            onPress={() => toggle(o.id)}
            activeOpacity={0.8}
          >
            <Text style={s.optIcon}>{o.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.optLabel, active && s.optLabelActive]}>{o.label}</Text>
              <Text style={s.optDesc}>{o.desc}</Text>
            </View>
            {active && <Text style={s.optCheck}>✓</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ── Step 5 ─ Community Guidelines ───────────────────────────────────── */
function ConductStep({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={s.stepPad}>
      <View style={s.infoBox}>
        <Text style={s.infoTxt}>
          I agree to behave respectfully with other users. Any inappropriate behaviour may lead to{' '}
          <Text style={{ color: '#ef4444', fontWeight: '700' }}>legal consequences</Text>.
        </Text>
      </View>
      <CheckboxCard
        checked={value}
        onToggle={() => onChange(!value)}
        label="I agree to the community guidelines"
      />
    </View>
  );
}

/* ── Step 6 ─ Terms & Conditions ─────────────────────────────────────── */
function TermsStep({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={s.stepPad}>
      <ScrollView
        style={s.termsBox}
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        <Text style={s.termsTxt}>
          <Text style={{ fontWeight: '700', color: '#1a1a1a' }}>Spark</Text>
          {' '}is a platform for users to meet and connect. The app is not responsible for
          user interactions or outcomes arising from those interactions.{'\n\n'}
          By using this app, you acknowledge that all conversations and meetups happen
          at your own discretion and risk. Spark reserves the right to suspend or
          terminate accounts that violate community standards.
        </Text>
      </ScrollView>
      <CheckboxCard
        checked={value}
        onToggle={() => onChange(!value)}
        label="I accept the Terms & Conditions"
      />
    </View>
  );
}

/* ── Step 7 ─ Review & Complete ──────────────────────────────────────── */
function ReviewStep({ data }: { data: FormData }) {
  const rows: { label: string; value: string }[] = [
    {
      label: 'Gender',
      value: data.gender === 'male' ? 'Male' : 'Female',
    },
    {
      label: 'About',
      value: data.about.length > 60 ? data.about.slice(0, 60) + '…' : data.about,
    },
    {
      label: 'Hobbies',
      value: data.hobbies.join(', '),
    },
    {
      label: 'Looking for',
      value: data.relationship
        .map(r => RELATIONSHIP_OPTIONS.find(o => o.id === r)?.label ?? '')
        .join(', '),
    },
    { label: 'Conduct', value: data.conduct ? 'Accepted ✓' : '—' },
    { label: 'Terms',   value: data.terms   ? 'Accepted ✓' : '—' },
  ];

  return (
    <View style={s.stepPad}>
      <View style={s.reviewCard}>
        {rows.map((r, i) => (
          <View
            key={r.label}
            style={[s.reviewRow, i < rows.length - 1 && s.reviewRowBorder]}
          >
            <Text style={s.reviewLbl}>{r.label}</Text>
            <Text style={s.reviewVal} numberOfLines={2}>{r.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ══════════════════════════ main screen ═══════════════════════════════ */

export default function SetupProfileScreen() {
  const { profile, setProfile } = useAuthStore();

  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [form,    setForm]    = useState<FormData>(INITIAL_FORM);

  /* Typed setter — keeps one call site per field */
  const set = useCallback(
    <K extends keyof FormData>(key: K) =>
      (val: FormData[K]) => setForm(prev => ({ ...prev, [key]: val })),
    [],
  );

  /* Per-step validation */
  const isValid = (): boolean => {
    switch (step) {
      case 1: return !!form.gender;
      case 2: return form.about.length >= ABOUT_MIN && form.about.length <= ABOUT_MAX;
      case 3: return form.hobbies.length > 0;
      case 4: return form.relationship.length > 0;
      case 5: return form.conduct;
      case 6: return form.terms;
      case 7: return (
        !!form.gender &&
        form.about.length >= ABOUT_MIN && form.about.length <= ABOUT_MAX &&
        form.hobbies.length > 0 &&
        form.relationship.length > 0 &&
        form.conduct &&
        form.terms
      );
      default: return false;
    }
  };

  const handleNext = async () => {
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1);
      return;
    }

    /* Final step — PATCH the profile */
    try {
      setLoading(true);
      const updated = await updateUserProfile({
        gender:    form.gender as any,
        bio:       form.about,
        hobbies:   form.hobbies,
        lookingFor: form.relationship,
      } as any);
      setProfile({ ...profile!, ...updated });
      /* Navigation to Main happens automatically via AppNavigator's
         hasCompletedSetup check re-evaluating on profile change. */
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* Step metadata */
  const STEPS: Record<number, { title: string; subtitle: string }> = {
    1: { title: "What's your gender?",      subtitle: "Select the option that best describes you."          },
    2: { title: 'About You',                subtitle: 'Write a short bio so others can get to know you.'    },
    3: { title: 'Your Hobbies',             subtitle: 'Pick things you enjoy — they help us find your people.' },
    4: { title: 'What are you looking for?',subtitle: 'You can pick more than one — no judgement here.'     },
    5: { title: 'Community Guidelines',     subtitle: "We're building a safe space for everyone."           },
    6: { title: 'Terms & Conditions',       subtitle: 'Almost there — one last thing.'                      },
    7: { title: 'Review Your Profile',      subtitle: 'Everything looks good? Let\'s go!'                   },
  };
  const { title, subtitle } = STEPS[step];

  const nextLabel =
    step === TOTAL_STEPS ? '✨  Complete Profile' : 'Continue  →';

  return (
    <SafeAreaView style={s.root}>
      {/*
        KeyboardAvoidingView wraps EVERYTHING including NavBar so the
        Continue button slides up above the keyboard on both iOS and Android.
        TouchableWithoutFeedback lets the user tap anywhere outside the
        TextInput to dismiss the keyboard.
      */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1 }}>

            {/* ── Header ── */}
            <View style={s.header}>
              <Text style={s.logo}>SPARK</Text>
            </View>

            {/* ── Progress ── */}
            <ProgressBar step={step} total={TOTAL_STEPS} />

            {/* ── Step title ── */}
            <View style={s.titleArea}>
              <Text style={s.title}>{title}</Text>
              <Text style={s.subtitle}>{subtitle}</Text>
            </View>

            {/* ── Step content (keyed so it remounts on step change) ── */}
            <View style={{ flex: 1 }} key={step}>
              {step === 1 && <GenderStep       value={form.gender}       onChange={set('gender')}       />}
              {step === 2 && <AboutStep        value={form.about}        onChange={set('about')}        />}
              {step === 3 && <HobbiesStep      value={form.hobbies}      onChange={set('hobbies')}      />}
              {step === 4 && <RelationshipStep value={form.relationship}  onChange={set('relationship')} />}
              {step === 5 && <ConductStep      value={form.conduct}       onChange={set('conduct')}      />}
              {step === 6 && <TermsStep        value={form.terms}         onChange={set('terms')}        />}
              {step === 7 && <ReviewStep       data={form}                                               />}
            </View>

            {/* ── Navigation ── */}
            <NavBar
              step={step}
              disabled={!isValid()}
              loading={loading}
              label={nextLabel}
              onBack={() => setStep(s => Math.max(1, s - 1))}
              onNext={handleNext}
            />

          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ═══════════════════════════ styles ════════════════════════════════════ */

const s = StyleSheet.create({

  /* root */
  root: { flex: 1, backgroundColor: '#fff' },

  /* header */
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  logo:   { fontSize: 22, fontWeight: '900', color: BRAND, letterSpacing: 3 },

  /* progress */
  progressWrap:  { paddingHorizontal: 24, marginBottom: 6 },
  progressMeta:  { flexDirection: 'row', justifyContent: 'space-between', fontSize: 12, color: '#aaa', fontWeight: '500' },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: '#f0f0f0', overflow: 'hidden', marginTop: 6 },
  progressFill:  { height: '100%', borderRadius: 3, backgroundColor: BRAND },

  /* step title */
  titleArea: { paddingHorizontal: 24, paddingBottom: 16 },
  title:     { fontSize: 26, fontWeight: '800', color: '#1a1a1a', marginBottom: 4, lineHeight: 32 },
  subtitle:  { fontSize: 14, color: '#888', lineHeight: 20 },

  /* common step padding */
  stepPad: { flex: 1, paddingHorizontal: 24 },

  /* option cards (gender + relationship) */
  optCard: {
    flexDirection: 'row', alignItems: 'center', padding: 18,
    borderRadius: 16, borderWidth: 2, borderColor: '#f0f0f0',
    backgroundColor: '#fafafa', marginBottom: 14,
  },
  optCardActive:  { borderColor: BRAND, backgroundColor: BRAND_LIGHT },
  optIcon:        { fontSize: 30, marginRight: 16 },
  optLabel:       { fontSize: 17, fontWeight: '600', color: '#555' },
  optLabelActive: { color: BRAND },
  optDesc:        { fontSize: 13, color: '#aaa', marginTop: 2 },
  optCheck:       { fontSize: 18, color: BRAND, fontWeight: '800', marginLeft: 8 },

  /* textarea (about) */
  textarea: {
    borderWidth: 2, borderColor: '#f0f0f0', borderRadius: 16,
    padding: 16, paddingBottom: 32, fontSize: 15, color: '#1a1a1a',
    backgroundColor: '#fafafa', minHeight: 130, lineHeight: 22,
  },
  textareaErr: { borderColor: '#ef4444' },
  charCount:   { position: 'absolute', bottom: 10, right: 14, fontSize: 12, color: '#bbb' },
  charErr:     { color: '#ef4444' },
  charWarn:    { color: '#f59e0b' },
  hint:        { fontSize: 12, color: '#f59e0b', marginTop: 8, marginLeft: 4 },

  /* hobbies chips */
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chipOn: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: BRAND,
  },
  chipOnTxt:  { color: '#fff', fontSize: 13, fontWeight: '600' },
  chipOff: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#e5e5e5', backgroundColor: '#fff',
  },
  chipOffTxt: { color: '#666', fontSize: 13, fontWeight: '500' },

  /* custom hobby input */
  customRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  customInput: {
    flex: 1, height: 46, borderRadius: 14, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: '#e5e5e5', backgroundColor: '#fafafa',
    color: '#1a1a1a', fontSize: 14,
  },
  addBtn: {
    height: 46, paddingHorizontal: 18, borderRadius: 14,
    backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center',
  },
  addBtnOff:    { backgroundColor: '#f0f0f0' },
  addBtnTxt:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  addBtnTxtOff: { color: '#bbb' },
  sectionLbl:   { fontSize: 11, color: '#bbb', fontWeight: '700', letterSpacing: 1, marginBottom: 10 },

  /* info box (conduct/terms) */
  infoBox: {
    padding: 20, borderRadius: 16, backgroundColor: '#fafafa',
    borderWidth: 1.5, borderColor: '#f0f0f0', marginBottom: 20,
  },
  infoTxt: { fontSize: 15, color: '#444', lineHeight: 22 },

  /* terms scroll box */
  termsBox: {
    maxHeight: 160, borderRadius: 16, backgroundColor: '#fafafa',
    borderWidth: 1.5, borderColor: '#f0f0f0', padding: 16, marginBottom: 20,
  },
  termsTxt: { fontSize: 14, color: '#666', lineHeight: 22 },

  /* checkbox card */
  checkCard: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e5e5', gap: 14,
  },
  checkCardActive:  { borderColor: BRAND, backgroundColor: BRAND_LIGHT },
  checkbox: {
    width: 24, height: 24, borderRadius: 8,
    borderWidth: 2, borderColor: '#ddd',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: BRAND, borderColor: BRAND },
  checkboxTick:    { color: '#fff', fontSize: 14, fontWeight: '800' },
  checkLabel:      { flex: 1, fontSize: 15, color: '#888', fontWeight: '500' },
  checkLabelActive:{ color: BRAND },

  /* review card */
  reviewCard: {
    borderRadius: 16, backgroundColor: '#fafafa',
    borderWidth: 1.5, borderColor: '#f0f0f0', paddingHorizontal: 18,
  },
  reviewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 14,
  },
  reviewRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  reviewLbl: { fontSize: 13, color: '#aaa', fontWeight: '600' },
  reviewVal: { fontSize: 14, color: '#333', fontWeight: '500', maxWidth: '60%', textAlign: 'right' },

  /* nav bar */
  navBar: {
    flexDirection: 'row', paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 8 : 20,
    paddingTop: 12, gap: 12,
  },
  backBtn: {
    width: 52, height: 52, borderRadius: 16,
    borderWidth: 1.5, borderColor: '#e5e5e5',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  backBtnText: { fontSize: 28, color: '#666', lineHeight: 32, marginTop: -2 },
  nextBtn: {
    flex: 1, height: 52, borderRadius: 16,
    backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center',
  },
  nextBtnOff:    { backgroundColor: '#f0f0f0' },
  nextBtnTxt:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  nextBtnTxtOff: { color: '#ccc' },
});
