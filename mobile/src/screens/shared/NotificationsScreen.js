import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, fontSizes, radius } from '../../lib/theme';

const TYPE_CONFIG = {
  BOOKING_CONFIRMED:        { icon: '✅', color: '#1d4ed8' },
  BOOKING_CANCELLED:        { icon: '❌', color: '#dc2626' },
  BOOKING_PAYMENT_RECEIVED: { icon: '💰', color: '#15803d' },
  BOOKING_CHECKED_IN:       { icon: '📍', color: '#7c3aed' },
  BOOKING_COMPLETED:        { icon: '🎉', color: '#15803d' },
  SOS_ALERT:                { icon: '🚨', color: '#dc2626' },
  NEW_MESSAGE:              { icon: '💬', color: '#1d4ed8' },
  VERIFICATION_APPROVED:    { icon: '✅', color: '#15803d' },
  VERIFICATION_REJECTED:    { icon: '❌', color: '#dc2626' },
};
const DEFAULT_CONFIG = { icon: '🔔', color: colors.primary };

export default function NotificationsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isCaregiver = user?.role === 'CAREGIVER';

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  const markOneMutation = useMutation({
    mutationFn: (id) => api.put(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleTap = (n) => {
    if (!n.isRead) markOneMutation.mutate(n.id);
    if (n.data?.bookingId) {
      const base = isCaregiver ? '/(caregiver)' : '/(customer)';
      router.push(`${base}/booking/${n.data.bookingId}`);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity
          style={styles.markAllBtn}
          onPress={() => markAllMutation.mutate()}
          disabled={unreadCount === 0 || markAllMutation.isPending}
        >
          <Text style={[styles.markAllText, unreadCount === 0 && { color: colors.gray[300] }]}>
            {markAllMutation.isPending ? 'Marking…' : 'Mark all read'}
          </Text>
        </TouchableOpacity>
      </View>

      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadBannerText}>
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} size="large" />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={n => n.id}
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
          contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : { paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>
                Booking updates, messages, and alerts will appear here.
              </Text>
            </View>
          }
          renderItem={({ item: n }) => {
            const cfg = TYPE_CONFIG[n.type] ?? DEFAULT_CONFIG;
            return (
              <TouchableOpacity
                style={[styles.item, !n.isRead && styles.itemUnread]}
                onPress={() => handleTap(n)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconWrap, { backgroundColor: cfg.color + '1a' }]}>
                  <Text style={styles.icon}>{cfg.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, !n.isRead && styles.itemTitleBold]}>
                    {n.title}
                  </Text>
                  <Text style={styles.itemMsg} numberOfLines={2}>{n.message}</Text>
                  <Text style={styles.itemTime}>
                    {format(new Date(n.createdAt), 'd MMM · HH:mm')}
                  </Text>
                </View>
                {!n.isRead && <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  backBtn: { paddingVertical: 4, paddingRight: 12, width: 60 },
  backText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600' },
  headerTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.gray[900] },
  markAllBtn: { paddingVertical: 4, paddingLeft: 8 },
  markAllText: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: '600' },

  unreadBanner: {
    backgroundColor: colors.primaryLight, paddingHorizontal: spacing.md, paddingVertical: 8,
  },
  unreadBannerText: { fontSize: fontSizes.xs, color: colors.primaryDark, fontWeight: '700' },

  emptyContainer: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: spacing.xl },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.gray[800], marginBottom: 8 },
  emptyText: { fontSize: fontSizes.sm, color: colors.gray[500], textAlign: 'center', lineHeight: 20 },

  item: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.gray[50],
  },
  itemUnread: { backgroundColor: '#f0f9ff' },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  icon: { fontSize: 20 },
  itemTitle: { fontSize: fontSizes.sm, color: colors.gray[700], lineHeight: 20 },
  itemTitleBold: { fontWeight: '700', color: colors.gray[900] },
  itemMsg: { fontSize: fontSizes.xs, color: colors.gray[500], marginTop: 2, lineHeight: 17 },
  itemTime: { fontSize: 10, color: colors.gray[400], marginTop: 4 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    alignSelf: 'center', flexShrink: 0,
  },
});
