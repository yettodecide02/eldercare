import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from '@tanstack/react-query';
import api from '../../lib/api';
import { Button, Input } from '../../components/ui';
import { colors, spacing, fontSizes, radius } from '../../lib/theme';

const STEPS = ['Profile', 'Services', 'Live Photo', 'Documents'];
const SERVICE_TYPES = [
  'PERSONAL_CARE', 'MEDICATION_MANAGEMENT', 'COMPANIONSHIP',
  'MOBILITY_ASSISTANCE', 'MEAL_PREPARATION', 'HOUSEKEEPING',
  'TRANSPORTATION', 'MEDICAL_MONITORING',
];
const DOC_TYPES = [
  { type: 'AADHAAR', label: 'Aadhaar Card', required: true, hint: 'Front & back of Aadhaar' },
  { type: 'PAN_CARD', label: 'PAN Card', required: true, hint: 'PAN card photo' },
  { type: 'POLICE_CHECK', label: 'Police Verification', required: true, hint: 'Police clearance certificate' },
  { type: 'CERTIFICATION', label: 'Care Certification', required: false, hint: 'Any care training certificate (optional)' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 0 — Profile
  const [bio, setBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState('350');
  const [languages, setLanguages] = useState('English');
  const [yearsExp, setYearsExp] = useState('');

  // Step 1 — Services
  const [serviceTypes, setServiceTypes] = useState([]);

  // Step 2 — Live Selfie
  const [selfieUri, setSelfieUri] = useState(null);
  const [selfieUploading, setSelfieUploading] = useState(false);
  const [selfieUploaded, setSelfieUploaded] = useState(false);

  // Step 3 — Documents
  const [uploadedDocs, setUploadedDocs] = useState({});
  const [uploadingDoc, setUploadingDoc] = useState(null);

  // ─── mutations ───────────────────────────────────────────────────────────────

  const profileMutation = useMutation({
    mutationFn: (data) => api.put('/caregiver/profile', data),
    onSuccess: () => setStep(1),
    onError: (e) => Alert.alert('Error', e.response?.data?.error || 'Failed to save profile'),
  });

  const uploadFile = async (documentType, asset) => {
    const urlRes = await api.post('/caregiver/documents/upload-url', {
      documentType,
      mimeType: 'image/jpeg',
      fileSize: asset.fileSize || 1000000,
    });
    const { uploadUrl, key } = urlRes.data;
    const blob = await fetch(asset.uri).then(r => r.blob());
    await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
    await api.post('/caregiver/documents', {
      documentType, s3Key: key,
      fileName: asset.fileName || `${documentType}.jpg`,
      fileSize: asset.fileSize,
    });
    return key;
  };

  // ─── Step 0: Profile ─────────────────────────────────────────────────────────

  const handleProfileNext = () => {
    const rate = parseFloat(hourlyRate);
    if (!bio.trim()) return Alert.alert('Required', 'Please add a bio');
    if (isNaN(rate) || rate < 250 || rate > 2000) return Alert.alert('Invalid Rate', 'Hourly rate must be ₹250–₹2000');
    profileMutation.mutate({
      bio,
      hourlyRate: rate,
      languages: languages.split(',').map(l => l.trim()).filter(Boolean),
      yearsOfExperience: parseInt(yearsExp) || 0,
    });
  };

  // ─── Step 1: Services ────────────────────────────────────────────────────────

  const toggleService = (s) =>
    setServiceTypes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const handleServicesNext = async () => {
    if (serviceTypes.length === 0) return Alert.alert('Required', 'Select at least one service');
    await api.put('/caregiver/profile', { serviceTypes });
    setStep(2);
  };

  // ─── Step 2: Live Selfie ─────────────────────────────────────────────────────

  const handleCaptureSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission Denied', 'Camera access is required to take a live selfie');

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      cameraType: ImagePicker.CameraType.front,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelfieUri(asset.uri);
      setSelfieUploading(true);
      try {
        await uploadFile('LIVE_SELFIE', asset);
        setSelfieUploaded(true);
      } catch (e) {
        Alert.alert('Upload Failed', e.message || 'Please try again');
        setSelfieUri(null);
      } finally {
        setSelfieUploading(false);
      }
    }
  };

  // ─── Step 3: Documents ───────────────────────────────────────────────────────

  const handlePickDocument = async (documentType) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission denied', 'Gallery access is needed');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setUploadingDoc(documentType);
      try {
        await uploadFile(documentType, result.assets[0]);
        setUploadedDocs(prev => ({ ...prev, [documentType]: true }));
      } catch (e) {
        Alert.alert('Upload Failed', e.message || 'Please try again');
      } finally {
        setUploadingDoc(null);
      }
    }
  };

  const handleSubmit = () => {
    const required = DOC_TYPES.filter(d => d.required);
    const allUploaded = required.every(d => uploadedDocs[d.type]);
    if (!allUploaded) {
      const missing = required.filter(d => !uploadedDocs[d.type]).map(d => d.label).join(', ');
      return Alert.alert('Required Documents', `Please upload: ${missing}`);
    }
    Alert.alert(
      'Submitted for Review 🎉',
      'Your profile and documents are under review. We\'ll notify you within 48 hours once approved.',
      [{ text: 'Go to Dashboard', onPress: () => router.replace('/(caregiver)') }],
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.white }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Step indicator */}
      <View style={styles.stepBar}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.stepDot, i <= step && styles.stepDotActive, i < step && styles.stepDotDone]}>
              <Text style={[styles.stepDotText, i <= step && styles.stepDotTextActive]}>
                {i < step ? '✓' : i + 1}
              </Text>
            </View>
            <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{s}</Text>
          </View>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>

        {/* ── Step 0: Profile ── */}
        {step === 0 && (
          <>
            <Text style={styles.title}>Set Up Your Profile</Text>
            <Text style={styles.subtitle}>Tell clients about yourself and your care experience</Text>
            <Input
              label="Bio / About You *"
              placeholder="Describe your experience and care approach…"
              value={bio}
              onChangeText={setBio}
              style={{ height: 100, textAlignVertical: 'top' }}
              multiline
            />
            <Input
              label="Hourly Rate (₹250 – ₹2000) *"
              keyboardType="numeric"
              value={hourlyRate}
              onChangeText={setHourlyRate}
              placeholder="350"
            />
            <Input
              label="Languages Spoken"
              placeholder="e.g. Hindi, English, Telugu"
              value={languages}
              onChangeText={setLanguages}
            />
            <Input
              label="Years of Experience"
              keyboardType="numeric"
              value={yearsExp}
              onChangeText={setYearsExp}
              placeholder="e.g. 3"
            />
            <Button
              title="Next: Select Services →"
              onPress={handleProfileNext}
              loading={profileMutation.isPending}
              style={{ marginTop: spacing.lg }}
            />
          </>
        )}

        {/* ── Step 1: Services ── */}
        {step === 1 && (
          <>
            <Text style={styles.title}>Select Your Services</Text>
            <Text style={styles.subtitle}>Choose all services you can provide</Text>
            <View style={styles.serviceGrid}>
              {SERVICE_TYPES.map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => toggleService(s)}
                  style={[styles.serviceBtn, serviceTypes.includes(s) && styles.serviceBtnActive]}
                >
                  <Text style={[styles.serviceBtnText, serviceTypes.includes(s) && styles.serviceBtnTextActive]}>
                    {s.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.selectedCount}>{serviceTypes.length} selected</Text>
            <Button
              title="Next: Live Photo →"
              disabled={serviceTypes.length === 0}
              onPress={handleServicesNext}
              style={{ marginTop: spacing.xl }}
            />
          </>
        )}

        {/* ── Step 2: Live Selfie ── */}
        {step === 2 && (
          <>
            <Text style={styles.title}>Live Photo Verification</Text>
            <Text style={styles.subtitle}>Take a clear selfie with your face fully visible. This proves you're a real person and will be reviewed by our admin team.</Text>

            <View style={styles.selfieContainer}>
              {selfieUri ? (
                <Image source={{ uri: selfieUri }} style={styles.selfiePreview} />
              ) : (
                <View style={styles.selfiePlaceholder}>
                  <Text style={styles.selfieIcon}>🤳</Text>
                  <Text style={styles.selfiePlaceholderText}>No photo yet</Text>
                </View>
              )}
            </View>

            {selfieUploaded ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>✅ Live selfie uploaded successfully!</Text>
              </View>
            ) : (
              <Button
                title={selfieUploading ? 'Uploading…' : '📸 Take Live Selfie'}
                onPress={handleCaptureSelfie}
                loading={selfieUploading}
                style={{ marginBottom: spacing.md }}
              />
            )}

            {selfieUri && !selfieUploaded && !selfieUploading && (
              <TouchableOpacity onPress={handleCaptureSelfie}>
                <Text style={styles.retakeLink}>Retake Photo</Text>
              </TouchableOpacity>
            )}

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                📋 Requirements:{'\n'}
                • Face clearly visible, no sunglasses{'\n'}
                • Good lighting{'\n'}
                • No filters or edits{'\n'}
                • Front camera recommended
              </Text>
            </View>

            <Button
              title="Next: Upload Documents →"
              disabled={!selfieUploaded}
              onPress={() => setStep(3)}
              style={{ marginTop: spacing.lg }}
            />

            {!selfieUploaded && (
              <Text style={styles.skipNote}>You must capture and upload a live selfie to proceed.</Text>
            )}
          </>
        )}

        {/* ── Step 3: Documents ── */}
        {step === 3 && (
          <>
            <Text style={styles.title}>Upload Documents</Text>
            <Text style={styles.subtitle}>Required for identity verification by our admin team</Text>

            {DOC_TYPES.map(doc => (
              <View key={doc.type} style={styles.docCard}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.docLabel}>{doc.label}</Text>
                    {doc.required && <Text style={styles.docRequired}>Required</Text>}
                  </View>
                  <Text style={styles.docHint}>{doc.hint}</Text>
                </View>
                {uploadedDocs[doc.type] ? (
                  <View style={styles.docUploaded}>
                    <Text style={styles.docUploadedText}>✓ Done</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.uploadBtn, uploadingDoc === doc.type && { opacity: 0.6 }]}
                    onPress={() => handlePickDocument(doc.type)}
                    disabled={uploadingDoc === doc.type}
                  >
                    <Text style={styles.uploadBtnText}>
                      {uploadingDoc === doc.type ? '⏳' : '📎'} Upload
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {/* Progress */}
            <View style={styles.progressRow}>
              {DOC_TYPES.map(d => (
                <View
                  key={d.type}
                  style={[styles.progressDot, uploadedDocs[d.type] && styles.progressDotDone]}
                />
              ))}
              <Text style={styles.progressText}>
                {Object.keys(uploadedDocs).length}/{DOC_TYPES.length} uploaded
              </Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                ⏳ Your profile will be reviewed within 48 hours. You'll receive a push notification once approved or if any action is needed.
              </Text>
            </View>

            <Button
              title="Submit for Verification 🚀"
              onPress={handleSubmit}
              style={{ marginTop: spacing.lg }}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  stepBar: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: spacing.md, borderBottomWidth: 1,
    borderBottomColor: colors.gray[100], backgroundColor: colors.white,
  },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.gray[200], alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: colors.primary },
  stepDotDone: { backgroundColor: colors.primaryDark },
  stepDotText: { fontSize: fontSizes.xs, fontWeight: '700', color: colors.gray[500] },
  stepDotTextActive: { color: colors.white },
  stepLabel: { fontSize: 10, color: colors.gray[400], textAlign: 'center' },
  stepLabelActive: { color: colors.primary, fontWeight: '700' },
  title: { fontSize: fontSizes.xxl, fontWeight: '800', color: colors.gray[900], marginBottom: 6 },
  subtitle: { fontSize: fontSizes.sm, color: colors.gray[500], marginBottom: spacing.lg, lineHeight: 20 },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceBtn: {
    borderWidth: 1.5, borderColor: colors.gray[200],
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8,
  },
  serviceBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  serviceBtnText: { fontSize: fontSizes.xs, fontWeight: '600', color: colors.gray[600] },
  serviceBtnTextActive: { color: colors.primaryDark },
  selectedCount: { fontSize: fontSizes.xs, color: colors.gray[400], marginTop: spacing.sm },
  selfieContainer: { alignItems: 'center', marginBottom: spacing.lg },
  selfiePreview: {
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 3, borderColor: colors.primary,
  },
  selfiePlaceholder: {
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: colors.gray[100], alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.gray[200], borderStyle: 'dashed',
  },
  selfieIcon: { fontSize: 48 },
  selfiePlaceholderText: { fontSize: fontSizes.xs, color: colors.gray[400], marginTop: 8 },
  successBox: {
    backgroundColor: '#d1fae5', borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.md, alignItems: 'center',
  },
  successText: { color: '#065f46', fontWeight: '700', fontSize: fontSizes.sm },
  retakeLink: { textAlign: 'center', color: colors.primary, fontWeight: '600', fontSize: fontSizes.sm, marginBottom: spacing.md },
  skipNote: { textAlign: 'center', color: colors.gray[400], fontSize: fontSizes.xs, marginTop: spacing.sm },
  docCard: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    borderWidth: 1.5, borderColor: colors.gray[200],
    borderRadius: radius.md, marginBottom: spacing.sm,
  },
  docLabel: { fontSize: fontSizes.md, fontWeight: '600', color: colors.gray[800] },
  docRequired: {
    fontSize: 10, color: colors.white, backgroundColor: colors.danger,
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, fontWeight: '600',
  },
  docHint: { fontSize: fontSizes.xs, color: colors.gray[400], marginTop: 3 },
  docUploaded: {
    backgroundColor: colors.primaryLight, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  docUploadedText: { fontSize: fontSizes.xs, fontWeight: '700', color: colors.primaryDark },
  uploadBtn: {
    backgroundColor: colors.gray[100], borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  uploadBtnText: { fontSize: fontSizes.xs, fontWeight: '600', color: colors.gray[700] },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md, marginBottom: spacing.sm },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gray[200] },
  progressDotDone: { backgroundColor: colors.primary },
  progressText: { fontSize: fontSizes.xs, color: colors.gray[500] },
  infoBox: { backgroundColor: '#fef3c7', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  infoText: { fontSize: fontSizes.sm, color: '#92400e', lineHeight: 20 },
});
