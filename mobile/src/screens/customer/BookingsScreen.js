import { useState } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  StyleSheet, Alert, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import api from '../../lib/api';
import { EmptyState } from '../../components/ui';
import { colors, spacing, fontSizes, radius } from '../../lib/theme';

const TABS = ['All', 'Upcoming', 'Active', 'Completed', 'Cancelled', 'Disputed'];
const STATUS_BADGE = {
  PENDING: 'yellow', CONFIRMED: 'blue', ACTIVE: 'green',
  COMPLETED: 'green', CANCELLED: 'gray', DISPUTED: 'red',
};

const TAB_STATUS_MAP = {
  All: undefined,
  Upcoming: 'PENDING,CONFIRMED',
  Active: 'ACTIVE',
  Completed: 'COMPLETED',
  Cancelled: 'CANCELLED',
  Disputed: 'DISPUTED',
};

export default function BookingsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState('All');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['customer-bookings', tab],
    queryFn: () =>
      api.get('/bookings/customer', { params: { status: TAB_STATUS_MAP[tab] } }).then(r => r.data),
  });

  const cancelMutation = useMutation({
    mutationFn: id => api.put(`/bookings/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-bookings'] });
      Alert.alert('Cancelled', 'Your booking has been cancelled.');
    },
    onError: e => Alert.alert('Error', e.response?.data?.message ?? 'Cancel failed'),
  });

  const sosMutation = useMutation({
    mutationFn: id => api.post(`/bookings/${id}/sos`),
    onSuccess: () => Alert.alert('SOS Sent', 'Emergency alert sent to your caregiver.'),
  });

  const bookings = data?.bookings ?? [];

  const handleCancel = id => {
    Alert.alert('Cancel Booking', 'Are you sure? Cancellation charges may apply.', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelMutation.mutate(id) },
    ]);
  };

  const handleSOS = id => {
    Alert.alert('🚨 SOS Alert', 'Send emergency alert to the caregiver?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send SOS', style: 'destructive', onPress: () => sosMutation.mutate(id) },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {TABS.map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={bookings}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
        ListEmptyComponent={
          <EmptyState
            icon="📋"
            title="No bookings"
            subtitle={tab === 'All' ? 'Book a caregiver to get started' : `No ${tab.toLowerCase()} bookings`}
          />
        }
        renderItem={({ item: b }) => {
          const cgName = b.caregiver?.user?.name ?? 'Caregiver';
          const STATUS_STYLES = {
            PENDING:   { bg: '#fef3c7', text: '#b45309', dot: '#f59e0b' },
            CONFIRMED: { bg: '#dbeafe', text: '#1d4ed8', dot: '#3b82f6' },
            ACTIVE:    { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
            COMPLETED: { bg: '#f3f4f6', text: '#4b5563', dot: '#9ca3af' },
            CANCELLED: { bg: '#fee2e2', text: '#dc2626', dot: '#ef4444' },
            DISPUTED:  { bg: '#fce7f3', text: '#9d174d', dot: '#ec4899' },
          };
          const ss = STATUS_STYLES[b.status] ?? STATUS_STYLES.PENDING;
          return (
            <TouchableOpacity
              style={styles.bookingCard}
              onPress={() => router.push(`/(customer)/booking/${b.id}`)}
              activeOpacity={0.88}
            >
              {/* Status bar accent */}
              <View style={[styles.bookingAccent, { backgroundColor: ss.dot }]} />

              {/* Header row */}
              <View style={styles.bookingHeader}>
                <View style={[styles.cgAvatar, { backgroundColor: ss.bg }]}>
                  <Text style={[styles.cgAvatarText, { color: ss.text }]}>{cgName[0]?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.cgName}>{cgName}</Text>
                  <Text style={styles.serviceType}>{b.serviceType?.replace(/_/g, ' ')}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: ss.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: ss.dot }]} />
                  <Text style={[styles.statusText, { color: ss.text }]}>{b.status}</Text>
                </View>
              </View>

              {/* Meta */}
              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>📅 {format(new Date(b.scheduledAt), 'dd MMM · HH:mm')}</Text>
                </View>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>⏱ {b.durationHours}h</Text>
                </View>
                <View style={[styles.metaChip, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.metaChipText, { color: colors.primaryDark, fontWeight: '700' }]}>₹{b.totalAmount}</Text>
                </View>
                {['CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(b.status) && (
                  <TouchableOpacity
                    style={[styles.metaChip, styles.chatChip]}
                    onPress={() => router.push(`/(customer)/booking/chat?bookingId=${b.id}&bookingNumber=${b.bookingNumber ?? ''}`)}
                  >
                    <Text style={styles.chatChipText}>💬 Chat</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                {(b.status === 'PENDING' || b.status === 'CONFIRMED') && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.cancelBtn]}
                    onPress={() => handleCancel(b.id)}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                )}
                {b.status === 'ACTIVE' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.sosBtn]}
                    onPress={() => handleSOS(b.id)}
                  >
                    <Text style={styles.sosBtnText}>🚨 SOS</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.viewBtn]}
                  onPress={() => router.push(`/(customer)/booking/${b.id}`)}
                >
                  <Text style={styles.viewBtnText}>View Details →</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  tabsWrapper: {
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.gray[100],
    paddingVertical: 10,
  },
  tabs: {
    paddingHorizontal: spacing.md, gap: 8,
    alignItems: 'center',
    flexDirection: 'row',
  },
  tab: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: radius.full, backgroundColor: colors.gray[100],
    alignSelf: 'center',
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: fontSizes.xs, fontWeight: '600', color: colors.gray[600] },
  tabTextActive: { color: colors.white },

  // Booking card
  bookingCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  bookingAccent: { height: 4, width: '100%' },
  bookingHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, paddingBottom: 8 },
  cgAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  cgAvatarText: { fontSize: fontSizes.lg, fontWeight: '800' },
  cgName: { fontSize: fontSizes.md, fontWeight: '700', color: colors.gray[900] },
  serviceType: { fontSize: fontSizes.xs, color: colors.gray[500], fontWeight: '500', marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  // Meta chips
  metaRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: spacing.md, paddingBottom: 10,
  },
  metaChip: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.full,
  },
  metaChipText: { fontSize: fontSizes.xs, color: colors.gray[600], fontWeight: '500' },

  // Actions
  actions: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.gray[50],
    paddingTop: 10,
  },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#fee2e2' },
  cancelBtnText: { fontSize: fontSizes.xs, fontWeight: '600', color: '#dc2626' },
  sosBtn: { backgroundColor: '#fee2e2' },
  sosBtnText: { fontSize: fontSizes.xs, fontWeight: '700', color: '#dc2626' },
  viewBtn: { backgroundColor: colors.primary },
  viewBtnText: { fontSize: fontSizes.xs, fontWeight: '600', color: colors.white },
  chatChip: { backgroundColor: '#eff6ff' },
  chatChipText: { fontSize: fontSizes.xs, color: '#1d4ed8', fontWeight: '600' },
});
