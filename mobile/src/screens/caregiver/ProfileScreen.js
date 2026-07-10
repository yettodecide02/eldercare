import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Modal, TextInput, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Card, Button, SectionHeader } from '../../components/ui';
import { colors, spacing, fontSizes, radius } from '../../lib/theme';

const ALL_SERVICE_TYPES = [
  'PERSONAL_CARE', 'MEDICATION_MANAGEMENT', 'COMPANIONSHIP',
  'MOBILITY_ASSISTANCE', 'MEAL_PREPARATION', 'HOUSEKEEPING',
  'TRANSPORTATION', 'MEDICAL_MONITORING',
];

export default function CaregiverProfileScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();

  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editYears, setEditYears] = useState('');
  const [editServices, setEditServices] = useState([]);
  const [editLanguages, setEditLanguages] = useState('');

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ['caregiver-me'],
    queryFn: () => api.get('/caregiver/me').then(r => r.data),
  });

  const { data: earnings } = useQuery({
    queryKey: ['caregiver-earnings'],
    queryFn: () => api.get('/caregiver/earnings').then(r => r.data),
  });

  const payoutMutation = useMutation({
    mutationFn: amount => api.post('/caregiver/payout-request', { amount }),
    onSuccess: () => Alert.alert('Requested', 'Payout request submitted!'),
    onError: e => Alert.alert('Error', e.response?.data?.message ?? 'Request failed'),
  });

  const editProfileMutation = useMutation({
    mutationFn: (payload) => api.put('/caregiver/profile', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caregiver-me'] });
      qc.invalidateQueries({ queryKey: ['caregiver-home'] });
      setShowEdit(false);
      Alert.alert('Saved ✅', 'Profile updated successfully.');
    },
    onError: e => Alert.alert('Error', e.response?.data?.error ?? 'Update failed'),
  });

  const openEdit = () => {
    setEditName(user?.name ?? '');
    setEditBio(profile?.bio ?? '');
    setEditRate(String(profile?.hourlyRate ?? ''));
    setEditYears(String(profile?.yearsOfExperience ?? ''));
    setEditServices(profile?.serviceTypes ?? []);
    setEditLanguages((profile?.languages ?? []).join(', '));
    setShowEdit(true);
  };

  const submitEdit = () => {
    const rate = parseFloat(editRate);
    if (editRate && (isNaN(rate) || rate < 250 || rate > 2000)) {
      return Alert.alert('Invalid Rate', 'Hourly rate must be between ₹250 and ₹2000.');
    }
    editProfileMutation.mutate({
      name: editName.trim() || undefined,
      bio: editBio.trim() || undefined,
      hourlyRate: editRate ? rate : undefined,
      yearsOfExperience: editYears ? parseInt(editYears) : undefined,
      serviceTypes: editServices.length > 0 ? editServices : undefined,
      languages: editLanguages ? editLanguages.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    });
  };

  const toggleService = (s) => {
    setEditServices(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const handlePayoutRequest = () => {
    const balance = earnings?.balance ?? 0;
    if (balance < 500) return Alert.alert('Insufficient', 'Minimum payout is ₹500');
    Alert.alert('Request Payout', `Withdraw ₹${balance}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Request', onPress: () => payoutMutation.mutate(balance) },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.[0] ?? 'C'}</Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.phone}>{user?.phone}</Text>
        <Text style={styles.role}>Caregiver</Text>
        <TouchableOpacity style={styles.editProfileBtn} onPress={openEdit}>
          <Text style={styles.editProfileBtnText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Verification Status */}
      <View style={styles.section}>
        <SectionHeader title="Verification Status" />
        {!profile ? (
          <Card style={styles.verifyCard}>
            <Text style={styles.verifyLoading}>Loading…</Text>
          </Card>
        ) : profile.verificationStatus === 'VERIFIED' ? (
          <Card style={[styles.verifyCard, styles.verifyVerified]}>
            <Text style={styles.verifyIcon}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.verifyTitle, { color: '#065f46' }]}>Verified Caregiver</Text>
              <Text style={[styles.verifySubtext, { color: '#047857' }]}>
                Your identity has been verified. You can accept bookings and go online.
              </Text>
            </View>
          </Card>
        ) : profile.verificationStatus === 'UNDER_REVIEW' ? (
          <Card style={[styles.verifyCard, styles.verifyPending]}>
            <Text style={styles.verifyIcon}>⏳</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.verifyTitle, { color: '#713f12' }]}>Under Review</Text>
              <Text style={[styles.verifySubtext, { color: '#78350f' }]}>
                Your documents are being reviewed. Approval usually takes 24–48 hours. We'll notify you once done.
              </Text>
            </View>
          </Card>
        ) : profile.verificationStatus === 'REJECTED' ? (
          <Card style={[styles.verifyCard, styles.verifyRejected]}>
            <Text style={styles.verifyIcon}>❌</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.verifyTitle, { color: '#991b1b' }]}>Verification Rejected</Text>
              <Text style={[styles.verifySubtext, { color: '#7f1d1d' }]}>
                {profile.documents?.find(d => d.verificationNotes)?.verificationNotes ||
                  'Your verification was rejected. Please re-upload clear photos of your documents.'}
              </Text>
              <TouchableOpacity
                style={styles.resubmitBtn}
                onPress={() => router.push('/(caregiver)/onboarding')}
              >
                <Text style={styles.resubmitText}>Re-submit Documents →</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : (
          <Card style={[styles.verifyCard, styles.verifyNew]}>
            <Text style={styles.verifyIcon}>📋</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.verifyTitle, { color: '#1e40af' }]}>Complete Verification</Text>
              <Text style={[styles.verifySubtext, { color: '#1d4ed8' }]}>
                You need to complete identity verification before you can accept bookings.
              </Text>
              <TouchableOpacity
                style={[styles.resubmitBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/(caregiver)/onboarding')}
              >
                <Text style={styles.resubmitText}>Start Verification →</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
      </View>

      {/* Profile Info */}
      {profile && (
        <View style={styles.section}>
          <SectionHeader title="Profile Info" />
          <Card>
            {profile.bio ? (
              <Text style={styles.bioText}>{profile.bio}</Text>
            ) : (
              <Text style={styles.bioEmpty}>No bio yet. Tap "Edit Profile" to add one.</Text>
            )}
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Rate</Text>
                <Text style={styles.infoVal}>₹{profile.hourlyRate}/hr</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Experience</Text>
                <Text style={styles.infoVal}>{profile.yearsOfExperience ?? '—'} yrs</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Rating</Text>
                <Text style={styles.infoVal}>⭐ {profile.averageRating ? parseFloat(profile.averageRating).toFixed(1) : 'New'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Completed</Text>
                <Text style={styles.infoVal}>{profile.completedBookings ?? 0}</Text>
              </View>
            </View>
            {(profile.serviceTypes ?? []).length > 0 && (
              <View style={styles.servicesWrap}>
                {profile.serviceTypes.map(s => (
                  <View key={s} style={styles.serviceChip}>
                    <Text style={styles.serviceChipText}>{s.replace(/_/g, ' ')}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </View>
      )}

      {/* Earnings */}
      <View style={styles.section}>
        <SectionHeader title="Earnings" />
        <View style={styles.earningsGrid}>
          {[
            { label: 'Balance', val: earnings?.balance ?? 0, highlight: true },
            { label: 'This Month', val: earnings?.thisMonth ?? 0 },
            { label: 'Last Month', val: earnings?.lastMonth ?? 0 },
            { label: 'Total', val: earnings?.total ?? 0 },
          ].map(e => (
            <Card key={e.label} style={[styles.earningCard, e.highlight && styles.earningCardHighlight]}>
              <Text style={[styles.earningVal, e.highlight && styles.earningValHighlight]}>
                ₹{e.val}
              </Text>
              <Text style={[styles.earningLabel, e.highlight && styles.earningLabelHighlight]}>
                {e.label}
              </Text>
            </Card>
          ))}
        </View>
        <Button
          title={`Request Payout (₹${earnings?.balance ?? 0})`}
          onPress={handlePayoutRequest}
          disabled={(earnings?.balance ?? 0) < 500}
          loading={payoutMutation.isPending}
          style={{ marginTop: spacing.md }}
        />
        <Text style={styles.payoutNote}>Minimum withdrawal: ₹500</Text>
      </View>

      {/* Recent Payouts */}
      {earnings?.payouts?.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Payout History" />
          {earnings.payouts.slice(0, 5).map(p => (
            <Card key={p.id} style={[styles.payoutRow]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.payoutAmount}>₹{p.amount}</Text>
                <Text style={styles.payoutDate}>{new Date(p.createdAt).toLocaleDateString('en-IN')}</Text>
              </View>
              <View style={[
                styles.payoutStatus,
                { backgroundColor: p.status === 'COMPLETED' ? colors.primaryLight : '#fef3c7' }
              ]}>
                <Text style={[
                  styles.payoutStatusText,
                  { color: p.status === 'COMPLETED' ? colors.primaryDark : colors.warning }
                ]}>
                  {p.status}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Ratings & Reviews */}
      {profile?.reviews?.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title={`Reviews (${profile.reviews.length})`} />
          {profile.reviews.map(r => (
            <Card key={r.id} style={[styles.reviewCard]}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewName}>{r.customer?.user?.name || 'Customer'}</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Text key={s} style={{ fontSize: 12, color: s <= r.rating ? '#f59e0b' : colors.gray[200] }}>★</Text>
                  ))}
                </View>
              </View>
              {r.text ? <Text style={styles.reviewText}>{r.text}</Text> : null}
              <Text style={styles.reviewDate}>
                {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </Card>
          ))}
        </View>
      )}

      {profile && !profile.reviews?.length && profile.verificationStatus === 'VERIFIED' && (
        <View style={styles.section}>
          <SectionHeader title="Reviews" />
          <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <Text style={{ fontSize: 32 }}>⭐</Text>
            <Text style={{ color: colors.gray[500], marginTop: spacing.sm, fontSize: fontSizes.sm }}>
              No reviews yet. Complete bookings to earn reviews.
            </Text>
          </Card>
        </View>
      )}

      {/* Logout */}
      <View style={[styles.section, { marginTop: spacing.xl }]}>
        <Button title="Logout" variant="outline" onPress={logout} />
      </View>

      {/* ─── Edit Profile Modal ─────────────────────────────────── */}
      <Modal visible={showEdit} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEdit(false)}>
              <Text style={{ color: colors.gray[500], fontSize: fontSizes.sm }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={submitEdit} disabled={editProfileMutation.isPending}>
              <Text style={[styles.modalSave, editProfileMutation.isPending && { color: colors.gray[300] }]}>
                {editProfileMutation.isPending ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            {/* Name */}
            <Text style={styles.fieldLabel}>Full Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={colors.gray[400]}
            />

            {/* Bio */}
            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput
              style={[styles.fieldInput, { height: 90, textAlignVertical: 'top', paddingTop: 10 }]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Tell customers about yourself…"
              placeholderTextColor={colors.gray[400]}
              multiline
              maxLength={500}
            />
            <Text style={{ fontSize: fontSizes.xs, color: colors.gray[400], textAlign: 'right', marginTop: 4 }}>
              {editBio.length}/500
            </Text>

            {/* Hourly Rate */}
            <Text style={styles.fieldLabel}>Hourly Rate (₹250–₹2000)</Text>
            <TextInput
              style={styles.fieldInput}
              value={editRate}
              onChangeText={setEditRate}
              keyboardType="numeric"
              placeholder="e.g. 500"
              placeholderTextColor={colors.gray[400]}
            />

            {/* Years of Experience */}
            <Text style={styles.fieldLabel}>Years of Experience</Text>
            <TextInput
              style={styles.fieldInput}
              value={editYears}
              onChangeText={setEditYears}
              keyboardType="numeric"
              placeholder="e.g. 3"
              placeholderTextColor={colors.gray[400]}
            />

            {/* Languages */}
            <Text style={styles.fieldLabel}>Languages (comma-separated)</Text>
            <TextInput
              style={styles.fieldInput}
              value={editLanguages}
              onChangeText={setEditLanguages}
              placeholder="e.g. Hindi, English, Tamil"
              placeholderTextColor={colors.gray[400]}
            />

            {/* Service Types */}
            <Text style={styles.fieldLabel}>Services Offered</Text>
            <View style={styles.serviceChipsEdit}>
              {ALL_SERVICE_TYPES.map(s => {
                const active = editServices.includes(s);
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => toggleService(s)}
                    style={[styles.serviceChipEdit, active && styles.serviceChipEditActive]}
                  >
                    <Text style={[styles.serviceChipEditText, active && styles.serviceChipEditTextActive]}>
                      {s.replace(/_/g, ' ')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  header: { alignItems: 'center', backgroundColor: colors.primary, paddingVertical: spacing.xxl, gap: 4 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { fontSize: 30, fontWeight: '800', color: colors.white },
  name: { fontSize: fontSizes.xxl, fontWeight: '800', color: colors.white },
  phone: { fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  role: { fontSize: fontSizes.xs, color: 'rgba(255,255,255,0.6)', marginTop: 4, fontWeight: '600', letterSpacing: 1 },
  editProfileBtn: {
    marginTop: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 6,
  },
  editProfileBtnText: { color: colors.white, fontSize: fontSizes.xs, fontWeight: '700' },

  section: { paddingHorizontal: spacing.md, marginTop: spacing.lg },
  bioText: { fontSize: fontSizes.sm, color: colors.gray[700], lineHeight: 20, marginBottom: spacing.sm },
  bioEmpty: { fontSize: fontSizes.sm, color: colors.gray[400], fontStyle: 'italic', marginBottom: spacing.sm },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  infoItem: { backgroundColor: colors.gray[50], borderRadius: radius.sm, padding: 8, minWidth: 70 },
  infoLabel: { fontSize: 10, color: colors.gray[400], fontWeight: '600', marginBottom: 2 },
  infoVal: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.gray[800] },
  servicesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  serviceChip: { backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  serviceChipText: { fontSize: fontSizes.xs, color: colors.primaryDark, fontWeight: '600' },

  earningsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  earningCard: { width: '47%', alignItems: 'center', padding: spacing.md },
  earningCardHighlight: { backgroundColor: colors.primary },
  earningVal: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.primary },
  earningValHighlight: { color: colors.white },
  earningLabel: { fontSize: fontSizes.xs, color: colors.gray[500], marginTop: 3 },
  earningLabelHighlight: { color: 'rgba(255,255,255,0.8)' },
  payoutNote: { fontSize: fontSizes.xs, color: colors.gray[400], textAlign: 'center', marginTop: 6 },
  payoutRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  payoutAmount: { fontSize: fontSizes.md, fontWeight: '700', color: colors.gray[900] },
  payoutDate: { fontSize: fontSizes.xs, color: colors.gray[400], marginTop: 2 },
  payoutStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  payoutStatusText: { fontSize: fontSizes.xs, fontWeight: '600' },

  verifyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  verifyVerified: { backgroundColor: '#d1fae5', borderColor: '#6ee7b7' },
  verifyPending: { backgroundColor: '#fef9c3', borderColor: '#fde047' },
  verifyRejected: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  verifyNew: { backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
  verifyLoading: { color: colors.gray[400], fontSize: fontSizes.sm },
  verifyIcon: { fontSize: 24, lineHeight: 30 },
  verifyTitle: { fontSize: fontSizes.sm, fontWeight: '700', marginBottom: 3 },
  verifySubtext: { fontSize: fontSizes.xs, lineHeight: 18 },
  resubmitBtn: {
    marginTop: spacing.sm, alignSelf: 'flex-start',
    backgroundColor: '#dc2626', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: radius.sm,
  },
  resubmitText: { color: colors.white, fontWeight: '700', fontSize: fontSizes.xs },

  reviewCard: { marginBottom: spacing.sm, gap: 4 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewName: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.gray[800] },
  starsRow: { flexDirection: 'row', gap: 1 },
  reviewText: { fontSize: fontSizes.sm, color: colors.gray[600], lineHeight: 18 },
  reviewDate: { fontSize: fontSizes.xs, color: colors.gray[400] },

  // Edit Profile Modal
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  modalTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.gray[900] },
  modalSave: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.primary },
  fieldLabel: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.gray[700], marginBottom: 6, marginTop: spacing.md },
  fieldInput: {
    borderWidth: 1.5, borderColor: colors.gray[200], borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: fontSizes.md,
    color: colors.gray[900],
  },
  serviceChipsEdit: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  serviceChipEdit: {
    borderWidth: 1.5, borderColor: colors.gray[200], borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.white,
  },
  serviceChipEditActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  serviceChipEditText: { fontSize: fontSizes.xs, fontWeight: '600', color: colors.gray[600] },
  serviceChipEditTextActive: { color: colors.primaryDark },
});
