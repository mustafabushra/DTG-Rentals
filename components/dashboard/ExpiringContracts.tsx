import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../hooks/useAppTheme';

export interface ExpiringContract {
  id: string;
  contractNumber?: string;
  unitNumber: string;
  tenantName: string;
  endDate: string;
  daysLeft: number;
}

interface Props {
  contracts: ExpiringContract[];
}

function urgency(days: number) {
  if (days <= 7)  return { color: '#E74C3C', bg: '#FFF5F5', label: `${days} أيام` };
  if (days <= 14) return { color: '#F39C12', bg: '#FFFBF0', label: `${days} يوم` };
  return               { color: '#27AE60', bg: '#F0FFF4', label: `${days} يوم` };
}

export function ExpiringContracts({ contracts }: Props) {
  const { colors } = useAppTheme();
  const shown = contracts.slice(0, 5);

  if (contracts.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.countBadge, { backgroundColor: '#FDEDEC' }]}>
            <Text style={[styles.countTxt, { color: '#E74C3C' }]}>{contracts.length}</Text>
          </View>
          <Ionicons name="time-outline" size={16} color="#F39C12" />
          <Text style={[styles.title, { color: colors.text }]}>العقود المنتهية خلال 30 يوم</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/contracts' as any)}>
          <Text style={[styles.seeAll, { color: '#C3AF76' }]}>عرض الكل</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {shown.map((c, idx) => {
        const u = urgency(c.daysLeft);
        const isLast = idx === shown.length - 1;
        return (
          <TouchableOpacity
            key={c.id}
            style={[styles.row, { backgroundColor: u.bg, borderRightColor: u.color }, !isLast && styles.rowBorder, { borderBottomColor: colors.border }]}
            onPress={() => router.push(`/contract/${c.id}` as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.daysBadge, { backgroundColor: u.color + '20' }]}>
              <Text style={[styles.daysNum, { color: u.color }]}>{c.daysLeft}</Text>
              <Text style={[styles.daysLbl, { color: u.color }]}>يوم</Text>
            </View>
            <View style={styles.info}>
              <Text style={[styles.unit, { color: colors.text }]} numberOfLines={1}>
                وحدة {c.unitNumber}
              </Text>
              <Text style={[styles.tenant, { color: colors.textSecondary }]} numberOfLines={1}>
                {c.tenantName}
              </Text>
            </View>
            <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: Theme.radius.xl, borderWidth: 1, overflow: 'hidden' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Theme.spacing.base, paddingTop: Theme.spacing.base, paddingBottom: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title:    { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },
  seeAll:   { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.semibold },
  countBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99 },
  countTxt:   { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.bold },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Theme.spacing.base, paddingVertical: 12,
    borderRightWidth: 4,
  },
  rowBorder: { borderBottomWidth: 1 },
  info:     { flex: 1 },
  unit:     { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  tenant:   { fontSize: Theme.fontSize.xs, textAlign: 'right' },
  daysBadge: { alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Theme.radius.md, minWidth: 40 },
  daysNum:   { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },
  daysLbl:   { fontSize: 9, fontWeight: Theme.fontWeight.semibold },
});
