/**
 * كشف المالك — "الدخل والمصاريف" بلغة بسيطة:
 * كم دخل، كم صُرف، وكم بقي؛ لكل عقار، ثم حصة المالك في كل وحدة حسب سند الملكية إن وُجد.
 * عملات مختلفة لا تُجمع في رقم واحد.
 */
import { PageHint } from '../components/ui/PageHint';
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';
import { buildOwnerStatement, statementMessage } from '../domain/services/OwnerStatementService';
import { buildStatementHTML, printStatement } from '../components/finance/statementPrint';
import { CollectionService } from '../domain/services/CollectionService';
import { getCurrency } from '../utils/currency';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppHeader } from '../components/ui/AppHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { CurrencyText } from '../components/ui/CurrencyText';
import { useApp } from '../context/AppProvider';
import { useFinance } from '../context/FinanceProvider';
import { useAppTheme } from '../hooks/useAppTheme';
import { netByProperty, netByUnit, ownerShareOf } from '../domain/services/FinanceService';
import { shareLabel } from '../domain/services/DeedService';
import { PERIOD_OPTIONS, PeriodKey, periodRange } from '../components/finance/periods';

export default function OwnerStatementScreen() {
  const { colors } = useAppTheme();
  const { payments, contracts, units, properties: allProperties, tenants, owners, currentUser, previewing, previewOwnerId } = useApp() as any;
  const { expenses } = useFinance();
  const params = useLocalSearchParams<{ ownerId?: string }>();
  // الموظف يفتح كشف مالك محدد (?ownerId=) ؛ المالك يشوف كشفه هو
  const staffOwnerId = !previewing && !currentUser?.ownerId ? params.ownerId : undefined;
  const [period, setPeriod] = useState<PeriodKey>(staffOwnerId ? 'last_month' : 'year');
  const { from, to } = periodRange(period);
  const ownerId: string | undefined = staffOwnerId ?? (previewing ? previewOwnerId : currentUser?.ownerId);
  const owner = (owners as any[]).find(o => o.id === ownerId);
  const properties = useMemo(() => staffOwnerId
    ? (allProperties as any[]).filter(p => p.ownerId === staffOwnerId || owner?.propertyIds?.includes(p.id))
    : allProperties, [allProperties, staffOwnerId, owner]);

  const src = useMemo(() => ({ payments, contracts, units, properties, expenses: expenses.filter(e => e.scope === 'property') }),
    [payments, contracts, units, properties, expenses]);

  const periodLabel = PERIOD_OPTIONS.find(o => o.value === period)?.label ?? '';
  const statement = useMemo(() => buildOwnerStatement(
    { payments, contracts, units, properties, tenants, expenses } as any,
    { propertyIds: (properties as any[]).map(p => p.id), from, to, today: new Date().toISOString().split('T')[0] },
  ), [payments, contracts, units, properties, tenants, expenses, from, to]);
  const ownerName = owner?.name ?? currentUser?.name ?? 'المالك';
  const openPdf = () => printStatement(buildStatementHTML(statement, { ownerName, periodLabel, from, to }));
  const sendWhatsApp = () => {
    const msg = statementMessage(ownerName, periodLabel, statement, (n, c) => `${n.toLocaleString('en-US')} ${getCurrency(c).code}`);
    const phone = owner?.phone ? CollectionService.normalizePhone(owner.phone, statement.totals[0]?.currency) : null;
    Linking.openURL(phone ? CollectionService.whatsappUrl(phone, msg) : `https://wa.me/?text=${encodeURIComponent(msg)}`);
  };

  const rows = useMemo(() => netByProperty(src as any, from, to), [src, from, to]);

  const totals = useMemo(() => {
    const m: Record<string, { income: number; expenses: number; net: number }> = {};
    for (const r of rows) {
      const t = m[r.currency] ?? (m[r.currency] = { income: 0, expenses: 0, net: 0 });
      t.income += r.income; t.expenses += r.expenses; t.net += r.net;
    }
    return Object.entries(m);
  }, [rows]);

  // حصص المالك في سندات الملكية
  const shares = useMemo(() => {
    if (!ownerId) return [];
    const byUnit = netByUnit(src as any, from, to);
    return (units as any[])
      .map(u => ({ u, s: u.titleDeed?.owners?.find((o: any) => o.ownerId === ownerId) }))
      .filter(x => x.s)
      .map(({ u, s }) => {
        const n = byUnit.get(u.id) ?? { income: 0, expenses: 0, net: 0 };
        const p = (properties as any[]).find(pp => pp.id === u.propertyId);
        return { unit: u, property: p, percent: s.sharePercent as number, net: n.net, share: ownerShareOf(n.net, s.sharePercent) };
      });
  }, [ownerId, src, units, properties, from, to]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={staffOwnerId ? `كشف حساب ${ownerName}` : 'الدخل والمصاريف'} showBack={!!staffOwnerId} />
      <PageHint text={staffOwnerId
        ? 'اختر الفترة، وبعدها افتح الكشف PDF أو أرسل الملخص للمالك بالواتساب.'
        : 'كم انحصّل من إيجاراتك، كم انصرف على عقاراتك، وكم بقي لك.'} />
      <FilterBar options={PERIOD_OPTIONS} value={period} onChange={v => setPeriod(v as PeriodKey)} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={openPdf} style={[styles.bigBtn, { backgroundColor: colors.primary }]}>
            <Ionicons name="document-text-outline" size={18} color={colors.textInverse} />
            <Text style={[styles.bigBtnText, { color: colors.textInverse }]}>الكشف PDF</Text>
          </TouchableOpacity>
          {staffOwnerId && (
            <TouchableOpacity onPress={sendWhatsApp} style={[styles.bigBtn, { backgroundColor: '#25D36614', borderWidth: 1, borderColor: '#25D366' }]}>
              <Ionicons name="logo-whatsapp" size={18} color="#1DA851" />
              <Text style={[styles.bigBtnText, { color: '#1DA851' }]}>أرسل للمالك</Text>
            </TouchableOpacity>
          )}
        </View>
        {totals.length === 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center', paddingVertical: 32 }]}>
            <Ionicons name="stats-chart-outline" size={28} color={colors.textMuted} />
            <Text style={[styles.empty, { color: colors.textSecondary }]}>لا يوجد دخل أو مصاريف في هذه الفترة.</Text>
          </View>
        )}

        {totals.map(([cur, t]) => (
          <View key={cur} style={[styles.summary, { backgroundColor: colors.primary }]}>
            <Text style={styles.sumLabel}>المتبقي لك بعد المصاريف</Text>
            <CurrencyText amount={t.net} currency={cur} size={30} color="#FFFFFF" />
            <View style={styles.sumRow}>
              <View style={styles.sumCell}>
                <Text style={styles.sumSmall}>الإيجار المحصَّل</Text>
                <CurrencyText amount={t.income} currency={cur} size={16} color="#FFFFFF" />
              </View>
              <View style={[styles.sumDivider]} />
              <View style={styles.sumCell}>
                <Text style={styles.sumSmall}>المصاريف</Text>
                <CurrencyText amount={t.expenses} currency={cur} size={16} color="#FFFFFF" />
              </View>
            </View>
          </View>
        ))}

        {rows.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>حسب العقار</Text>
            {rows.map((r, i) => (
              <TouchableOpacity
                key={r.propertyId}
                onPress={() => router.push(`/property/${r.propertyId}` as any)}
                style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{r.propertyName}</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Text style={[styles.rowSub, { color: colors.textMuted }]}>دخل </Text>
                    <CurrencyText amount={r.income} currency={r.currency} size={12} color={colors.textSecondary} />
                    <Text style={[styles.rowSub, { color: colors.textMuted }]}>مصاريف </Text>
                    <CurrencyText amount={r.expenses} currency={r.currency} size={12} color={colors.textSecondary} />
                  </View>
                </View>
                <CurrencyText amount={r.net} currency={r.currency} size={15} color={r.net < 0 ? colors.danger : colors.text} />
                <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {shares.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>حصتك حسب سند الملكية</Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>صافي الوحدة × نسبتك في السند. مصاريف العقار العامة غير موزعة هنا.</Text>
            {shares.map(({ unit, property, percent, share }, i) => (
              <TouchableOpacity
                key={unit.id}
                onPress={() => router.push(`/unit/${unit.id}` as any)}
                style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{property?.name ?? 'عقار'}، وحدة {unit.number}</Text>
                  <Text style={[styles.rowSub, { color: colors.textMuted }]}>نسبتك {shareLabel(percent)}</Text>
                </View>
                <CurrencyText amount={share} currency={property?.currency} size={15} color={colors.text} />
                <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40, width: '100%', maxWidth: 820, alignSelf: 'center' },
  summary: { borderRadius: 14, padding: 20, gap: 6 },
  sumLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'right' },
  sumRow: { flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  sumCell: { flex: 1, gap: 4 },
  sumDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 12 },
  sumSmall: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'right' },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 4 },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'right', marginBottom: 4 },
  hint: { fontSize: 12, textAlign: 'right', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rowName: { fontSize: 14, fontWeight: '500', textAlign: 'right' },
  rowSub: { fontSize: 12, textAlign: 'right' },
  empty: { fontSize: 14, marginTop: 8 },
  bigBtn: { flex: 1, height: 46, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bigBtnText: { fontSize: 14, fontWeight: '600' },
});
