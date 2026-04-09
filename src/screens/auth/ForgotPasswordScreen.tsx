import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types';
import { apiClient } from '../../services/apiClient';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

type Step = 'email' | 'otp';

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [step, setStep]               = useState<Step>('email');
  const [email, setEmail]             = useState('');
  const [otp, setOtp]                 = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm]         = useState('');
  const [loading, setLoading]         = useState(false);
  const [serverMsg, setServerMsg]     = useState('');

  // ── Step 1: request OTP ─────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your email address.');
      return;
    }
    try {
      setLoading(true);
      console.log('[ForgotPwd] Calling /auth/forgot-password with email:', email.trim());
      const { data } = await apiClient.post('/auth/forgot-password', { email: email.trim() });
      console.log('[ForgotPwd] Response:', JSON.stringify(data));

      // If user not found in DB, the backend returns userNotFound: true
      if (data.userNotFound) {
        Alert.alert(
          'Email not registered',
          'No account was found with that email address. Please check the email or sign up first.',
        );
        return;   // Stay on email step so user can correct it
      }

      setServerMsg(data.message || '');
      setStep('otp');
    } catch (err: any) {
      console.log('[ForgotPwd] Error:', err.response?.status, err.response?.data || err.message);
      const status = err.response?.status;
      const msg    = err.response?.data?.message || err.message || 'Request failed';

      if (status === 429) {
        Alert.alert('Too many attempts', 'Please wait a few minutes and try again.');
      } else if (err.code === 'ECONNREFUSED' || err.message === 'Network Error') {
        Alert.alert('Connection failed', 'Cannot reach the backend server. Make sure it is running.');
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP + set new password ───────────────────────────────────
  const handleReset = async () => {
    if (!otp.trim() || !newPassword || !confirm) {
      Alert.alert('Required', 'Please fill in all fields.');
      return;
    }
    if (newPassword !== confirm) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Too short', 'Password must be at least 6 characters.');
      return;
    }
    try {
      setLoading(true);
      await apiClient.post('/auth/reset-password', {
        email: email.trim(),
        otp:   otp.trim(),
        newPassword,
      });
      Alert.alert('Success', 'Your password has been reset. Please sign in.', [
        { text: 'Sign In', onPress: () => navigation.replace('Login') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          {step === 'email' ? (
            <>
              <Text style={styles.title}>Forgot password?</Text>
              <Text style={styles.subtitle}>
                Enter your email and we'll send you a 6-digit OTP to reset your password.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>Send OTP</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Enter OTP</Text>
              <Text style={styles.subtitle}>
                We sent a 6-digit OTP to{' '}
                <Text style={styles.emailHighlight}>{email}</Text>.
                Enter it below along with your new password.
              </Text>

              {!!serverMsg && (
                <View style={styles.msgBanner}>
                  <Text style={styles.msgText}>{serverMsg}</Text>
                </View>
              )}

              <TextInput
                style={styles.input}
                placeholder="6-digit OTP"
                placeholderTextColor="#aaa"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TextInput
                style={styles.input}
                placeholder="New password"
                placeholderTextColor="#aaa"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor="#aaa"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleReset}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>Reset Password</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.resendBtn} onPress={() => setStep('email')}>
                <Text style={styles.resendText}>Didn't receive it? Go back</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#fff' },
  inner:          { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 40 },
  backBtn:        { marginBottom: 30 },
  backText:       { fontSize: 16, color: '#FF4B6E' },
  title:          { fontSize: 30, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  subtitle:       { fontSize: 15, color: '#888', marginBottom: 28, lineHeight: 22 },
  emailHighlight: { color: '#FF4B6E', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 14,
    backgroundColor: '#fafafa',
    color: '#1a1a1a',
  },
  button: {
    backgroundColor: '#FF4B6E',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText:     { color: '#fff', fontSize: 17, fontWeight: '700' },
  resendBtn:      { alignItems: 'center' },
  resendText:     { color: '#FF4B6E', fontSize: 15, fontWeight: '500' },
  msgBanner: {
    backgroundColor: '#e8f5e9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#81c784',
  },
  msgText: { fontSize: 13, color: '#2e7d32', textAlign: 'center' },
});
