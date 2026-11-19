import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { utils, writeFile } from 'xlsx';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { useFinance } from '../context/FinanceProvider';
import { AppHeader } from '../components/ui/AppHeader';
import { SearchBar } from '../components/ui/SearchBar';
import { FilterBar } from '../components/ui/FilterBar';
import { EmptyState } from '../components/ui/EmptyState';
import { CurrencyText } from '../components/ui/CurrencyText';
import { ListSkeleton } from '../components/ui/Skeleton';
import { FormSelect } from '../components/forms/FormSelect';
import { useAppTheme } from '../hooks/useAppTheme';
import { useScreenSize } from '../hooks/useScreenSize';
import { formatDate } from '../data/mockData';
import { inRange, PAYMENT_METHOD_LABELS, VOUCHER_LABEL } from '../domain/services/FinanceService';
import { PERIOD_OPTIONS, periodRange, type PeriodKey } from '../components/finance/periods';

const TYPE_OPTIONS = [
  { value: 'all',     label: 'الكل' },
  { value: 'receipt', label: 'سندات القبض' },
  { value: 'payment', label: 'سندات الصرف' },
];
const STATUS_OPTIONS = [
  { value: 'issued',    label: 'سارية' },
  { value: 'cancelled', label: 'ملغاة' },
  { value: 'all',       label: 'الكل' },
];

export default function VouchersScreen() {
  const { colors } = useAppTheme();
  const { hPad } = useScreenSize();
  const { properties, dataLoading } = useApp();
  const { vouchers, financeLoading } = useFinance();

  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('issued');
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [propertyId, setPropertyId] = useState('all');
  const { from, to } = periodRange(period);

  const propName = (id?: string) => properties.find(p => p.id === id)?.name ?? '';

  const filtered = useMemo(() => {
    const q = search.trim();
    return vouchers
      .filter(v => type === 'all' || v.type === type)
      .filter(v => status === 'all' || v.status === status)
      .filter(v => period === 'all' || inRange(v.date, from, to))
      .filter(v => propertyId === 'all' || (propertyId === 'office' ? !v.propertyId : v.propertyId === propertyId))
      .filter(v => !q || [v.number, v.partyName, v.description, v.referenceNumber, propName(v.propertyId)]
        .some(x => (x ?? '').includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.seq - a.seq);
  }, [vouchers, type, status, period, from, to, propertyId, search, properties]);

  // المجاميع لكل عملة: قبض / صرف / صافي
  const sums = useMemo(() => {
    const m: Record<string, { in: number; out: number }> = {};
    for (const v of filtered) {
      if (v.status !== 'issued') continue;
      const r = m[v.currency] ?? (m[v.currency] = { in: 0, out: 0 });
      if (v.type === 'receipt') r.in += v.amount; else r.out += v.amount;
    }
    return m;
  }, [filtered]);

  const propOptions = useMemo(() => [
    { value: 'all', label: 'الكل' },
    { value: 'office', label: 'المكتب (بدون عقار)' },
    ...properties.map(p => ({ value: p.id, label: p.name })),
  ], [properties]);

  const exportExcel = () => {
    const rows = filtered.map(v => ({
      'رقم السند': v.number,
      'النوع': VOUCHER_LABEL[v.type],
      'التاريخ': v.date,
      'الطرف': v.partyName,
      'البيان': v.description,
      'العقار': propName(v.propertyId),
      'المبلغ': v.amount,
      'العملة': v.currency,
      'المبلغ كتابةً': v.amountInWords,
      'طريقة الدفع': v.paymentMethod ? PAYMENT_METHOD_LABELS[v.paymentMethod] : '',
      'رقم المرجع': v.referenceNumber ?? '',
      'الحالة': v.status === 'issued' ? 'سارٍ' : 'ملغي',
      'سبب الإلغاء': v.cancelReason ?? '',
      'أصدره': v.issuedBy,
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    (wb as any).Workbook = { Views: [{ RTL: true }] };
    utils.book_append_sheet(wb, ws, 'السندات');
    writeFile(wb, `vouchers_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (dataLoading || (financeLoading && vouchers.length === 0)) return <ListSkeleton count={5} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="السندات" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="ابحث برقم السند أو الاسم أو البيان..." />
        <FilterBar options={TYPE_OPTIONS} value={type} onChange={setType} />
        <FilterBar options={PERIOD_OPTIONS} value={period} onChange={v => setPeriod(v as PeriodKey)} />
        <FilterBar options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        <View style={{ paddingHorizontal: hPad, marginTop: Theme.spacing.sm }}>
          <FormSelect label="العقار" value={propertyId} options={propOptions} onSelect={setPropertyId} />
        </View>

        {/* ── الملخص ── */}
        <View style={[styles.summary, { marginHorizontal: hPad, backgroundColor: colors.card, borderColor: colors.borderStrong }]}>
          {Object.keys(sums).length === 0 ? (
            <Text style={[styles.muted, { color: colors.textMuted }]}>لا توجد سندات سارية في هذه الفترة</Text>
          ) : Object.entries(sums).map(([cur, s]) => (
            <View key={cur} style={styles.sumRow}>
              <View style={styles.sumCell}>
                <Text style={[styles.sumLbl, { color: colors.textMuted }]}>المقبوض</Text>
                <CurrencyText amount={s.in} currency={cur} size={17} color={colors.success} />
              </View>
              <View style={[styles.sumDiv, { backgroundColor: colors.border }]} />
              <View style={styles.sumCell}>
                <Text style={[styles.sumLbl, { color: colors.textMuted }]}>المصروف</Text>
                <CurrencyText amount={s.out} currency={cur} size={17} color={colors.danger} />
              </View>
              <View style={[styles.sumDiv, { backgroundColor: colors.border }]} />
              <View style={styles.sumCell}>
                <Text style={[styles.sumLbl, { color: colors.textMuted }]}>الصافي</Text>
                <CurrencyText amount={s.in - s.out} currency={cur} size={17} color={colors.text} />
              </View>
            </View>
          ))}
          {Platform.OS === 'web' && filtered.length > 0 && (
            <TouchableOpacity onPress={exportExcel} style={[styles.exportBtn, { borderColor: colors.borderStrong }]}>
              <Ionicons name="download-outline" size={16} color={colors.text} />
              <Text style={[styles.exportTxt, { color: colors.text }]}>تصدير Excel</Text>
            </TouchableOpacity>
          )}
        </View>

        {filtered.length === 0 ? (
          <EmptyState icon="documents-outline" title="لا توجد سندات" subtitle="سندات القبض تصدر عند تأكيد استلام الدفعات، وسندات الصرف عند تسجيل المصاريف." />
        ) : (
          <View style={[styles.list, { marginHorizontal: hPad, backgroundColor: colors.card, borderColor: colors.borderStrong }]}>
            {filtered.map((v, i) => {
              const isReceipt = v.type === 'receipt';
              const cancelled = v.status === 'cancelled';
              const tone = cancelled ? colors.textMuted : isReceipt ? colors.success : colors.danger;
              return (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => router.push(`/voucher/${v.id}` as any)}
                  activeOpacity={0.8}
                  style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: cancelled ? colors.surface : isReceipt ? colors.successSubtle : colors.dangerSubtle }]}>
                    <Ionicons name={isReceipt ? 'arrow-down-outline' : 'arrow-up-outline'} size={18} color={tone} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.line}>
                      <Text style={[styles.num, { color: colors.text }]}>{v.number}</Text>
                      <Text style={[styles.typeTxt, { color: colors.textMuted }]}>{VOUCHER_LABEL[v.type]}</Text>
                      {cancelled && (
                        <View style={[styles.tag, { backgroundColor: colors.dangerSubtle, borderColor: `${colors.danger}55` }]}>
                          <Text style={[styles.tagTxt, { color: colors.danger }]}>ملغي</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>{v.partyName} — {v.description}</Text>
                    <Text style={[styles.date, { color: colors.textMuted }]}>{formatDate(v.date)}</Text>
                  </View>
                  <CurrencyText amount={v.amount} currency={v.currency} size={15} color={tone} />
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
  summary: { marginTop: Theme.spacing.base, borderWidth: 1, borderRadius: Theme.radius.xl, padding: Theme.spacing.base, gap: Theme.spacing.md },
  muted: { fontSize: 14, textAlign: 'center' },
  sumRow: { flexDirection: 'row', alignItems: 'center' },
  sumCell: { flex: 1, alignItems: 'center', gap: 4 },
  sumLbl: { fontSize: 12 },
  sumDiv: { width: 1, alignSelf: 'stretch' },
  exportBtn: { alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', borderWidth: 1, borderRadius: Theme.radius.sm, paddingHorizontal: 12, minHeight: 36 },
  exportTxt: { fontSize: 13, fontWeight: '500' },
  list: { marginTop: Theme.spacing.base, borderWidth: 1, borderRadius: Theme.radius.xl, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: Theme.spacing.base },
  rowIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  num: { fontSize: 15, fontWeight: '600' },
  typeTxt: { fontSize: 12 },
  sub: { fontSize: 13, textAlign: 'right' },
  date: { fontSize: 12, textAlign: 'right' },
  tag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  tagTxt: { fontSize: 11, fontWeight: '500' },
});
