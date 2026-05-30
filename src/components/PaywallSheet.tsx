/**
 * PaywallSheet.tsx
 *
 * Bottom sheet shown when a user tries to use a premium feature without
 * an active subscription. Routes to SubscriptionScreen when they tap upgrade.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const BRAND = '#FF4B6E';
const DARK  = '#1A1A1A';
const GRAY  = '#888';

interface Props {
  visible:  boolean;
  feature:  'likes-received' | 'star';
  onClose:  () => void;
}

const COPY: Record<Props['feature'], { title: string; body: string; icon: any }> = {
  'likes-received': {
    title: 'See who likes you',
    body:  'Unlock everyone who already liked you and never miss a match.',
    icon:  'heart',
  },
  'star': {
    title: 'Send stars',
    body:  'Stars stand out from regular likes. Get noticed by the people you really want to match with.',
    icon:  'star',
  },
};

export default function PaywallSheet({ visible, feature, onClose }: Props) {
  const navigation = useNavigation<any>();
  const copy = COPY[feature];

  const goPremium = () => {
    onClose();
    navigation.navigate('Subscription');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropFill} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.iconCircle}>
            <Ionicons name={copy.icon} size={32} color="#fff" />
          </View>

          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={goPremium} activeOpacity={0.85}>
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={styles.primaryText}>Try Spark Premium</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} activeOpacity={0.6}>
            <Text style={styles.secondaryText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  backdropFill: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor:    '#fff',
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop:        12,
    paddingBottom:     Platform.OS === 'ios' ? 36 : 24,
    alignItems:        'center',
  },
  handle: {
    width: 40, height: 5, borderRadius: 3,
    backgroundColor: '#E0E0E0', marginBottom: 16,
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: BRAND,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '800', color: DARK, marginBottom: 8 },
  body:  { fontSize: 14, color: GRAY, textAlign: 'center', lineHeight: 20, marginBottom: 22, paddingHorizontal: 12 },
  primaryBtn: {
    flexDirection: 'row', gap: 8,
    backgroundColor: BRAND,
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondaryBtn: { paddingVertical: 16, alignItems: 'center' },
  secondaryText: { color: GRAY, fontSize: 14, fontWeight: '600' },
});
