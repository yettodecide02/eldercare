import { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Button } from '../../components/ui';
import { colors, spacing, fontSizes, radius } from '../../lib/theme';

export default function ReviewScreen() {
  const { bookingId, caregiverName } = useLocalSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post(`/bookings/${bookingId}/review`, { rating, text: text.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-bookings'] });
      qc.invalidateQueries({ queryKey: ['booking-detail', bookingId] });
      Alert.alert('Review Submitted! ⭐', 'Thank you for your feedback.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    },
    onError: (e) => Alert.alert('Error', e.response?.data?.error || 'Could not submit review'),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Text style={styles.title}>Rate Your Experience</Text>
          <Text style={styles.subtitle}>How was your session with {caregiverName}?</Text>

          {/* Star Rating */}
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map(s => (
              <TouchableOpacity key={s} onPress={() => setRating(s)}>
                <Text style={[styles.star, s <= rating && styles.starActive]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text style={styles.ratingLabel}>
              {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
            </Text>
          )}

          {/* Text Review */}
          <Text style={styles.label}>Write a review (optional)</Text>
          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={5}
            placeholder="Share details about the care quality, punctuality, professionalism…"
            placeholderTextColor={colors.gray[400]}
            value={text}
            onChangeText={setText}
            maxLength={500}
          />
          <Text style={styles.charCount}>{text.length}/500</Text>

          <Button
            title={mutation.isPending ? 'Submitting…' : 'Submit Review'}
            onPress={() => mutation.mutate()}
            disabled={rating === 0 || mutation.isPending}
            loading={mutation.isPending}
            style={{ marginTop: spacing.xl }}
          />
          <Button
            title="Skip for Now"
            variant="secondary"
            onPress={() => router.back()}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  title: { fontSize: fontSizes.xxxl, fontWeight: '800', color: colors.gray[900], textAlign: 'center' },
  subtitle: { fontSize: fontSizes.md, color: colors.gray[500], textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: spacing.sm },
  star: { fontSize: 48, color: colors.gray[200] },
  starActive: { color: '#f59e0b' },
  ratingLabel: { textAlign: 'center', fontSize: fontSizes.md, color: '#f59e0b', fontWeight: '700', marginBottom: spacing.xl },
  label: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.gray[700], marginBottom: 8 },
  textInput: {
    borderWidth: 1.5, borderColor: colors.gray[200], borderRadius: radius.md,
    padding: spacing.md, fontSize: fontSizes.sm, color: colors.gray[900],
    textAlignVertical: 'top', minHeight: 120,
  },
  charCount: { fontSize: fontSizes.xs, color: colors.gray[400], textAlign: 'right', marginTop: 4 },
});
