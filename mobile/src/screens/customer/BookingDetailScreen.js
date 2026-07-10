import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../lib/api';
import { Badge, Button, Card } from '../../components/ui';
import { colors, fontSizes, radius, spacing } from '../../lib/theme';

const STATUS_BADGE = {
  PENDING: 'yellow', CONFIRMED: 'blue', ACTIVE: 'green',
  COMPLETED: 'green', CANCELLED: 'gray', DISPUTED: 'red',
};

const STATUS_BG = {
  ACTIVE: colors.primary,
  CONFIRMED: colors.elderBlue,
  PENDING: '#d97706',
  COMPLETED: '#15803d',
  CANCELLED: colors.gray[400],
  DISPUTED: colors.danger,
};

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking-detail', id],
    queryFn: () => api.get(`/bookings/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: profileData } = useQuery({
    queryKey: ['customer-profile'],
    queryFn: () => api.get('/customer/profile').then(r => r.data),
  });
  const hasLocation = !!(profileData?.profile?.latitude);

  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const cancelMutation = useMutation({
    mutationFn: () => api.put(`/bookings/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-bookings'] });
      qc.invalidateQueries({ queryKey: ['booking-detail', id] });
      qc.invalidateQueries({ queryKey: ['customer-home'] });
      Alert.alert('Cancelled', 'Your booking has been cancelled.');
    },
    onError: e => Alert.alert('Error', e.response?.data?.message ?? 'Cancel failed'),
  });

  const rescheduleMutation = useMutation({
    mutationFn: () => {
      const date = rescheduleDate.toISOString().split('T')[0];
      const startTime = `${String(rescheduleDate.getHours()).padStart(2, '0')}:${String(rescheduleDate.getMinutes()).padStart(2, '0')}`;
      return api.put(`/bookings/${id}/reschedule`, { date, startTime });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['booking-detail', id] });
      qc.invalidateQueries({ queryKey: ['customer-bookings'] });
      setShowReschedule(false);
      Alert.alert('Rescheduled ✅', 'Your booking has been rescheduled successfully.');
    },
    onError: e => Alert.alert('Error', e.response?.data?.error ?? 'Reschedule failed'),
  });

  const handleCancel = () => {
    Alert.alert('Cancel Booking', 'Are you sure? Cancellation charges may apply.', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelMutation.mutate() },
    ]);
  };

  if (isLoading) return <ActivityIndicator style={{ flex: 1, marginTop: 80 }} color={colors.primary} size="large" />;
  if (!booking) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: colors.gray[500] }}>Booking not found</Text>
    </View>
  );

  const cgName = booking.caregiver?.user?.name ?? booking.caregiver?.name ?? 'Caregiver';
  const cgCity = booking.caregiver?.city ?? '';
  const hasReview = !!booking.review;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: STATUS_BG[booking.status] ?? colors.gray[400] }]}>
          <Text style={styles.statusText}>{booking.status}</Text>
          {booking.bookingNumber && (
            <Text style={styles.bookingNum}>#{booking.bookingNumber}</Text>
          )}
        </View>

        <View style={styles.content}>
          {/* Location nudge — shown when booking is active/upcoming and no address is set */}
          {!hasLocation && ['PENDING', 'CONFIRMED', 'ACTIVE'].includes(booking.status) && (
            <TouchableOpacity
              style={styles.locationNudge}
              onPress={() => router.push('/(customer)/profile')}
              activeOpacity={0.85}
            >
              <Text style={styles.locationNudgeIcon}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.locationNudgeTitle}>Set your home address</Text>
                <Text style={styles.locationNudgeText}>
                  Your caregiver needs it to check in. Tap to set your location now.
                </Text>
              </View>
              <Text style={styles.locationNudgeArrow}>→</Text>
            </TouchableOpacity>
          )}

          {/* Caregiver Card */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Caregiver</Text>
            <View style={styles.cgRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{cgName[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cgName}>{cgName}</Text>
                {cgCity ? <Text style={styles.cgMeta}>📍 {cgCity}</Text> : null}
                {booking.caregiver?.avgRating ? (
                  <Text style={styles.cgMeta}>⭐ {booking.caregiver.avgRating.toFixed(1)} rating</Text>
                ) : null}
              </View>
              <Badge label={booking.status} color={STATUS_BADGE[booking.status] ?? 'gray'} />
            </View>
          </Card>

          {/* Booking Info */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Booking Info</Text>
            <InfoRow label="Service" value={booking.serviceType?.replace(/_/g, ' ') ?? '—'} />
            {booking.scheduledAt ? (
              <>
                <InfoRow label="Date" value={format(new Date(booking.scheduledAt), 'EEE, dd MMM yyyy')} />
                <InfoRow label="Time" value={format(new Date(booking.scheduledAt), 'hh:mm a')} />
              </>
            ) : null}
            <InfoRow label="Duration" value={`${booking.durationHours} hour${booking.durationHours !== 1 ? 's' : ''}`} />
            {booking.elder?.name && <InfoRow label="Elder" value={`${booking.elder.name}${booking.elder.age ? `, ${booking.elder.age} yrs` : ''}`} />}
            {booking.specialNotes && <InfoRow label="Notes" value={booking.specialNotes} />}
          </Card>

          {/* Payment Info */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <InfoRow label="Total" value={`₹${booking.totalAmount}`} highlight />
            <InfoRow label="Rate" value={`₹${booking.caregiver?.hourlyRate ?? '—'}/hr`} />
            {booking.paymentStatus && <InfoRow label="Status" value={booking.paymentStatus} />}
          </Card>

          {/* Review (if submitted) */}
          {hasReview && (
            <Card style={styles.card}>
              <Text style={styles.sectionTitle}>Your Review</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                {[1,2,3,4,5].map(s => (
                  <Text key={s} style={{ fontSize: 18, color: s <= booking.review.rating ? '#f59e0b' : colors.gray[200] }}>★</Text>
                ))}
              </View>
              {booking.review.text ? <Text style={styles.reviewText}>{booking.review.text}</Text> : null}
            </Card>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {booking.status === 'ACTIVE' && (
              <Button
                title="📍 Track Live + SOS"
                onPress={() => router.push(`/(customer)/booking/track?bookingId=${id}`)}
                style={styles.actionBtn}
              />
            )}
            {['CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(booking.status) && (
              <Button
                title="💬 Chat with Caregiver"
                variant="outline"
                onPress={() => router.push(`/(customer)/booking/chat?bookingId=${id}&bookingNumber=${booking.bookingNumber ?? ''}`)}
                style={styles.actionBtn}
              />
            )}
            {booking.status === 'COMPLETED' && !hasReview && (
              <Button
                title="⭐ Leave a Review"
                onPress={() => router.push(`/(customer)/booking/review?bookingId=${id}&caregiverName=${encodeURIComponent(cgName)}`)}
                style={styles.actionBtn}
              />
            )}
            {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
              <>
                <Button
                  title="🗓️ Reschedule"
                  variant="outline"
                  onPress={() => { setRescheduleDate(booking.scheduledAt ? new Date(booking.scheduledAt) : new Date()); setShowReschedule(true); }}
                  style={styles.actionBtn}
                />
                <Button
                  title="Cancel Booking"
                  variant="danger"
                  onPress={handleCancel}
                  loading={cancelMutation.isPending}
                  style={styles.actionBtn}
                />
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Reschedule Modal */}
      <Modal visible={showReschedule} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.white }}>
          <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.gray[100] }]}>
            <Text style={[styles.headerTitle, { fontSize: fontSizes.lg }]}>Reschedule Booking</Text>
            <TouchableOpacity onPress={() => setShowReschedule(false)}>
              <Text style={{ fontSize: 24, color: colors.gray[400] }}>×</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Text style={{ fontSize: fontSizes.sm, color: colors.gray[600] }}>
              Choose a new date and time for your booking.
            </Text>

            <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.datePickerLabel}>Date</Text>
              <Text style={styles.datePickerVal}>{format(rescheduleDate, 'EEE, dd MMM yyyy')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.datePickerLabel}>Time</Text>
              <Text style={styles.datePickerVal}>{`${String(rescheduleDate.getHours()).padStart(2, '0')}:${String(rescheduleDate.getMinutes()).padStart(2, '0')}`}</Text>
            </TouchableOpacity>

            <Button
              title={rescheduleMutation.isPending ? 'Rescheduling…' : 'Confirm Reschedule'}
              onPress={() => rescheduleMutation.mutate()}
              loading={rescheduleMutation.isPending}
            />

            {showDatePicker && (
              <DateTimePicker
                value={rescheduleDate}
                mode="date"
                minimumDate={new Date()}
                onChange={(_, d) => { setShowDatePicker(false); if (d) setRescheduleDate(prev => { const n = new Date(prev); n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); return n; }); }}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={rescheduleDate}
                mode="time"
                minuteInterval={30}
                onChange={(_, d) => { setShowTimePicker(false); if (d) setRescheduleDate(prev => { const n = new Date(prev); n.setHours(d.getHours(), d.getMinutes()); return n; }); }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ label, value, highlight }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoVal, highlight && { color: colors.primary, fontWeight: '800', fontSize: fontSizes.lg }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, paddingHorizontal: spacing.md,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  backBtn: { paddingVertical: 4, paddingRight: 12, width: 60 },
  backText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600' },
  headerTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.gray[900] },
  statusBanner: {
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    alignItems: 'center', gap: 4,
  },
  statusText: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.white, letterSpacing: 1 },
  bookingNum: { fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  content: { padding: spacing.md, gap: spacing.sm },
  card: { marginBottom: 0 },
  sectionTitle: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.gray[500], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  cgRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.primaryDark },
  cgName: { fontSize: fontSizes.md, fontWeight: '700', color: colors.gray[900] },
  cgMeta: { fontSize: fontSizes.xs, color: colors.gray[500], marginTop: 2 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.gray[50],
  },
  infoLabel: { fontSize: fontSizes.sm, color: colors.gray[500], flex: 1 },
  infoVal: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.gray[800], flex: 2, textAlign: 'right' },
  reviewText: { fontSize: fontSizes.sm, color: colors.gray[600], marginTop: spacing.sm, lineHeight: 20 },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { width: '100%' },
  locationNudge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fef3c7', borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: '#fde68a', marginBottom: spacing.sm,
  },
  locationNudgeIcon: { fontSize: 22 },
  locationNudgeTitle: { fontSize: fontSizes.sm, fontWeight: '700', color: '#92400e' },
  locationNudgeText: { fontSize: fontSizes.xs, color: '#b45309', marginTop: 2, lineHeight: 16 },
  locationNudgeArrow: { fontSize: fontSizes.md, color: '#b45309', fontWeight: '700' },
  datePickerBtn: {
    borderWidth: 1.5, borderColor: colors.gray[200], borderRadius: radius.md,
    padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  datePickerLabel: { fontSize: fontSizes.sm, color: colors.gray[500] },
  datePickerVal: { fontSize: fontSizes.md, fontWeight: '700', color: colors.gray[900] },
});
