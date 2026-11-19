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
import { ReasonModal } from '../../components/finance/ReasonModal';
import { printVoucher } from '../../components/finance/voucherPrint';
import { useAppTheme } from '../../hooks/useAppTheme';
import { formatDate } from '../../data/mockData';
import { PAYMENT_METHOD_LABELS, VOUCHER_LABEL } from '../../domain/services/FinanceService';

export default function VoucherDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const { properties, units, canDelete } = useApp();
  const { vouchers, cancelVoucher } = useFinance();
  const [showCancel, setShowCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const v = vouchers.find(x => x.id === id);
  if (!v) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title="السند" />
        <EmptyState icon="alert-circle-outline" title="السند غير موجود" />
      </View>
    );
  }

  const isReceipt = v.type === 'receipt';
  const cancelled = v.status === 'cancelled';
  const tone = isReceipt ? colors.success : colors.danger;
  const prop = properties.find(p => p.id === v.propertyId);
  const unit = units.find(u => u.id === v.unitId) as any;
  const extra = { propertyName: prop?.name, unitNumber: unit?.number };

  const rows: [string, string | undefined][] = [
    [isReceipt ? 'استلمنا من' : 'صرفنا إلى', v.partyName],
    ['وذلك عن', v.description],
    ['التاريخ', formatDate(v.date)],
    ['طريقة الدفع', v.paymentMethod ? PAYMENT_METHOD_LABELS[v.paymentMethod] : undefined],
    ['رقم المرجع', v.referenceNumber],
    ['العقار', prop?.name],
    ['الوحدة', unit ? `وحدة ${unit.number ?? ''}` : undefined],
    ['أصدره', v.issuedBy],
  ];

  const onCancel = async (reason: string) => {
    setBusy(true); setError(null);
    const r = await cancelVoucher(v.id, reason);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setShowCancel(false);
  };

  const source = v.paymentId
    ? { label: 'عرض الدفعة', route: `/payment/${v.paymentId}` }
    : v.expenseId ? { label: 'عرض المصروف', route: `/expense/${v.expenseId}` } : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={`${VOUCHER_LABEL[v.type]} ${v.number}`} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.wrap}>
          <View style={[styles.doc, { backgroundColor: colors.card, borderColor: colors.borderStrong }]}>
            <View style={[styles.bar, { backgroundColor: cancelled ? colors.textMuted : tone }]} />
            <View style={styles.docHead}>
              <View>
                <Text style={[styles.docType, { color: cancelled ? colors.textMuted : tone }]}>{VOUCHER_LABEL[v.type]}</Text>
                <Text style={[styles.docNum, { color: colors.text }]}>{v.number}</Text>
              </View>
              <View style={[styles.status, {
                backgroundColor: cancelled ? colors.dangerSubtle : colors.successSubtle,
                borderColor: `${cancelled ? colors.danger : colors.success}55`,
              }]}>
                <Text style={{ color: cancelled ? colors.danger : colors.success, fontSize: 12, fontWeight: '500' }}>{cancelled ? 'ملغي' : 'سارٍ'}</Text>
              </View>
            </View>

            <View style={[styles.amountBox, { backgroundColor: isReceipt ? colors.successSubtle : colors.dangerSubtle }]}>
              <CurrencyText amount={v.amount} currency={v.currency} size={30} color={cancelled ? colors.textMuted : colors.text} />
              <Text style={[styles.words, { color: colors.textSecondary }]}>{v.amountInWords}</Text>
            </View>

            {rows.filter(([, x]) => !!x).map(([k, x]) => (
              <View key={k} style={[styles.row, { borderTopColor: colors.border }]}>
                <Text style={[styles.k, { color: colors.textMuted }]}>{k}</Text>
                <Text style={[styles.v, { color: colors.text }]}>{x}</Text>
              </View>
            ))}

            {cancelled && (
              <View style={[styles.voidNote, { backgroundColor: colors.dangerSubtle, borderColor: `${colors.danger}40` }]}>
                <Text style={{ color: colors.danger, fontSize: 13, lineHeight: 20, textAlign: 'right' }}>
                  أُلغي {formatDate(v.cancelledAt?.slice(0, 10))}{v.cancelledBy ? ` بواسطة ${v.cancelledBy}` : ''} — السبب: {v.cancelReason ?? '—'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={() => printVoucher(v, extra)} style={[styles.btn, { backgroundColor: colors.primary }]}>
              <Ionicons name="print-outline" size={18} color={colors.textInverse} />
              <Text style={[styles.btnTxt, { color: colors.textInverse }]}>طباعة / PDF</Text>
            </TouchableOpacity>
            {source && (
              <TouchableOpacity onPress={() => router.push(source.route as any)} style={[styles.btn, { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.card }]}>
                <Text style={[styles.btnTxt, { color: colors.text }]}>{source.label}</Text>
              </TouchableOpacity>
            )}
          </View>

          {canDelete && !cancelled && (
            <TouchableOpacity onPress={() => { setError(null); setShowCancel(true); }} style={[styles.dangerBtn, { borderColor: colors.danger }]}>
              <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
              <Text style={[styles.dangerTxt, { color: colors.danger }]}>
                {v.type === 'payment' ? 'إلغاء السند والمصروف' : 'إلغاء السند'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <ReasonModal
        visible={showCancel}
        title={`إلغاء ${VOUCHER_LABEL[v.type]} ${v.number}`}
        message={v.type === 'payment'
          ? 'سند الصرف مرتبط بمصروف، فسيُلغى المصروف معه. لا يُحذف شيء، ويبقى الرقم محجوزاً.'
          : 'يبقى السند ظاهراً بحالة "ملغي" ولا يُعاد استخدام رقمه. الدفعة نفسها لا تتغيّر.'}
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
  wrap: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: Theme.spacing.md },
  doc: { borderWidth: 1, borderRadius: Theme.radius.xl, overflow: 'hidden', paddingBottom: 8 },
  bar: { height: 6 },
  docHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Theme.spacing.base },
  docType: { fontSize: 14, fontWeight: '600', textAlign: 'right' },
  docNum: { fontSize: 22, fontWeight: '700', textAlign: 'right' },
  status: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 2 },
  amountBox: { marginHorizontal: Theme.spacing.base, borderRadius: Theme.radius.md, padding: Theme.spacing.base, alignItems: 'center', gap: 6, marginBottom: 8 },
  words: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 12, marginHorizontal: Theme.spacing.base, borderTopWidth: 1 },
  k: { fontSize: 14 },
  v: { flex: 1, fontSize: 14, fontWeight: '500', textAlign: 'left', lineHeight: 21 },
  voidNote: { margin: Theme.spacing.base, marginBottom: 4, borderWidth: 1, borderRadius: Theme.radius.sm, padding: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: Theme.radius.sm, minHeight: 44 },
  btnTxt: { fontSize: 15, fontWeight: '500' },
  dangerBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: Theme.radius.sm, minHeight: 44 },
  dangerTxt: { fontSize: 15, fontWeight: '500' },
});
