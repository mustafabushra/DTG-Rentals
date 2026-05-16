import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Platform, ScrollView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../hooks/useAppTheme';

const MONTHS = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
];
const DAY_LABELS = ['أح','إث','ثل','أر','خم','جم','سب'];

function parseIso(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d };
}

function buildIso(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatIsoArabic(iso: string): string {
  const p = parseIso(iso);
  if (!p) return '—';
  return `${p.day} ${MONTHS[p.month]} ${p.year}`;
}

interface Props {
  label: string;
  value: string;
  onChange: (date: string) => void;
  required?: boolean;
  error?: string;
  minDate?: string;
}

export function FormDatePicker({ label, value, onChange, required, error, minDate }: Props) {
  const [open, setOpen] = useState(false);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const today = new Date();
  const todayIso = buildIso(today.getFullYear(), today.getMonth(), today.getDate());

  const [viewYear,  setViewYear]  = useState(() => parseIso(value)?.year  ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parseIso(value)?.month ?? today.getMonth());

  useEffect(() => {
    const p = parseIso(value);
    if (p) { setViewYear(p.year); setViewMonth(p.month); }
  }, [value]);

  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekDay = new Date(viewYear, viewMonth, 1).getDay();

  const flat: (number | null)[] = [];
  for (let i = 0; i < firstWeekDay; i++) flat.push(null);
  for (let d = 1; d <= daysInMonth; d++) flat.push(d);
  while (flat.length % 7 !== 0) flat.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < flat.length; i += 7) weeks.push(flat.slice(i, i + 7));

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const selectDay = (day: number) => {
    onChange(buildIso(viewYear, viewMonth, day));
    setOpen(false);
  };

  // ── Calendar panel (shared between web & native) ────────────────────────────
  const CalendarPanel = (
    <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Nav */}
      <View style={styles.navRow}>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.monthTitle, { color: colors.text }]}>
          {MONTHS[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Day labels */}
      <View style={styles.dayLabelsRow}>
        {DAY_LABELS.map(d => (
          <Text key={d} style={[styles.dayLabel, { color: colors.textMuted }]}>{d}</Text>
        ))}
      </View>

      {/* Week rows */}
      <View>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((day, di) => {
              if (!day) return <View key={`e${di}`} style={styles.dayCell} />;
              const iso        = buildIso(viewYear, viewMonth, day);
              const isSelected = value === iso;
              const isDisabled = !!minDate && iso < minDate;
              const isToday    = iso === todayIso;
              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayCell,
                    isSelected && { backgroundColor: colors.primary, borderRadius: 99 },
                    !isSelected && isToday && { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 99 },
                  ]}
                  onPress={() => !isDisabled && selectDay(day)}
                  disabled={isDisabled}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    styles.dayText,
                    { color: isDisabled ? colors.textMuted : isSelected ? '#FFF' : colors.text },
                  ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );

  const hasError = !!error;

  return (
    <View style={[styles.wrapper, Platform.OS === 'web' && { zIndex: open ? 999 : 1 }]}>
      <Text style={[styles.label, { color: colors.text }]}>
        {label}
        {required && <Text style={{ color: colors.danger }}> *</Text>}
      </Text>

      <TouchableOpacity
        style={[styles.selector, {
          backgroundColor: colors.inputBg,
          borderColor: hasError ? colors.danger : colors.inputBorder,
        }]}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.8}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
        <Text style={[styles.dateText, { color: value ? colors.text : colors.textMuted }]}>
          {value ? formatIsoArabic(value) : 'اختر تاريخاً...'}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {hasError && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

      {/* ── Web: dropdown below input ─────────────────────────────────────── */}
      {Platform.OS === 'web' && open && (
        <>
          {/* Invisible full-screen backdrop to catch outside clicks */}
          <TouchableOpacity
            style={styles.webBackdrop}
            onPress={() => setOpen(false)}
            activeOpacity={1}
          />
          <View style={styles.webDropdown}>
            {CalendarPanel}
          </View>
        </>
      )}

      {/* ── Native: bottom-sheet modal ────────────────────────────────────── */}
      {Platform.OS !== 'web' && (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            {CalendarPanel}
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:  { gap: 6 },
  label:    { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  selector: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Theme.radius.md, borderWidth: 1.5,
    paddingHorizontal: Theme.spacing.md, height: 48, gap: 10,
  },
  dateText: { fontSize: Theme.fontSize.base, flex: 1, textAlign: 'right' },
  error:    { fontSize: Theme.fontSize.sm },

  // Web
  webBackdrop: {
    position: 'fixed' as any,
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 998,
  },
  webDropdown: {
    position: 'absolute' as any,
    top: '100%' as any,
    right: 0,
    zIndex: 999,
    marginTop: 4,
    width: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderRadius: Theme.radius.xl,
    overflow: 'hidden',
  },

  // Native modal
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingHorizontal: Theme.spacing.base,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },

  // Shared panel
  panel: {
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.xl,
    borderWidth: Platform.OS === 'web' ? 1 : 0,
  },
  navRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 },
  navBtn:     { padding: 6 },
  monthTitle: { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },

  dayLabelsRow: { flexDirection: 'row', paddingBottom: 4 },
  dayLabel:     { flex: 1, textAlign: 'center', fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold, paddingVertical: 4 },

  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  dayText: { fontSize: Theme.fontSize.md, textAlign: 'center' },
});
