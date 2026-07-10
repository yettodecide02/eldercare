import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, fontSizes, radius } from '../../lib/theme';

export default function ChatScreen() {
  const { bookingId, bookingNumber } = useLocalSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [text, setText] = useState('');
  const listRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['booking-messages', bookingId],
    queryFn: () => api.get(`/bookings/${bookingId}/messages`).then(r => r.data),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    enabled: !!bookingId,
  });

  const messages = data?.messages ?? [];

  const sendMutation = useMutation({
    mutationFn: (msg) => api.post(`/bookings/${bookingId}/messages`, { text: msg }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['booking-messages', bookingId] });
      setText('');
    },
  });

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Chat</Text>
          {bookingNumber ? <Text style={styles.headerSub}>Booking #{bookingNumber}</Text> : null}
        </View>
        <View style={{ width: 60 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} size="large" />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={[styles.list, messages.length === 0 && styles.listEmpty]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
            </View>
          }
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: msg }) => {
            const isMe = msg.senderId === user?.id;
            return (
              <View style={[styles.bubbleWrap, isMe ? styles.bubbleWrapMe : styles.bubbleWrapThem]}>
                {!isMe && (
                  <Text style={styles.senderLabel}>{msg.senderName}</Text>
                )}
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                  <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
                    {msg.text}
                  </Text>
                  <View style={styles.bubbleMeta}>
                    <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
                      {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {isMe && <Text style={styles.deliveredTick}>✓</Text>}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Type a message…"
          placeholderTextColor={colors.gray[400]}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sendMutation.isPending) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!text.trim() || sendMutation.isPending}
        >
          <Text style={styles.sendBtnText}>
            {sendMutation.isPending ? '…' : 'Send'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  headerTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.gray[900] },
  headerSub: { fontSize: fontSizes.xs, color: colors.gray[400], marginTop: 2 },
  list: { padding: spacing.md, gap: 8 },
  listEmpty: { flex: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: fontSizes.md, color: colors.gray[400] },
  bubbleWrap: { maxWidth: '80%' },
  bubbleWrapMe: { alignSelf: 'flex-end' },
  bubbleWrapThem: { alignSelf: 'flex-start' },
  senderLabel: {
    fontSize: fontSizes.xs, fontWeight: '700', color: colors.primary,
    marginBottom: 3, marginLeft: 4,
  },
  bubble: {
    borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  bubbleMe: { backgroundColor: colors.primary },
  bubbleThem: { backgroundColor: colors.white },
  bubbleText: { fontSize: fontSizes.sm, color: colors.gray[800], lineHeight: 20 },
  bubbleTextMe: { color: colors.white },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  bubbleTime: { fontSize: 10, color: colors.gray[400] },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.7)' },
  deliveredTick: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '700' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.gray[100],
  },
  input: {
    flex: 1, borderWidth: 1.5, borderColor: colors.gray[200], borderRadius: radius.lg,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: fontSizes.sm,
    color: colors.gray[800], maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingHorizontal: 18, paddingVertical: 10, minWidth: 60, alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.gray[300] },
  sendBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSizes.sm },
});
