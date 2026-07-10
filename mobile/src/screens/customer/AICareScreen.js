import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { colors, spacing, fontSizes, radius } from '../../lib/theme';

const PRIORITY_STYLE = {
  HIGH: { bg: '#fef2f2', border: '#fecaca', badge: '#dc2626', badgeText: '#fff', label: 'High Priority' },
  MEDIUM: { bg: '#fffbeb', border: '#fde68a', badge: '#f59e0b', badgeText: '#fff', label: 'Suggested' },
  LOW: { bg: '#f0fdf4', border: '#bbf7d0', badge: '#16a34a', badgeText: '#fff', label: 'Tip' },
};

const TYPE_LABEL = {
  SERVICE_SUGGESTION: 'Service',
  SCHEDULING: 'Scheduling',
  WELLNESS: 'Wellness',
  SETUP: 'Setup Required',
  DAILY_TIP: "Today's Tip",
};

function RecommendationCard({ rec, onAction }) {
  const p = PRIORITY_STYLE[rec.priority] ?? PRIORITY_STYLE.LOW;

  return (
    <View style={[styles.card, { backgroundColor: p.bg, borderColor: p.border }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{rec.icon}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.cardBadgeRow}>
            <View style={[styles.cardBadge, { backgroundColor: p.badge }]}>
              <Text style={[styles.cardBadgeText, { color: p.badgeText }]}>{p.label}</Text>
            </View>
            {rec.type !== 'DAILY_TIP' && (
              <View style={styles.cardTypeBadge}>
                <Text style={styles.cardTypeBadgeText}>{TYPE_LABEL[rec.type] ?? rec.type}</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardTitle}>{rec.title}</Text>
        </View>
      </View>
      <Text style={styles.cardDesc}>{rec.description}</Text>
      {rec.action && (
        <TouchableOpacity style={styles.cardAction} onPress={() => onAction(rec.action)}>
          <Text style={styles.cardActionText}>{rec.action.label} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function MetaCard({ meta }) {
  if (!meta) return null;
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaTitle}>🤖 How Recommendations Work</Text>
      <Text style={styles.metaDesc}>
        These insights are generated from your elder profiles, medical conditions, booking history, and care patterns. They update each time you visit.
      </Text>
      <View style={styles.metaStats}>
        <View style={styles.metaStat}>
          <Text style={styles.metaStatVal}>{meta.elderCount}</Text>
          <Text style={styles.metaStatLabel}>Elder{meta.elderCount !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.metaStatDiv} />
        <View style={styles.metaStat}>
          <Text style={styles.metaStatVal}>{meta.totalBookings}</Text>
          <Text style={styles.metaStatLabel}>Bookings</Text>
        </View>
        <View style={styles.metaStatDiv} />
        <View style={styles.metaStat}>
          <Text style={styles.metaStatVal}>{meta.daysSinceLastBooking ?? '—'}</Text>
          <Text style={styles.metaStatLabel}>Days Since Last</Text>
        </View>
      </View>
      <Text style={styles.metaGenerated}>
        Generated {new Date(meta.generatedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
      </Text>
    </View>
  );
}

export default function AICareScreen() {
  const router = useRouter();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['ai-recommendations'],
    queryFn: () => api.get('/customer/ai-recommendations').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const recommendations = data?.recommendations ?? [];
  const meta = data?.meta;

  const handleAction = (action) => {
    if (action?.screen) router.push(action.screen);
  };

  const high = recommendations.filter(r => r.priority === 'HIGH');
  const medium = recommendations.filter(r => r.priority === 'MEDIUM');
  const low = recommendations.filter(r => r.priority === 'LOW');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Care Insights</Text>
        <View style={{ width: 60 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Analysing care data…</Text>
        </View>
      ) : isError ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>Could not load recommendations.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Personalised Care Recommendations</Text>
              <Text style={styles.heroSub}>
                {recommendations.length} insight{recommendations.length !== 1 ? 's' : ''} based on your care profile
              </Text>
            </View>
          </View>

          {high.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⚡ Immediate Attention</Text>
              {high.map(r => <RecommendationCard key={r.id} rec={r} onAction={handleAction} />)}
            </View>
          )}

          {medium.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💡 Suggestions</Text>
              {medium.map(r => <RecommendationCard key={r.id} rec={r} onAction={handleAction} />)}
            </View>
          )}

          {low.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🌿 Wellness Tips</Text>
              {low.map(r => <RecommendationCard key={r.id} rec={r} onAction={handleAction} />)}
            </View>
          )}

          {recommendations.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyTitle}>All Clear!</Text>
              <Text style={styles.emptyText}>No recommendations right now. Add elder profiles and book care sessions to get personalised insights.</Text>
            </View>
          )}

          <MetaCard meta={meta} />

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              ⓘ These are general wellness suggestions based on your care data, not medical advice. Always consult a healthcare professional for medical decisions.
            </Text>
          </View>
        </ScrollView>
      )}
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

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: fontSizes.sm, color: colors.gray[500] },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorIcon: { fontSize: 40 },
  errorText: { fontSize: fontSizes.sm, color: colors.gray[600] },
  retryBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { color: colors.white, fontWeight: '700' },

  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },

  hero: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  heroEmoji: { fontSize: 40 },
  heroTitle: { fontSize: fontSizes.md, fontWeight: '800', color: colors.gray[900] },
  heroSub: { fontSize: fontSizes.xs, color: colors.gray[500], marginTop: 3 },

  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.gray[600], textTransform: 'uppercase', letterSpacing: 0.5 },

  card: {
    borderRadius: radius.lg, borderWidth: 1.5, padding: spacing.md, gap: spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardIcon: { fontSize: 28, marginTop: 2 },
  cardBadgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  cardBadge: { borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  cardBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  cardTypeBadge: { borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: colors.gray[100] },
  cardTypeBadgeText: { fontSize: 10, color: colors.gray[600], fontWeight: '600' },
  cardTitle: { fontSize: fontSizes.md, fontWeight: '800', color: colors.gray[900], marginTop: 2 },
  cardDesc: { fontSize: fontSizes.sm, color: colors.gray[700], lineHeight: 21 },
  cardAction: {
    alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.primary,
  },
  cardActionText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '700' },

  empty: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.gray[900] },
  emptyText: { fontSize: fontSizes.sm, color: colors.gray[500], textAlign: 'center', lineHeight: 22 },

  metaCard: {
    backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  metaTitle: { fontSize: fontSizes.sm, fontWeight: '800', color: colors.gray[900] },
  metaDesc: { fontSize: fontSizes.xs, color: colors.gray[500], lineHeight: 18 },
  metaStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: spacing.sm },
  metaStat: { alignItems: 'center', gap: 2 },
  metaStatVal: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.primary },
  metaStatLabel: { fontSize: fontSizes.xs, color: colors.gray[400] },
  metaStatDiv: { width: 1, height: 32, backgroundColor: colors.gray[100] },
  metaGenerated: { fontSize: 10, color: colors.gray[300], textAlign: 'right' },

  disclaimer: {
    backgroundColor: colors.gray[100], borderRadius: radius.md, padding: spacing.md,
  },
  disclaimerText: { fontSize: fontSizes.xs, color: colors.gray[400], lineHeight: 18 },
});
