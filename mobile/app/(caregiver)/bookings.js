import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import api from '../../src/lib/api';
import { Card, Badge } from '../../src/components/ui';
import { colors, spacing, fontSizes, radius } from '../../src/lib/theme';

const STATUS_COLOR = {
  PENDING: 'yellow', CONFIRMED: 'blue', ACTIVE: 'green',
  COMPLETED: 'green', CANCELLED: 'gray',
};

const STATUS_TABS = ['ALL', 'PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

export default function CaregiverBookingsScreen() {
  const router = useRouter();
  const [activeStatus, setActiveStatus] = useState('ALL');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['caregiver-bookings', activeStatus],
    queryFn: () => api.get('/bookings/caregiver', {
      params: { status: activeStatus === 'ALL' ? undefined : activeStatus, limit: 50 },
    }).then(r => r.data),
  });

  const bookings = data?.bookings ?? [];

  return (
    <View style={styles.container}>
      {/* Status Tabs */}
      <View>
        <FlatList
          horizontal
          data={STATUS_TABS}
          keyExtractor={s => s}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
          renderItem={({ item: s }) => (
            <TouchableOpacity
              onPress={() => setActiveStatus(s)}
              style={[styles.tab, activeStatus === s && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeStatus === s && styles.tabTextActive]}>
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ flex: 1, marginTop: 60 }} color={colors.primary} size="large" />
      ) : bookings.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No {activeStatus === 'ALL' ? '' : activeStatus.toLowerCase() + ' '}bookings</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={b => b.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          renderItem={({ item: b }) => (
            <TouchableOpacity onPress={() => router.push(`/(caregiver)/booking/${b.id}`)}>
              <Card style={styles.bookingCard}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerName}>{b.customer?.name}</Text>
                    <Text style={styles.elderName}>{b.elder?.name} · {b.serviceType?.replace(/_/g, ' ')}</Text>
                    {b.scheduledAt && (
                      <Text style={styles.dateText}>
                        {format(new Date(b.scheduledAt), 'EEE, dd MMM yyyy · hh:mm a')}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Badge label={b.status} color={STATUS_COLOR[b.status] ?? 'gray'} />
                    <Text style={styles.amount}>₹{b.totalAmount}</Text>
                  </View>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.footerText}>{b.durationHours}h · {b.bookingNumber}</Text>
                  {b.customer?.phone && (
                    <Text style={styles.footerText}>📞 {b.customer.phone}</Text>
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  tabs: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 8 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.gray[200], backgroundColor: colors.white,
  },
  tabActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  tabText: { fontSize: fontSizes.xs, fontWeight: '600', color: colors.gray[600] },
  tabTextActive: { color: colors.primaryDark },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: fontSizes.md, color: colors.gray[400] },
  bookingCard: { gap: spacing.sm },
  cardTop: { flexDirection: 'row', gap: spacing.sm },
  customerName: { fontSize: fontSizes.md, fontWeight: '700', color: colors.gray[900] },
  elderName: { fontSize: fontSizes.xs, color: colors.gray[500], marginTop: 2 },
  dateText: { fontSize: fontSizes.xs, color: colors.gray[400], marginTop: 2 },
  amount: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.primary },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.gray[100],
  },
  footerText: { fontSize: fontSizes.xs, color: colors.gray[400] },
});
