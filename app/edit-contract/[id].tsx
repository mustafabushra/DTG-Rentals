import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { FormInput } from '../../components/forms/FormInput';
import { FormSelect } from '../../components/forms/FormSelect';
import { FormDatePicker } from '../../components/forms/FormDatePicker';
import { AppHeader } from '../../components/ui/AppHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormContainer } from '../../components/ui/FormContainer';
import { ConfirmModal } from '../../components/ui/Modal';
import { useAppTheme } from '../../hooks/useAppTheme';
import { COUNTRY_CURRENCY_OPTIONS, getCurrency } from '../../utils/currency';

export default function EditContractScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { contracts, updateContract } = useApp();

  const contract = contracts.find(c => c.id === id);

  const [form, setForm] = useState({
    startDate: contract?.startDate || '',
    endDate: contract?.endDate || '',
    annualValue: contract?.annualValue?.toString() || '',
    installmentsCount: contract?.installmentsCount?.toString() || '',
    status: contract?.status || 'active',
    notes: contract?.notes || '',
    currency: contract?.currency || 'SAR',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<any>(null);

  useEffect(() => {
    if (contract) {
      setForm({
        startDate: contract.startDate,
        endDate: contract.endDate,
        annualValue: contract.annualValue?.toString() || '',
        installmentsCount: contract.installmentsCount?.toString() || '',
        status: contract.status || 'active',
        notes: contract.notes || '',
        currency: contract.currency || 'SAR',
      });
    }
  }, [contract?.id]);

  if (!contract) return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="تعديل العقد" />
      <EmptyState icon="document-text-outline" title="العقد غير موجود" />
    </View>
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.startDate) e.startDate = 'تاريخ البداية مطلوب';
    if (!form.endDate) e.endDate = 'تاريخ النهاية مطلوب';
    if (form.endDate && form.startDate && form.endDate <= form.startDate) e.endDate = 'تاريخ النهاية يجب أن يكون بعد البداية';
    if (!form.annualValue || isNaN(Number(form.annualValue))) e.annualValue = 'القيمة السنوية مطلوبة';
    if (!form.installmentsCount || isNaN(Number(form.installmentsCount))) e.installmentsCount = 'عدد الأقساط مطلوب';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const doSave = (data: any) => {
    updateContract(id, data);
    router.back();
  };

  const handleSave = () => {
    if (!validate()) return;
    const newAnnualValue       = Number(form.annualValue);
    const newInstallmentsCount = Number(form.installmentsCount);
    const data = {
      startDate: form.startDate,
      endDate: form.endDate,
      annualValue: newAnnualValue,
      installmentsCount: newInstallmentsCount,
      status: form.status as any,
      notes: form.notes.trim() || undefined,
      currency: form.currency,
    };

    const financialChange =
      newAnnualValue       !== Number(contract.annualValue)       ||
      newInstallmentsCount !== Number(contract.installmentsCount) ||
      form.startDate       !== contract.startDate                 ||
      form.endDate         !== contract.endDate;

    if (financialChange) {
      setPendingData(data);
      setShowConfirm(true);
    } else {
      doSave(data);
    }
  };

  const installmentOptions = ['1', '2', '4', '6', '12', '24'].map(v => ({
    label: v === '1' ? 'قسط واحد' : v === '2' ? 'قسطان' : `${v} أقساط`,
    value: v,
  }));
  const statusOptions = [
    { label: 'نشط', value: 'active' }, { label: 'منتهي', value: 'expired' }, { label: 'ملغي', value: 'cancelled' },
  ];

  const set = (key: string) => (val: string) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تعديل العقد</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <Text style={styles.saveText}>حفظ</Text>
        </TouchableOpacity>
      </View>

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.infoCard, { backgroundColor: colors.accent, borderColor: colors.border }]}>
          <Text style={[styles.infoText, { color: colors.text }]}>رقم العقد: {contract.contractNumber}</Text>
        </View>

        <FormDatePicker label="تاريخ البداية" value={form.startDate} onChange={set('startDate')} required error={errors.startDate} />
        <FormDatePicker label="تاريخ النهاية" value={form.endDate} onChange={set('endDate')} required error={errors.endDate} minDate={form.startDate} />
        <FormSelect label="دولة العقد" value={form.currency} options={COUNTRY_CURRENCY_OPTIONS} onSelect={set('currency')} required />
        <FormInput label={`القيمة السنوية (${getCurrency(form.currency).symbol})`} value={form.annualValue} onChangeText={set('annualValue')} keyboardType="number-pad" required icon="cash-outline" error={errors.annualValue} />
        <FormSelect label="عدد الأقساط" value={form.installmentsCount} options={installmentOptions} onSelect={set('installmentsCount')} required error={errors.installmentsCount} />
        <FormSelect label="حالة العقد" value={form.status} options={statusOptions} onSelect={set('status')} required />
        <FormInput label="ملاحظات (اختياري)" value={form.notes} onChangeText={set('notes')} multiline numberOfLines={3} icon="document-text-outline" />
      </ScrollView></FormContainer>

      <ConfirmModal
        visible={showConfirm}
        onClose={() => { setShowConfirm(false); setPendingData(null); }}
        onConfirm={() => { setShowConfirm(false); doSave(pendingData); }}
        title="إعادة توليد الأقساط"
        message={`سيتم حذف جميع الأقساط المعلقة وإنشاء ${pendingData?.installmentsCount ?? ''} أقساط جديدة بناءً على القيمة الجديدة. الأقساط المدفوعة لن تتأثر.`}
        confirmLabel="تأكيد وحفظ"
        variant="warning"
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
  infoCard: { padding: Theme.spacing.md, borderRadius: Theme.radius.md, borderWidth: 1 },
  infoText: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.medium },
});
