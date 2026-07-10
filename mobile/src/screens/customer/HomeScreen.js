import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, fontSizes, radius } from '../../lib/theme';

const { width } = Dimensions.get('window');

const STATUS_CONFIG = {
  PENDING:   { color: '#b45309', bg: '#fef3c7', dot: '#f59e0b', label: 'Pending' },
  CONFIRMED: { color: '#1d4ed8', bg: '#dbeafe', dot: '#3b82f6', label: 'Confirmed' },
  ACTIVE:    { color: '#15803d', bg: '#dcfce7', dot: '#22c55e', label: 'Live' },
  COMPLETED: { color: '#4b5563', bg: '#f3f4f6', dot: '#9ca3af', label: 'Completed' },
  CANCELLED: { color: '#dc2626', bg: '#fee2e2', dot: '#ef4444', label: 'Cancelled' },
};

const SERVICE_EMOJI = {
  PERSONAL_CARE: '🛁', MEDICATION_MANAGEMENT: '💊',
  COMPANIONSHIP: '🤝', MOBILITY_ASSISTANCE: '🦯',
  MEAL_PREPARATION: '🍱', HOUSEKEEPING: '🏠',
  TRANSPORTATION: '🚗', MEDICAL_MONITORING: '🩺',
};

const CARE_TIPS = [
  'Social interaction improves an elder\'s mental wellbeing significantly.',
  'Remind elders to drink water every 2 hours — hydration is vital.',
  'Gentle morning stretches reduce stiffness and improve mobility.',
  'Check medications weekly to ensure consistent, on-time intake.',
  'A consistent daily routine helps elders with cognitive conditions.',
  'Indoor plants and natural light can boost mood and reduce anxiety.',
  'Regular gentle walks improve both physical and mental health.',
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good morning', icon: '🌅' };
  if (h < 17) return { text: 'Good afternoon', icon: '☀️' };
  return { text: 'Good evening', icon: '🌙' };
}

export default function CustomerHomeScreen() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);

  const { data: notifData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => api.get('/notifications?unreadOnly=true&limit=1').then(r => r.data),
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });
  const unreadNotifs = notifData?.unreadCount ?? 0;

  const { data: medsData } = useQuery({
    queryKey: ['medication-reminders'],
    queryFn: () => api.get('/customer/medications').then(r => r.data),
    staleTime: 2 * 60 * 1000,
  });

  const { data: aiData } = useQuery({
    queryKey: ['ai-recommendations'],
    queryFn: () => api.get('/customer/ai-recommendations').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const activeMeds = (medsData ?? []).filter(m => m.isActive);
  const topInsight = (aiData?.recommendations ?? []).find(r => r.priority === 'HIGH') ?? (aiData?.recommendations ?? [])[0];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customer-home'],
    queryFn: async () => {
      const [bookingsRes, subRes] = await Promise.all([
        api.get('/bookings/customer', { params: { limit: 10 } }),
        api.get('/payments/subscription'),
      ]);
      return {
        bookings: bookingsRes.data.bookings ?? [],
        subscription: subRes.data,
      };
    },
  });

  const allBookings = data?.bookings ?? [];
  const upcoming = allBookings.filter(b => ['PENDING', 'CONFIRMED', 'ACTIVE'].includes(b.status));
  const activeSession = allBookings.find(b => b.status === 'ACTIVE');
  const completedCount = allBookings.filter(b => b.status === 'COMPLETED').length;
  const { text: greeting, icon: greetIcon } = getGreeting();
  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const tip = CARE_TIPS[new Date().getDay() % CARE_TIPS.length];
  const isPaidPlan = data?.subscription?.plan && data.subscription.plan !== 'FREE';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.white} />
      }
    >
      {/* Error banner */}
      {isError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>Could not load data. Check your connection.</Text>
          <TouchableOpacity onPress={refetch} style={styles.errorRetryBtn}>
            <Text style={styles.errorRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <View style={styles.hero}>
        {/* Top bar */}
        <View style={styles.heroBar}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>{firstName[0]?.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.greetSmall}>{greeting} {greetIcon}</Text>
            <Text style={styles.greetName}>{firstName}</Text>
          </View>
          {isPaidPlan ? (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>⭐ PRO</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.upgradePill} onPress={() => router.push('/(customer)/subscription')}>
              <Text style={styles.upgradePillText}>Upgrade</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => router.push('/(customer)/notifications')}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadNotifs > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Tagline */}
        <Text style={styles.heroTagline}>
          Trusted care for your{'\n'}loved ones, every day.
        </Text>

        {/* Search bar */}
        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={0.85}
          onPress={() => router.push('/(customer)/search')}
        >
          <Text style={styles.searchBarIcon}>🔍</Text>
          <Text style={styles.searchBarText}>Find a caregiver near you…</Text>
          <View style={styles.searchBarBtn}>
            <Text style={styles.searchBarBtnText}>Search</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Hero wave */}
      <View style={styles.heroWave} />

      {/* ══════════════════════════════════════════
          ACTIVE SESSION BANNER
      ══════════════════════════════════════════ */}
      {activeSession && (
        <View style={styles.px}>
          <TouchableOpacity
            style={styles.sessionBanner}
            onPress={() => router.push(`/(customer)/booking/${activeSession.id}`)}
            activeOpacity={0.9}
          >
            <View style={styles.sessionPulse}>
              <View style={styles.sessionPulseInner} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.sessionBannerTitle}>Session in Progress</Text>
              <Text style={styles.sessionBannerSub}>
                {activeSession.caregiver?.user?.name ?? 'Caregiver'} ·{' '}
                {activeSession.serviceType?.replace(/_/g, ' ')}
              </Text>
            </View>
            <View style={styles.sessionBannerArrow}>
              <Text style={styles.sessionBannerArrowText}>Track →</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* ══════════════════════════════════════════
          STATS ROW
      ══════════════════════════════════════════ */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statsRow}
      >
        {[
          { icon: '📅', val: upcoming.length, label: 'Upcoming', path: '/(customer)/bookings', bg: '#dbeafe', fg: '#1d4ed8' },
          { icon: '✅', val: completedCount, label: 'Completed', path: '/(customer)/bookings', bg: '#dcfce7', fg: '#15803d' },
          { icon: '❤️', val: '', label: 'Saved', path: '/(customer)/favorites', bg: '#fee2e2', fg: '#dc2626' },
          { icon: '👴', val: '', label: 'Elders', path: '/(customer)/profile', bg: '#f3e8ff', fg: '#7c3aed' },
          { icon: '💳', val: '', label: 'Plans', path: '/(customer)/subscription', bg: '#fef3c7', fg: '#b45309' },
        ].map((s, i) => (
          <TouchableOpacity key={i} style={[styles.statCard, { backgroundColor: s.bg }]} onPress={() => router.push(s.path)}>
            <Text style={styles.statCardIcon}>{s.icon}</Text>
            {s.val !== '' && <Text style={[styles.statCardVal, { color: s.fg }]}>{s.val}</Text>}
            <Text style={[styles.statCardLabel, { color: s.fg }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ══════════════════════════════════════════
          QUICK ACTIONS
      ══════════════════════════════════════════ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {[
            { icon: '🔍', label: 'Find Caregiver', desc: 'Browse & book verified caregivers', path: '/(customer)/search', primary: true },
            { icon: '📋', label: 'My Bookings', desc: 'View & manage bookings', path: '/(customer)/bookings' },
            { icon: '💊', label: 'Medications', desc: `${activeMeds.length} active reminder${activeMeds.length !== 1 ? 's' : ''}`, path: '/(customer)/medications' },
            { icon: '🤖', label: 'AI Insights', desc: 'Personalised care tips', path: '/(customer)/ai-care' },
            { icon: '❤️', label: 'Saved', desc: 'Your favourite caregivers', path: '/(customer)/favorites' },
            { icon: '👴', label: 'Elder Profiles', desc: 'Manage care recipients', path: '/(customer)/profile' },
          ].map((a, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.actionCard, a.primary && styles.actionCardPrimary]}
              onPress={() => router.push(a.path)}
              activeOpacity={0.85}
            >
              <Text style={styles.actionCardIcon}>{a.icon}</Text>
              <Text style={[styles.actionCardLabel, a.primary && styles.actionCardLabelPrimary]}>{a.label}</Text>
              <Text style={[styles.actionCardDesc, a.primary && styles.actionCardDescPrimary]}>{a.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ══════════════════════════════════════════
          MEDICATION REMINDER PREVIEW
      ══════════════════════════════════════════ */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>💊 Medication Reminders</Text>
          <TouchableOpacity onPress={() => router.push('/(customer)/medications')}>
            <Text style={styles.sectionLink}>Manage →</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.medPreviewCard}
          onPress={() => router.push('/(customer)/medications')}
          activeOpacity={0.85}
        >
          {activeMeds.length === 0 ? (
            <View style={styles.medPreviewEmpty}>
              <Text style={styles.medPreviewEmptyIcon}>💊</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.medPreviewEmptyTitle}>No Reminders Set</Text>
                <Text style={styles.medPreviewEmptyText}>Add medication schedules for your elders and never miss a dose.</Text>
              </View>
              <Text style={styles.medPreviewArrow}>→</Text>
            </View>
          ) : (
            <View style={styles.medPreviewContent}>
              <View style={styles.medPreviewStat}>
                <Text style={styles.medPreviewStatVal}>{activeMeds.length}</Text>
                <Text style={styles.medPreviewStatLabel}>Active</Text>
              </View>
              <View style={styles.medPreviewDiv} />
              <View style={{ flex: 1, gap: 4 }}>
                {activeMeds.slice(0, 2).map(m => (
                  <View key={m.id} style={styles.medPreviewRow}>
                    <Text style={styles.medPreviewName}>{m.name}</Text>
                    {m.times.length > 0 && (
                      <View style={styles.medPreviewTime}>
                        <Text style={styles.medPreviewTimeText}>{m.times[0]}</Text>
                      </View>
                    )}
                  </View>
                ))}
                {activeMeds.length > 2 && (
                  <Text style={styles.medPreviewMore}>+{activeMeds.length - 2} more</Text>
                )}
              </View>
              <Text style={styles.medPreviewArrow}>→</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ══════════════════════════════════════════
          AI CARE INSIGHT PREVIEW
      ══════════════════════════════════════════ */}
      {topInsight && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🤖 AI Care Insight</Text>
            <TouchableOpacity onPress={() => router.push('/(customer)/ai-care')}>
              <Text style={styles.sectionLink}>See all →</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.aiPreviewCard, topInsight.priority === 'HIGH' && styles.aiPreviewCardHigh]}
            onPress={() => router.push('/(customer)/ai-care')}
            activeOpacity={0.85}
          >
            <Text style={styles.aiPreviewIcon}>{topInsight.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiPreviewTitle}>{topInsight.title}</Text>
              <Text style={styles.aiPreviewDesc} numberOfLines={2}>{topInsight.description}</Text>
            </View>
            <Text style={styles.aiPreviewArrow}>→</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ══════════════════════════════════════════
          UPCOMING BOOKINGS
      ══════════════════════════════════════════ */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
          <TouchableOpacity onPress={() => router.push('/(customer)/bookings')}>
            <Text style={styles.sectionLink}>View all →</Text>
          </TouchableOpacity>
        </View>

        {upcoming.length === 0 ? (
          <TouchableOpacity style={styles.emptyCard} onPress={() => router.push('/(customer)/search')} activeOpacity={0.85}>
            <Text style={styles.emptyCardEmoji}>🌿</Text>
            <Text style={styles.emptyCardTitle}>No upcoming bookings</Text>
            <Text style={styles.emptyCardText}>Book a caregiver for your loved one today and give them the care they deserve.</Text>
            <View style={styles.emptyCardBtn}>
              <Text style={styles.emptyCardBtnText}>Find a Caregiver →</Text>
            </View>
          </TouchableOpacity>
        ) : (
          upcoming.slice(0, 4).map(b => {
            const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.PENDING;
            const cgName = b.caregiver?.user?.name ?? b.caregiver?.name ?? 'Caregiver';
            const isActive = b.status === 'ACTIVE';
            return (
              <TouchableOpacity
                key={b.id}
                style={[styles.bookingCard, isActive && styles.bookingCardActive]}
                onPress={() => router.push(`/(customer)/booking/${b.id}`)}
                activeOpacity={0.88}
              >
                {isActive && <View style={styles.bookingActiveBar} />}

                {/* Top row */}
                <View style={styles.bookingTop}>
                  <View style={[styles.cgAvatar, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.cgAvatarText, { color: cfg.color }]}>
                      {cgName[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.cgName}>{cgName}</Text>
                    <View style={styles.serviceRow}>
                      <Text>{SERVICE_EMOJI[b.serviceType] ?? '🩺'}</Text>
                      <Text style={styles.serviceLabel}>{b.serviceType?.replace(/_/g, ' ') ?? '—'}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: cfg.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: cfg.dot }]} />
                    <Text style={[styles.statusChipText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>

                {/* Meta row */}
                <View style={styles.bookingMeta}>
                  <Text style={styles.metaText}>
                    📅 {b.scheduledAt ? format(new Date(b.scheduledAt), 'EEE, dd MMM · HH:mm') : '—'}
                  </Text>
                  <Text style={styles.metaSep}>·</Text>
                  <Text style={styles.metaText}>⏱ {b.durationHours}h</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={styles.metaAmount}>₹{b.totalAmount}</Text>
                </View>

                {/* Active CTA */}
                {isActive && (
                  <View style={styles.trackRow}>
                    <View style={styles.liveIndicator}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>LIVE</Text>
                    </View>
                    <Text style={styles.trackCTA}>Tap to track live location & SOS</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* ══════════════════════════════════════════
          CARE TIP
      ══════════════════════════════════════════ */}
      <View style={styles.section}>
        <View style={styles.tipCard}>
          <View style={styles.tipHeader}>
            <Text style={styles.tipIcon}>💡</Text>
            <Text style={styles.tipTitle}>Daily Care Tip</Text>
          </View>
          <Text style={styles.tipText}>{tip}</Text>
        </View>
      </View>

      {/* ══════════════════════════════════════════
          HELP BANNER
      ══════════════════════════════════════════ */}
      <View style={styles.px}>
        <TouchableOpacity style={styles.helpBanner} onPress={() => router.push('/(customer)/search')}>
          <View style={{ flex: 1 }}>
            <Text style={styles.helpBannerTitle}>Need help finding care?</Text>
            <Text style={styles.helpBannerText}>Browse 100+ verified caregivers in your city</Text>
          </View>
          <View style={styles.helpBannerBtn}>
            <Text style={styles.helpBannerBtnText}>Browse →</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  px: { paddingHorizontal: spacing.md },

  // ── Error Banner ─────────────────────────────────────────────
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

  // ── Hero ────────────────────────────────────────────────────
  hero: {
    backgroundColor: colors.primary,
    paddingTop: spacing.lg,
    paddingBottom: 40,
    paddingHorizontal: spacing.lg,
  },
  heroBar: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  heroAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  heroAvatarText: { fontSize: 20, fontWeight: '800', color: colors.white },
  greetSmall: { fontSize: fontSizes.xs, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  greetName: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.white, marginTop: 1 },
  premiumBadge: {
    backgroundColor: '#fbbf24', borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  premiumBadgeText: { fontSize: 11, fontWeight: '800', color: '#78350f' },
  upgradePill: {
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5,
  },
  upgradePillText: { fontSize: fontSizes.xs, color: colors.white, fontWeight: '600' },
  bellBtn: { position: 'relative', width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  bellIcon: { fontSize: 20 },
  bellBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#ef4444', borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  bellBadgeText: { fontSize: 9, fontWeight: '800', color: colors.white },
  heroTagline: {
    fontSize: fontSizes.xxl, fontWeight: '800', color: colors.white,
    lineHeight: 34, marginBottom: spacing.lg,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, borderRadius: radius.xl,
    paddingLeft: 14, paddingRight: 6, paddingVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  searchBarIcon: { fontSize: 16, marginRight: 8 },
  searchBarText: { flex: 1, fontSize: fontSizes.sm, color: colors.gray[400], fontWeight: '500' },
  searchBarBtn: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  searchBarBtnText: { color: colors.white, fontSize: fontSizes.xs, fontWeight: '700' },

  // Hero wave overlap
  heroWave: {
    height: 24, backgroundColor: colors.primary,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    marginBottom: spacing.sm,
  },

  // ── Active Session Banner ────────────────────────────────────
  sessionBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#052e16', borderRadius: radius.xl,
    padding: spacing.md, marginBottom: spacing.md,
    shadowColor: '#16a34a', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
  },
  sessionPulse: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  sessionPulseInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e' },
  sessionBannerTitle: { fontSize: fontSizes.sm, fontWeight: '800', color: '#86efac' },
  sessionBannerSub: { fontSize: fontSizes.xs, color: 'rgba(134,239,172,0.7)', marginTop: 2 },
  sessionBannerArrow: {
    backgroundColor: '#16a34a', borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  sessionBannerArrowText: { color: colors.white, fontSize: fontSizes.xs, fontWeight: '700' },

  // ── Stats Row ────────────────────────────────────────────────
  statsRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 10, flexDirection: 'row', alignItems: 'center' },
  statCard: {
    borderRadius: radius.xl, paddingHorizontal: 18, paddingVertical: 14,
    alignItems: 'center', minWidth: 76,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  statCardIcon: { fontSize: 22, marginBottom: 4 },
  statCardVal: { fontSize: fontSizes.lg, fontWeight: '800', marginBottom: 2 },
  statCardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  // ── Quick Actions ────────────────────────────────────────────
  section: { paddingHorizontal: spacing.md, marginTop: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { fontSize: fontSizes.md, fontWeight: '800', color: colors.gray[900], marginBottom: spacing.sm },
  sectionLink: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: {
    width: (width - spacing.md * 2 - 10) / 2,
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.md, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: colors.gray[100],
  },
  actionCardPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary, shadowOpacity: 0.3,
  },
  actionCardIcon: { fontSize: 28, marginBottom: 4 },
  actionCardLabel: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.gray[900] },
  actionCardLabelPrimary: { color: colors.white },
  actionCardDesc: { fontSize: 11, color: colors.gray[500], lineHeight: 15 },
  actionCardDescPrimary: { color: 'rgba(255,255,255,0.75)' },

  // ── Booking Cards ────────────────────────────────────────────
  bookingCard: {
    backgroundColor: colors.white, borderRadius: radius.xl, marginBottom: spacing.sm,
    padding: spacing.md, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: colors.gray[100],
  },
  bookingCardActive: {
    borderColor: '#86efac', borderWidth: 1.5,
    shadowColor: '#16a34a', shadowOpacity: 0.15,
  },
  bookingActiveBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 4,
    backgroundColor: '#22c55e', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
  },
  bookingTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  cgAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  cgAvatarText: { fontSize: 18, fontWeight: '800' },
  cgName: { fontSize: fontSizes.md, fontWeight: '700', color: colors.gray[900] },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  serviceLabel: { fontSize: fontSizes.xs, color: colors.gray[500], fontWeight: '500' },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  bookingMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.gray[50], borderRadius: radius.md,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  metaText: { fontSize: 11, color: colors.gray[600], fontWeight: '500' },
  metaSep: { color: colors.gray[300], fontSize: 12 },
  metaAmount: { fontSize: fontSizes.sm, fontWeight: '800', color: colors.primary },
  trackRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm,
  },
  liveIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#dcfce7', borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  liveText: { fontSize: 10, fontWeight: '800', color: '#15803d', letterSpacing: 1 },
  trackCTA: { fontSize: 11, color: colors.gray[500], flex: 1 },

  // ── Empty State ─────────────────────────────────────────────
  emptyCard: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.xl, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    borderWidth: 1, borderColor: colors.gray[100],
    borderStyle: 'dashed',
  },
  emptyCardEmoji: { fontSize: 48, marginBottom: 12 },
  emptyCardTitle: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.gray[800], marginBottom: 6 },
  emptyCardText: { fontSize: fontSizes.sm, color: colors.gray[400], textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyCardBtn: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyCardBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSizes.sm },

  // ── Care Tip ─────────────────────────────────────────────────
  tipCard: {
    backgroundColor: '#f0fdf4', borderRadius: radius.xl,
    padding: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.primary,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  tipIcon: { fontSize: 20 },
  tipTitle: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.primary },
  tipText: { fontSize: fontSizes.sm, color: '#166534', lineHeight: 21 },

  // ── Medication Preview Card ──────────────────────────────────
  medPreviewCard: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.md, borderWidth: 1, borderColor: '#e0f2fe',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  medPreviewEmpty: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  medPreviewEmptyIcon: { fontSize: 28 },
  medPreviewEmptyTitle: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.gray[900] },
  medPreviewEmptyText: { fontSize: 11, color: colors.gray[500], marginTop: 2 },
  medPreviewArrow: { fontSize: fontSizes.md, color: colors.gray[400] },
  medPreviewContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  medPreviewStat: { alignItems: 'center', minWidth: 36 },
  medPreviewStatVal: { fontSize: fontSizes.xxl, fontWeight: '800', color: colors.primary },
  medPreviewStatLabel: { fontSize: 10, color: colors.gray[400], fontWeight: '600' },
  medPreviewDiv: { width: 1, height: 40, backgroundColor: colors.gray[100] },
  medPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  medPreviewName: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.gray[900], flex: 1 },
  medPreviewTime: { backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  medPreviewTimeText: { fontSize: 10, color: colors.primary, fontWeight: '700' },
  medPreviewMore: { fontSize: 10, color: colors.gray[400] },

  // ── AI Preview Card ──────────────────────────────────────────
  aiPreviewCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#f0f9ff', borderRadius: radius.xl,
    padding: spacing.md, borderWidth: 1, borderColor: '#bae6fd',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  aiPreviewCardHigh: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  aiPreviewIcon: { fontSize: 28 },
  aiPreviewTitle: { fontSize: fontSizes.sm, fontWeight: '800', color: colors.gray[900] },
  aiPreviewDesc: { fontSize: 11, color: colors.gray[600], marginTop: 2, lineHeight: 16 },
  aiPreviewArrow: { fontSize: fontSizes.md, color: colors.gray[400] },

  // ── Help Banner ──────────────────────────────────────────────
  helpBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.gray[900], borderRadius: radius.xl,
    padding: spacing.md, marginTop: spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 5,
  },
  helpBannerTitle: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.white },
  helpBannerText: { fontSize: fontSizes.xs, color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  helpBannerBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  helpBannerBtnText: { color: colors.white, fontSize: fontSizes.xs, fontWeight: '700' },
});
