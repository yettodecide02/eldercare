import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, Linking, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { colors, spacing, fontSizes, radius } from '../../lib/theme';

function PulseDot({ active }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useState(() => {
    if (!active) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.8, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  });

  return (
    <View style={styles.pulseDotWrap}>
      <Animated.View style={[styles.pulseDotRing, { transform: [{ scale }], opacity }]} />
      <View style={[styles.pulseDotCore, active && styles.pulseDotCoreActive]} />
    </View>
  );
}

export default function LiveTrackingScreen() {
  const { bookingId } = useLocalSearchParams();
  const router = useRouter();
  const [sosCount, setSosCount] = useState(0);

  const { data: booking } = useQuery({
    queryKey: ['booking-track', bookingId],
    queryFn: () => api.get(`/bookings/${bookingId}`).then(r => r.data),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const { data: gpsData } = useQuery({
    queryKey: ['gps-history', bookingId],
    queryFn: () => api.get(`/bookings/${bookingId}/gps-history`).then(r => r.data),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const locations = gpsData?.locations ?? [];
  const lastLocation = locations[locations.length - 1];
  const caregiverPhone = booking?.caregiver?.phone ?? booking?.caregiver?.user?.phone;
  const isActive = booking?.status === 'ACTIVE';

  const handleSOS = () => {
    Alert.alert(
      '🚨 SOS Emergency Alert',
      'This will immediately alert your caregiver. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/bookings/${bookingId}/sos`);
              setSosCount(c => c + 1);
              Alert.alert('SOS Sent', 'Emergency alert has been sent to your caregiver.');
            } catch (e) {
              Alert.alert('Error', e.response?.data?.error || 'Failed to send SOS');
            }
          },
        },
      ]
    );
  };

  const formatCoord = (val) => parseFloat(val).toFixed(5);
  const formatTime = (ts) =>
    new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Tracking</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status hero card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cgName}>{booking?.caregiver?.name ?? '—'}</Text>
              <View style={styles.statusRow}>
                <PulseDot active={isActive} />
                <Text style={[styles.statusText, isActive && styles.statusTextActive]}>
                  {isActive ? 'Session in progress' : booking?.status ?? '—'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.callBtn, !caregiverPhone && { opacity: 0.4 }]}
              onPress={() => caregiverPhone && Linking.openURL(`tel:${caregiverPhone}`)}
              disabled={!caregiverPhone}
            >
              <Text style={styles.callBtnText}>📞</Text>
            </TouchableOpacity>
          </View>

          {/* Location tile */}
          {lastLocation ? (
            <View style={styles.locationTile}>
              <View style={styles.locationTileHeader}>
                <Text style={styles.locationTileLabel}>📍 Last Known Location</Text>
                <Text style={styles.locationTileTime}>{formatTime(lastLocation.timestamp)}</Text>
              </View>
              <Text style={styles.coordLine}>
                {formatCoord(lastLocation.latitude)}° N, {formatCoord(lastLocation.longitude)}° E
              </Text>
              {lastLocation.accuracy && (
                <Text style={styles.accuracyText}>Accuracy: ±{Math.round(lastLocation.accuracy)}m</Text>
              )}
            </View>
          ) : (
            <View style={styles.noLocationTile}>
              <Text style={styles.noLocationIcon}>📡</Text>
              <Text style={styles.noLocationText}>
                {isActive ? 'Waiting for caregiver location…' : 'No location data available'}
              </Text>
            </View>
          )}
        </View>

        {/* GPS History */}
        {locations.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Route History ({locations.length} points)</Text>
            <View style={styles.timeline}>
              {[...locations].reverse().slice(0, 8).map((loc, i) => (
                <View key={i} style={styles.timelineRow}>
                  <View style={styles.timelineDotCol}>
                    <View style={[styles.timelineDot, i === 0 && styles.timelineDotLatest]} />
                    {i < Math.min(7, locations.length - 2) && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTime}>{formatTime(loc.timestamp)}</Text>
                    <Text style={styles.timelineCoord}>
                      {formatCoord(loc.latitude)}° N, {formatCoord(loc.longitude)}° E
                    </Text>
                  </View>
                </View>
              ))}
              {locations.length > 8 && (
                <Text style={styles.morePoints}>+{locations.length - 8} earlier points</Text>
              )}
            </View>
          </View>
        )}

        {/* Booking info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Info</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>
                {booking?.bookingDate ? new Date(booking.bookingDate).toLocaleDateString('en-IN') : '—'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Start Time</Text>
              <Text style={styles.infoValue}>{booking?.startTime ?? '—'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Duration</Text>
              <Text style={styles.infoValue}>{booking?.durationHours ? `${booking.durationHours}h` : '—'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Check-In</Text>
              <Text style={styles.infoValue}>
                {booking?.checkInTime ? formatTime(booking.checkInTime) : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* SOS */}
        {isActive && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.sosBtn, sosCount >= 3 && styles.sosBtnDisabled]}
              onPress={handleSOS}
              disabled={sosCount >= 3}
            >
              <Text style={styles.sosBtnText}>
                {sosCount >= 3 ? '🚨 SOS Limit Reached' : '🚨 SOS Emergency Alert'}
              </Text>
            </TouchableOpacity>
            {sosCount > 0 && (
              <Text style={styles.sosUsed}>Alerts sent: {sosCount}/3</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  backBtn: { paddingVertical: 4, paddingRight: 12, width: 60 },
  backText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: fontSizes.lg, fontWeight: '700', color: colors.gray[900], textAlign: 'center' },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },

  heroCard: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.lg, gap: spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cgName: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.gray[900] },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusText: { fontSize: fontSizes.sm, color: colors.gray[500], fontWeight: '500' },
  statusTextActive: { color: '#15803d', fontWeight: '700' },
  callBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  callBtnText: { fontSize: 22 },

  pulseDotWrap: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  pulseDotRing: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#15803d' },
  pulseDotCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gray[300] },
  pulseDotCoreActive: { backgroundColor: '#15803d' },

  locationTile: {
    backgroundColor: colors.gray[50], borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.gray[100],
  },
  locationTileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  locationTileLabel: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.gray[700] },
  locationTileTime: { fontSize: fontSizes.xs, color: colors.gray[400] },
  coordLine: { fontSize: fontSizes.md, fontWeight: '600', color: colors.gray[900], fontVariant: ['tabular-nums'] },
  accuracyText: { fontSize: fontSizes.xs, color: colors.gray[400], marginTop: 3 },

  noLocationTile: {
    backgroundColor: colors.gray[50], borderRadius: radius.lg,
    padding: spacing.lg, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.gray[100],
  },
  noLocationIcon: { fontSize: 28 },
  noLocationText: { fontSize: fontSizes.sm, color: colors.gray[500], textAlign: 'center' },

  section: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.lg, gap: spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  sectionTitle: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.gray[500], textTransform: 'uppercase', letterSpacing: 0.5 },

  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineDotCol: { width: 16, alignItems: 'center', paddingTop: 4 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gray[300], borderWidth: 2, borderColor: colors.gray[200] },
  timelineDotLatest: { backgroundColor: colors.primary, borderColor: colors.primary },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.gray[100], marginTop: 2, minHeight: 20 },
  timelineContent: { flex: 1, paddingBottom: 14 },
  timelineTime: { fontSize: fontSizes.xs, fontWeight: '700', color: colors.gray[700] },
  timelineCoord: { fontSize: fontSizes.xs, color: colors.gray[400], marginTop: 1 },
  morePoints: { fontSize: fontSizes.xs, color: colors.gray[400], textAlign: 'center', marginTop: 4 },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  infoItem: { width: '47%', backgroundColor: colors.gray[50], borderRadius: radius.md, padding: spacing.sm },
  infoLabel: { fontSize: fontSizes.xs, color: colors.gray[400], fontWeight: '600', marginBottom: 2 },
  infoValue: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.gray[900] },

  sosBtn: { backgroundColor: '#dc2626', borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  sosBtnDisabled: { backgroundColor: colors.gray[300] },
  sosBtnText: { color: colors.white, fontSize: fontSizes.md, fontWeight: '800' },
  sosUsed: { fontSize: fontSizes.xs, color: colors.gray[400], textAlign: 'center' },
});
