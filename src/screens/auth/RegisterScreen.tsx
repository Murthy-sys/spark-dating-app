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
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types';
import { useAuthStore } from '../../store/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { register, isLoading } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const getAge = (dob: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  };

  const formatDate = (d: Date): string => {
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const yr = d.getFullYear();
    return `${day}/${mon}/${yr}`;
  };

  const handleDateChange = (_: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selected) setDateOfBirth(selected);
  };

  // Max date = 18 years ago today
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 18);

  const handleRegister = async () => {
    if (!displayName || !email || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (!dateOfBirth) {
      Alert.alert('Date of birth required', 'Please select your date of birth.');
      return;
    }
    if (getAge(dateOfBirth) < 18) {
      Alert.alert('Age restriction', 'You must be at least 18 years old to register.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    try {
      await register(email.trim(), password, displayName.trim(), dateOfBirth.toISOString());
    } catch (err: any) {
      Alert.alert('Registration failed', err.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Start meeting people nearby</Text>

          <TextInput
            style={styles.input}
            placeholder="First name"
            placeholderTextColor="#aaa"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor="#aaa"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
          />

          {/* Date of Birth */}
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ fontSize: 16, color: dateOfBirth ? '#1a1a1a' : '#aaa' }}>
              {dateOfBirth
                ? `${formatDate(dateOfBirth)}  (${getAge(dateOfBirth)} years old)`
                : 'Date of birth'}
            </Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && showDatePicker && (
            <Modal transparent animationType="slide">
              <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: '#1a1a1a' }]}>
                  <View style={[styles.modalHeader, { borderBottomColor: '#333' }]}>
                    <Text style={[styles.modalTitle, { color: '#fff' }]}>Select Date of Birth</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Text style={styles.modalDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={dateOfBirth || maxDate}
                    mode="date"
                    display="spinner"
                    maximumDate={maxDate}
                    minimumDate={new Date(1920, 0, 1)}
                    onChange={handleDateChange}
                    themeVariant="dark"
                    style={{ height: 200 }}
                  />
                </View>
              </View>
            </Modal>
          )}

          {Platform.OS === 'android' && showDatePicker && (
            <DateTimePicker
              value={dateOfBirth || maxDate}
              mode="date"
              display="default"
              maximumDate={maxDate}
              minimumDate={new Date(1920, 0, 1)}
              onChange={handleDateChange}
            />
          )}

          <Text style={styles.terms}>
            By continuing you agree to our{' '}
            <Text style={styles.link}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.link}>Privacy Policy</Text>
          </Text>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.switchText}>
              Already have an account?{' '}
              <Text style={styles.switchLink}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner:     { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 40 },
  backBtn:   { marginBottom: 30 },
  backText:  { fontSize: 16, color: '#FF4B6E' },
  title:     { fontSize: 32, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  subtitle:  { fontSize: 16, color: '#888', marginBottom: 32 },
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
  terms:    { fontSize: 13, color: '#999', textAlign: 'center', marginBottom: 20 },
  link:     { color: '#FF4B6E' },
  button: {
    backgroundColor: '#FF4B6E',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText:     { color: '#fff', fontSize: 17, fontWeight: '700' },
  switchText:     { textAlign: 'center', color: '#888', fontSize: 15 },
  switchLink:     { color: '#FF4B6E', fontWeight: '600' },
  modalOverlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent:   { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  modalTitle:     { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  modalDone:      { fontSize: 17, fontWeight: '600', color: '#FF4B6E' },
});
