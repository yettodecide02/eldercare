import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../lib/api';
import { Card, Button, Badge } from '../../components/ui';
import { colors, spacing, fontSizes, radius } from '../../lib/theme';

const DURATION_OPTIONS = [1, 2, 3, 4, 6, 8, 12];
const SERVICE_TYPES = ['PERSONAL_CARE', 'MEDICATION_MANAGEMENT', 'COMPANIONSHIP', 'MOBILITY_ASSISTANCE', 'MEAL_PREPARATION', 'HOUSEKEEPING', 'TRANSPORTATION', 'MEDICAL_MONITORING'];

export default function CaregiverDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [showBooking, setShowBooking] = useState(false);
  const [bookingDate, setBookingDate] = useState(new Date(Date.now() + 2 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [duration, setDuration] = useState(2);
  const [serviceType, setServiceType] = useState('');
  const [elderId, setElderId] = useState('');
  const [notes, setNotes] = useState('');

  const { data: cg, isLoading } = useQuery({
    queryKey: ['caregiver', id],
    queryFn: () => api.get(`/caregiver/${id}`).then(r => r.data),
  });

  const { data: eldersData } = useQuery({
    queryKey: ['customer-elders'],
    queryFn: () => api.get('/customer/elders').then(r => r.data),
  });

  const bookMutation = useMutation({
    mutationFn: (payload) => api.post('/bookings', payload),
    onSuccess: (res) => {
      setShowBooking(false);
      Alert.alert('Booking Placed! 🎉', `Booking ${res.data.bookingNumber} is pending caregiver confirmation.`, [
        { text: 'View Bookings', onPress: () => router.push('/(customer)/bookings') },
      ]);
    },
    onError: (e) => Alert.alert('Booking Failed', e.response?.data?.error || 'Please try again'),
  });

  const favoriteMutation = useMutation({
    mutationFn: () => api.post(`/customer/favorites/toggle/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['caregiver', id] }),
    onError: () => Alert.alert('Error', 'Could not update saved status'),
  });

  const handleBook = () => {
    if (!serviceType) return Alert.alert('Required', 'Please select a service type');
    if (!elderId) {
      if (!eldersData || eldersData.length === 0) {
        return Alert.alert(
          'No Elder Profile',
          'You need to add an elder profile before booking. Go to Profile → Elder Profiles → Add Elder.',
          [{ text: 'OK' }]
        );
      }
      return Alert.alert('Required', 'Please select an elder');
    }

    const date = bookingDate.toISOString().split('T')[0];
    const startTime = `${String(bookingDate.getHours()).padStart(2, '0')}:${String(bookingDate.getMinutes()).padStart(2, '0')}`;
    bookMutation.mutate({ caregiverId: id, elderId, date, startTime, duration, serviceType, specialNotes: notes });
  };

  const totalAmount = cg ? parseFloat(cg.hourlyRate) * duration : 0;

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;
  if (!cg) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Caregiver not found</Text></View>;

  return (
    <>
      <ScrollView style={styles.container}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{cg.name?.[0]}</Text></View>
          <Text style={styles.name}>{cg.name}</Text>
          <Text style={styles.city}>📍 {cg.city}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statVal}>{cg.rating ? parseFloat(cg.rating).toFixed(1) : 'New'}</Text><Text style={styles.statLabel}>Rating</Text></View>
            <View style={[styles.stat, styles.statBorder]}><Text style={styles.statVal}>{cg.totalReviews}</Text><Text style={styles.statLabel}>Reviews</Text></View>
            <View style={styles.stat}><Text style={styles.statVal}>{cg.completedBookings}</Text><Text style={styles.statLabel}>Completed</Text></View>
          </View>
        </View>

        {/* Rate + Book Button */}
        <View style={styles.rateBar}>
          <View>
            <Text style={styles.rate}>₹{cg.hourlyRate}</Text>
            <Text style={styles.rateLabel}>per hour</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              style={styles.heartBtn}
              onPress={() => favoriteMutation.mutate()}
              disabled={favoriteMutation.isPending}
            >
              <Text style={styles.heartBtnText}>{cg.isFavorited ? '❤️' : '🤍'}</Text>
            </TouchableOpacity>
            <Button title="Book Now" onPress={() => setShowBooking(true)} style={{ paddingHorizontal: 32 }} />
          </View>
        </View>

        <View style={styles.section}>
          {/* Bio */}
          {cg.bio && (
            <Card style={{ marginBottom: spacing.md }}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bio}>{cg.bio}</Text>
            </Card>
          )}

          {/* Services */}
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={styles.sectionTitle}>Services Offered</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {(cg.serviceTypes || []).map(s => <Badge key={s} label={s.replace(/_/g, ' ')} color="green" />)}
            </View>
          </Card>

          {/* Availability */}
          {Object.keys(cg.availability || {}).length > 0 && (
            <Card style={{ marginBottom: spacing.md }}>
              <Text style={styles.sectionTitle}>Availability</Text>
              {Object.entries(cg.availability).map(([day, times]) => (
                <View key={day} style={styles.availRow}>
                  <Text style={styles.availDay}>{day}</Text>
                  <Text style={styles.availTime}>{times.start} – {times.end}</Text>
                </View>
              ))}
            </Card>
          )}

          {/* Reviews */}
          {cg.reviews?.length > 0 && (
            <Card>
              <Text style={styles.sectionTitle}>Reviews</Text>
              {cg.reviews.map(r => (
                <View key={r.id} style={styles.review}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.reviewName}>{r.customerName}</Text>
                    <Text style={styles.reviewStars}>{'⭐'.repeat(r.rating)}</Text>
                  </View>
                  {r.text && <Text style={styles.reviewText}>{r.text}</Text>}
                </View>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>

      {/* Booking Modal */}
      <Modal visible={showBooking} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Book {cg.name}</Text>
            <TouchableOpacity onPress={() => setShowBooking(false)}><Text style={{ fontSize: 24, color: colors.gray[400] }}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
            {/* Date */}
            <Text style={styles.fieldLabel}>Date</Text>
            <TouchableOpacity style={styles.inputBtn} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.inputBtnText}>{bookingDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
            </TouchableOpacity>

            {/* Time */}
            <Text style={styles.fieldLabel}>Start Time</Text>
            <TouchableOpacity style={styles.inputBtn} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.inputBtnText}>{`${String(bookingDate.getHours()).padStart(2, '0')}:${String(bookingDate.getMinutes()).padStart(2, '0')}`}</Text>
            </TouchableOpacity>

            {/* Duration */}
            <Text style={styles.fieldLabel}>Duration</Text>
            <View style={styles.durationRow}>
              {DURATION_OPTIONS.map(d => (
                <TouchableOpacity key={d} onPress={() => setDuration(d)} style={[styles.durationBtn, duration === d && styles.durationBtnActive]}>
                  <Text style={[styles.durationBtnText, duration === d && styles.durationBtnTextActive]}>{d}h</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Service Type */}
            <Text style={styles.fieldLabel}>Service Type</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingBottom: spacing.md }}
            >
              {(cg.serviceTypes?.length > 0 ? SERVICE_TYPES.filter(s => cg.serviceTypes.includes(s)) : SERVICE_TYPES).map(s => (
                <TouchableOpacity key={s} onPress={() => setServiceType(s)} style={[styles.chip, serviceType === s && styles.chipActive, { alignSelf: 'center' }]}>
                  <Text style={[styles.chipText, serviceType === s && styles.chipTextActive]}>{s.replace(/_/g, ' ')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Elder */}
            {eldersData?.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>For Elder</Text>
                <View style={{ gap: 6, marginBottom: spacing.md }}>
                  {eldersData.map(e => (
                    <TouchableOpacity key={e.id} onPress={() => setElderId(e.id)} style={[styles.inputBtn, elderId === e.id && { borderColor: colors.primary }]}>
                      <Text style={styles.inputBtnText}>{e.name} ({e.relationship || 'Elder'})</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Notes */}
            <Text style={styles.fieldLabel}>Special Notes (optional)</Text>
            <TextInput
              style={[styles.inputBtn, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
              multiline
              placeholder="Any special care instructions…"
              placeholderTextColor={colors.gray[400]}
              value={notes}
              onChangeText={setNotes}
            />

            {/* Cost */}
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Total Estimated Cost</Text>
              <Text style={styles.costVal}>₹{totalAmount.toFixed(0)}</Text>
            </View>
            <Text style={styles.costNote}>₹{cg.hourlyRate}/hr × {duration}h</Text>

            <Button
              title={bookMutation.isPending ? 'Placing Booking…' : 'Confirm Booking'}
              onPress={handleBook}
              loading={bookMutation.isPending}
              style={{ marginTop: spacing.lg }}
            />
          </ScrollView>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={bookingDate}
            mode="date"
            minimumDate={new Date()}
            onChange={(e, d) => { setShowDatePicker(false); if (d) setBookingDate(prev => { const n = new Date(prev); n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); return n; }); }}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={bookingDate}
            mode="time"
            minuteInterval={30}
            onChange={(e, d) => { setShowTimePicker(false); if (d) setBookingDate(prev => { const n = new Date(prev); n.setHours(d.getHours(), d.getMinutes()); return n; }); }}
          />
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  hero: { backgroundColor: colors.primary, alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  avatarText: { fontSize: 32, fontWeight: '800', color: colors.white },
  name: { fontSize: fontSizes.xxl, fontWeight: '800', color: colors.white },
  city: { fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  statsRow: { flexDirection: 'row', marginTop: spacing.md, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.lg, paddingVertical: spacing.sm },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  statVal: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.white },
  statLabel: { fontSize: fontSizes.xs, color: 'rgba(255,255,255,0.7)' },
  rateBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.white, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  rate: { fontSize: fontSizes.xxl, fontWeight: '800', color: colors.primary },
  rateLabel: { fontSize: fontSizes.xs, color: colors.gray[400] },
  section: { padding: spacing.md },
  sectionTitle: { fontSize: fontSizes.md, fontWeight: '700', color: colors.gray[900], marginBottom: spacing.sm },
  bio: { fontSize: fontSizes.sm, color: colors.gray[600], lineHeight: 20 },
  availRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  availDay: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.gray[700] },
  availTime: { fontSize: fontSizes.sm, color: colors.gray[500] },
  review: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  reviewName: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.gray[800] },
  reviewStars: { fontSize: 12 },
  reviewText: { fontSize: fontSizes.xs, color: colors.gray[500], marginTop: 4, lineHeight: 18 },
  modal: { flex: 1, backgroundColor: colors.white },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  modalTitle: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.gray[900] },
  fieldLabel: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.gray[700], marginBottom: 6, marginTop: spacing.sm },
  inputBtn: { borderWidth: 1.5, borderColor: colors.gray[200], borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12 },
  inputBtnText: { fontSize: fontSizes.md, color: colors.gray[800] },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  durationBtn: { borderWidth: 1.5, borderColor: colors.gray[200], borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 8 },
  durationBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  durationBtnText: { fontSize: fontSizes.sm, color: colors.gray[600], fontWeight: '600' },
  durationBtnTextActive: { color: colors.primaryDark },
  chip: { borderWidth: 1.5, borderColor: colors.gray[200], borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText: { fontSize: fontSizes.xs, fontWeight: '600', color: colors.gray[600] },
  chipTextActive: { color: colors.primaryDark },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  costLabel: { fontSize: fontSizes.md, fontWeight: '600', color: colors.primaryDark },
  costVal: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.primary },
  costNote: { fontSize: fontSizes.xs, color: colors.gray[400], textAlign: 'right', marginTop: 4 },
  heartBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.gray[200],
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  heartBtnText: { fontSize: 20 },
});
