import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../hooks/useAppTheme';

export interface DuePayment {
  id: string;
  tenantName: string;
  unitNumber: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'overdue';
  currency?: string;
}

interface Props {
  todayPayments: DuePayment[];
  weekPayments: DuePayment[];
}

function fmt(n: number) { return n.toLocaleString('en-US'); }

function PaymentRow({ p, colors }: { p: DuePayment; colors: any }) {
  const isOverdue = p.status === 'overdue';
  const amtColor  = isOverdue ? colors.danger : colors.warning;
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/payment/${p.id}` as any)}
      activeOpacity={0.8}
    >
      <View style={[styles.amtCol, { alignItems: 'flex-start' }]}>
        <Text style={[styles.amt, { color: amtColor }]}>{fmt(p.amount)}</Text>
        <Text style={[styles.cur, { color: colors.textMuted }]}>{p.currency ?? 'ريال'}</Text>
        {isOverdue && (
          <View style={[styles.overdueBadge, { backgroundColor: colors.dangerSubtle }]}>
            <Text style={[styles.overdueTxt, { color: colors.danger }]}>متأخر</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.tenant, { color: colors.text }]} numberOfLines={1}>{p.tenantName}</Text>
        <Text style={[styles.unit, { color: colors.textSecondary }]}>وحدة {p.unitNumber}</Text>
      </View>
      <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export function DuePayments({ todayPayments, weekPayments }: Props) {
  const { colors } = useAppTheme();
  const [tab, setTab] = useState<'today' | 'week'>('today');

  const list = tab === 'today' ? todayPayments : weekPayments;
  const shown = list.slice(0, 5);
  const total = list.reduce((s, p) => s + p.amount, 0);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.tabs}>
          {(['today', 'week'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && { borderBottomWidth: 2, borderBottomColor: colors.accentGold }]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabTxt, { color: tab === t ? colors.primary : colors.textMuted }]}>
                {t === 'today' ? 'اليوم' : 'هذا الأسبوع'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.title, { color: colors.text }]}>الدفعات المستحقة</Text>
      </View>

      {/* Empty */}
      {shown.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle-outline" size={28} color={colors.success} />
          <Text style={[styles.emptyTxt, { color: colors.textMuted }]}>لا توجد دفعات مستحقة</Text>
        </View>
      ) : (
        <>
          {shown.map(p => <PaymentRow key={p.id} p={p} colors={colors} />)}

          {/* Total */}
          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalAmt, { color: colors.warning }]}>{fmt(total)}</Text>
            <Text style={[styles.totalLbl, { color: colors.textMuted }]}>الإجمالي</Text>
          </View>

          {list.length > 5 && (
            <TouchableOpacity style={styles.moreBtn} onPress={() => router.push('/payments' as any)}>
              <Text style={[styles.moreTxt, { color: colors.accentGold }]}>عرض {list.length - 5} دفعة إضافية</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: Theme.radius.xl, borderWidth: 1, overflow: 'hidden' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Theme.spacing.base, paddingTop: Theme.spacing.base, paddingBottom: 10,
  },
  title: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },
  tabs:  { flexDirection: 'row', gap: 4 },
  tab:   { paddingHorizontal: 10, paddingBottom: 4 },
  tabTxt: { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.semibold },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Theme.spacing.base, paddingVertical: 13, borderBottomWidth: 1,
  },
  info:   { flex: 1 },
  tenant: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  unit:   { fontSize: Theme.fontSize.xs, textAlign: 'right' },
  amtCol: { minWidth: 64 },
  amt:    { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  cur:    { fontSize: 10 },
  overdueBadge: { borderRadius: 99, paddingHorizontal: 5, paddingVertical: 1, marginTop: 2 },
  overdueTxt:   { fontSize: 9, fontWeight: '700' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, paddingHorizontal: Theme.spacing.base, paddingVertical: 12,
  },
  totalLbl: { fontSize: Theme.fontSize.sm },
  totalAmt: { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },
  empty:    { alignItems: 'center', gap: 8, padding: Theme.spacing.lg },
  emptyTxt: { fontSize: Theme.fontSize.sm },
  moreBtn:  { alignItems: 'center', paddingVertical: 10 },
  moreTxt:  { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
});
