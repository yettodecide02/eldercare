import { useState } from 'react';
import {
  SafeAreaView, ScrollView, View, Text, TouchableOpacity,
  Modal, TextInput, Alert, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useAuthStore } from '../../src/store/authStore';
import { Button, Input, Card, Badge } from '../../src/components/ui';
import { colors, spacing, fontSizes, radius } from '../../src/lib/theme';
import api from '../../src/lib/api';

const PLAN_COLORS = { FREE: 'gray', FAMILY_BASIC: 'blue', FAMILY_PREMIUM: 'green', ENTERPRISE: 'yellow' };
const PLAN_LABELS = { FREE: 'Free', FAMILY_BASIC: 'Family Basic', FAMILY_PREMIUM: 'Family Premium', ENTERPRISE: 'Enterprise' };

export default function CustomerProfile() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [editingProfile, setEditingProfile] = useState(false);
  const [addingElder, setAddingElder] = useState(false);
  const [editingElder, setEditingElder] = useState(null);
  const [name, setName] = useState(user?.name || '');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [city, setCity] = useState('');
  const [elder, setElder] = useState({ name: '', age: '', relationship: '', medicalConditions: '', medications: '', allergies: '', specialNeeds: '' });
  const [locLoading, setLocLoading] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['customer-profile'],
    queryFn: () => api.get('/customer/profile').then(r => r.data),
  });

  const { data: elders = [] } = useQuery({
    queryKey: ['customer-elders'],
    queryFn: () => api.get('/customer/elders').then(r => r.data),
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get('/payments/subscription').then(r => r.data),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data) => api.put('/customer/profile', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customer-profile'] }); setEditingProfile(false); Alert.alert('Saved', 'Profile updated successfully'); },
    onError: (e) => Alert.alert('Error', e.response?.data?.error || 'Update failed'),
  });

  const locationMutation = useMutation({
    mutationFn: (data) => api.put('/customer/location', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customer-profile'] }); Alert.alert('Location Saved ✅', 'Caregivers will use this to find your home'); },
    onError: (e) => Alert.alert('Error', e.response?.data?.error || 'Could not save location'),
  });

  const handleSetLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is needed to save your service address');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const [geo] = await Location.reverseGeocodeAsync(loc.coords);
      const address = [geo?.name, geo?.street, geo?.city, geo?.region].filter(Boolean).join(', ');
      Alert.alert(
        'Confirm Location',
        `Use this address?\n\n${address || 'GPS coordinates saved'}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: () => locationMutation.mutate({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              address,
            }),
          },
        ],
      );
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not get location');
    } finally {
      setLocLoading(false);
    }
  };

  const addElderMutation = useMutation({
    mutationFn: (data) => api.post('/customer/elders', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customer-elders'] }); setAddingElder(false); resetElderForm(); Alert.alert('Added!', 'Elder profile saved'); },
    onError: (e) => Alert.alert('Error', e.response?.data?.error || 'Failed to add elder'),
  });

  const updateElderMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/customer/elders/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customer-elders'] }); setEditingElder(null); resetElderForm(); },
    onError: (e) => Alert.alert('Error', e.response?.data?.error || 'Update failed'),
  });

  const deleteElderMutation = useMutation({
    mutationFn: (id) => api.delete(`/customer/elders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-elders'] }),
  });

  const resetElderForm = () => setElder({ name: '', age: '', relationship: '', medicalConditions: '', medications: '', allergies: '', specialNeeds: '' });

  const openEditElder = (e) => {
    setElder({ name: e.name, age: String(e.age || ''), relationship: e.relationship || '', medicalConditions: e.medicalConditions?.join(', ') || '', medications: e.medications?.join(', ') || '', allergies: e.allergies?.join(', ') || '', specialNeeds: e.specialNeeds || '' });
    setEditingElder(e);
  };

  const parseList = (str) => str.split(',').map(s => s.trim()).filter(Boolean);

  const submitElder = () => {
    if (!elder.name.trim()) return Alert.alert('Required', 'Elder name is required');
    const payload = { name: elder.name.trim(), age: elder.age ? parseInt(elder.age) : undefined, relationship: elder.relationship, medicalConditions: parseList(elder.medicalConditions), medications: parseList(elder.medications), allergies: parseList(elder.allergies), specialNeeds: elder.specialNeeds };
    if (editingElder) updateElderMutation.mutate({ id: editingElder.id, data: payload });
    else addElderMutation.mutate(payload);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.gray[50] }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.avatar}><Text style={s.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text></View>
          <Text style={s.name}>{user?.name}</Text>
          <Text style={s.phone}>{user?.phone}</Text>
          <Badge label={PLAN_LABELS[subscription?.plan || 'FREE']} color={PLAN_COLORS[subscription?.plan || 'FREE']} />
        </View>

        {/* Profile Card */}
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={s.sectionTitle}>Personal Info</Text>
            <TouchableOpacity onPress={() => { setName(user?.name || ''); setEmergencyContact(profile?.profile?.emergencyContact || ''); setCity(profile?.profile?.city || ''); setEditingProfile(true); }}>
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: fontSizes.sm }}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Name</Text><Text style={s.infoVal}>{user?.name}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Phone</Text><Text style={s.infoVal}>{user?.phone}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>City</Text><Text style={s.infoVal}>{profile?.profile?.city || '—'}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Emergency</Text><Text style={s.infoVal}>{profile?.profile?.emergencyContact || '—'}</Text></View>
        </Card>

        {/* Service Location Card */}
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={s.sectionTitle}>📍 Service Location</Text>
            <TouchableOpacity onPress={handleSetLocation} disabled={locLoading || locationMutation.isPending}>
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: fontSizes.sm }}>
                {locLoading || locationMutation.isPending ? 'Saving…' : profile?.profile?.latitude ? 'Update' : 'Set Location'}
              </Text>
            </TouchableOpacity>
          </View>
          {profile?.profile?.latitude ? (
            <>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Address</Text>
                <Text style={[s.infoVal, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                  {profile.profile.address || 'GPS saved'}
                </Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Coordinates</Text>
                <Text style={s.infoVal}>
                  {parseFloat(profile.profile.latitude).toFixed(4)}, {parseFloat(profile.profile.longitude).toFixed(4)}
                </Text>
              </View>
              <View style={{ backgroundColor: '#d1fae5', borderRadius: radius.sm, padding: 8, marginTop: 8 }}>
                <Text style={{ fontSize: fontSizes.xs, color: '#065f46' }}>
                  ✅ Caregivers must be within 500m of this location to check in.
                </Text>
              </View>
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📍</Text>
              <Text style={{ fontSize: fontSizes.sm, color: colors.gray[500], textAlign: 'center' }}>
                No location set yet.{'\n'}Tap "Set Location" to save your home address.
              </Text>
              <Text style={{ fontSize: fontSizes.xs, color: '#92400e', backgroundColor: '#fef3c7', padding: 8, borderRadius: radius.sm, marginTop: 8, textAlign: 'center' }}>
                ⚠️ Without a location, caregivers can check in from anywhere.
              </Text>
            </View>
          )}
          {(locLoading || locationMutation.isPending) && (
            <ActivityIndicator style={{ marginTop: 8 }} color={colors.primary} />
          )}
        </Card>

        {/* Subscription Card */}
        {subscription && (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={s.sectionTitle}>Subscription</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <View>
                <Text style={{ fontSize: fontSizes.lg, fontWeight: '700', color: colors.gray[900] }}>{PLAN_LABELS[subscription.plan]}</Text>
                {subscription.subscription?.endDate && (
                  <Text style={{ fontSize: fontSizes.xs, color: colors.gray[400], marginTop: 2 }}>
                    Renews {new Date(subscription.subscription.endDate).toLocaleDateString('en-IN')}
                  </Text>
                )}
              </View>
              <Badge label={subscription.plan === 'FREE' ? 'Free' : `₹${{ FAMILY_BASIC: 499, FAMILY_PREMIUM: 999, ENTERPRISE: 2999 }[subscription.plan]}/mo`} color={PLAN_COLORS[subscription.plan]} />
            </View>
          </Card>
        )}

        {/* Elders */}
        <View style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={s.sectionTitle}>Elder Profiles</Text>
            <TouchableOpacity onPress={() => { resetElderForm(); setAddingElder(true); }}>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: fontSizes.sm }}>+ Add Elder</Text>
            </TouchableOpacity>
          </View>
          {elders.length === 0 ? (
            <Card><Text style={{ color: colors.gray[400], textAlign: 'center', paddingVertical: spacing.md }}>No elder profiles yet. Add one to start booking care.</Text></Card>
          ) : elders.map(e => (
            <Card key={e.id} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: fontSizes.md, color: colors.gray[900] }}>{e.name}</Text>
                  <Text style={{ fontSize: fontSizes.xs, color: colors.gray[500] }}>{e.relationship}{e.age ? `, ${e.age} yrs` : ''}</Text>
                  {e.medicalConditions?.length > 0 && <Text style={{ fontSize: fontSizes.xs, color: colors.warning, marginTop: 4 }}>⚕️ {e.medicalConditions.join(', ')}</Text>}
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => openEditElder(e)}><Text style={{ color: colors.primary, fontWeight: '600', fontSize: fontSizes.xs }}>Edit</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => Alert.alert('Remove Elder?', `Remove ${e.name}?`, [{ text: 'Cancel' }, { text: 'Remove', style: 'destructive', onPress: () => deleteElderMutation.mutate(e.id) }])}><Text style={{ color: colors.danger, fontWeight: '600', fontSize: fontSizes.xs }}>Remove</Text></TouchableOpacity>
                </View>
              </View>
            </Card>
          ))}
        </View>

        {/* Saved Caregivers */}
        <TouchableOpacity onPress={() => router.push('/(customer)/favorites')} style={s.savedBtn}>
          <Text style={s.savedBtnText}>❤️  Saved Caregivers</Text>
          <Text style={s.savedBtnArrow}>→</Text>
        </TouchableOpacity>

        {/* Logout */}
        <Button title="Logout" variant="outline" onPress={() => Alert.alert('Logout', 'Are you sure?', [{ text: 'Cancel' }, { text: 'Logout', style: 'destructive', onPress: logout }])} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editingProfile} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setEditingProfile(false)}><Text style={{ color: colors.gray[400], fontSize: 16 }}>Cancel</Text></TouchableOpacity>
            <Text style={{ fontWeight: '700', fontSize: fontSizes.lg }}>Edit Profile</Text>
            <TouchableOpacity onPress={() => updateProfileMutation.mutate({ name, emergencyContact, city })}><Text style={{ color: colors.primary, fontWeight: '700' }}>Save</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            <Input label="Full Name" value={name} onChangeText={setName} />
            <Input label="City" value={city} onChangeText={setCity} />
            <Input label="Emergency Contact (+91XXXXXXXXXX)" value={emergencyContact} onChangeText={setEmergencyContact} keyboardType="phone-pad" />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add/Edit Elder Modal */}
      <Modal visible={addingElder || !!editingElder} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => { setAddingElder(false); setEditingElder(null); resetElderForm(); }}><Text style={{ color: colors.gray[400] }}>Cancel</Text></TouchableOpacity>
            <Text style={{ fontWeight: '700', fontSize: fontSizes.lg }}>{editingElder ? 'Edit Elder' : 'Add Elder'}</Text>
            <TouchableOpacity onPress={submitElder}><Text style={{ color: colors.primary, fontWeight: '700' }}>Save</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            <Input label="Name *" value={elder.name} onChangeText={v => setElder(p => ({ ...p, name: v }))} />
            <Input label="Age" value={elder.age} onChangeText={v => setElder(p => ({ ...p, age: v }))} keyboardType="numeric" />
            <Input label="Relationship (e.g. Mother, Father)" value={elder.relationship} onChangeText={v => setElder(p => ({ ...p, relationship: v }))} />
            <Input label="Medical Conditions (comma-separated)" value={elder.medicalConditions} onChangeText={v => setElder(p => ({ ...p, medicalConditions: v }))} placeholder="e.g. Diabetes, Arthritis" />
            <Input label="Medications (comma-separated)" value={elder.medications} onChangeText={v => setElder(p => ({ ...p, medications: v }))} placeholder="e.g. Metformin, Amlodipine" />
            <Input label="Allergies (comma-separated)" value={elder.allergies} onChangeText={v => setElder(p => ({ ...p, allergies: v }))} />
            <Input label="Special Needs / Notes" value={elder.specialNeeds} onChangeText={v => setElder(p => ({ ...p, specialNeeds: v }))} multiline style={{ height: 80, textAlignVertical: 'top' }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { alignItems: 'center', paddingVertical: spacing.xl, gap: 6 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText: { fontSize: 30, fontWeight: '800', color: colors.primaryDark },
  name: { fontSize: fontSizes.xxl, fontWeight: '800', color: colors.gray[900] },
  phone: { fontSize: fontSizes.sm, color: colors.gray[500] },
  sectionTitle: { fontSize: fontSizes.md, fontWeight: '700', color: colors.gray[900] },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.gray[50] },
  infoLabel: { fontSize: fontSizes.sm, color: colors.gray[500] },
  infoVal: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.gray[800] },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  savedBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: spacing.md,
    paddingVertical: 14, borderWidth: 1, borderColor: colors.gray[200], marginBottom: spacing.sm,
  },
  savedBtnText: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.gray[800] },
  savedBtnArrow: { fontSize: fontSizes.md, color: colors.gray[400] },
});
