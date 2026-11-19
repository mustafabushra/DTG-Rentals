import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { useFinance } from '../../context/FinanceProvider';
import { CurrencyText } from '../ui/CurrencyText';
import { FilterBar } from '../ui/FilterBar';
import { useAppTheme } from '../../hooks/useAppTheme';
import { formatDate } from '../../data/mockData';
import { inRange, netByProperty } from '../../domain/services/FinanceService';
import { PERIOD_OPTIONS, periodRange, type PeriodKey } from './periods';

/** تبويب "المالية" في صفحة العقار: المحصَّل والمصاريف وصافي الدخل وآخر المصاريف. */
export function PropertyFinancePanel({ propertyId }: { propertyId: string }) {
  const { colors } = useAppTheme();
  const { properties, units, contracts, payments, canWrite } = useApp();
  const { expenses } = useFinance();
  const [period, setPeriod] = useState<PeriodKey>('year');
  const { from, to } = periodRange(period);

  const property = properties.find(p => p.id === propertyId);
  const currency = property?.currency ?? 'SAR';

  const net = useMemo(() => {
    const rows = netByProperty({
      payments: payments as any, contracts: contracts as any, units: units as any,
      properties: properties as any, expenses,
    }, from, to);
    return rows.find(r => r.propertyId === propertyId) ?? { income: 0, expenses: 0, net: 0 };
  }, [payments, contracts, units, properties, expenses, from, to, propertyId]);

  const list = useMemo(() => expenses
    .filter(e => e.scope === 'property' && e.propertyId === propertyId && e.status === 'active')
    .filter(e => period === 'all' || inRange(e.date, from, to))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8), [expenses, propertyId, period, from, to]);

  const margin = net.income > 0 ? Math.round((net.net / net.income) * 100) : null;

  return (
    <View style={styles.wrap}>
      <FilterBar options={PERIOD_OPTIONS} value={period} onChange={v => setPeriod(v as PeriodKey)} />

      <View style={[styles.kpis, { backgroundColor: colors.card, borderColor: colors.borderStrong }]}>
        <View style={styles.kpi}>
          <Text style={[styles.lbl, { color: colors.textMuted }]}>المحصَّل</Text>
          <CurrencyText amount={net.income} currency={currency} size={17} color={colors.success} />
        </View>
        <View style={[styles.div, { backgroundColor: colors.border }]} />
        <View style={styles.kpi}>
          <Text style={[styles.lbl, { color: colors.textMuted }]}>المصاريف</Text>
          <CurrencyText amount={net.expenses} currency={currency} size={17} color={colors.danger} />
        </View>
        <View style={[styles.div, { backgroundColor: colors.border }]} />
        <View style={styles.kpi}>
          <Text style={[styles.lbl, { color: colors.textMuted }]}>صافي الدخل</Text>
          <CurrencyText amount={net.net} currency={currency} size={17} color={net.net < 0 ? colors.danger : colors.text} />
          {margin !== null && <Text style={[styles.margin, { color: colors.textMuted }]}>هامش {margin}%</Text>}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderStrong }]}>
        <View style={styles.cardHead}>
          <Text style={[styles.title, { color: colors.text }]}>آخر المصاريف</Text>
          {canWrite && (
            <TouchableOpacity
              onPress={() => router.push(`/add-expense?scope=property&propertyId=${propertyId}` as any)}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="add" size={16} color={colors.textInverse} />
              <Text style={[styles.addTxt, { color: colors.textInverse }]}>إضافة مصروف</Text>
            </TouchableOpacity>
          )}
        </View>
        {list.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد مصاريف مسجّلة في هذه الفترة</Text>
        ) : list.map(e => (
          <TouchableOpacity key={e.id} onPress={() => router.push(`/expense/${e.id}` as any)} style={[styles.row, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>{e.category}{e.vendor ? ` — ${e.vendor}` : ''}</Text>
              <Text style={[styles.rowSub, { color: colors.textMuted }]}>{formatDate(e.date)}</Text>
            </View>
            <CurrencyText amount={e.amount} currency={e.currency} size={14} />
          </TouchableOpacity>
        ))}
        {list.length > 0 && (
          <TouchableOpacity onPress={() => router.push('/expenses' as any)} style={[styles.more, { borderTopColor: colors.border }]}>
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '500' }}>كل مصاريف العقارات</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, gap: Theme.spacing.md },
  kpis: { flexDirection: 'row', marginHorizontal: Theme.spacing.base, borderWidth: 1, borderRadius: Theme.radius.xl, paddingVertical: Theme.spacing.base },
  kpi: { flex: 1, alignItems: 'center', gap: 4 },
  div: { width: 1 },
  lbl: { fontSize: 12 },
  margin: { fontSize: 11 },
  card: { marginHorizontal: Theme.spacing.base, borderWidth: 1, borderRadius: Theme.radius.xl, paddingHorizontal: Theme.spacing.base },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  title: { fontSize: 15, fontWeight: '600' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Theme.radius.sm, paddingHorizontal: 10, minHeight: 32 },
  addTxt: { fontSize: 13, fontWeight: '500' },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1 },
  rowTitle: { fontSize: 14, fontWeight: '500', textAlign: 'right' },
  rowSub: { fontSize: 12, textAlign: 'right', marginTop: 2 },
  more: { borderTopWidth: 1, paddingVertical: 12, alignItems: 'center' },
});
