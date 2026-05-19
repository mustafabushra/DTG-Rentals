import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { FormInput } from '../components/forms/FormInput';
import { FormSelect } from '../components/forms/FormSelect';
import { FormDatePicker } from '../components/forms/FormDatePicker';
import { Payment, formatCurrency } from '../data/mockData';
import { FormContainer } from '../components/ui/FormContainer';
import { CurrencyText } from '../components/ui/CurrencyText';
import { useAppTheme } from '../hooks/useAppTheme';
import { getCurrency, resolvePaymentCurrency } from '../utils/currency';

export default function RecordPaymentScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { contracts, payments, tenants, units, properties, updatePayment } = useApp();
  const { contractId: preselectedContractId } = useLocalSearchParams<{ contractId?: string }>();

  const [form, setForm] = useState({
    contractId: preselectedContractId ?? '', installmentId: '', paidDate: new Date().toISOString().split('T')[0],
    method: '', referenceNumber: '', notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const activeContracts = contracts.filter(c => c.status === 'active');
  const contractOptions = activeContracts.map(c => {
    const tenant = tenants.find(t => t.id === c.tenantId);
    const unit = units.find(u => u.id === c.unitId);
    return { label: `${c.contractNumber} — ${tenant?.name || ''} (وحدة ${unit?.number || ''})`, value: c.id };
  });

  const pendingInstallments = useMemo(() => {
    if (!form.contractId) return [];
    return payments.filter(p => p.contractId === form.contractId && p.status !== 'paid');
  }, [form.contractId, payments]);

  const installmentOptions = pendingInstallments.map(p => {
    const cur = resolvePaymentCurrency(p, contracts, units, properties);
    const sym = getCurrency(cur).symbol;
    return {
      label: `القسط ${p.installmentNumber} — ${formatCurrency(p.amount)} ${sym} (${p.dueDate})`,
      value: p.id,
    };
  });

  const selectedInstallment = pendingInstallments.find(p => p.id === form.installmentId);

  const methodOptions = [
    { label: 'تحويل بنكي', value: 'transfer' },
    { label: 'نقداً', value: 'cash' },
    { label: 'شيك', value: 'check' },
  ];

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.contractId) e.contractId = 'العقد مطلوب';
    if (!form.installmentId) e.installmentId = 'القسط مطلوب';
    if (!form.paidDate) e.paidDate = 'تاريخ الدفع مطلوب';
    if (!form.method) e.method = 'طريقة الدفع مطلوبة';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    updatePayment(form.installmentId, {
      status: 'paid',
      paidDate: form.paidDate,
      method: form.method as any,
      referenceNumber: form.referenceNumber.trim() || undefined,
      notes: form.notes.trim() || undefined,
      receiptNumber: `RCP-${String(Date.now()).slice(-4)}`,
    });
    router.back();
  };

  const set = (key: string) => (val: string) => {
    setForm(f => {
      const updated = { ...f, [key]: val };
      if (key === 'contractId') updated.installmentId = '';
      return updated;
    });
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تسجيل دفعة</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <Text style={styles.saveText}>تسجيل</Text>
        </TouchableOpacity>
      </View>

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FormSelect
          label="العقد"
          value={form.contractId}
          options={contractOptions}
          onSelect={set('contractId')}
          required
          placeholder="اختر العقد..."
          error={errors.contractId}
        />

        {form.contractId && (
          <FormSelect
            label="القسط المستحق"
            value={form.installmentId}
            options={installmentOptions}
            onSelect={set('installmentId')}
            required
            placeholder={pendingInstallments.length > 0 ? 'اختر القسط...' : 'لا توجد أقساط مستحقة'}
            error={errors.installmentId}
          />
        )}

        {selectedInstallment && (
          <View style={[styles.amountCard, { backgroundColor: colors.success + '15', borderColor: colors.success }]}>
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>المبلغ المستحق</Text>
            <CurrencyText amount={selectedInstallment.amount} currency={resolvePaymentCurrency(selectedInstallment, contracts, units, properties)} color={colors.success} size={32} />
          </View>
        )}

        <FormDatePicker label="تاريخ الدفع" value={form.paidDate} onChange={set('paidDate')} required error={errors.paidDate} />
        <FormSelect label="طريقة الدفع" value={form.method} options={methodOptions} onSelect={set('method')} required placeholder="اختر الطريقة..." error={errors.method} />
        <FormInput label="رقم المرجع (اختياري)" value={form.referenceNumber} onChangeText={set('referenceNumber')} placeholder="رقم التحويل أو رقم الشيك" icon="barcode-outline" />
        <FormInput label="ملاحظات (اختياري)" value={form.notes} onChangeText={set('notes')} placeholder="أي ملاحظات..." multiline numberOfLines={3} icon="document-text-outline" />
      </ScrollView></FormContainer>
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
  amountCard: { borderRadius: Theme.radius.lg, borderWidth: 1, padding: Theme.spacing.lg, alignItems: 'center', gap: 4 },
  amountLabel: { fontSize: Theme.fontSize.md, textAlign: 'right' },
  amountValue: { fontSize: 36, fontWeight: '800' },
});
