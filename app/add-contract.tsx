import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { FormInput } from '../components/forms/FormInput';
import { FormSelect } from '../components/forms/FormSelect';
import { FormDatePicker } from '../components/forms/FormDatePicker';
import { Contract } from '../data/mockData';
import { FormContainer } from '../components/ui/FormContainer';
import { useAppTheme } from '../hooks/useAppTheme';
import { COUNTRY_CURRENCY_OPTIONS, getCurrency } from '../utils/currency';

export default function AddContractScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { units, tenants, properties, contracts, addContract, systemSettings, externalOwnedUnits } = useApp();

  const [form, setForm] = useState({
    unitId: '', tenantId: '', startDate: '', endDate: '',
    annualValue: '', installmentsCount: '', notes: '', currency: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // عند اختيار الوحدة → نرث عملة العقار تلقائياً
  const selectedUnit = units.find(u => u.id === form.unitId);
  const selectedProperty = selectedUnit ? properties.find(p => p.id === selectedUnit.propertyId) : null;
  const effectiveCurrency = form.currency || selectedProperty?.currency || systemSettings?.currency || 'SAR';
  const currencyMeta = getCurrency(effectiveCurrency);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.unitId) {
      e.unitId = 'الوحدة مطلوبة';
    } else {
      const activeOnUnit = contracts.find(c => c.unitId === form.unitId && c.status === 'active');
      if (activeOnUnit) e.unitId = `الوحدة مؤجرة بالفعل — العقد: ${activeOnUnit.contractNumber}`;
    }
    if (!form.tenantId) e.tenantId = 'المستأجر مطلوب';
    if (!form.startDate) e.startDate = 'تاريخ البداية مطلوب';
    if (!form.endDate) e.endDate = 'تاريخ النهاية مطلوب';
    if (form.startDate && form.endDate && form.endDate <= form.startDate) e.endDate = 'تاريخ النهاية يجب أن يكون بعد البداية';
    if (!form.annualValue || isNaN(Number(form.annualValue)) || Number(form.annualValue) <= 0) e.annualValue = 'القيمة السنوية مطلوبة';
    if (!form.installmentsCount || isNaN(Number(form.installmentsCount)) || Number(form.installmentsCount) < 1) e.installmentsCount = 'عدد الأقساط مطلوب';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const contract: Contract = {
      id:               `c${Date.now()}`,
      contractNumber:   `CNT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      unitId:           form.unitId,
      tenantId:         form.tenantId,
      startDate:        form.startDate,
      endDate:          form.endDate,
      annualValue:      Number(form.annualValue),
      installmentsCount:Number(form.installmentsCount),
      status:           'active',
      currency:         effectiveCurrency,
      notes:            form.notes.trim() || undefined,
      createdAt:        new Date().toISOString().split('T')[0],
    };
    addContract(contract);
    router.back();
  };

  // فلترة الوحدات بالعقود الفعلية — أدق من unit.status الذي قد يكون stale
  const activeContractUnitIds = new Set(contracts.filter(c => c.status === 'active').map(c => c.unitId));
  const vacantUnits = units.filter(u => !activeContractUnitIds.has(u.id));
  const externalUnitNames = new Map(externalOwnedUnits.map(u => [u.id, u.parentPropertyName]));
  const unitOptions = vacantUnits.map(u => {
    const prop = properties.find(p => p.id === u.propertyId);
    const propName = prop?.name ?? externalUnitNames.get(u.id) ?? '';
    const label = u.number === 'رئيسية'
      ? propName
      : propName ? `${propName} — ${u.number}` : u.number;
    return { label, value: u.id };
  });
  const tenantOptions = tenants.map(t => ({ label: t.name, value: t.id }));
  const installmentOptions = ['1', '2', '3', '4', '6', '12', '24'].map(v => {
    const n = Number(v);
    const label = n === 1 ? 'قسط واحد' : n === 2 ? 'قسطان' : `${v} أقساط`;
    return { label, value: v };
  });

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
        <Text style={styles.headerTitle}>إضافة عقد جديد</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <Text style={styles.saveText}>حفظ</Text>
        </TouchableOpacity>
      </View>

      <FormContainer>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FormSelect label="الوحدة" value={form.unitId} options={unitOptions} onSelect={set('unitId')} required placeholder="اختر الوحدة الشاغرة..." error={errors.unitId} />
          <FormSelect label="المستأجر" value={form.tenantId} options={tenantOptions} onSelect={set('tenantId')} required placeholder="اختر المستأجر..." error={errors.tenantId} />
          <FormDatePicker label="تاريخ البداية" value={form.startDate} onChange={set('startDate')} required error={errors.startDate} />
          <FormDatePicker label="تاريخ النهاية" value={form.endDate} onChange={set('endDate')} required error={errors.endDate} minDate={form.startDate} />
          {/* العملة — تُورَث من العقار، قابلة للتغيير */}
          <FormSelect
            label={`دولة العقد${selectedProperty ? ` (مورَّثة من العقار)` : ''}`}
            value={effectiveCurrency}
            options={COUNTRY_CURRENCY_OPTIONS}
            onSelect={set('currency')}
            required
          />
          <FormInput
            label={`القيمة السنوية (${currencyMeta.symbol})`}
            value={form.annualValue}
            onChangeText={set('annualValue')}
            placeholder="مثال: 60000"
            keyboardType="number-pad"
            required
            icon="cash-outline"
            error={errors.annualValue}
          />
          <FormSelect label="عدد الأقساط" value={form.installmentsCount} options={installmentOptions} onSelect={set('installmentsCount')} required placeholder="اختر عدد الأقساط..." error={errors.installmentsCount} />
          <FormInput label="ملاحظات (اختياري)" value={form.notes} onChangeText={set('notes')} placeholder="أي ملاحظات إضافية..." multiline numberOfLines={3} icon="document-text-outline" />
        </ScrollView>
      </FormContainer>
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
});
