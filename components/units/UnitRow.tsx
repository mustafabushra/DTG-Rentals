/**
 * صف وحدة مضغوط: رقم الوحدة ونوعها، من ساكن فيها، الإيجار، والحالة. سطر واحد يُقرأ بنظرة.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppTheme } from '../../hooks/useAppTheme';
import { CurrencyText } from '../ui/CurrencyText';
import { getUnitTypeLabel, Unit } from '../../data/mockData';

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'muted' | 'info' }> = {
  rented: { label: 'مؤجرة', tone: 'success' },
  vacant: { label: 'شاغرة', tone: 'warning' },
  maintenance: { label: 'صيانة', tone: 'muted' },
  reserved: { label: 'محجوزة', tone: 'info' },
};

export function UnitRow({ unit, currency, tenantName, first }: { unit: Unit; currency?: string; tenantName?: string; first?: boolean }) {
  const { colors } = useAppTheme();
  const st = STATUS[unit.status] ?? { label: unit.status, tone: 'muted' as const };
  const toneColor = st.tone === 'success' ? colors.success : st.tone === 'warning' ? colors.warning : st.tone === 'info' ? colors.primary : colors.textMuted;
  const nightly = unit.rentalModel === 'nightly';
  const price = nightly ? unit.nightlyRate : unit.monthlyRent;
  const details = [getUnitTypeLabel(unit.type), unit.area ? `${unit.area} م²` : null, unit.floor ? `الطابق ${unit.floor}` : null].filter(Boolean).join('، ');

  return (
    <TouchableOpacity
      onPress={() => router.push(`/unit/${unit.id}` as any)}
      activeOpacity={0.7}
      style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: colors.border }]}
    >
      <View style={[styles.num, { backgroundColor: colors.surface }]}>
        <Text style={[styles.numText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{unit.number}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.main, { color: colors.text }]} numberOfLines={1}>
          {unit.status === 'rented' && tenantName ? tenantName : details}
        </Text>
        <View style={styles.statusLine}>
          <View style={[styles.dot, { backgroundColor: toneColor }]} />
          <Text style={[styles.sub, { color: toneColor }]}>{st.label}</Text>
          {unit.status === 'rented' && tenantName ? <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>{`· ${details}`}</Text> : null}
        </View>
      </View>
      {!!price && (
        <View style={{ alignItems: 'flex-start' }}>
          <CurrencyText amount={price} currency={currency} size={14} color={colors.text} />
          <Text style={[styles.per, { color: colors.textMuted }]}>{nightly ? 'لليلة' : 'شهرياً'}</Text>
        </View>
      )}
      <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  num: { minWidth: 48, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  numText: { fontSize: 14, fontWeight: '700' },
  main: { fontSize: 14, fontWeight: '500', textAlign: 'right' },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  sub: { fontSize: 12, textAlign: 'right' },
  per: { fontSize: 11 },
});
