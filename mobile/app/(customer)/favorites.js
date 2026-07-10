import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../src/lib/api';
import { Card, Badge } from '../../src/components/ui';
import { colors, spacing, fontSizes, radius } from '../../src/lib/theme';

export default function FavoritesScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ['customer-favorites'],
    queryFn: () => api.get('/customer/favorites').then(r => r.data),
  });

  const removeMutation = useMutation({
    mutationFn: (cgId) => api.post(`/customer/favorites/toggle/${cgId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-favorites'] }),
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Caregivers</Text>
        <View style={{ width: 60 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} size="large" />
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>❤️</Text>
              <Text style={styles.emptyTitle}>No saved caregivers</Text>
              <Text style={styles.emptyText}>
                Tap the heart button on a caregiver's profile to save them here.
              </Text>
              <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/(customer)/search')}>
                <Text style={styles.browseBtnText}>Browse Caregivers →</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item: cg }) => (
            <Card style={styles.cgCard}>
              <View style={styles.cgHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{cg.name?.[0] ?? 'C'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cgName}>{cg.name}</Text>
                  <Text style={styles.cgCity}>📍 {cg.city}</Text>
                  <View style={styles.ratingRow}>
                    <Text style={styles.star}>⭐</Text>
                    <Text style={styles.rating}>{cg.rating ? parseFloat(cg.rating).toFixed(1) : 'New'}</Text>
                    <Text style={styles.reviewCount}>({cg.totalReviews ?? 0})</Text>
                    {cg.isOnline && <Text style={styles.onlineDot}>● Online</Text>}
                  </View>
                </View>
                <View style={styles.rateBox}>
                  <Text style={styles.rate}>₹{parseFloat(cg.hourlyRate).toFixed(0)}</Text>
                  <Text style={styles.rateLabel}>/hr</Text>
                </View>
              </View>

              <View style={styles.services}>
                {(cg.serviceTypes ?? []).slice(0, 3).map(s => (
                  <Badge key={s} label={s.replace(/_/g, ' ')} color="green" />
                ))}
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.viewBtn}
                  onPress={() => router.push(`/(customer)/caregiver/${cg.id}`)}
                >
                  <Text style={styles.viewBtnText}>View & Book →</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeMutation.mutate(cg.id)}
                  disabled={removeMutation.isPending}
                >
                  <Text style={styles.removeBtnText}>♡ Remove</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}
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
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: spacing.xl },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.gray[800], marginBottom: 8 },
  emptyText: { fontSize: fontSizes.sm, color: colors.gray[500], textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  browseBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 28, paddingVertical: 12 },
  browseBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSizes.sm },
  cgCard: { gap: spacing.sm },
  cgHeader: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.primaryDark },
  cgName: { fontSize: fontSizes.md, fontWeight: '700', color: colors.gray[900] },
  cgCity: { fontSize: fontSizes.xs, color: colors.gray[500], marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  star: { fontSize: 12 },
  rating: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.gray[800] },
  reviewCount: { fontSize: fontSizes.xs, color: colors.gray[400] },
  onlineDot: { fontSize: fontSizes.xs, color: '#16a34a', fontWeight: '600', marginLeft: 4 },
  rateBox: { alignItems: 'flex-end' },
  rate: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.primary },
  rateLabel: { fontSize: fontSizes.xs, color: colors.gray[400] },
  services: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  viewBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 10, alignItems: 'center',
  },
  viewBtnText: { color: colors.white, fontSize: fontSizes.sm, fontWeight: '700' },
  removeBtn: {
    borderWidth: 1.5, borderColor: colors.gray[200], borderRadius: radius.md,
    paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center',
  },
  removeBtnText: { color: colors.gray[500], fontSize: fontSizes.sm, fontWeight: '600' },
});
