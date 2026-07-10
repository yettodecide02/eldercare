import {
  View, Text, TouchableOpacity, TextInput,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { colors, radius, spacing, fontSizes, shadows } from '../lib/theme';

// --- Button ---
export function Button({ title, onPress, variant = 'primary', loading, disabled, style }) {
  const bg = {
    primary: colors.primary,
    secondary: colors.gray[100],
    danger: colors.danger,
    outline: 'transparent',
  }[variant];

  const textColor = {
    primary: colors.white,
    secondary: colors.gray[700],
    danger: colors.white,
    outline: colors.primary,
  }[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: bg, borderWidth: variant === 'outline' ? 1.5 : 0, borderColor: colors.primary },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={textColor} size="small" />
        : <Text style={[styles.btnText, { color: textColor }]}>{title}</Text>
      }
    </TouchableOpacity>
  );
}

// --- Input ---
export function Input({ label, error, style, ...props }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={colors.gray[400]}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

// --- Card ---
export function Card({ children, style }) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

// --- Badge ---
export function Badge({ label, color = 'green' }) {
  const colorMap = {
    green: { bg: colors.primaryLight, text: colors.primaryDark },
    red: { bg: '#fee2e2', text: colors.danger },
    yellow: { bg: '#fef3c7', text: colors.warning },
    blue: { bg: colors.elderBluLight, text: colors.elderBlue },
    gray: { bg: colors.gray[100], text: colors.gray[600] },
  };
  const c = colorMap[color] ?? colorMap.gray;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{label}</Text>
    </View>
  );
}

// --- SectionHeader ---
export function SectionHeader({ title, action, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// --- EmptyState ---
export function EmptyState({ icon, title, subtitle }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon ?? '📭'}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: '500',
    color: colors.gray[700],
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSizes.md,
    color: colors.gray[900],
    backgroundColor: colors.white,
  },
  inputError: { borderColor: colors.danger },
  errorText: { fontSize: fontSizes.xs, color: colors.danger, marginTop: 4 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.card,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: fontSizes.xs, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.gray[900] },
  sectionAction: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSizes.lg, fontWeight: '600', color: colors.gray[700] },
  emptySubtitle: { fontSize: fontSizes.sm, color: colors.gray[400], marginTop: 4, textAlign: 'center' },
});
