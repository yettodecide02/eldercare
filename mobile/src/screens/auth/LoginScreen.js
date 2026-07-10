import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Button, Input } from '../../components/ui';
import { colors, spacing, fontSizes, radius } from '../../lib/theme';

const STEPS = { PHONE: 'PHONE', OTP: 'OTP', SIGNUP: 'SIGNUP' };

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore(s => s.setAuth);

  const [step, setStep] = useState(STEPS.PHONE);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [tempToken, setTempToken] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('CUSTOMER');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const otpRefs = useRef([]);

  useEffect(() => {
    let timer;
    if (countdown > 0) timer = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendOtp = async () => {
    if (phone.length !== 10) return Alert.alert('Invalid', 'Enter a 10-digit mobile number');
    setLoading(true);
    try {
      await api.post('/auth/send-otp', { phone: `+91${phone}` });
      setStep(STEPS.OTP);
      setCountdown(60);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message ?? 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val, idx) => {
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { phone: `+91${phone}`, otp: code });
      if (data.tempToken) {
        setTempToken(data.tempToken);
        setStep(STEPS.SIGNUP);
      } else {
        await setAuth(data.token, data.user);
        router.replace(data.user.role === 'CAREGIVER' ? '/(caregiver)' : '/(customer)');
      }
    } catch (e) {
      Alert.alert('Invalid OTP', e.response?.data?.message ?? 'Incorrect code');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!name.trim() || !city.trim()) return Alert.alert('Required', 'Fill in all fields');
    setLoading(true);
    try {
      const { data } = await api.post(
        '/auth/complete-signup',
        { name, role, city },
        { headers: { Authorization: `Bearer ${tempToken}` } }
      );
      await setAuth(data.token, data.user);
      router.replace(data.user.role === 'CAREGIVER' ? '/(caregiver)' : '/(customer)');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message ?? 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.white }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🌿 ElderCare</Text>
          <Text style={styles.tagline}>Trusted care for your elders</Text>
        </View>

        {/* Step: Phone */}
        {step === STEPS.PHONE && (
          <View style={styles.form}>
            <Text style={styles.title}>Enter your mobile</Text>
            <Text style={styles.subtitle}>We'll send you a verification code</Text>
            <View style={styles.phoneRow}>
              <View style={styles.countryCode}><Text style={styles.countryText}>+91</Text></View>
              <TextInput
                style={[styles.phoneInput]}
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.gray[400]}
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
              />
            </View>
            <Button title="Send OTP" onPress={handleSendOtp} loading={loading} style={{ marginTop: spacing.lg }} />
          </View>
        )}

        {/* Step: OTP */}
        {step === STEPS.OTP && (
          <View style={styles.form}>
            <Text style={styles.title}>Enter OTP</Text>
            <Text style={styles.subtitle}>Sent to +91 {phone}</Text>
            <View style={styles.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={r => (otpRefs.current[i] = r)}
                  style={styles.otpBox}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={digit}
                  onChangeText={v => handleOtpChange(v, i)}
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === 'Backspace' && !otp[i] && i > 0)
                      otpRefs.current[i - 1]?.focus();
                  }}
                />
              ))}
            </View>
            <Button
              title="Verify OTP"
              onPress={handleVerifyOtp}
              loading={loading}
              disabled={otp.join('').length !== 6}
              style={{ marginTop: spacing.lg }}
            />
            <TouchableOpacity
              disabled={countdown > 0}
              onPress={() => { setOtp(['','','','','','']); handleSendOtp(); }}
              style={{ marginTop: spacing.md, alignItems: 'center' }}
            >
              <Text style={{ color: countdown > 0 ? colors.gray[400] : colors.primary, fontSize: fontSizes.sm }}>
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep(STEPS.PHONE)} style={styles.back}>
              <Text style={styles.backText}>← Change number</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step: Signup */}
        {step === STEPS.SIGNUP && (
          <View style={styles.form}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Tell us a bit about yourself</Text>
            <Input label="Full Name" placeholder="Your full name" value={name} onChangeText={setName} />
            <Input label="City" placeholder="e.g. Hyderabad" value={city} onChangeText={setCity} />
            <Text style={styles.label}>I am a</Text>
            <View style={styles.roleRow}>
              {[
                { val: 'CUSTOMER', label: '👨‍👩‍👦 Family / Customer' },
                { val: 'CAREGIVER', label: '🧑‍⚕️ Caregiver' },
              ].map(r => (
                <TouchableOpacity
                  key={r.val}
                  onPress={() => setRole(r.val)}
                  style={[styles.roleBtn, role === r.val && styles.roleBtnActive]}
                >
                  <Text style={[styles.roleBtnText, role === r.val && styles.roleBtnTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button title="Create Account" onPress={handleSignup} loading={loading} style={{ marginTop: spacing.lg }} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  logo: { fontSize: 32, fontWeight: '800', color: colors.primary },
  tagline: { fontSize: fontSizes.sm, color: colors.gray[500], marginTop: 4 },
  form: { gap: spacing.sm },
  title: { fontSize: fontSizes.xxl, fontWeight: '700', color: colors.gray[900] },
  subtitle: { fontSize: fontSizes.sm, color: colors.gray[500], marginBottom: spacing.md },
  phoneRow: { flexDirection: 'row', gap: 8 },
  countryCode: {
    borderWidth: 1.5, borderColor: colors.gray[200], borderRadius: radius.md,
    paddingHorizontal: spacing.md, justifyContent: 'center',
    backgroundColor: colors.gray[50],
  },
  countryText: { fontSize: fontSizes.md, color: colors.gray[700], fontWeight: '600' },
  phoneInput: {
    flex: 1, borderWidth: 1.5, borderColor: colors.gray[200],
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    paddingVertical: 12, fontSize: fontSizes.md, color: colors.gray[900],
  },
  otpRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginVertical: spacing.md },
  otpBox: {
    width: 48, height: 56, borderWidth: 1.5, borderColor: colors.gray[300],
    borderRadius: radius.md, textAlign: 'center', fontSize: fontSizes.xl,
    fontWeight: '700', color: colors.gray[900], backgroundColor: colors.gray[50],
  },
  back: { alignItems: 'center', marginTop: spacing.md },
  backText: { color: colors.gray[500], fontSize: fontSizes.sm },
  label: { fontSize: fontSizes.sm, fontWeight: '500', color: colors.gray[700], marginBottom: 6 },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleBtn: {
    flex: 1, borderWidth: 1.5, borderColor: colors.gray[200],
    borderRadius: radius.md, padding: spacing.md, alignItems: 'center',
  },
  roleBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  roleBtnText: { fontSize: fontSizes.sm, color: colors.gray[600], fontWeight: '500' },
  roleBtnTextActive: { color: colors.primaryDark, fontWeight: '700' },
});
