/**
 * SubscriptionScreen.tsx
 *
 * Spark Premium plan + checkout flow.
 *
 * - Reads the user's age-based plan from the backend
 * - Lets the user start a Razorpay subscription (autopay)
 * - If already subscribed, shows status + cancel control
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import {
  cancelSubscription,
  createSubscription,
  getMyPlan,
  getMySubscription,
  MyPlanResponse,
  SubscriptionRecord,
  verifySubscriptionPayment,
} from '../../services/subscriptionService';
import RazorpayCheckout, { RazorpayCheckoutResult } from '../../components/RazorpayCheckout';
import { useSubscriptionStore } from '../../hooks/useSubscription';

const BRAND = '#FF4B6E';
const DARK  = '#1A1A1A';
const GRAY  = '#888';
const BG    = '#FFFFFF';

const PERKS = [
  { icon: 'heart' as const,         text: 'See everyone who liked you' },
  { icon: 'star' as const,          text: 'Send unlimited stars (super-likes)' },
  { icon: 'eye' as const,           text: 'Know when your likes get a response' },
  { icon: 'shield-checkmark' as const, text: 'Premium badge on your profile' },
  { icon: 'infinite' as const,      text: 'Unlimited likes (free for everyone)' },
];

export default function SubscriptionScreen() {
  const navigation = useNavigation<any>();
  const profile    = useAuthStore((s) => s.profile);

  const [planInfo,    setPlanInfo]    = useState<MyPlanResponse | null>(null);
  const [current,     setCurrent]     = useState<SubscriptionRecord | null>(null);
  const [isActive,    setIsActive]    = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);

  const [checkout, setCheckout] = useState<{
    keyId:          string;
    subscriptionId: string;
  } | null>(null);

  // ─── Load plan + current subscription ────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [p, m] = await Promise.all([getMyPlan(), getMySubscription()]);
      setPlanInfo(p);
      setIsActive(m.isActive);
      setCurrent(m.subscription);
      // Sync the global store so the Profile card and any paywall checks
      // reflect the latest authoritative state immediately.
      useSubscriptionStore.setState({
        isActive:     m.isActive,
        subscription: m.subscription,
      });
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Failed to load plan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // ─── Subscribe ───────────────────────────────────────────────────────────────
  const handleSubscribe = async () => {
    try {
      setSubmitting(true);
      const { subscription, keyId } = await createSubscription();
      setCheckout({ keyId, subscriptionId: subscription.razorpaySubscriptionId });
    } catch (e: any) {
      const code = e?.response?.data?.code;
      if (code === 'SUBSCRIPTION_EXISTS') {
        Alert.alert('Already subscribed', 'You already have a subscription. Cancel it before creating a new one.');
        await refresh();
      } else {
        Alert.alert('Could not start checkout', e?.response?.data?.message ?? e.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Razorpay → success / dismiss / failure ─────────────────────────────────
  const handleCheckoutResult = async (r: RazorpayCheckoutResult) => {
    setCheckout(null);

    if (r.type === 'success') {
      try {
        await verifySubscriptionPayment({
          razorpay_payment_id:      r.razorpay_payment_id!,
          razorpay_subscription_id: r.razorpay_subscription_id!,
          razorpay_signature:       r.razorpay_signature!,
        });
        Alert.alert(
          'Welcome to Spark Premium 🎉',
          'Autopay is set up. You can cancel anytime from this screen.',
        );
        await refresh();
      } catch (e: any) {
        Alert.alert('Payment received', 'We could not verify the payment immediately. It will appear shortly.');
      }
    } else if (r.type === 'error') {
      Alert.alert('Payment failed', r.description ?? 'Please try again.');
    }
    // 'dismissed' → silent; user closed the sheet
  };

  // ─── Cancel ──────────────────────────────────────────────────────────────────
  const handleCancel = () => {
    Alert.alert(
      'Cancel autopay?',
      'You\'ll keep premium access until the end of the current billing cycle. After that, your card will not be charged again.',
      [
        { text: 'Keep premium', style: 'cancel' },
        {
          text:    'Cancel autopay',
          style:   'destructive',
          onPress: async () => {
            try {
              await cancelSubscription(false);
              Alert.alert('Cancelled', 'Autopay has been turned off.');
              await refresh();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.message ?? 'Could not cancel');
            }
          },
        },
      ],
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={BRAND} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={DARK} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Spark Premium</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.heroBadgeText}>PREMIUM</Text>
          </View>
          <Text style={styles.heroTitle}>Unlock the full Spark experience</Text>
          <Text style={styles.heroSubtitle}>
            See who likes you, send stars, and know when your messages get a response.
          </Text>
        </View>

        {/* Perks */}
        <View style={styles.perksWrap}>
          {PERKS.map((p) => (
            <View style={styles.perkRow} key={p.icon}>
              <View style={styles.perkIconWrap}>
                <Ionicons name={p.icon} size={18} color={BRAND} />
              </View>
              <Text style={styles.perkText}>{p.text}</Text>
            </View>
          ))}
        </View>

        {/* Active state */}
        {isActive && current ? (
          <View style={styles.activeCard}>
            <View style={styles.activeHeader}>
              <Ionicons name="checkmark-circle" size={22} color="#28A745" />
              <Text style={styles.activeTitle}>Premium is active</Text>
            </View>
            <Text style={styles.activeMeta}>
              Status: <Text style={styles.activeMetaStrong}>{current.status}</Text>
            </Text>
            {current.currentEnd && (
              <Text style={styles.activeMeta}>
                Next charge: <Text style={styles.activeMetaStrong}>
                  {new Date(current.currentEnd).toLocaleDateString()}
                </Text>
              </Text>
            )}
            {current.cancelAtPeriodEnd && (
              <Text style={[styles.activeMeta, { color: '#C0392B' }]}>
                Autopay cancelled — access ends on the date above.
              </Text>
            )}

            {!current.cancelAtPeriodEnd && (
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.85}>
                <Text style={styles.cancelBtnText}>Cancel autopay</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          // ─── Plan card + subscribe CTA ──────────────────────────────────────
          <View style={styles.planCard}>
            <Text style={styles.planLabel}>{planInfo?.plan.label}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceCurrency}>₹</Text>
              <Text style={styles.priceAmount}>{planInfo?.plan.amountRupees}</Text>
              <Text style={styles.pricePeriod}>/month</Text>
            </View>
            <Text style={styles.planNote}>
              Auto-renews monthly. Cancel anytime — your card is charged only while autopay is on.
            </Text>

            <TouchableOpacity
              style={[styles.subscribeBtn, submitting && { opacity: 0.6 }]}
              disabled={submitting}
              onPress={handleSubscribe}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.subscribeText}>Subscribe — ₹{planInfo?.plan.amountRupees}/mo</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              Powered by Razorpay. By subscribing, you authorize a recurring monthly
              charge of ₹{planInfo?.plan.amountRupees} until you cancel.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Razorpay checkout */}
      {checkout && (
        <RazorpayCheckout
          visible
          keyId={checkout.keyId}
          subscriptionId={checkout.subscriptionId}
          prefill={{
            name:  profile?.displayName,
            email: profile?.email,
          }}
          merchantName="Spark"
          description={`${planInfo?.plan.label} — ₹${planInfo?.plan.amountRupees}/month`}
          onClose={handleCheckoutResult}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: BG },
  center:  { alignItems: 'center', justifyContent: 'center' },
  scroll:  { paddingBottom: 60 },

  // top bar
  topBar: {
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop:    Platform.OS === 'android' ? 12 : 4,
    paddingBottom: 12,
  },
  backBtn:  { padding: 4 },
  topTitle: { fontSize: 18, fontWeight: '800', color: DARK },

  // hero
  hero: {
    paddingHorizontal: 24,
    paddingTop:        12,
    paddingBottom:     20,
    alignItems:        'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems:    'center',
    gap: 6,
    backgroundColor: BRAND,
    paddingHorizontal: 12,
    paddingVertical:    6,
    borderRadius:      20,
    marginBottom:      14,
  },
  heroBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  heroTitle:    { fontSize: 24, fontWeight: '800', color: DARK, textAlign: 'center', marginBottom: 8 },
  heroSubtitle: { fontSize: 15, color: GRAY, textAlign: 'center', lineHeight: 21 },

  // perks
  perksWrap: { paddingHorizontal: 24, gap: 14, marginBottom: 24 },
  perkRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  perkIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFE5EA',
    alignItems: 'center', justifyContent: 'center',
  },
  perkText: { fontSize: 15, color: DARK, flex: 1 },

  // plan card
  planCard: {
    marginHorizontal: 20,
    backgroundColor:  '#fff',
    borderRadius:     20,
    padding:          24,
    borderWidth:      1,
    borderColor:      '#f0f0f0',
    shadowColor:      '#000',
    shadowOpacity:    0.05,
    shadowOffset:     { width: 0, height: 4 },
    shadowRadius:     12,
    elevation:        3,
    alignItems:       'center',
  },
  planLabel: { fontSize: 14, fontWeight: '700', color: BRAND, marginBottom: 6 },
  priceRow:  { flexDirection: 'row', alignItems: 'baseline' },
  priceCurrency: { fontSize: 24, fontWeight: '700', color: DARK },
  priceAmount:   { fontSize: 56, fontWeight: '900', color: DARK, letterSpacing: -1 },
  pricePeriod:   { fontSize: 16, color: GRAY, marginLeft: 4 },
  planNote: { fontSize: 13, color: GRAY, textAlign: 'center', lineHeight: 19, marginVertical: 14 },
  subscribeBtn: {
    backgroundColor: BRAND,
    borderRadius:    30,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems:      'center',
    width:           '100%',
    marginTop:       6,
  },
  subscribeText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  disclaimer: { fontSize: 11, color: GRAY, textAlign: 'center', marginTop: 14, lineHeight: 16 },

  // active card
  activeCard: {
    marginHorizontal: 20,
    backgroundColor: '#F6FFF8',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#D1F0DC',
  },
  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  activeTitle:  { fontSize: 18, fontWeight: '800', color: DARK },
  activeMeta:   { fontSize: 14, color: '#444', marginTop: 4 },
  activeMetaStrong: { fontWeight: '700', color: DARK },
  cancelBtn: {
    marginTop: 18,
    borderWidth: 1.5,
    borderColor: '#C0392B',
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#C0392B', fontWeight: '700', fontSize: 15 },
});
