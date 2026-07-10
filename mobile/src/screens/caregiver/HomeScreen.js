import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Switch, Alert, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Card, Badge, SectionHeader, EmptyState } from '../../components/ui';
import { colors, spacing, fontSizes, radius } from '../../lib/theme';
import * as Location from 'expo-location';

export default function CaregiverHomeScreen() {
  const user = useAuthStore(s => s.user);
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['caregiver-home'],
    queryFn: async () => {
      const [me, bookings] = await Promise.all([
        api.get('/caregiver/me'),
        api.get('/bookings/caregiver', { params: { limit: 5, status: 'PENDING,CONFIRMED,ACTIVE' } }),
      ]);
      return { profile: me.data, bookings: bookings.data.bookings ?? [] };
    },
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => api.get('/notifications?unreadOnly=true&limit=1').then(r => r.data),
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });
  const unreadNotifs = notifData?.unreadCount ?? 0;

  const onlineMutation = useMutation({
    mutationFn: isOnline => api.put('/caregiver/online-status', { isOnline }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['caregiver-home'] }),
    onError: e => {
      const data = e.response?.data;
      if (data?.code === 'NOT_VERIFIED') {
        Alert.alert(
          'Verification Required',
          `Your profile is currently "${data.verificationStatus?.replace('_', ' ')}". You can go online only after admin approves your documents.\n\nWe'll notify you once verified.`,
        );
      } else {
        Alert.alert('Error', data?.error ?? 'Could not update status');
      }
    },
  });

  const confirmMutation = useMutation({
    mutationFn: ({ id, action }) => api.put(`/bookings/${id}/confirm`, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['caregiver-home'] }),
    onError: e => Alert.alert('Error', e.response?.data?.message ?? 'Action failed'),
  });

  const getLocationCoords = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission is required to check in/out. Please enable it in Settings.');
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  };

  const checkInMutation = useMutation({
    mutationFn: async id => {
      const coords = await getLocationCoords();
      return api.post(`/bookings/${id}/check-in`, coords);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['caregiver-home'] }); Alert.alert('Checked In ✅', 'Session started! Your location is being shared.'); },
    onError: e => {
      const data = e.response?.data;
      if (data?.code === 'OUT_OF_RANGE') {
        Alert.alert(
          '📍 Too Far Away',
          `You are ${data.distanceMeters}m from the customer's location.\n\nYou must be within ${data.allowedMeters}m to check in.\n\nPlease travel to the customer's home and try again.`,
          [{ text: 'OK' }],
        );
      } else if (data?.code === 'TOO_EARLY') {
        Alert.alert('Too Early', 'Check-in is only allowed 15 minutes before the booking start time.');
      } else {
        Alert.alert('Check-in Failed', e.message ?? data?.error ?? 'Could not check in');
      }
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async id => {
      const coords = await getLocationCoords();
      return api.post(`/bookings/${id}/check-out`, coords);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['caregiver-home'] }); Alert.alert('Checked Out ✅', 'Session complete. Payment released!'); },
    onError: e => {
      const data = e.response?.data;
      if (data?.code === 'SESSION_TOO_SHORT') {
        Alert.alert('Too Soon', 'Minimum session duration is 15 minutes. Please wait and try again.');
      } else {
        Alert.alert('Check-out Failed', e.message ?? data?.error ?? 'Could not check out');
      }
    },
  });

  const profile = data?.profile;
  const bookings = data?.bookings ?? [];

  useEffect(() => {
    if (!isLoading && profile && profile.verificationStatus === 'PENDING') {
      router.replace('/(caregiver)/onboarding');
    }
  }, [isLoading, profile?.verificationStatus]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      {/* Header */}
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.subText}>
            {profile?.verificationStatus === 'VERIFIED' ? '✅ Verified Caregiver' : `⏳ ${profile?.verificationStatus ?? '…'}`}
          </Text>
        </View>

        {/* Notification Bell */}
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => router.push('/(caregiver)/notifications')}
        >
          <Text style={styles.bellIcon}>🔔</Text>
          {unreadNotifs > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</Text>
            </View>
          )}
        </TouchableOpacity>

        {profile?.verificationStatus === 'VERIFIED' && (
          <View style={styles.onlineRow}>
            <Text style={styles.onlineLabel}>{profile?.isOnline ? 'Online' : 'Offline'}</Text>
            <Switch
              value={profile?.isOnline ?? false}
              onValueChange={val => onlineMutation.mutate(val)}
              trackColor={{ false: colors.gray[300], true: colors.primaryLight }}
              thumbColor={profile?.isOnline ? colors.primary : colors.gray[500]}
            />
          </View>
        )}
      </View>

      {/* Error Banner */}
      {isError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>Could not load data. Check your connection.</Text>
          <TouchableOpacity onPress={refetch} style={styles.errorRetryBtn}>
            <Text style={styles.errorRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Verification Status Banners */}
      {profile?.verificationStatus === 'UNDER_REVIEW' && (
        <View style={[styles.verificationBanner, styles.bannerPending]}>
          <Text style={styles.bannerIcon}>⏳</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Verification Under Review</Text>
            <Text style={styles.bannerText}>
              Your documents are being reviewed by our team. You'll receive a notification within 48 hours once approved.
            </Text>
          </View>
        </View>
      )}

      {profile?.verificationStatus === 'REJECTED' && (
        <View style={[styles.verificationBanner, styles.bannerRejected]}>
          <Text style={styles.bannerIcon}>❌</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: '#991b1b' }]}>Verification Rejected</Text>
            <Text style={[styles.bannerText, { color: '#7f1d1d' }]}>
              {profile.documents?.find(d => d.verificationNotes)?.verificationNotes ||
                'Please re-upload your documents for re-review.'}
            </Text>
            <TouchableOpacity
              style={styles.resubmitBtn}
              onPress={() => router.push('/(caregiver)/onboarding')}
            >
              <Text style={styles.resubmitBtnText}>Re-submit Documents →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Earnings Summary */}
      <View style={styles.section}>
        <View style={styles.earningsRow}>
          {[
            { label: 'Today', val: profile?.todayEarnings },
            { label: 'This Month', val: profile?.monthEarnings },
            { label: 'Total', val: profile?.totalEarnings },
          ].map(e => (
            <Card key={e.label} style={styles.earningsCard}>
              <Text style={styles.earningsVal}>
                {isLoading ? '—' : `₹${e.val ?? 0}`}
              </Text>
              <Text style={styles.earningsLabel}>{e.label}</Text>
            </Card>
          ))}
        </View>
      </View>

      {/* Booking Requests */}
      <View style={styles.section}>
        <SectionHeader title="Booking Requests" />
        {bookings.filter(b => b.status === 'PENDING').length === 0 ? (
          <EmptyState icon="📬" title="No pending requests" />
        ) : (
          bookings.filter(b => b.status === 'PENDING').map(b => (
            <TouchableOpacity key={b.id} onPress={() => router.push(`/(caregiver)/booking/${b.id}`)}>
              <Card style={{ marginBottom: spacing.sm }}>
                <Text style={styles.customerName}>{b.customer?.name ?? b.customer?.user?.name}</Text>
                <Text style={styles.bookingMeta}>
                  {b.serviceType?.replace(/_/g, ' ')} · {format(new Date(b.scheduledAt), 'dd MMM, HH:mm')} · {b.durationHours}h · ₹{b.totalAmount}
                </Text>
                {b.elder?.name && (
                  <Text style={styles.bookingMeta}>For: {b.elder.name}</Text>
                )}
                <View style={styles.confirmRow}>
                  <TouchableOpacity
                    style={[styles.confirmBtn, styles.declineBtn]}
                    onPress={() => confirmMutation.mutate({ id: b.id, action: 'decline' })}
                  >
                    <Text style={styles.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, styles.acceptBtn]}
                    onPress={() => confirmMutation.mutate({ id: b.id, action: 'accept' })}
                  >
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Active / Upcoming */}
      <View style={styles.section}>
        <SectionHeader title="Active & Upcoming" />
        {bookings.filter(b => ['CONFIRMED', 'ACTIVE'].includes(b.status)).length === 0 ? (
          <EmptyState icon="📅" title="No active bookings" />
        ) : (
          bookings.filter(b => ['CONFIRMED', 'ACTIVE'].includes(b.status)).map(b => (
            <TouchableOpacity key={b.id} onPress={() => router.push(`/(caregiver)/booking/${b.id}`)}>
              <Card style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerName}>{b.customer?.name ?? b.customer?.user?.name}</Text>
                    <Text style={styles.bookingMeta}>
                      {format(new Date(b.scheduledAt), 'dd MMM, HH:mm')} · {b.durationHours}h · ₹{b.totalAmount}
                    </Text>
                    <Text style={[styles.bookingMeta, { color: colors.primary }]}>
                      {b.serviceType?.replace(/_/g, ' ')}
                    </Text>
                  </View>
                  <Badge label={b.status} color={b.status === 'ACTIVE' ? 'green' : 'blue'} />
                </View>

                <View style={styles.confirmRow}>
                  {b.status === 'CONFIRMED' && (
                    <TouchableOpacity
                      style={[styles.confirmBtn, styles.acceptBtn, { flex: 1 }]}
                      onPress={() => checkInMutation.mutate(b.id)}
                      disabled={checkInMutation.isPending}
                    >
                      <Text style={styles.acceptBtnText}>📍 Check In</Text>
                    </TouchableOpacity>
                  )}
                  {b.status === 'ACTIVE' && (
                    <TouchableOpacity
                      style={[styles.confirmBtn, { backgroundColor: colors.elderBlue, flex: 1 }]}
                      onPress={() => checkOutMutation.mutate(b.id)}
                      disabled={checkOutMutation.isPending}
                    >
                      <Text style={[styles.acceptBtnText, { color: colors.white }]}>✅ Check Out</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.confirmBtn, styles.detailBtn]}
                    onPress={() => router.push(`/(caregiver)/booking/${b.id}`)}
                  >
                    <Text style={styles.detailBtnText}>Details →</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  hero: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary, padding: spacing.lg, paddingTop: spacing.xl,
    gap: 10,
  },
  greeting: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.white },
  subText: { fontSize: fontSizes.xs, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  bellBtn: { position: 'relative', width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  bellIcon: { fontSize: 22 },
  bellBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#ef4444', borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { fontSize: 9, fontWeight: '800', color: colors.white },
  onlineRow: { alignItems: 'center', gap: 4 },
  onlineLabel: { fontSize: fontSizes.xs, color: colors.white, fontWeight: '600' },

  // Error Banner
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fee2e2', paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  errorBannerText: { fontSize: fontSizes.xs, color: '#dc2626', flex: 1 },
  errorRetryBtn: {
    borderWidth: 1, borderColor: '#dc2626', borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8,
  },
  errorRetryText: { fontSize: fontSizes.xs, color: '#dc2626', fontWeight: '700' },

  section: { paddingHorizontal: spacing.md, marginTop: spacing.lg },
  earningsRow: { flexDirection: 'row', gap: 8 },
  earningsCard: { flex: 1, alignItems: 'center', padding: spacing.sm },
  earningsVal: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.primary },
  earningsLabel: { fontSize: fontSizes.xs, color: colors.gray[500], marginTop: 2 },
  customerName: { fontSize: fontSizes.md, fontWeight: '700', color: colors.gray[900] },
  bookingMeta: { fontSize: fontSizes.xs, color: colors.gray[500], marginTop: 3 },
  confirmRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  confirmBtn: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  acceptBtn: { backgroundColor: colors.primaryLight },
  acceptBtnText: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.primaryDark },
  declineBtn: { backgroundColor: '#fee2e2' },
  declineBtnText: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.danger },
  detailBtn: { backgroundColor: colors.gray[100], flex: 0, paddingHorizontal: 14 },
  detailBtnText: { fontSize: fontSizes.xs, fontWeight: '700', color: colors.gray[600] },

  verificationBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginHorizontal: spacing.md, marginTop: spacing.md,
    borderRadius: radius.md, padding: spacing.md, borderWidth: 1,
  },
  bannerPending: { backgroundColor: '#fef9c3', borderColor: '#fde047' },
  bannerRejected: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  bannerIcon: { fontSize: 22, lineHeight: 28 },
  bannerTitle: { fontSize: fontSizes.sm, fontWeight: '700', color: '#713f12', marginBottom: 3 },
  bannerText: { fontSize: fontSizes.xs, color: '#78350f', lineHeight: 18 },
  resubmitBtn: {
    marginTop: spacing.sm, alignSelf: 'flex-start',
    backgroundColor: '#dc2626', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: radius.sm,
  },
  resubmitBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSizes.xs },
});
