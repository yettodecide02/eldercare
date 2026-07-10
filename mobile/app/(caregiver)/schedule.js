import { useState, Platform } from 'react';
import { SafeAreaView, ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../src/lib/api';
import { Card, Button } from '../../src/components/ui';
import { colors, spacing, fontSizes, radius } from '../../src/lib/theme';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DAY_SHORT = { MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun' };

function timeToDate(timeStr) {
  const [h, m] = (timeStr || '09:00').split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function ScheduleScreen() {
  const qc = useQueryClient();
  const [timePicker, setTimePicker] = useState(null); // { day, field: 'start'|'end' }
  const [localTimes, setLocalTimes] = useState({}); // { MONDAY: { start: '09:00', end: '18:00' } }

  const { data } = useQuery({
    queryKey: ['caregiver-availability'],
    queryFn: () => api.get('/caregiver/me').then(r => r.data),
  });

  const availability = data?.availability ?? [];
  const activeDay = day => availability.find(a => a.dayOfWeek === day);

  const getTime = (day, field) => {
    if (localTimes[day]?.[field]) return localTimes[day][field];
    const avail = activeDay(day);
    return field === 'start' ? (avail?.startTime || '09:00') : (avail?.endTime || '18:00');
  };

  const toggleMutation = useMutation({
    mutationFn: ({ day, enable, startTime, endTime }) => {
      if (!enable) {
        // Remove availability by setting isAvailable false — backend upsert will handle
        return api.put('/caregiver/availability', [{
          dayOfWeek: day,
          startTime: startTime || '09:00',
          endTime: endTime || '18:00',
          isAvailable: false,
        }]);
      }
      return api.put('/caregiver/availability', [{
        dayOfWeek: day,
        startTime: startTime || '09:00',
        endTime: endTime || '18:00',
        isAvailable: true,
      }]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['caregiver-availability'] }),
  });

  const saveTimeMutation = useMutation({
    mutationFn: ({ day, startTime, endTime }) =>
      api.put('/caregiver/availability', [{
        dayOfWeek: day, startTime, endTime, isAvailable: true,
      }]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['caregiver-availability'] }),
  });

  const handleTimeChange = (_, selectedDate) => {
    if (!timePicker) return;
    setTimePicker(null);
    if (!selectedDate) return;

    const { day, field } = timePicker;
    const time = dateToTime(selectedDate);
    const currentStart = getTime(day, 'start');
    const currentEnd = getTime(day, 'end');

    setLocalTimes(t => ({
      ...t,
      [day]: { start: currentStart, end: currentEnd, [field]: time },
    }));

    const newStart = field === 'start' ? time : currentStart;
    const newEnd = field === 'end' ? time : currentEnd;

    if (activeDay(day)?.isAvailable) {
      saveTimeMutation.mutate({ day, startTime: newStart, endTime: newEnd });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.gray[50] }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
        <Text style={styles.title}>My Availability</Text>
        <Text style={styles.subtitle}>Set the days and hours you're available for bookings</Text>

        {DAYS.map(day => {
          const avail = activeDay(day);
          const isOn = !!avail?.isAvailable;
          const startTime = getTime(day, 'start');
          const endTime = getTime(day, 'end');

          return (
            <Card key={day} style={[styles.dayCard, isOn && styles.dayCardActive]}>
              {/* Toggle row */}
              <View style={styles.dayHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dayName, isOn && styles.dayNameActive]}>{day}</Text>
                  <Text style={styles.dayShort}>{DAY_SHORT[day]}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => toggleMutation.mutate({ day, enable: !isOn, startTime, endTime })}
                  style={[styles.toggleBtn, isOn && styles.toggleBtnActive]}
                >
                  <Text style={[styles.toggleText, isOn && styles.toggleTextActive]}>
                    {isOn ? 'Available ✓' : 'Off'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Time pickers (only show when available) */}
              {isOn && (
                <View style={styles.timeRow}>
                  <TouchableOpacity
                    style={styles.timeBtn}
                    onPress={() => setTimePicker({ day, field: 'start' })}
                  >
                    <Text style={styles.timeBtnLabel}>Start</Text>
                    <Text style={styles.timeBtnVal}>{startTime}</Text>
                  </TouchableOpacity>

                  <Text style={styles.timeSep}>→</Text>

                  <TouchableOpacity
                    style={styles.timeBtn}
                    onPress={() => setTimePicker({ day, field: 'end' })}
                  >
                    <Text style={styles.timeBtnLabel}>End</Text>
                    <Text style={styles.timeBtnVal}>{endTime}</Text>
                  </TouchableOpacity>

                  <Text style={styles.hoursText}>
                    {(() => {
                      const [sh, sm] = startTime.split(':').map(Number);
                      const [eh, em] = endTime.split(':').map(Number);
                      const hrs = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
                      return hrs > 0 ? `${hrs}h` : '';
                    })()}
                  </Text>
                </View>
              )}
            </Card>
          );
        })}

        {timePicker && (
          <DateTimePicker
            value={timeToDate(timePicker.field === 'start' ? getTime(timePicker.day, 'start') : getTime(timePicker.day, 'end'))}
            mode="time"
            minuteInterval={30}
            is24Hour={true}
            onChange={handleTimeChange}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: fontSizes.xxl, fontWeight: '800', color: colors.gray[900], marginBottom: 4 },
  subtitle: { fontSize: fontSizes.sm, color: colors.gray[500], marginBottom: spacing.lg },
  dayCard: { marginBottom: spacing.sm, gap: spacing.sm },
  dayCardActive: { borderWidth: 1.5, borderColor: colors.primary },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayName: { fontSize: fontSizes.md, fontWeight: '700', color: colors.gray[700] },
  dayNameActive: { color: colors.primaryDark },
  dayShort: { fontSize: fontSizes.xs, color: colors.gray[400], marginTop: 1 },
  toggleBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full,
    backgroundColor: colors.gray[100],
  },
  toggleBtnActive: { backgroundColor: colors.primaryLight },
  toggleText: { fontSize: fontSizes.xs, fontWeight: '700', color: colors.gray[500] },
  toggleTextActive: { color: colors.primaryDark },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timeBtn: {
    flex: 1, borderWidth: 1.5, borderColor: colors.gray[200],
    borderRadius: radius.md, padding: spacing.sm, alignItems: 'center',
  },
  timeBtnLabel: { fontSize: fontSizes.xs, color: colors.gray[400], marginBottom: 2 },
  timeBtnVal: { fontSize: fontSizes.md, fontWeight: '700', color: colors.gray[900] },
  timeSep: { fontSize: fontSizes.md, color: colors.gray[400] },
  hoursText: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: '700', minWidth: 28, textAlign: 'right' },
});
