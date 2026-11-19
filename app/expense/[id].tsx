import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { useFinance } from '../../context/FinanceProvider';
import { AppHeader } from '../../components/ui/AppHeader';
import { CurrencyText } from '../../components/ui/CurrencyText';
import { EmptyState } from '../../components/ui/EmptyState';
import { AttachmentPanel } from '../../components/features/AttachmentPanel';
import { ReasonModal } from '../../components/finance/ReasonModal';
import { printVoucher } from '../../components/finance/voucherPrint';
import { useAppTheme } from '../../hooks/useAppTheme';
import { formatDate } from '../../data/mockData';
import { PAYMENT_METHOD_LABELS } from '../../domain/services/FinanceService';
import { getCurrency } from '../../utils/currency';

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const { properties, units, canWrite, canDelete, maintenance } = useApp();
  const { expenses, vouchers, cancelExpense } = useFinance();
  const [showCancel, setShowCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const e = expenses.find(x => x.id === id);
  if (!e) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title="المصروف" />
        <EmptyState icon="alert-circle-outline" title="المصروف غير موجود" subtitle="ربما لم تكتمل مزامنة البيانات بعد." />
      </View>
    );
  }

  const prop = properties.find(p => p.id === e.propertyId);
  const unit = units.find(u => u.id === e.unitId) as any;
  const mReq = maintenance.find(m => m.id === e.maintenanceId);
  const active = vouchers.find(v => v.id === e.voucherId);
  const history = vouchers
    .filter(v => v.expenseId === e.id && v.id !== e.voucherId)
    .sort((a, b) => b.seq - a.seq);
  const cancelled = e.status === 'cancelled';

  const rows: [string, string | undefined][] = [
    ['النطاق', e.scope === 'office' ? 'مصاريف المكتب' : 'مصروف عقار'],
    ['العقار', prop?.name],
    ['الوحدة', unit ? `وحدة ${unit.number ?? ''}` : undefined],
    ['التصنيف', e.category],
    ['التاريخ', formatDate(e.date)],
    ['المورد / الجهة', e.vendor],
    ['طريقة الدفع', e.paymentMethod ? PAYMENT_METHOD_LABELS[e.paymentMethod] : undefined],
    ['رقم المرجع', e.referenceNumber],
    ['العملة', `${getCurrency(e.currency).label} (${e.currency})`],
    ['سجّله', e.createdBy],
    ['ملاحظات', e.notes],
  ];

  const onCancel = async (reason: string) => {
    setBusy(true); setError(null);
    const r = await cancelExpense(e.id, reason);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setShowCancel(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="تفاصيل المصروف"
        rightAction={canWrite && !cancelled ? { icon: 'create-outline', onPress: () => router.push(`/add-expense?id=${e.id}` as any), label: 'تعديل' } : undefined}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.wrap}>
          {/* المبلغ */}
          <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.borderStrong }]}>
            <View style={[styles.heroIcon, { backgroundColor: cancelled ? colors.surface : colors.dangerSubtle }]}>
              <Ionicons name={e.scope === 'office' ? 'briefcase-outline' : 'receipt-outline'} size={24} color={cancelled ? colors.textMuted : colors.danger} />
            </View>
            <Text style={[styles.heroLabel, { color: colors.textMuted }]}>{e.category}</Text>
            <CurrencyText amount={e.amount} currency={e.currency} size={30} color={cancelled ? colors.textMuted : colors.text} />
            <View style={[styles.status, {
              backgroundColor: cancelled ? colors.dangerSubtle : colors.successSubtle,
              borderColor: `${cancelled ? colors.danger : colors.success}55`,
            }]}>
              <Text style={{ color: cancelled ? colors.danger : colors.success, fontSize: 12, fontWeight: '500' }}>
                {cancelled ? 'ملغي' : 'سارٍ'}
              </Text>
            </View>
            {cancelled && (
              <Text style={[styles.cancelNote, { color: colors.danger }]}>
                أُلغي {formatDate(e.cancelledAt?.slice(0, 10))}{e.cancelledBy ? ` بواسطة ${e.cancelledBy}` : ''} — {e.cancelReason}
              </Text>
            )}
          </View>

          {/* سند الصرف */}
          {active && (
            <TouchableOpacity
              onPress={() => router.push(`/voucher/${active.id}` as any)}
              activeOpacity={0.85}
              style={[styles.voucher, { backgroundColor: colors.card, borderColor: colors.borderStrong }]}
            >
              <View style={[styles.vIcon, { backgroundColor: colors.primarySubtle }]}>
                <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.vTitle, { color: colors.text }]}>سند صرف {active.number}</Text>
                <Text style={[styles.vSub, { color: colors.textMuted }]} numberOfLines={1}>{active.amountInWords}</Text>
              </View>
              <TouchableOpacity
                onPress={() => printVoucher(active, { propertyName: prop?.name, unitNumber: unit?.number })}
                style={[styles.printBtn, { borderColor: colors.borderStrong }]}
                hitSlop={8}
              >
                <Ionicons name="print-outline" size={16} color={colors.text} />
                <Text style={[styles.printTxt, { color: colors.text }]}>طباعة</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          {/* التفاصيل */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderStrong }]}>
            {rows.filter(([, v]) => !!v).map(([k, v], i) => (
              <View key={k} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={[styles.k, { color: colors.textMuted }]}>{k}</Text>
                <Text style={[styles.v, { color: colors.text }]}>{v}</Text>
              </View>
            ))}
            {mReq && (
              <TouchableOpacity
                onPress={() => router.push(`/maintenance/${mReq.id}` as any)}
                style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border }]}
              >
                <Text style={[styles.k, { color: colors.textMuted }]}>طلب الصيانة</Text>
                <Text style={[styles.v, { color: colors.primary }]}>{mReq.title}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* سجل السندات السابقة */}
          {history.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderStrong }]}>
              <Text style={[styles.section, { color: colors.text }]}>سندات سابقة لهذا المصروف</Text>
              {history.map(v => (
                <TouchableOpacity key={v.id} onPress={() => router.push(`/voucher/${v.id}` as any)} style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <Text style={[styles.k, { color: colors.textMuted }]}>{v.number}</Text>
                  <Text style={[styles.v, { color: colors.textSecondary }]} numberOfLines={1}>
                    {v.status === 'cancelled' ? `ملغي — ${v.cancelReason ?? ''}` : 'سارٍ'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* المرفقات (الفاتورة) */}
          <AttachmentPanel entityType="expense" entityId={e.id} />

          {canDelete && !cancelled && (
            <TouchableOpacity onPress={() => { setError(null); setShowCancel(true); }} style={[styles.dangerBtn, { borderColor: colors.danger }]}>
              <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
              <Text style={[styles.dangerTxt, { color: colors.danger }]}>إلغاء المصروف وسند الصرف</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <ReasonModal
        visible={showCancel}
        title="إلغاء المصروف"
        message={`سيُلغى المصروف${active ? ` وسند الصرف ${active.number}` : ''}. يبقيان ظاهرين بحالة "ملغي" ولا يُحذفان.`}
        busy={busy}
        error={error}
        onClose={() => setShowCancel(false)}
        onConfirm={onCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Theme.spacing.base, paddingBottom: 48 },
  wrap: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: Theme.spacing.md },
  hero: { borderWidth: 1, borderRadius: Theme.radius.xl, padding: Theme.spacing.xl, alignItems: 'center', gap: 6 },
  heroIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroLabel: { fontSize: 14 },
  status: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 2, marginTop: 4 },
  cancelNote: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  voucher: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: Theme.radius.xl, padding: Theme.spacing.base },
  vIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  vTitle: { fontSize: 15, fontWeight: '600', textAlign: 'right' },
  vSub: { fontSize: 12, textAlign: 'right', marginTop: 2 },
  printBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: Theme.radius.sm, paddingHorizontal: 10, minHeight: 34 },
  printTxt: { fontSize: 13, fontWeight: '500' },
  card: { borderWidth: 1, borderRadius: Theme.radius.xl, paddingHorizontal: Theme.spacing.base },
  section: { fontSize: 15, fontWeight: '600', textAlign: 'right', paddingVertical: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingVertical: 12 },
  k: { fontSize: 14 },
  v: { flex: 1, fontSize: 14, fontWeight: '500', textAlign: 'left' },
  dangerBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: Theme.radius.sm, minHeight: 44 },
  dangerTxt: { fontSize: 15, fontWeight: '500' },
});
