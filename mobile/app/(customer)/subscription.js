import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import api from '../../src/lib/api';
import { colors, spacing, fontSizes, radius } from '../../src/lib/theme';

const PLANS = [
  {
    key: 'FREE',
    name: 'Free',
    price: 0,
    period: 'forever',
    badge: null,
    color: '#6b7280',
    bg: '#f9fafb',
    border: '#e5e7eb',
    features: [
      '2 bookings per month',
      'Basic caregiver search',
      'Email support',
    ],
    missing: ['Priority caregiver matching', 'Unlimited bookings', 'Family dashboard', 'Emergency SOS priority'],
  },
  {
    key: 'FAMILY_BASIC',
    name: 'Family Basic',
    price: 499,
    period: 'month',
    badge: 'Popular',
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#3b82f6',
    features: [
      '10 bookings per month',
      'Priority caregiver matching',
      'Family dashboard (2 elders)',
      'In-app messaging',
      'Phone & email support',
    ],
    missing: ['Unlimited bookings', 'Emergency SOS priority'],
  },
  {
    key: 'FAMILY_PREMIUM',
    name: 'Family Premium',
    price: 999,
    period: 'month',
    badge: 'Best Value',
    color: '#15803d',
    bg: '#f0fdf4',
    border: '#22c55e',
    features: [
      'Unlimited bookings',
      'Priority caregiver matching',
      'Family dashboard (5 elders)',
      'Emergency SOS priority',
      'In-app messaging & video calls',
      'Dedicated care coordinator',
      '24/7 support',
    ],
    missing: [],
  },
  {
    key: 'ENTERPRISE',
    name: 'Enterprise',
    price: 2999,
    period: 'month',
    badge: null,
    color: '#7c3aed',
    bg: '#faf5ff',
    border: '#8b5cf6',
    features: [
      'Everything in Premium',
      'Unlimited elders',
      'Custom caregiver training',
      'Dedicated account manager',
      'API access',
      'Custom reporting',
      'SLA guarantee',
    ],
    missing: [],
  },
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);

  // Use the subscription endpoint — returns { plan, subscription, expiresAt }
  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get('/payments/subscription').then(r => r.data),
  });

  const currentPlan = subData?.plan ?? 'FREE';
  const expiresAt = subData?.expiresAt;

  // Pre-select the current plan once data loads (bug E1 fix)
  useEffect(() => {
    if (currentPlan && selected === null) {
      setSelected(currentPlan);
    }
  }, [currentPlan]);

  const subscribeMutation = useMutation({
    mutationFn: (plan) => {
      // FREE downgrade → cancel endpoint, not subscribe (bug 3 fix)
      if (plan === 'FREE') {
        return api.post('/payments/subscription/cancel').then(r => r.data);
      }
      return api.post('/payments/subscribe', { plan }).then(r => r.data);
    },
    onSuccess: () => {
      // Invalidate all related caches so hero badge & profile update immediately (bug 4 fix)
      qc.invalidateQueries({ queryKey: ['subscription'] });
      qc.invalidateQueries({ queryKey: ['customer-home'] });
      qc.invalidateQueries({ queryKey: ['customer-profile'] });
      const planName = PLANS.find(p => p.key === selected)?.name ?? selected;
      Alert.alert(
        selected === 'FREE' ? 'Downgraded to Free' : 'Subscription Active!',
        selected === 'FREE'
          ? 'Your subscription has been cancelled. You are now on the Free plan.'
          : `You are now on the ${planName} plan.`,
        [{ text: 'Done', onPress: () => router.back() }],
      );
    },
    onError: (e) => {
      Alert.alert('Error', e.response?.data?.message ?? e.response?.data?.error ?? 'Failed to update subscription. Please try again.');
    },
  });

  const handleSubscribe = () => {
    if (!selected) {
      Alert.alert('Select a Plan', 'Please choose a subscription plan first.');
      return;
    }
    if (selected === currentPlan) {
      Alert.alert('Already on this plan', `You are already on the ${PLANS.find(p => p.key === selected)?.name} plan.`);
      return;
    }
    const plan = PLANS.find(p => p.key === selected);
    Alert.alert(
      selected === 'FREE' ? 'Downgrade to Free?' : `Subscribe to ${plan?.name}?`,
      selected === 'FREE'
        ? 'Your subscription will be cancelled and you will lose premium features at the end of the billing period.'
        : `You will be charged ₹${plan?.price}/month.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => subscribeMutation.mutate(selected) },
      ],
    );
  };

  if (subLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Choose Your Plan</Text>
          <View style={{ width: 60 }} />
        </View>
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Your Plan</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>✨</Text>
          <Text style={styles.heroTitle}>Upgrade Your Care</Text>
          <Text style={styles.heroSub}>
            Get priority access to top caregivers, unlimited bookings, and dedicated support for your loved ones.
          </Text>
          {/* Show current plan + expiry (bug E2 fix) */}
          <View style={styles.currentPlanRow}>
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>
                Current: {PLANS.find(p => p.key === currentPlan)?.name ?? currentPlan}
              </Text>
            </View>
            {expiresAt && currentPlan !== 'FREE' && (
              <Text style={styles.expiryText}>
                Renews {format(new Date(expiresAt), 'd MMM yyyy')}
              </Text>
            )}
          </View>
        </View>

        {/* Plan cards */}
        {PLANS.map(plan => {
          const isCurrentPlan = plan.key === currentPlan;
          const isSelected = selected === plan.key;
          return (
            <TouchableOpacity
              key={plan.key}
              style={[
                styles.planCard,
                { borderColor: isSelected ? plan.color : plan.border, backgroundColor: plan.bg },
                isSelected && styles.planCardSelected,
              ]}
              onPress={() => setSelected(plan.key)}
              activeOpacity={0.85}
            >
              {/* Top row */}
              <View style={styles.planTop}>
                <View style={{ flex: 1 }}>
                  <View style={styles.planNameRow}>
                    <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
                    {plan.badge && (
                      <View style={[styles.badge, { backgroundColor: plan.color }]}>
                        <Text style={styles.badgeText}>{plan.badge}</Text>
                      </View>
                    )}
                    {isCurrentPlan && (
                      <View style={[styles.badge, { backgroundColor: '#6b7280' }]}>
                        <Text style={styles.badgeText}>Current</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceSymbol, { color: plan.color }]}>₹</Text>
                    <Text style={[styles.price, { color: plan.color }]}>{plan.price}</Text>
                    <Text style={styles.pricePeriod}>/{plan.period}</Text>
                  </View>
                </View>
                <View style={[styles.radioOuter, { borderColor: isSelected ? plan.color : '#d1d5db' }]}>
                  {isSelected && <View style={[styles.radioInner, { backgroundColor: plan.color }]} />}
                </View>
              </View>

              {/* Features */}
              <View style={styles.featureList}>
                {plan.features.map(f => (
                  <View key={f} style={styles.featureRow}>
                    <Text style={[styles.featureCheck, { color: plan.color }]}>✓</Text>
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
                {plan.missing.map(f => (
                  <View key={f} style={styles.featureRow}>
                    <Text style={styles.featureMissCheck}>✗</Text>
                    <Text style={styles.featureMissText}>{f}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.cta}>
        <TouchableOpacity
          style={[
            styles.ctaBtn,
            {
              backgroundColor: selected && selected !== currentPlan
                ? PLANS.find(p => p.key === selected)?.color ?? colors.primary
                : colors.gray[300],
            },
          ]}
          onPress={handleSubscribe}
          disabled={!selected || subscribeMutation.isPending}
        >
          {subscribeMutation.isPending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.ctaBtnText}>
              {!selected
                ? 'Select a Plan to Continue'
                : selected === currentPlan
                  ? `Already on ${PLANS.find(p => p.key === selected)?.name}`
                  : selected === 'FREE'
                    ? 'Downgrade to Free'
                    : `Subscribe to ${PLANS.find(p => p.key === selected)?.name} — ₹${PLANS.find(p => p.key === selected)?.price}/mo`}
            </Text>
          )}
        </TouchableOpacity>
        <Text style={styles.ctaNote}>Cancel anytime. Billed monthly.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  backBtn: { width: 60 },
  backText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600' },
  headerTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.gray[900] },

  scroll: { padding: spacing.md },

  hero: { alignItems: 'center', paddingVertical: spacing.xl, paddingBottom: spacing.lg },
  heroEmoji: { fontSize: 40, marginBottom: 8 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: colors.gray[900], textAlign: 'center' },
  heroSub: {
    fontSize: fontSizes.sm, color: colors.gray[500], textAlign: 'center',
    lineHeight: 22, marginTop: 8, paddingHorizontal: spacing.md,
  },
  currentPlanRow: { alignItems: 'center', marginTop: 14, gap: 6 },
  currentBadge: {
    backgroundColor: colors.primaryLight, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 5,
  },
  currentBadgeText: { fontSize: fontSizes.xs, fontWeight: '700', color: colors.primaryDark },
  expiryText: { fontSize: fontSizes.xs, color: colors.gray[400] },

  planCard: {
    borderWidth: 2, borderRadius: 16, padding: spacing.md,
    marginBottom: spacing.md,
  },
  planCardSelected: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  planTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  planName: { fontSize: fontSizes.lg, fontWeight: '800' },
  badge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.white },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  priceSymbol: { fontSize: fontSizes.md, fontWeight: '700', marginBottom: 2 },
  price: { fontSize: 32, fontWeight: '900', lineHeight: 36 },
  pricePeriod: { fontSize: fontSizes.sm, color: colors.gray[400], marginBottom: 4 },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  radioInner: { width: 12, height: 12, borderRadius: 6 },

  featureList: { gap: 6 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureCheck: { fontSize: fontSizes.sm, fontWeight: '800', width: 16 },
  featureText: { fontSize: fontSizes.sm, color: colors.gray[700], flex: 1 },
  featureMissCheck: { fontSize: fontSizes.sm, color: colors.gray[300], width: 16 },
  featureMissText: { fontSize: fontSizes.sm, color: colors.gray[400], flex: 1 },

  cta: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1, borderTopColor: colors.gray[100],
    padding: spacing.md, paddingBottom: 28,
  },
  ctaBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaBtnText: { fontSize: fontSizes.md, fontWeight: '700', color: colors.white },
  ctaNote: { textAlign: 'center', fontSize: fontSizes.xs, color: colors.gray[400], marginTop: 6 },
});
