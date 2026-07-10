import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, FlatList, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, Badge } from '../../components/ui';
import { colors, spacing, fontSizes, radius } from '../../lib/theme';

const SERVICE_TYPES = ['COMPANION', 'MEDICAL', 'HOUSEHOLD', 'NIGHT_CARE', 'SPECIALIZED'];

const RATING_OPTIONS = [
  { label: 'Any', value: '' },
  { label: '4★+', value: '4' },
  { label: '4.5★+', value: '4.5' },
];

const DEFAULT_FILTERS = {
  city: '', serviceType: '', minRate: '', maxRate: '', minRating: '', sortBy: 'rating',
};

export default function SearchScreen() {
  const router = useRouter();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [allCaregivers, setAllCaregivers] = useState([]);

  const hasActiveFilter = !!(filters.city || filters.serviceType || filters.minRate || filters.maxRate || filters.minRating);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['caregiver-search', filters, page],
    queryFn: () => api.get('/caregiver/search', {
      params: {
        ...filters,
        page,
        minRate: filters.minRate || undefined,
        maxRate: filters.maxRate || undefined,
        minRating: filters.minRating || undefined,
      },
    }).then(r => r.data),
  });

  // Accumulate results across pages; reset when filters change
  useEffect(() => {
    if (data?.data) {
      setAllCaregivers(prev => page === 1 ? data.data : [...prev, ...data.data]);
    }
  }, [data?.data, page]);

  const setFilter = (update) => {
    setFilters(f => ({ ...f, ...update }));
    setPage(1);
    setAllCaregivers([]);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
    setAllCaregivers([]);
  };

  const totalCount = data?.pagination?.total ?? 0;
  const currentPages = data?.pagination?.pages ?? 1;
  const hasMore = page < currentPages;

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍  Search city…"
          placeholderTextColor={colors.gray[400]}
          value={filters.city}
          onChangeText={v => setFilter({ city: v })}
        />
      </View>

      {/* Service type chips */}
      <View style={styles.chipsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {['ALL', ...SERVICE_TYPES].map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => setFilter({ serviceType: s === 'ALL' ? '' : s })}
              style={[styles.chip, (filters.serviceType === s || (s === 'ALL' && !filters.serviceType)) && styles.chipActive]}
            >
              <Text style={[styles.chipText, (filters.serviceType === s || (s === 'ALL' && !filters.serviceType)) && styles.chipTextActive]}>
                {s.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Rating + price filters */}
      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Rating:</Text>
        {RATING_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => setFilter({ minRating: opt.value })}
            style={[styles.filterBtn, filters.minRating === opt.value && styles.filterBtnActive]}
          >
            <Text style={[styles.filterBtnText, filters.minRating === opt.value && styles.filterBtnTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        <TextInput
          style={styles.priceInput}
          placeholder="Min ₹"
          placeholderTextColor={colors.gray[400]}
          keyboardType="numeric"
          value={filters.minRate}
          onChangeText={v => setFilter({ minRate: v })}
        />
        <TextInput
          style={styles.priceInput}
          placeholder="Max ₹"
          placeholderTextColor={colors.gray[400]}
          keyboardType="numeric"
          value={filters.maxRate}
          onChangeText={v => setFilter({ maxRate: v })}
        />
      </View>

      {/* Sort + result count + clear */}
      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Sort:</Text>
        {['rating', 'rate_asc', 'rate_desc'].map(s => (
          <TouchableOpacity
            key={s}
            onPress={() => setFilter({ sortBy: s })}
            style={[styles.filterBtn, filters.sortBy === s && styles.filterBtnActive]}
          >
            <Text style={[styles.filterBtnText, filters.sortBy === s && styles.filterBtnTextActive]}>
              {s === 'rating' ? 'Top Rated' : s === 'rate_asc' ? 'Price ↑' : 'Price ↓'}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        {hasActiveFilter && (
          <TouchableOpacity onPress={clearFilters} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕ Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Result count */}
      {!isLoading && (
        <View style={styles.resultCountRow}>
          <Text style={styles.resultCount}>
            {totalCount === 0 ? 'No caregivers found' : `${totalCount} caregiver${totalCount !== 1 ? 's' : ''} found`}
          </Text>
          {isFetching && page === 1 && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />}
        </View>
      )}

      {/* Results */}
      {isLoading && page === 1 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />
      ) : (
        <FlatList
          data={allCaregivers}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 40 }}>🔍</Text>
              <Text style={{ color: colors.gray[500], marginTop: 12, fontSize: fontSizes.md }}>
                No caregivers found
              </Text>
              {hasActiveFilter && (
                <TouchableOpacity onPress={clearFilters} style={[styles.clearBtn, { marginTop: 16 }]}>
                  <Text style={styles.clearBtnText}>✕ Clear filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={
            allCaregivers.length > 0 && hasMore ? (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => setPage(p => p + 1)}
                disabled={isFetching}
              >
                {isFetching ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={styles.loadMoreText}>Load More</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item: cg }) => (
            <TouchableOpacity onPress={() => router.push(`/(customer)/caregiver/${cg.id}`)}>
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
                    </View>
                  </View>
                  <View style={styles.rateBox}>
                    <Text style={styles.rate}>₹{cg.hourlyRate}</Text>
                    <Text style={styles.rateLabel}>/hr</Text>
                  </View>
                </View>

                {cg.bio && (
                  <Text style={styles.bio} numberOfLines={2}>{cg.bio}</Text>
                )}

                <View style={styles.services}>
                  {(cg.serviceTypes ?? []).map(s => (
                    <Badge key={s} label={s.replace(/_/g, ' ')} color="green" />
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.bookBtn}
                  onPress={() => router.push(`/(customer)/caregiver/${cg.id}`)}
                >
                  <Text style={styles.bookBtnText}>View & Book →</Text>
                </TouchableOpacity>
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
  searchBar: { backgroundColor: colors.white, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  searchInput: {
    backgroundColor: colors.gray[50], borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: fontSizes.md,
    color: colors.gray[900],
  },
  chipsWrapper: {
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.gray[100],
    paddingVertical: 10,
  },
  chips: {
    paddingHorizontal: spacing.md, gap: 8,
    flexDirection: 'row', alignItems: 'center',
  },
  chip: {
    borderWidth: 1.5, borderColor: colors.gray[200], borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: colors.white,
    alignSelf: 'center',
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText: { fontSize: fontSizes.xs, fontWeight: '600', color: colors.gray[600] },
  chipTextActive: { color: colors.primaryDark },

  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[50],
  },
  filterLabel: { fontSize: fontSizes.xs, color: colors.gray[500], marginRight: 2 },
  filterBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.gray[100] },
  filterBtnActive: { backgroundColor: colors.gray[800] },
  filterBtnText: { fontSize: fontSizes.xs, color: colors.gray[600], fontWeight: '500' },
  filterBtnTextActive: { color: colors.white },
  priceInput: {
    borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm,
    paddingHorizontal: 8, paddingVertical: 4, fontSize: fontSizes.xs,
    color: colors.gray[800], width: 58,
  },
  clearBtn: {
    backgroundColor: '#fee2e2', borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  clearBtnText: { fontSize: fontSizes.xs, color: '#dc2626', fontWeight: '700' },

  resultCountRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 8,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  resultCount: { fontSize: fontSizes.xs, color: colors.gray[500], fontWeight: '600' },

  loadMoreBtn: {
    alignItems: 'center', paddingVertical: 14,
    marginTop: 4, backgroundColor: colors.white,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gray[200],
  },
  loadMoreText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '700' },

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
  rateBox: { alignItems: 'flex-end' },
  rate: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.primary },
  rateLabel: { fontSize: fontSizes.xs, color: colors.gray[400] },
  bio: { fontSize: fontSizes.xs, color: colors.gray[500], lineHeight: 18 },
  services: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  bookBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 10, alignItems: 'center', marginTop: 4,
  },
  bookBtnText: { color: colors.white, fontSize: fontSizes.sm, fontWeight: '700' },
});
