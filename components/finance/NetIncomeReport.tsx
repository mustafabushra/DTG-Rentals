import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { utils, writeFile } from 'xlsx';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { useFinance } from '../../context/FinanceProvider';
import { CurrencyText } from '../ui/CurrencyText';
import { useAppTheme } from '../../hooks/useAppTheme';
import { inRange, netByProperty } from '../../domain/services/FinanceService';
import { resolvePaymentCurrency, countryLabel } from '../../utils/currency';

/**
 * تقرير الدخل والمصاريف: لكل عملة (المحصَّل − مصاريف العقارات − مصاريف المكتب = الصافي)
 * ثم جدول صافي الدخل لكل عقار بعملته. لا نجمع عملات مختلفة في رقم واحد.
 */
export function NetIncomeReport({ from, to, currency }: { from: string; to: string; currency: 'all' | string }) {
  const { colors } = useAppTheme();
  const { payments, contracts, units, properties } = useApp();
  const { expenses } = useFinance();

  const rows = useMemo(() => netByProperty({
    payments: payments as any, contracts: contracts as any, units: units as any,
    properties: properties as any, expenses,
  }, from, to).filter(r => currency === 'all' || r.currency === currency), [payments, contracts, units, properties, expenses, from, to, currency]);

  const byCurrency = useMemo(() => {
    const m: Record<string, { income: number; propExp: number; officeExp: number }> = {};
    const get = (c: string) => m[c] ?? (m[c] = { income: 0, propExp: 0, officeExp: 0 });
    for (const p of payments) {
      if (p.status !== 'paid' || !inRange(p.paidDate, from, to)) continue;
      const c = resolvePaymentCurrency(p as any, contracts as any, units as any, properties as any);
      get(c).income += p.amount || 0;
    }
    for (const e of expenses) {
      if (e.status !== 'active' || !inRange(e.date, from, to)) continue;
      if (e.scope === 'office') get(e.currency).officeExp += e.amount || 0;
      else get(e.currency).propExp += e.amount || 0;
    }
    return Object.entries(m).filter(([c]) => currency === 'all' || c === currency);
  }, [payments, contracts, units, properties, expenses, from, to, currency]);

  const exportExcel = () => {
    const wb = utils.book_new();
    (wb as any).Workbook = { Views: [{ RTL: true }, { RTL: true }] };
    utils.book_append_sheet(wb, utils.json_to_sheet(byCurrency.map(([c, s]) => ({
      'الدولة': countryLabel(c), 'العملة': c,
      'المحصَّل': Math.round(s.income), 'مصاريف العقارات': Math.round(s.propExp),
      'مصاريف المكتب': Math.round(s.officeExp), 'الصافي': Math.round(s.income - s.propExp - s.officeExp),
    }))), 'الملخص');
    utils.book_append_sheet(wb, utils.json_to_sheet(rows.map(r => ({
      'العقار': r.propertyName, 'العملة': r.currency,
      'المحصَّل': Math.round(r.income), 'المصاريف': Math.round(r.expenses), 'صافي الدخل': Math.round(r.net),
    }))), 'حسب العقار');
    writeFile(wb, `net_income_${from}_${to}.xlsx`);
  };

  return (
    <View style={{ gap: Theme.spacing.sm }}>
      {byCurrency.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد تحصيلات أو مصاريف في هذه الفترة</Text>
        </View>
      ) : byCurrency.map(([c, s]) => {
        const net = s.income - s.propExp - s.officeExp;
        return (
          <View key={c} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>{countryLabel(c)} — {c}</Text>
            <View style={styles.grid}>
              {[
                { l: 'المحصَّل', v: s.income, col: colors.success },
                { l: 'مصاريف العقارات', v: -s.propExp, col: colors.danger },
                { l: 'مصاريف المكتب', v: -s.officeExp, col: colors.danger },
              ].map(x => (
                <View key={x.l} style={[styles.line, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.lbl, { color: colors.textSecondary }]}>{x.l}</Text>
                  <CurrencyText amount={x.v} currency={c} size={15} color={x.col} />
                </View>
              ))}
              <View style={styles.line}>
                <Text style={[styles.lbl, { color: colors.text, fontWeight: '600' }]}>صافي الدخل</Text>
                <CurrencyText amount={net} currency={c} size={18} color={net < 0 ? colors.danger : colors.text} />
              </View>
            </View>
          </View>
        );
      })}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: colors.text, marginBottom: 0 }]}>صافي الدخل حسب العقار</Text>
          {Platform.OS === 'web' && (rows.length > 0 || byCurrency.length > 0) && (
            <TouchableOpacity onPress={exportExcel} style={[styles.export, { borderColor: colors.borderStrong }]}>
              <Ionicons name="download-outline" size={15} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>Excel</Text>
            </TouchableOpacity>
          )}
        </View>
        {rows.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد بيانات</Text>
        ) : (
          <>
            <View style={[styles.tr, { borderBottomColor: colors.border }]}>
              <Text style={[styles.th, styles.c1, { color: colors.textMuted }]}>العقار</Text>
              <View style={styles.cn}><Text style={[styles.th, { color: colors.textMuted }]}>المحصَّل</Text></View>
              <View style={styles.cn}><Text style={[styles.th, { color: colors.textMuted }]}>المصاريف</Text></View>
              <View style={styles.cn}><Text style={[styles.th, { color: colors.textMuted }]}>الصافي</Text></View>
            </View>
            {rows.map(r => (
              <TouchableOpacity key={r.propertyId} onPress={() => router.push(`/property/${r.propertyId}` as any)} style={[styles.tr, { borderBottomColor: colors.border }]}>
                <Text style={[styles.td, styles.c1, { color: colors.text }]} numberOfLines={1}>{r.propertyName}</Text>
                <View style={styles.cn}><CurrencyText amount={r.income} currency={r.currency} size={13} color={colors.success} /></View>
                <View style={styles.cn}><CurrencyText amount={r.expenses} currency={r.currency} size={13} color={colors.danger} /></View>
                <View style={styles.cn}><CurrencyText amount={r.net} currency={r.currency} size={13} color={r.net < 0 ? colors.danger : colors.text} /></View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: Theme.spacing.base, borderWidth: 1, borderRadius: Theme.radius.xl, padding: Theme.spacing.base },
  title: { fontSize: 15, fontWeight: '600', textAlign: 'right', marginBottom: 8 },
  empty: { textAlign: 'center', paddingVertical: 16, fontSize: 13 },
  grid: { gap: 0 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  lbl: { fontSize: 14 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  export: { flexDirection: 'row', gap: 4, alignItems: 'center', borderWidth: 1, borderRadius: Theme.radius.sm, paddingHorizontal: 10, minHeight: 32 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, gap: 6 },
  th: { fontSize: 12, fontWeight: '500' },
  td: { fontSize: 13, fontWeight: '500' },
  c1: { flex: 1.4, textAlign: 'right' },
  cn: { flex: 1, alignItems: 'flex-end' },
});
