import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { utils, writeFile } from 'xlsx';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { useFinance } from '../../context/FinanceProvider';
import { AppHeader } from '../ui/AppHeader';
import { SearchBar } from '../ui/SearchBar';
import { FilterBar } from '../ui/FilterBar';
import { EmptyState } from '../ui/EmptyState';
import { CurrencyText } from '../ui/CurrencyText';
import { ListSkeleton } from '../ui/Skeleton';
import { FormSelect } from '../forms/FormSelect';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useScreenSize } from '../../hooks/useScreenSize';
import { formatDate } from '../../data/mockData';
import type { Expense, ExpenseScope } from '../../domain/models';
import { inRange, totalsByCategory, totalsByCurrency, PAYMENT_METHOD_LABELS } from '../../domain/services/FinanceService';
import { getCurrency } from '../../utils/currency';
import { PERIOD_OPTIONS, periodRange, type PeriodKey } from './periods';

const STATUS_OPTIONS = [
  { value: 'active',    label: 'سارية' },
  { value: 'cancelled', label: 'ملغاة' },
  { value: 'all',       label: 'الكل' },
];

export function ExpensesScreen({ scope }: { scope: ExpenseScope }) {
  const { colors } = useAppTheme();
  const { hPad } = useScreenSize();
  const { properties, units, canWrite, dataLoading } = useApp();
  const { expenses, vouchers, financeLoading } = useFinance();

  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [status, setStatus] = useState('active');
  const [category, setCategory] = useState('all');
  const [propertyId, setPropertyId] = useState('all');

  const title = scope === 'office' ? 'مصاريف المكتب' : 'مصاريف العقارات';
  const addRoute = `/add-expense?scope=${scope}` as any;

  const scoped = useMemo(() => expenses.filter(e => e.scope === scope), [expenses, scope]);
  const { from, to } = periodRange(period);

  const propName = (id?: string) => properties.find(p => p.id === id)?.name ?? '';
  const unitNo = (id?: string) => (units.find(u => u.id === id) as any)?.number ?? '';
  const voucherNo = (e: Expense) => vouchers.find(v => v.id === e.voucherId)?.number ?? '';

  const filtered = useMemo(() => {
    const q = search.trim();
    return scoped
      .filter(e => period === 'all' || inRange(e.date, from, to))
      .filter(e => status === 'all' || e.status === status)
      .filter(e => category === 'all' || e.category === category)
      .filter(e => scope === 'office' || propertyId === 'all' || e.propertyId === propertyId)
      .filter(e => !q || [e.category, e.vendor, e.notes, e.referenceNumber, propName(e.propertyId), voucherNo(e)]
        .some(x => (x ?? '').includes(q)))
      .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  }, [scoped, period, from, to, status, category, propertyId, search, properties, vouchers]);

  const totals = useMemo(() => totalsByCurrency(filtered), [filtered]);
  const byCat = useMemo(() => totalsByCategory(filtered).slice(0, 4), [filtered]);
  const catOptions = useMemo(() => [
    { value: 'all', label: 'كل التصنيفات' },
    ...Array.from(new Set(scoped.map(e => e.category))).map(c => ({ value: c, label: c })),
  ], [scoped]);
  const propOptions = useMemo(() => [
    { value: 'all', label: 'كل العقارات' },
    ...properties.map(p => ({ value: p.id, label: p.name })),
  ], [properties]);

  const exportExcel = () => {
    const rows = filtered.map(e => ({
      'رقم السند': voucherNo(e),
      'التاريخ': e.date,
      ...(scope === 'property' ? { 'العقار': propName(e.propertyId), 'الوحدة': unitNo(e.unitId) } : {}),
      'التصنيف': e.category,
      'المورد / الجهة': e.vendor ?? '',
      'المبلغ': e.amount,
      'العملة': e.currency,
      'طريقة الدفع': e.paymentMethod ? PAYMENT_METHOD_LABELS[e.paymentMethod] : '',
      'رقم المرجع': e.referenceNumber ?? '',
      'الحالة': e.status === 'active' ? 'سارٍ' : 'ملغي',
      'ملاحظات': e.notes ?? '',
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    (wb as any).Workbook = { Views: [{ RTL: true }] };
    utils.book_append_sheet(wb, ws, scope === 'office' ? 'مصاريف المكتب' : 'مصاريف العقارات');
    writeFile(wb, `${scope === 'office' ? 'office' : 'property'}_expenses_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (dataLoading || (financeLoading && expenses.length === 0)) return <ListSkeleton count={5} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={title}
        rightAction={canWrite ? { icon: 'add', onPress: () => router.push(addRoute), label: 'إضافة مصروف' } : undefined}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="ابحث بالتصنيف أو المورد أو رقم السند..." />
        <FilterBar options={PERIOD_OPTIONS} value={period} onChange={v => setPeriod(v as PeriodKey)} />
        <FilterBar options={STATUS_OPTIONS} value={status} onChange={setStatus} />

        <View style={[styles.selects, { paddingHorizontal: hPad }]}>
          {scope === 'property' && (
            <View style={{ flex: 1 }}>
              <FormSelect label="العقار" value={propertyId} options={propOptions} onSelect={setPropertyId} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <FormSelect label="التصنيف" value={category} options={catOptions} onSelect={setCategory} />
          </View>
        </View>

        {/* ── الملخص ── */}
        <View style={[styles.summary, { marginHorizontal: hPad, backgroundColor: colors.card, borderColor: colors.borderStrong }]}>
          <View style={styles.summaryTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>إجمالي المصاريف</Text>
              {Object.keys(totals).length === 0 ? (
                <Text style={[styles.summaryValue, { color: colors.text }]}>0</Text>
              ) : Object.entries(totals).map(([cur, amt]) => (
                <CurrencyText key={cur} amount={amt} currency={cur} size={22} color={colors.danger} />
              ))}
            </View>
            <View style={[styles.countBox, { backgroundColor: colors.surface }]}>
              <Text style={[styles.countVal, { color: colors.text }]}>{filtered.length}</Text>
              <Text style={[styles.countLbl, { color: colors.textMuted }]}>مصروف</Text>
            </View>
          </View>
          {byCat.length > 0 && (
            <View style={[styles.cats, { borderTopColor: colors.border }]}>
              {byCat.map(c => (
                <View key={c.category} style={[styles.catChip, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.catName, { color: colors.textSecondary }]}>{c.category}</Text>
                  <Text style={[styles.catAmt, { color: colors.text }]}>{Math.round(c.amount).toLocaleString('en-US')}</Text>
                </View>
              ))}
            </View>
          )}
          {Platform.OS === 'web' && filtered.length > 0 && (
            <TouchableOpacity onPress={exportExcel} style={[styles.exportBtn, { borderColor: colors.borderStrong }]}>
              <Ionicons name="download-outline" size={16} color={colors.text} />
              <Text style={[styles.exportTxt, { color: colors.text }]}>تصدير Excel</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── القائمة ── */}
        {filtered.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title="لا توجد مصاريف في هذه الفترة"
            subtitle={canWrite ? 'سجّل أول مصروف ويصدر سند الصرف تلقائياً' : undefined}
            actionLabel={canWrite ? 'إضافة مصروف' : undefined}
            onAction={canWrite ? () => router.push(addRoute) : undefined}
          />
        ) : (
          <View style={[styles.list, { marginHorizontal: hPad, backgroundColor: colors.card, borderColor: colors.borderStrong }]}>
            {filtered.map((e, i) => {
              const cancelled = e.status === 'cancelled';
              const where_ = scope === 'property'
                ? [propName(e.propertyId), e.unitId ? `وحدة ${unitNo(e.unitId)}` : ''].filter(Boolean).join(' — ')
                : '';
              return (
                <TouchableOpacity
                  key={e.id}
                  onPress={() => router.push(`/expense/${e.id}` as any)}
                  activeOpacity={0.8}
                  style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: cancelled ? colors.surface : colors.dangerSubtle }]}>
                    <Ionicons name={scope === 'office' ? 'briefcase-outline' : 'receipt-outline'} size={18} color={cancelled ? colors.textMuted : colors.danger} />
                  </View>
                  <View style={styles.rowMain}>
                    <View style={styles.rowLine}>
                      <Text style={[styles.rowTitle, { color: cancelled ? colors.textMuted : colors.text }, cancelled && styles.strike]} numberOfLines={1}>
                        {e.category}{e.vendor ? ` — ${e.vendor}` : ''}
                      </Text>
                      {cancelled && (
                        <View style={[styles.tag, { backgroundColor: colors.dangerSubtle, borderColor: `${colors.danger}55` }]}>
                          <Text style={[styles.tagTxt, { color: colors.danger }]}>ملغي</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.rowSub, { color: colors.textMuted }]} numberOfLines={1}>
                      {[formatDate(e.date), where_, voucherNo(e)].filter(Boolean).join('  ·  ')}
                    </Text>
                  </View>
                  <View style={styles.rowAmt}>
                    <CurrencyText amount={e.amount} currency={e.currency} size={15} color={cancelled ? colors.textMuted : colors.text} />
                    {getCurrency(e.currency).code !== 'SAR' && (
                      <Text style={[styles.curCode, { color: colors.textMuted }]}>{e.currency}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  selects: { flexDirection: 'row', gap: Theme.spacing.sm, marginTop: Theme.spacing.sm },
  summary: { marginTop: Theme.spacing.base, borderWidth: 1, borderRadius: Theme.radius.xl, padding: Theme.spacing.base, gap: Theme.spacing.md },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md },
  summaryLabel: { fontSize: 13, textAlign: 'right', marginBottom: 4 },
  summaryValue: { fontSize: 22, fontWeight: '600', textAlign: 'right' },
  countBox: { borderRadius: Theme.radius.md, paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center' },
  countVal: { fontSize: 20, fontWeight: '600' },
  countLbl: { fontSize: 12 },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, paddingTop: Theme.spacing.md },
  catChip: { flexDirection: 'row', gap: 6, alignItems: 'center', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  catName: { fontSize: 12 },
  catAmt: { fontSize: 13, fontWeight: '600' },
  exportBtn: { alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', borderWidth: 1, borderRadius: Theme.radius.sm, paddingHorizontal: 12, minHeight: 36 },
  exportTxt: { fontSize: 13, fontWeight: '500' },
  list: { marginTop: Theme.spacing.base, borderWidth: 1, borderRadius: Theme.radius.xl, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: Theme.spacing.base },
  rowIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowMain: { flex: 1, gap: 4 },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flexShrink: 1, fontSize: 15, fontWeight: '500', textAlign: 'right' },
  strike: { textDecorationLine: 'line-through' },
  rowSub: { fontSize: 12, textAlign: 'right' },
  rowAmt: { alignItems: 'flex-end', gap: 2 },
  curCode: { fontSize: 11 },
  tag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  tagTxt: { fontSize: 11, fontWeight: '500' },
});
