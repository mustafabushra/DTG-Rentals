/**
 * إضافة / تعديل مصروف — نفس الشاشة:
 *   /add-expense?scope=property|office            إضافة
 *   /add-expense?id=exp_...                         تعديل
 *   /add-expense?scope=property&propertyId=..&unitId=..&amount=..&category=..&maintenanceId=..   تعبئة مسبقة (من الصيانة)
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { useFinance } from '../context/FinanceProvider';
import { FormInput } from '../components/forms/FormInput';
import { FormSelect } from '../components/forms/FormSelect';
import { FormDatePicker } from '../components/forms/FormDatePicker';
import { FormContainer } from '../components/ui/FormContainer';
import { useAppTheme } from '../hooks/useAppTheme';
import type { ExpenseScope } from '../domain/models';
import { validateExpense } from '../domain/services/FinanceService';
import { COUNTRY_CURRENCY_OPTIONS } from '../utils/currency';

const NEW_CAT = '__new__';
const METHOD_OPTIONS = [
  { label: 'نقداً', value: 'cash' },
  { label: 'تحويل بنكي', value: 'transfer' },
  { label: 'شيك', value: 'check' },
];

export default function AddExpenseScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{
    id?: string; scope?: string; propertyId?: string; unitId?: string;
    amount?: string; category?: string; vendor?: string; maintenanceId?: string; notes?: string;
  }>();
  const { properties, units, systemSettings, canWrite } = useApp();
  const { expenses, categories, addCategory, addExpense, updateExpense } = useFinance();

  const editing = params.id ? expenses.find(e => e.id === params.id) : undefined;
  const scope: ExpenseScope = editing?.scope ?? (params.scope === 'office' ? 'office' : 'property');

  const currencyFor = (propertyId?: string, unitId?: string) =>
    (units.find(u => u.id === unitId) as any)?.currency
    ?? properties.find(p => p.id === propertyId)?.currency
    ?? systemSettings.currency ?? 'SAR';

  const [form, setForm] = useState(() => ({
    propertyId: editing?.propertyId ?? params.propertyId ?? '',
    unitId: editing?.unitId ?? params.unitId ?? '',
    category: editing?.category ?? params.category ?? '',
    newCategory: '',
    amount: editing ? String(editing.amount) : (params.amount ?? ''),
    currency: editing?.currency ?? currencyFor(params.propertyId, params.unitId),
    date: editing?.date ?? new Date().toISOString().split('T')[0],
    vendor: editing?.vendor ?? params.vendor ?? '',
    paymentMethod: editing?.paymentMethod ?? 'transfer',
    referenceNumber: editing?.referenceNumber ?? '',
    notes: editing?.notes ?? params.notes ?? '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const catOptions = useMemo(() => {
    const list = categories(scope);
    const withCurrent = form.category && !list.includes(form.category) ? [form.category, ...list] : list;
    return [...withCurrent.map(c => ({ label: c, value: c })), { label: '+ تصنيف جديد...', value: NEW_CAT }];
  }, [categories, scope, form.category]);

  const propertyOptions = properties.map(p => ({ label: p.name, value: p.id }));
  const unitOptions = [
    { label: 'العقار كاملاً (بدون وحدة)', value: '' },
    ...units.filter(u => u.propertyId === form.propertyId)
      .map(u => ({ label: `وحدة ${(u as any).number ?? ''}`, value: u.id })),
  ];

  const set = (key: keyof typeof form) => (val: string) => {
    setForm(f => {
      const next = { ...f, [key]: val };
      if (key === 'propertyId') { next.unitId = ''; next.currency = currencyFor(val); }
      if (key === 'unitId') next.currency = currencyFor(f.propertyId, val);
      return next;
    });
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
    setSaveError(null);
  };

  const handleSave = async () => {
    if (saving) return;
    const category = form.category === NEW_CAT ? form.newCategory.trim() : form.category;
    const amount = Number(String(form.amount).replace(/,/g, '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
    const payload = {
      scope,
      propertyId: scope === 'property' ? form.propertyId || undefined : undefined,
      unitId: scope === 'property' ? form.unitId || undefined : undefined,
      category,
      amount,
      currency: form.currency,
      date: form.date,
      vendor: form.vendor.trim() || undefined,
      paymentMethod: form.paymentMethod as any,
      referenceNumber: form.referenceNumber.trim() || undefined,
      notes: form.notes.trim() || undefined,
      maintenanceId: editing?.maintenanceId ?? params.maintenanceId ?? undefined,
    };
    const errs = validateExpense(payload);
    if (form.category === NEW_CAT && !form.newCategory.trim()) errs.category = 'اكتب اسم التصنيف الجديد';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    if (form.category === NEW_CAT) await addCategory(scope, category);
    const res = editing
      ? await updateExpense(editing.id, payload)
      : await addExpense(payload);
    setSaving(false);
    if (!res.ok) { setSaveError(res.error); return; }
    if (editing) router.back();
    else router.replace(`/expense/${(res.value as any)?.id}` as any);
  };

  if (!canWrite) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>ليست لديك صلاحية إضافة مصاريف.</Text>
      </View>
    );
  }

  const title = editing ? 'تعديل المصروف' : scope === 'office' ? 'مصروف مكتب جديد' : 'مصروف عقار جديد';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="إغلاق">
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}>
          {saving
            ? <ActivityIndicator size="small" color={colors.textInverse} />
            : <Text style={[styles.saveText, { color: colors.textInverse }]}>حفظ</Text>}
        </TouchableOpacity>
      </View>

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.note, { backgroundColor: colors.infoSubtle, borderColor: `${colors.info}40` }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.info} />
          <Text style={[styles.noteText, { color: colors.info }]}>
            {editing
              ? 'تعديل المبلغ أو التاريخ أو الجهة يلغي سند الصرف الحالي ويصدر سنداً بديلاً برقم جديد.'
              : 'يصدر سند صرف برقم تسلسلي تلقائياً عند الحفظ.'}
          </Text>
        </View>

        {scope === 'property' && (
          <>
            <FormSelect label="العقار" value={form.propertyId} options={propertyOptions} onSelect={set('propertyId')} required placeholder="اختر العقار..." error={errors.propertyId} />
            {!!form.propertyId && unitOptions.length > 1 && (
              <FormSelect label="الوحدة (اختياري)" value={form.unitId} options={unitOptions} onSelect={set('unitId')} placeholder="العقار كاملاً" />
            )}
          </>
        )}

        <FormSelect label="التصنيف" value={form.category} options={catOptions} onSelect={set('category')} required placeholder="اختر التصنيف..." error={form.category === NEW_CAT ? undefined : errors.category} />
        {form.category === NEW_CAT && (
          <FormInput label="اسم التصنيف الجديد" value={form.newCategory} onChangeText={set('newCategory')} placeholder="مثال: صيانة المصاعد" required icon="pricetag-outline" error={errors.category} />
        )}

        <View style={styles.row2}>
          <View style={{ flex: 3 }}>
            <FormInput label="المبلغ" value={form.amount} onChangeText={set('amount')} placeholder="0" keyboardType="decimal-pad" required icon="cash-outline" error={errors.amount} />
          </View>
          <View style={{ flex: 2 }}>
            <FormSelect label="العملة" value={form.currency} options={COUNTRY_CURRENCY_OPTIONS.map(o => ({ label: o.value, value: o.value }))} onSelect={set('currency')} required error={errors.currency} />
          </View>
        </View>

        <FormDatePicker label="تاريخ الصرف" value={form.date} onChange={set('date')} required error={errors.date} />
        <FormInput label="المورد / الجهة المستفيدة" value={form.vendor} onChangeText={set('vendor')} placeholder="مثال: شركة الكهرباء، فني الصيانة..." icon="storefront-outline" />
        <FormSelect label="طريقة الدفع" value={form.paymentMethod} options={METHOD_OPTIONS} onSelect={set('paymentMethod')} />
        <FormInput label="رقم المرجع / الفاتورة / الشيك" value={form.referenceNumber} onChangeText={set('referenceNumber')} placeholder="اختياري" icon="document-text-outline" />
        <FormInput label="ملاحظات" value={form.notes} onChangeText={set('notes')} placeholder="اختياري" multiline numberOfLines={3} icon="create-outline" />

        {!!saveError && (
          <View style={[styles.note, { backgroundColor: colors.dangerSubtle, borderColor: `${colors.danger}40` }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={[styles.noteText, { color: colors.danger }]}>{saveError}</Text>
          </View>
        )}
      </ScrollView></FormContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, paddingHorizontal: Theme.spacing.base },
  headerTitle: { fontSize: 18, fontWeight: '600'},
  backBtn: { padding: 4 },
  saveBtn: { paddingHorizontal: 16, minHeight: 36, minWidth: 64, alignItems: 'center', justifyContent: 'center', borderRadius: Theme.radius.sm },
  saveText: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.medium },
  content: { padding: Theme.spacing.base, gap: Theme.spacing.lg, paddingBottom: 48 },
  row2: { flexDirection: 'row', gap: Theme.spacing.sm, alignItems: 'flex-start' },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderWidth: 1, borderRadius: Theme.radius.sm, padding: 12 },
  noteText: { flex: 1, fontSize: 13, lineHeight: 20, textAlign: 'right' },
});
