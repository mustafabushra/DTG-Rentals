/**
 * نقل مستأجر إلى وحدة أخرى — الحساب معروض قبل الاعتماد.
 *
 * الرصيد يُحسب بالأيام ويظهر مفصّلاً (المدة، المستهلك، المدفوع)، ويبقى **قابلاً
 * للتعديل** لأن الاتفاق مع المستأجر قد يخالف الحساب — والنظام يوثّق السبب ولا
 * يفرض سياسة مالية.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { FormInput } from '../../components/forms/FormInput';
import { FormSelect } from '../../components/forms/FormSelect';
import { FormDatePicker } from '../../components/forms/FormDatePicker';
import { FormContainer } from '../../components/ui/FormContainer';
import { AppHeader } from '../../components/ui/AppHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertModal } from '../../components/ui/Modal';
import { useAppTheme } from '../../hooks/useAppTheme';
import { formatCurrency, formatDate } from '../../data/mockData';
import { TransferService } from '../../domain/services/TransferService';
import { RenewalService } from '../../domain/services/RenewalService';

export default function TransferTenantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { contracts, payments, units, properties, tenants, transferTenant, canWrite } = useApp();

  const contract = contracts.find(c => c.id === id);
  const tenant   = contract ? tenants.find(t => t.id === contract.tenantId) : null;
  const oldUnit  = contract ? units.find(u => u.id === contract.unitId) : null;

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    transferDate: today,
    newUnitId: '',
    newAnnualValue: '',
    newInstallmentsCount: '4',
    newStartDate: today,
    newEndDate: '',
    creditOverride: '',
    creditNote: '',
  });
  const [saving, setSaving] = useState(false);
  const [alert, setAlert]   = useState<{ title: string; message: string; variant: 'info' | 'warning' } | null>(null);

  // الوحدات الشاغرة فقط، باستثناء الوحدة الحالية
  const vacantUnits = useMemo(() => units.filter(u =>
    u.id !== contract?.unitId && !u.currentContractId,
  ), [units, contract?.unitId]);

  const unitOptions = vacantUnits.map(u => ({
    label: `${properties.find(p => p.id === u.propertyId)?.name ?? 'عقار'} — وحدة ${u.number}`,
    value: u.id,
  }));

  const breakdown = useMemo(() => {
    if (!contract) return null;
    return TransferService.computeCredit(
      {
        id: contract.id, tenantId: contract.tenantId, unitId: contract.unitId,
        startDate: contract.startDate, endDate: contract.endDate,
        annualValue: contract.annualValue, installmentsCount: contract.installmentsCount,
      },
      payments, form.transferDate,
    );
  }, [contract, payments, form.transferDate]);

  const overrideNum = form.creditOverride.trim() === '' ? null : Number(form.creditOverride);
  const effectiveCredit = overrideNum !== null && Number.isFinite(overrideNum)
    ? Math.round(overrideNum)
    : (breakdown?.credit ?? 0);
  const newValue = Number(form.newAnnualValue) || 0;
  const netDue   = Math.max(0, newValue - effectiveCredit);

  const set = (key: string) => (val: string) => setForm(f => {
    const next = { ...f, [key]: val };
    // عند اختيار الوحدة: اقترح الإيجار السنوي منها
    if (key === 'newUnitId' && !f.newAnnualValue) {
      const u = units.find(x => x.id === val);
      if (u?.annualRent) next.newAnnualValue = String(u.annualRent);
    }
    // عند تغيير البداية: اقترح نهاية بعد سنة تقويمية
    if ((key === 'newStartDate' || key === 'transferDate') && val) {
      const term = RenewalService.nextTerm(val, val);
      if (!f.newEndDate && term.startDate !== val) next.newEndDate = term.endDate;
    }
    if (key === 'transferDate' && !f.newStartDate) next.newStartDate = val;
    return next;
  });

  if (!contract) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title="نقل المستأجر" />
        <EmptyState icon="swap-horizontal-outline" title="العقد غير موجود" />
      </View>
    );
  }

  const handleSave = async () => {
    if (saving || !canWrite) return;
    setSaving(true);
    const res = await transferTenant({
      contractId: contract.id,
      transferDate: form.transferDate,
      newUnitId: form.newUnitId,
      newAnnualValue: newValue,
      newInstallmentsCount: Number(form.newInstallmentsCount) || 1,
      newStartDate: form.newStartDate,
      newEndDate: form.newEndDate,
      creditOverride: overrideNum,
      creditNote: form.creditNote,
    });
    setSaving(false);
    if (res.ok) {
      setAlert({
        title: 'تم النقل',
        message: `أُنشئ العقد الجديد بمستحق صافٍ ${formatCurrency(res.netDue ?? 0)}. `
               + `دفعات العقد السابق المسدَّدة والمتأخرة بقيت كما هي.`,
        variant: 'info',
      });
    } else {
      setAlert({ title: 'تعذّر النقل', message: res.error ?? 'لم يتغيّر شيء.', variant: 'warning' });
    }
  };

  const closeAlert = () => {
    const wasSuccess = alert?.variant === 'info';
    setAlert(null);
    if (wasSuccess) router.replace(`/contract/${contract.id}`);
  };

  const Row = ({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) => (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[
        styles.rowValue,
        { color: color ?? colors.text },
        strong && styles.rowValueStrong,
      ]}>{value}</Text>
    </View>
  );

  const currency = contract.currency ?? '';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>نقل المستأجر</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={saving}>
          <Text style={styles.saveText}>{saving ? '...' : 'تنفيذ'}</Text>
        </TouchableOpacity>
      </View>

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── العقد الحالي ورصيده ── */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            العقد الحالي — {contract.contractNumber}
          </Text>
          <Text style={[styles.cardSub, { color: colors.textMuted }]}>
            {tenant?.name ?? '—'} · {oldUnit ? `وحدة ${oldUnit.number}` : '—'}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Row label="القيمة السنوية" value={`${formatCurrency(contract.annualValue)} ${currency}`} />
          <Row label="المدة" value={`${formatDate(contract.startDate)} ← ${formatDate(contract.endDate)}`} />
          {breakdown && (
            <>
              <Row label={`المستهلك (${breakdown.consumedDays} يوماً من ${breakdown.termDays})`}
                   value={`${formatCurrency(breakdown.consumedAmount)} ${currency}`} />
              <Row label="المدفوع" value={`${formatCurrency(breakdown.paidTotal)} ${currency}`} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Row label="رصيد لصالح المستأجر" strong color={colors.success}
                   value={`${formatCurrency(breakdown.credit)} ${currency}`} />
              {breakdown.arrears > 0 && (
                <View style={[styles.notice, { backgroundColor: colors.danger + '12', borderColor: colors.danger + '55' }]}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                  <Text style={[styles.noticeText, { color: colors.danger }]}>
                    عليه متأخرات {formatCurrency(breakdown.arrears)} {currency} — تبقى ديناً قائماً ولا تُقاصّ من الرصيد تلقائياً.
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        <FormDatePicker label="تاريخ النقل" value={form.transferDate} onChange={set('transferDate')} required />

        {/* ── الوحدة الجديدة ── */}
        {unitOptions.length === 0 ? (
          <View style={[styles.notice, { backgroundColor: colors.warningSubtle, borderColor: colors.warning }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
            <Text style={[styles.noticeText, { color: colors.warning }]}>
              لا توجد وحدات شاغرة للنقل إليها. أنهِ عقد وحدة أخرى أو أضِف وحدة جديدة أولاً.
            </Text>
          </View>
        ) : (
          <>
            <FormSelect label="الوحدة الجديدة" value={form.newUnitId} options={unitOptions}
                        onSelect={set('newUnitId')} required placeholder="اختر وحدة شاغرة..." />
            <FormInput label={`القيمة السنوية الجديدة (${currency})`} value={form.newAnnualValue}
                       onChangeText={set('newAnnualValue')} keyboardType="number-pad" required icon="cash-outline" />
            <FormSelect label="عدد الأقساط"
                        value={form.newInstallmentsCount}
                        options={['1', '2', '3', '4', '6', '12'].map(v => ({ label: v === '1' ? 'قسط واحد' : `${v} أقساط`, value: v }))}
                        onSelect={set('newInstallmentsCount')} required />
            <FormDatePicker label="بداية العقد الجديد" value={form.newStartDate} onChange={set('newStartDate')} required />
            <FormDatePicker label="نهاية العقد الجديد" value={form.newEndDate} onChange={set('newEndDate')}
                            required minDate={form.newStartDate} />

            {/* ── الرصيد والمستحق ── */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary + '40' }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>الحساب</Text>
              <Row label="القيمة التعاقدية" value={`${formatCurrency(newValue)} ${currency}`} />
              <Row label="يُخصم الرصيد" value={`− ${formatCurrency(effectiveCredit)} ${currency}`} color={colors.success} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Row label="المستحق على المستأجر" strong color={colors.primary}
                   value={`${formatCurrency(netDue)} ${currency}`} />
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                تبقى القيمة التعاقدية {formatCurrency(newValue)} على العقد كما هي؛ الرصيد يُخصم من جدول الأقساط وحده فتظل التقارير صادقة.
              </Text>
            </View>

            <FormInput label={`تعديل الرصيد يدوياً (${currency}) — اختياري`} value={form.creditOverride}
                       onChangeText={set('creditOverride')} keyboardType="number-pad" icon="create-outline"
                       placeholder={`المحسوب: ${breakdown?.credit ?? 0}`} />
            {overrideNum !== null && (
              <FormInput label="سبب تعديل الرصيد" value={form.creditNote} onChangeText={set('creditNote')}
                         placeholder="مثال: اتفاق على خصم شهر إنهاء مبكر" multiline numberOfLines={2}
                         icon="document-text-outline" />
            )}
          </>
        )}
      </ScrollView></FormContainer>

      <AlertModal
        visible={!!alert}
        onClose={closeAlert}
        title={alert?.title ?? ''}
        message={alert?.message ?? ''}
        variant={alert?.variant ?? 'info'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 14, paddingHorizontal: Theme.spacing.base,
  },
  headerTitle: { color: '#FFF', fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },
  backBtn: { padding: 4 },
  saveBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: Theme.radius.full },
  saveText: { color: '#FFF', fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold },
  content: { padding: Theme.spacing.base, gap: Theme.spacing.lg, paddingBottom: 48 },
  card: { padding: Theme.spacing.md, borderRadius: Theme.radius.lg, borderWidth: 1, gap: 2 },
  cardTitle: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  cardSub: { fontSize: Theme.fontSize.sm, textAlign: 'right', marginTop: 2 },
  divider: { height: 1, marginVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3, gap: 10 },
  rowLabel: { fontSize: Theme.fontSize.sm, flex: 1, textAlign: 'right' },
  rowValue: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.medium },
  rowValueStrong: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  hint: { fontSize: Theme.fontSize.xs, textAlign: 'right', lineHeight: 18, marginTop: 8 },
  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: Theme.spacing.md, borderRadius: Theme.radius.md, borderWidth: 1, marginTop: 10,
  },
  noticeText: { flex: 1, fontSize: Theme.fontSize.sm, textAlign: 'right', lineHeight: 20 },
});
