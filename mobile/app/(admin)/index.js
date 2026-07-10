import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../../src/store/authStore';
import { colors, fontSizes, spacing, radius } from '../../src/lib/theme';

export default function AdminMobileScreen() {
  const { user, logout } = useAuthStore();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>🌿</Text>
        <Text style={styles.title}>Admin Panel</Text>
        <Text style={styles.name}>Welcome, {user?.name}</Text>
        <View style={styles.divider} />
        <Text style={styles.message}>
          The ElderCare admin panel is available on the{'\n'}
          <Text style={styles.bold}>web dashboard only.</Text>
        </Text>
        <Text style={styles.sub}>
          Please open the web app in your browser to:{'\n'}
          • Review &amp; approve caregiver verifications{'\n'}
          • Manage bookings and disputes{'\n'}
          • View analytics and reports{'\n'}
          • Configure platform settings
        </Text>
      </View>
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  icon: { fontSize: 56, marginBottom: spacing.sm },
  title: {
    fontSize: fontSizes.xxl,
    fontWeight: '800',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  name: {
    fontSize: fontSizes.sm,
    color: '#94a3b8',
    marginBottom: spacing.md,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#334155',
    marginBottom: spacing.md,
  },
  message: {
    fontSize: fontSizes.md,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  bold: { fontWeight: '700', color: '#38bdf8' },
  sub: {
    fontSize: fontSizes.sm,
    color: '#64748b',
    lineHeight: 22,
    alignSelf: 'flex-start',
  },
  logoutBtn: {
    marginTop: spacing.xl,
    backgroundColor: '#dc2626',
    paddingHorizontal: spacing.xxl,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  logoutText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSizes.md,
  },
});
