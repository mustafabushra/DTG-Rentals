/**
 * بطاقة عقد مختصرة: مين المستأجر، وين، كم قيمته، ومتى ينتهي — بنظرة واحدة.
 * رقم العقد (غالباً طويل) صار تفصيلاً صغيراً بدل أن يكون العنوان.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../../constants/Theme';
import { Contract, formatDate } from '../../data/mockData';
import { CurrencyText } from './CurrencyText';
import { useApp } from '../../context/AppProvider';
import { useAppTheme } from '../../hooks/useAppTheme';

interface ContractCardProps {
  contract: Contract;
  onDelete?: () => void;
  style?: any;
}

const STATUS: Record<string, { label: string; tone: 'success' | 'danger' | 'muted' | 'warning' }> = {
  active: { label: 'ساري', tone: 'success' },
  expired: { label: 'منتهي', tone: 'danger' },
  terminated: { label: 'أُنهي', tone: 'muted' },
  cancelled: { label: 'ملغي', tone: 'muted' },
  pending: { label: 'معلّق', tone: 'warning' },
};

export function daysUntil(date: string) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(date.slice(0, 10) + 'T00:00:00').getTime() - t.getTime()) / 86400000);
}

export function ContractCard({ contract, style }: ContractCardProps) {
  const { colors } = useAppTheme();
  const { tenants, units, properties } = useApp();
  const tenant = tenants.find(t => t.id === contract.tenantId);
  const unit = units.find(u => u.id === contract.unitId);
  const prop = unit ? properties.find(p => p.id === unit.propertyId) : undefined;
  const left0 = daysUntil(contract.endDate);
  // "ساري" وتاريخه فات = عقد انتهى ولم يُجدَّد ولم يُغلق — يحتاج إجراء
  const st = contract.status === 'active' && left0 < 0
    ? { label: 'انتهى ولم يُجدَّد', tone: 'danger' as const }
    : STATUS[contract.status] ?? { label: contract.status, tone: 'muted' as const };
  const toneColor = { success: colors.success, danger: colors.danger, muted: colors.textMuted, warning: colors.warning }[st.tone];
  const toneBg = { success: colors.successSubtle, danger: colors.dangerSubtle, muted: colors.surface, warning: colors.warningSubtle }[st.tone];

  const left = daysUntil(contract.endDate);
  const active = contract.status === 'active';
  const endText = active
    ? (left < 0 ? `انتهى ${formatDate(contract.endDate)}` : left === 0 ? 'ينتهي اليوم' : `ينتهي ${formatDate(contract.endDate)} · بعد ${left} يوم`)
    : `انتهى ${formatDate(contract.endDate)}`;
  const endColor = active && left <= 60 ? (left <= 14 ? colors.danger : colors.warning) : colors.textMuted;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}
      onPress={() => router.push(`/contract/${contract.id}`)}
      activeOpacity={0.75}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.top}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{tenant?.name || 'مستأجر غير محدد'}</Text>
          <View style={[styles.pill, { backgroundColor: toneBg }]}>
            <Text style={[styles.pillText, { color: toneColor }]}>{st.label}</Text>
          </View>
        </View>
        <Text style={[styles.place, { color: colors.textSecondary }]} numberOfLines={1}>
          {[prop?.name, unit ? `وحدة ${unit.number}` : null].filter(Boolean).join('، ') || '—'}
        </Text>
        <View style={styles.bottom}>
          <Text style={[styles.end, { color: endColor }]} numberOfLines={1}>{endText}</Text>
          <View style={styles.value}>
            <CurrencyText amount={contract.annualValue} currency={contract.currency} size={14} color={colors.text} />
            <Text style={[styles.per, { color: colors.textMuted }]}>سنوياً</Text>
          </View>
        </View>
        <Text style={[styles.number, { color: colors.textMuted }]} numberOfLines={1}>عقد رقم {contract.contractNumber}</Text>
      </View>
      <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12, borderWidth: 1,
    marginHorizontal: Theme.spacing.base, marginBottom: Theme.spacing.sm,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: '600', textAlign: 'right' },
  pill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 12, fontWeight: '600' },
  place: { fontSize: 13, textAlign: 'right' },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  end: { flex: 1, fontSize: 12, fontWeight: '500', textAlign: 'right' },
  value: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  per: { fontSize: 11 },
  number: { fontSize: 11, textAlign: 'right' },
});
