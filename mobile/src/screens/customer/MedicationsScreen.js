import { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ScrollView, Alert, Switch, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import api from '../../lib/api';
import { colors, spacing, fontSizes, radius } from '../../lib/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const FREQUENCIES = [
  { key: 'DAILY', label: 'Once Daily', times: 1 },
  { key: 'TWICE_DAILY', label: 'Twice Daily', times: 2 },
  { key: 'THREE_TIMES_DAILY', label: 'Three Times Daily', times: 3 },
  { key: 'WEEKLY', label: 'Weekly', times: 1 },
  { key: 'AS_NEEDED', label: 'As Needed', times: 0 },
];

const FREQ_LABEL = Object.fromEntries(FREQUENCIES.map(f => [f.key, f.label]));

const DEFAULT_TIMES_FOR = {
  DAILY: ['08:00'],
  TWICE_DAILY: ['08:00', '20:00'],
  THREE_TIMES_DAILY: ['08:00', '14:00', '20:00'],
  WEEKLY: ['09:00'],
  AS_NEEDED: [],
};

const BLANK = { elderId: '', name: '', dosage: '', frequency: 'DAILY', times: ['08:00'], notes: '' };

function TimeChip({ value, onChange, onRemove, canRemove }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(value);

  const commit = () => {
    setEditing(false);
    if (/^\d{2}:\d{2}$/.test(raw)) onChange(raw);
    else setRaw(value);
  };

  return (
    <View style={styles.timeChip}>
      {editing ? (
        <TextInput
          style={styles.timeChipInput}
          value={raw}
          onChangeText={setRaw}
          onBlur={commit}
          autoFocus
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
      ) : (
        <TouchableOpacity onPress={() => { setRaw(value); setEditing(true); }}>
          <Text style={styles.timeChipText}>🕐 {value}</Text>
        </TouchableOpacity>
      )}
      {canRemove && (
        <TouchableOpacity onPress={onRemove} style={styles.timeChipRemove}>
          <Text style={styles.timeChipRemoveText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ReminderModal({ visible, onClose, elders, initial, onSave, isSaving }) {
  const [form, setForm] = useState(initial ?? BLANK);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const setFreq = (freq) => {
    set('frequency', freq);
    set('times', [...DEFAULT_TIMES_FOR[freq]]);
  };

  const updateTime = (i, val) => {
    const next = [...form.times];
    next[i] = val;
    set('times', next);
  };

  const removeTime = (i) => set('times', form.times.filter((_, idx) => idx !== i));

  const addTime = () => set('times', [...form.times, '12:00']);

  const submit = () => {
    if (!form.elderId) return Alert.alert('Error', 'Please select an elder.');
    if (!form.name.trim()) return Alert.alert('Error', 'Medication name is required.');
    if (form.frequency !== 'AS_NEEDED' && form.times.length === 0)
      return Alert.alert('Error', 'Add at least one reminder time.');
    const invalidTime = form.times.find(t => !/^\d{2}:\d{2}$/.test(t));
    if (invalidTime) return Alert.alert('Error', `"${invalidTime}" is not a valid time (use HH:MM).`);
    onSave(form);
  };

  // Reset form when modal opens with new initial value
  useState(() => { if (visible) setForm(initial ?? BLANK); }, [visible, initial]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{initial ? 'Edit Reminder' : 'Add Reminder'}</Text>
          <TouchableOpacity onPress={submit} disabled={isSaving}>
            <Text style={[styles.modalSave, isSaving && { opacity: 0.4 }]}>
              {isSaving ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalScroll} contentContainerStyle={{ gap: spacing.lg, padding: spacing.md }}>
          {/* Elder */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>For Elder *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: 'row' }}>
              {elders.map(e => (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.elderChip, form.elderId === e.id && styles.elderChipActive]}
                  onPress={() => set('elderId', e.id)}
                >
                  <Text style={[styles.elderChipText, form.elderId === e.id && styles.elderChipTextActive]}>
                    {e.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Name */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Medication Name *</Text>
            <TextInput
              style={styles.formInput}
              value={form.name}
              onChangeText={v => set('name', v)}
              placeholder="e.g. Metformin, Aspirin"
              placeholderTextColor={colors.gray[400]}
              maxLength={100}
            />
          </View>

          {/* Dosage */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Dosage</Text>
            <TextInput
              style={styles.formInput}
              value={form.dosage}
              onChangeText={v => set('dosage', v)}
              placeholder="e.g. 500mg, 1 tablet, 2 drops"
              placeholderTextColor={colors.gray[400]}
              maxLength={100}
            />
          </View>

          {/* Frequency */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Frequency *</Text>
            <View style={styles.freqGrid}>
              {FREQUENCIES.map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.freqChip, form.frequency === f.key && styles.freqChipActive]}
                  onPress={() => setFreq(f.key)}
                >
                  <Text style={[styles.freqChipText, form.frequency === f.key && styles.freqChipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Times */}
          {form.frequency !== 'AS_NEEDED' && (
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Reminder Times (HH:MM)</Text>
              <View style={styles.timesRow}>
                {form.times.map((t, i) => (
                  <TimeChip
                    key={i}
                    value={t}
                    onChange={v => updateTime(i, v)}
                    onRemove={() => removeTime(i)}
                    canRemove={form.times.length > 1}
                  />
                ))}
                <TouchableOpacity style={styles.addTimeBtn} onPress={addTime}>
                  <Text style={styles.addTimeBtnText}>+ Add Time</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Notes */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
              value={form.notes}
              onChangeText={v => set('notes', v)}
              placeholder="e.g. Take with food, avoid grapefruit"
              placeholderTextColor={colors.gray[400]}
              multiline
              maxLength={500}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function MedicationsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['medication-reminders'],
    queryFn: () => api.get('/customer/medications').then(r => r.data),
  });

  const { data: elders = [] } = useQuery({
    queryKey: ['customer-elders'],
    queryFn: () => api.get('/customer/elders').then(r => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['medication-reminders'] });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/customer/medications', data),
    onSuccess: () => { invalidate(); setShowModal(false); scheduleLocalNotifs(); },
    onError: e => Alert.alert('Error', e.response?.data?.error ?? 'Failed to save'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/customer/medications/${id}`, data),
    onSuccess: () => { invalidate(); setShowModal(false); setEditTarget(null); },
    onError: e => Alert.alert('Error', e.response?.data?.error ?? 'Failed to save'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => api.put(`/customer/medications/${id}/toggle`),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/customer/medications/${id}`),
    onSuccess: invalidate,
  });

  const scheduleLocalNotifs = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      // Notifications are handled server-side; local scheduling is just for offline safety
    } catch {}
  };

  const openAdd = () => { setEditTarget(null); setShowModal(true); };
  const openEdit = (r) => {
    setEditTarget({
      id: r.id, elderId: r.elderId,
      name: r.name, dosage: r.dosage ?? '',
      frequency: r.frequency, times: [...r.times],
      notes: r.notes ?? '',
    });
    setShowModal(true);
  };

  const handleSave = (form) => {
    if (editTarget?.id) {
      updateMutation.mutate({ id: editTarget.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const confirmDelete = (r) => {
    Alert.alert('Delete Reminder', `Remove ${r.name} reminder for ${r.elder?.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(r.id) },
    ]);
  };

  // Group by elder
  const grouped = reminders.reduce((acc, r) => {
    const key = r.elderId;
    if (!acc[key]) acc[key] = { elder: r.elder, items: [] };
    acc[key].items.push(r);
    return acc;
  }, {});

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Medication Reminders</Text>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} size="large" />
      ) : reminders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💊</Text>
          <Text style={styles.emptyTitle}>No Reminders Yet</Text>
          <Text style={styles.emptyText}>Add medication reminders for your elders and get notified at the right time every day.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
            <Text style={styles.emptyBtnText}>Add First Reminder</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {elders.length === 0 && (
            <View style={styles.noEldersBanner}>
              <Text style={styles.noEldersText}>⚠️ Add elder profiles first before creating medication reminders.</Text>
            </View>
          )}

          {Object.values(grouped).map(({ elder, items }) => (
            <View key={elder?.id} style={styles.elderGroup}>
              <View style={styles.elderGroupHeader}>
                <Text style={styles.elderGroupAvatar}>👴</Text>
                <Text style={styles.elderGroupName}>{elder?.name}</Text>
                <Text style={styles.elderGroupCount}>{items.length} med{items.length !== 1 ? 's' : ''}</Text>
              </View>

              {items.map(r => (
                <View key={r.id} style={[styles.reminderCard, !r.isActive && styles.reminderCardInactive]}>
                  <View style={styles.reminderTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reminderName}>{r.name}</Text>
                      {r.dosage ? <Text style={styles.reminderDosage}>{r.dosage}</Text> : null}
                    </View>
                    <Switch
                      value={r.isActive}
                      onValueChange={() => toggleMutation.mutate(r.id)}
                      trackColor={{ false: colors.gray[200], true: colors.primaryLight }}
                      thumbColor={r.isActive ? colors.primary : colors.gray[400]}
                    />
                  </View>

                  <View style={styles.reminderMeta}>
                    <Text style={styles.reminderFreq}>📋 {FREQ_LABEL[r.frequency]}</Text>
                    {r.times.length > 0 && (
                      <View style={styles.reminderTimes}>
                        {r.times.map((t, i) => (
                          <View key={i} style={styles.reminderTimeBadge}>
                            <Text style={styles.reminderTimeBadgeText}>🕐 {t}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {r.notes ? <Text style={styles.reminderNotes}>📝 {r.notes}</Text> : null}
                  </View>

                  <View style={styles.reminderActions}>
                    <TouchableOpacity style={styles.reminderEditBtn} onPress={() => openEdit(r)}>
                      <Text style={styles.reminderEditBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.reminderDeleteBtn} onPress={() => confirmDelete(r)}>
                      <Text style={styles.reminderDeleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <ReminderModal
        visible={showModal}
        onClose={() => { setShowModal(false); setEditTarget(null); }}
        elders={elders}
        initial={editTarget}
        onSave={handleSave}
        isSaving={isSaving}
      />
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
  addBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.primary, borderRadius: radius.md },
  addBtnText: { fontSize: fontSizes.sm, color: colors.white, fontWeight: '700' },

  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 12 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.gray[900] },
  emptyText: { fontSize: fontSizes.sm, color: colors.gray[500], textAlign: 'center', lineHeight: 22 },
  emptyBtn: { marginTop: 8, backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSizes.md },

  noEldersBanner: { backgroundColor: '#fef3c7', borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: '#fde68a' },
  noEldersText: { fontSize: fontSizes.sm, color: '#92400e' },

  elderGroup: { gap: spacing.sm },
  elderGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  elderGroupAvatar: { fontSize: 20 },
  elderGroupName: { flex: 1, fontSize: fontSizes.md, fontWeight: '700', color: colors.gray[900] },
  elderGroupCount: { fontSize: fontSizes.xs, color: colors.gray[400] },

  reminderCard: {
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  reminderCardInactive: { opacity: 0.55 },
  reminderTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reminderName: { fontSize: fontSizes.md, fontWeight: '700', color: colors.gray[900] },
  reminderDosage: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600', marginTop: 2 },
  reminderMeta: { gap: 6 },
  reminderFreq: { fontSize: fontSizes.sm, color: colors.gray[600] },
  reminderTimes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reminderTimeBadge: { backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  reminderTimeBadgeText: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: '600' },
  reminderNotes: { fontSize: fontSizes.xs, color: colors.gray[400], fontStyle: 'italic' },
  reminderActions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: colors.gray[100], paddingTop: spacing.sm },
  reminderEditBtn: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  reminderEditBtnText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '700' },
  reminderDeleteBtn: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  reminderDeleteBtnText: { fontSize: fontSizes.sm, color: '#dc2626', fontWeight: '700' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.white },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  modalCancel: { fontSize: fontSizes.md, color: colors.gray[500] },
  modalTitle: { fontSize: fontSizes.md, fontWeight: '700', color: colors.gray[900] },
  modalSave: { fontSize: fontSizes.md, color: colors.primary, fontWeight: '700' },
  modalScroll: { flex: 1 },

  formGroup: { gap: 8 },
  formLabel: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.gray[700] },
  formInput: {
    borderWidth: 1.5, borderColor: colors.gray[200], borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: fontSizes.sm, color: colors.gray[900],
  },

  elderChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.gray[200], backgroundColor: colors.white,
  },
  elderChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  elderChipText: { fontSize: fontSizes.sm, color: colors.gray[700], fontWeight: '600' },
  elderChipTextActive: { color: colors.white },

  freqGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  freqChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.gray[200],
  },
  freqChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  freqChipText: { fontSize: fontSizes.sm, color: colors.gray[700] },
  freqChipTextActive: { color: colors.white, fontWeight: '700' },

  timesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primaryLight, borderRadius: radius.md,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  timeChipInput: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '700', minWidth: 48 },
  timeChipText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '700' },
  timeChipRemove: { paddingLeft: 2 },
  timeChipRemoveText: { fontSize: 11, color: colors.primary },
  addTimeBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed',
  },
  addTimeBtnText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600' },
});
