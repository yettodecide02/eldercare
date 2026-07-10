import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, Alert, Platform, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import api from '../../../src/lib/api';
import { Card, Badge, Button } from '../../../src/components/ui';
import { colors, spacing, fontSizes, radius } from '../../../src/lib/theme';
import * as Location from 'expo-location';

const STATUS_COLOR = {
  PENDING: '#d97706', CONFIRMED: colors.primary, ACTIVE: '#16a34a',
  COMPLETED: '#15803d', CANCELLED: colors.gray[400],
};

function InfoRow({ label, value, highlight }) {
  if (!value && value !== 0) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoVal, highlight && { color: colors.primary, fontWeight: '800', fontSize: fontSizes.md }]}>
        {value}
      </Text>
    </View>
  );
}

function SessionTimer({ checkInTime }) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = Date.now() - new Date(checkInTime).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [checkInTime]);

  return (
    <View style={styles.timerBox}>
      <Text style={styles.timerLabel}>Session Time</Text>
      <Text style={styles.timerValue}>{elapsed}</Text>
      <Text style={styles.timerSub}>Live session in progress</Text>
    </View>
  );
}

export default function CaregiverBookingDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data: booking, isLoading } = useQuery({
    queryKey: ['cg-booking-detail', id],
    queryFn: () => api.get(`/bookings/${id}`).then(r => r.data),
    enabled: !!id,
    refetchInterval: booking?.status === 'ACTIVE' ? 30000 : false,
  });

  const { data: photosData, refetch: refetchPhotos } = useQuery({
    queryKey: ['session-photos', id],
    queryFn: () => api.get(`/bookings/${id}/photos`).then(r => r.data),
    enabled: !!id && ['ACTIVE', 'COMPLETED'].includes(booking?.status),
  });
  const sessionPhotos = photosData?.photos ?? [];

  const handleAddPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permission needed', 'Please allow photo library access to upload session photos.');
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const mimeType = allowedMimes.includes(asset.mimeType) ? asset.mimeType : 'image/jpeg';
    setUploading(true);
    try {
      const { uploadUrl, key } = await api.post(`/bookings/${id}/photos/upload-url`, {
        mimeType,
        fileSize: asset.fileSize || 2000000,
      }).then(r => r.data);

      // Read file as blob and PUT to S3
      const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = reject;
        xhr.responseType = 'blob';
        xhr.open('GET', asset.uri);
        xhr.send();
      });
      await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: blob });

      await api.post(`/bookings/${id}/photos/confirm`, { key, caption: photoCaption.trim() || undefined });
      setPhotoCaption('');
      await refetchPhotos();
      Alert.alert('Photo Added ✅', 'Session photo saved to this booking.');
    } catch {
      Alert.alert('Upload Failed', 'Could not upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const getLocationCoords = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') throw new Error('Location permission required');
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  };

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const coords = await getLocationCoords();
      return api.post(`/bookings/${id}/check-in`, coords);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cg-booking-detail', id] });
      qc.invalidateQueries({ queryKey: ['caregiver-home'] });
      Alert.alert('Checked In ✅', 'Session started! Your location is being tracked.');
    },
    onError: e => {
      const d = e.response?.data;
      if (d?.code === 'OUT_OF_RANGE') {
        Alert.alert('📍 Too Far Away', `You are ${d.distanceMeters}m away. Must be within ${d.allowedMeters}m to check in.`);
      } else if (d?.code === 'TOO_EARLY') {
        Alert.alert('Too Early', 'Check-in allowed only 15 minutes before start time.');
      } else {
        Alert.alert('Check-in Failed', d?.error || 'Could not check in');
      }
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const coords = await getLocationCoords();
      return api.post(`/bookings/${id}/check-out`, coords);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cg-booking-detail', id] });
      qc.invalidateQueries({ queryKey: ['caregiver-home'] });
      Alert.alert('Checked Out ✅', 'Session complete! Payment has been released.');
    },
    onError: e => {
      const d = e.response?.data;
      if (d?.code === 'SESSION_TOO_SHORT') {
        Alert.alert('Too Soon', 'Minimum session is 15 minutes.');
      } else {
        Alert.alert('Check-out Failed', d?.error || 'Could not check out');
      }
    },
  });

  const openMaps = () => {
    const loc = booking?.customerLocation;
    if (!loc) return Alert.alert('No location', 'Customer location not available yet.');
    const label = encodeURIComponent(loc.address || 'Customer Home');
    const url = Platform.OS === 'ios'
      ? `maps://?q=${label}&ll=${loc.latitude},${loc.longitude}`
      : `geo:${loc.latitude},${loc.longitude}?q=${loc.latitude},${loc.longitude}(${label})`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${loc.latitude},${loc.longitude}`)
    );
  };

  const callCustomer = () => {
    if (!booking?.customer?.phone) return;
    Linking.openURL(`tel:${booking.customer.phone}`);
  };

  if (isLoading) return <ActivityIndicator style={{ flex: 1, marginTop: 80 }} color={colors.primary} size="large" />;
  if (!booking) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: colors.gray[500] }}>Booking not found</Text>
    </View>
  );

  const isConfirmedOrActive = ['CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(booking.status);
  const elder = booking.elder || {};
  const loc = booking.customerLocation;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: STATUS_COLOR[booking.status] ?? colors.gray[400] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Booking #{booking.bookingNumber}</Text>
          <Text style={styles.headerStatus}>{booking.status}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Session Timer (ACTIVE only) */}
        {booking.status === 'ACTIVE' && booking.checkInTime && (
          <SessionTimer checkInTime={booking.checkInTime} />
        )}

        {/* Customer Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <Card style={styles.card}>
            <View style={styles.contactRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{booking.customer?.name?.[0] ?? 'C'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{booking.customer?.name}</Text>
                {isConfirmedOrActive && booking.customer?.phone ? (
                  <TouchableOpacity onPress={callCustomer}>
                    <Text style={styles.phoneLink}>📞 {booking.customer.phone}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.phoneLocked}>📞 Phone revealed after you accept</Text>
                )}
              </View>
              {isConfirmedOrActive && booking.customer?.phone && (
                <TouchableOpacity style={styles.callBtn} onPress={callCustomer}>
                  <Text style={styles.callBtnText}>Call</Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>
        </View>

        {/* Location / Navigate */}
        {loc && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Location</Text>
            <Card style={styles.card}>
              <Text style={styles.addressText}>{loc.address || `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`}</Text>
              <TouchableOpacity style={styles.mapBtn} onPress={openMaps}>
                <Text style={styles.mapBtnText}>🗺️  Open in Maps</Text>
              </TouchableOpacity>
            </Card>
          </View>
        )}

        {/* Elder Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Care Recipient</Text>
          <Card style={styles.card}>
            <InfoRow label="Name" value={elder.name} />
            <InfoRow label="Age" value={elder.age ? `${elder.age} years` : undefined} />
            <InfoRow label="Gender" value={elder.gender} />
            {isConfirmedOrActive && (
              <>
                <InfoRow label="Relationship" value={elder.relationship} />
                {elder.medicalConditions?.length > 0 && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Medical Conditions</Text>
                    <View style={{ flex: 2, alignItems: 'flex-end' }}>
                      {elder.medicalConditions.map((c, i) => (
                        <Text key={i} style={[styles.infoVal, { color: colors.danger }]}>{c}</Text>
                      ))}
                    </View>
                  </View>
                )}
                {elder.medications?.length > 0 && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Medications</Text>
                    <View style={{ flex: 2, alignItems: 'flex-end' }}>
                      {elder.medications.map((m, i) => (
                        <Text key={i} style={styles.infoVal}>{m}</Text>
                      ))}
                    </View>
                  </View>
                )}
                {elder.allergies?.length > 0 && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Allergies</Text>
                    <View style={{ flex: 2, alignItems: 'flex-end' }}>
                      {elder.allergies.map((a, i) => (
                        <Text key={i} style={[styles.infoVal, { color: '#d97706' }]}>{a}</Text>
                      ))}
                    </View>
                  </View>
                )}
                {elder.specialNeeds && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Special Needs</Text>
                    <Text style={[styles.infoVal, { color: colors.primary }]}>{elder.specialNeeds}</Text>
                  </View>
                )}
              </>
            )}
            {!isConfirmedOrActive && (
              <Text style={styles.lockedNote}>Full medical details available after you accept the booking</Text>
            )}
          </Card>
        </View>

        {/* Booking Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Details</Text>
          <Card style={styles.card}>
            <InfoRow label="Service" value={booking.serviceType?.replace(/_/g, ' ')} />
            {booking.scheduledAt && (
              <>
                <InfoRow label="Date" value={format(new Date(booking.scheduledAt), 'EEE, dd MMM yyyy')} />
                <InfoRow label="Time" value={`${booking.startTime} – ${booking.endTime}`} />
              </>
            )}
            <InfoRow label="Duration" value={`${booking.durationHours}h`} />
            <InfoRow label="Your Earnings" value={`₹${booking.totalAmount}`} highlight />
            {booking.specialNotes && <InfoRow label="Notes" value={booking.specialNotes} />}
            {booking.checkInTime && <InfoRow label="Checked In" value={format(new Date(booking.checkInTime), 'hh:mm a')} />}
            {booking.checkOutTime && <InfoRow label="Checked Out" value={format(new Date(booking.checkOutTime), 'hh:mm a')} />}
            {booking.actualDuration && <InfoRow label="Actual Duration" value={`${booking.actualDuration.toFixed(1)}h`} />}
          </Card>
        </View>

        {/* Session Photos (ACTIVE or COMPLETED) */}
        {['ACTIVE', 'COMPLETED'].includes(booking.status) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Session Photos</Text>
            {sessionPhotos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingRight: spacing.md }}>
                  {sessionPhotos.map(p => (
                    <View key={p.id} style={styles.photoThumb}>
                      <Image source={{ uri: p.viewUrl }} style={styles.photoImg} resizeMode="cover" />
                      {p.caption ? <Text style={styles.photoCaption} numberOfLines={1}>{p.caption}</Text> : null}
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
            {booking.status === 'ACTIVE' && (
              <Card style={styles.card}>
                <TextInput
                  style={styles.captionInput}
                  placeholder="Optional caption for photo…"
                  placeholderTextColor={colors.gray[400]}
                  value={photoCaption}
                  onChangeText={setPhotoCaption}
                />
                <Button
                  title={uploading ? 'Uploading…' : '📸 Add Session Photo'}
                  onPress={handleAddPhoto}
                  loading={uploading}
                  variant="outline"
                />
              </Card>
            )}
            {sessionPhotos.length === 0 && booking.status === 'COMPLETED' && (
              <Card style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <Text style={{ color: colors.gray[400], fontSize: fontSizes.sm }}>No photos were taken during this session.</Text>
              </Card>
            )}
          </View>
        )}

        {/* Chat button for confirmed/active/completed */}
        {isConfirmedOrActive && (
          <View style={styles.section}>
            <Button
              title="💬 Chat with Customer"
              variant="outline"
              onPress={() => router.push(`/(caregiver)/booking/chat?bookingId=${id}&bookingNumber=${booking.bookingNumber ?? ''}`)}
            />
          </View>
        )}

        {/* Actions */}
        <View style={[styles.section, { gap: spacing.sm }]}>
          {booking.status === 'CONFIRMED' && (
            <Button
              title="📍 Check In"
              onPress={() => checkInMutation.mutate()}
              loading={checkInMutation.isPending}
            />
          )}
          {booking.status === 'ACTIVE' && (
            <Button
              title="✅ Check Out"
              onPress={() => checkOutMutation.mutate()}
              loading={checkOutMutation.isPending}
              style={{ backgroundColor: colors.elderBlue }}
            />
          )}
          {booking.status === 'COMPLETED' && (
            <View style={styles.completedBadge}>
              <Text style={styles.completedText}>✅ Session Completed</Text>
              {booking.actualDuration && (
                <Text style={styles.completedSub}>Duration: {booking.actualDuration.toFixed(1)}h · Earned: ₹{booking.totalAmount}</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  backBtn: { paddingRight: 12, paddingVertical: 4 },
  backText: { color: 'rgba(255,255,255,0.9)', fontSize: fontSizes.sm, fontWeight: '600' },
  headerTitle: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.white },
  headerStatus: { fontSize: fontSizes.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2, letterSpacing: 1 },
  timerBox: {
    backgroundColor: '#16a34a', paddingVertical: spacing.lg,
    alignItems: 'center', gap: 4,
  },
  timerLabel: { fontSize: fontSizes.xs, color: 'rgba(255,255,255,0.8)', fontWeight: '600', letterSpacing: 1 },
  timerValue: { fontSize: 40, fontWeight: '900', color: colors.white, letterSpacing: 4, fontVariant: ['tabular-nums'] },
  timerSub: { fontSize: fontSizes.xs, color: 'rgba(255,255,255,0.7)' },
  section: { paddingHorizontal: spacing.md, marginTop: spacing.lg },
  sectionTitle: { fontSize: fontSizes.xs, fontWeight: '700', color: colors.gray[500], textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm },
  card: { marginBottom: 0 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.primaryDark },
  contactName: { fontSize: fontSizes.md, fontWeight: '700', color: colors.gray[900] },
  phoneLink: { fontSize: fontSizes.sm, color: colors.primary, marginTop: 3, fontWeight: '600' },
  phoneLocked: { fontSize: fontSizes.xs, color: colors.gray[400], marginTop: 3 },
  callBtn: { backgroundColor: colors.primaryLight, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.sm },
  callBtnText: { color: colors.primaryDark, fontSize: fontSizes.sm, fontWeight: '700' },
  addressText: { fontSize: fontSizes.sm, color: colors.gray[700], lineHeight: 20, marginBottom: spacing.sm },
  mapBtn: { backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  mapBtnText: { color: colors.primaryDark, fontSize: fontSizes.sm, fontWeight: '700' },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.gray[50],
  },
  infoLabel: { fontSize: fontSizes.sm, color: colors.gray[500], flex: 1 },
  infoVal: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.gray[800], flex: 2, textAlign: 'right' },
  lockedNote: { fontSize: fontSizes.xs, color: colors.gray[400], textAlign: 'center', marginTop: spacing.sm, fontStyle: 'italic' },
  completedBadge: {
    backgroundColor: '#dcfce7', borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', gap: 4,
  },
  completedText: { fontSize: fontSizes.md, fontWeight: '700', color: '#15803d' },
  completedSub: { fontSize: fontSizes.xs, color: '#16a34a' },
  photoThumb: {
    width: 120, height: 100, borderRadius: radius.md, overflow: 'hidden',
    backgroundColor: colors.gray[100],
  },
  photoImg: { width: 120, height: 80 },
  photoCaption: {
    fontSize: 10, color: colors.gray[600], paddingHorizontal: 4, paddingVertical: 2,
    backgroundColor: colors.white,
  },
  captionInput: {
    borderWidth: 1.5, borderColor: colors.gray[200], borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: fontSizes.sm,
    color: colors.gray[800], marginBottom: spacing.sm,
  },
});
