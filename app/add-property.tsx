import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { FormInput } from '../components/forms/FormInput';
import { FormSelect } from '../components/forms/FormSelect';
import { Property, PropertyType, UnitStructure, defaultUnitStructure } from '../data/mockData';
import { FormContainer } from '../components/ui/FormContainer';
import { sanitizeText, sanitizeDescription, sanitizeNumber } from '../utils/sanitize';
import { validateRequired, validatePositiveNumber } from '../utils/validation';
import { useAppTheme } from '../hooks/useAppTheme';
import { CURRENCY_OPTIONS } from '../utils/currency';

export default function AddPropertyScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { owners, cities, addProperty, systemSettings } = useApp();

  const [form, setForm] = useState({
    name: '', type: '' as PropertyType | '', location: '', floors: '',
    ownerId: '', description: '', currency: systemSettings?.currency ?? 'SAR',
    deedNumber: '', area: '', unitStructure: '' as UnitStructure | '',
    cityId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    const r1 = validateRequired(form.name, 'اسم العقار');
    if (!r1.valid) e.name = r1.error!;
    if (!form.type) e.type = 'نوع العقار مطلوب';
    const r2 = validateRequired(form.location, 'الموقع');
    if (!r2.valid) e.location = r2.error!;
    const r3 = validatePositiveNumber(form.floors, 'عدد الطوابق');
    if (!r3.valid) e.floors = r3.error!;
    if (!form.ownerId) e.ownerId = 'المالك مطلوب';
    if (!form.cityId) e.cityId = 'المدينة مطلوبة';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const property: Property = {
      id:          `p${Date.now()}`,
      name:        sanitizeText(form.name),
      type:        form.type as PropertyType,
      location:    sanitizeText(form.location),
      cityId:      form.cityId || undefined,
      floors:      Number(sanitizeNumber(form.floors)),
      totalUnits:  0,
      ownerId:     form.ownerId,
      status:      'active',
      description:   sanitizeDescription(form.description),
      currency:      form.currency,
      deedNumber:    form.deedNumber.trim() || undefined,
      area:          form.area ? Number(sanitizeNumber(form.area)) : undefined,
      unitStructure: effectiveStructure,
      createdAt:     new Date().toISOString().split('T')[0],
    };
    addProperty(property);
    router.back();
  };

  const ownerOptions = owners.map(o => ({ label: o.name, value: o.id }));
  const cityOptions = [
    { label: 'اختر المدينة...', value: '' },
    ...cities.map(c => ({ label: c.displayName || c.name, value: c.id })),
  ];
  const typeOptions = [
    { label: 'شقة', value: 'apartment' }, { label: 'فيلا', value: 'villa' },
    { label: 'مبنى', value: 'building' }, { label: 'برج', value: 'tower' },
    { label: 'مكتب', value: 'office' },   { label: 'محل', value: 'shop' },
    { label: 'أرض', value: 'land' },
  ];

  const set = (key: string) => (val: string) => {
    setForm(f => {
      const updated = { ...f, [key]: val };
      // عند تغيير النوع → نحدد unitStructure تلقائياً إذا لم يختره المستخدم يدوياً
      if (key === 'type' && val) {
        updated.unitStructure = defaultUnitStructure(val as PropertyType);
      }
      return updated;
    });
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  const effectiveStructure: UnitStructure =
    (form.unitStructure as UnitStructure) ||
    (form.type ? defaultUnitStructure(form.type as PropertyType) : 'multi');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إضافة عقار جديد</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <Text style={styles.saveText}>حفظ</Text>
        </TouchableOpacity>
      </View>

      <FormContainer>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FormInput label="اسم العقار" value={form.name} onChangeText={set('name')} placeholder="مثال: برج الرياض السكني" required icon="business-outline" error={errors.name} />
          <FormSelect label="نوع العقار" value={form.type} options={typeOptions} onSelect={set('type')} required error={errors.type} />

          {/* هيكل الوحدات — يتحدد تلقائياً حسب النوع، قابل للتعديل */}
          {form.type ? (
            <View style={styles.structureRow}>
              <Text style={[styles.structureLabel, { color: colors.textSecondary }]}>هيكل العقار</Text>
              <View style={styles.structureBtns}>
                {([
                  { value: 'single', label: 'وحدة واحدة', icon: 'home-outline' },
                  { value: 'multi',  label: 'متعدد الوحدات', icon: 'business-outline' },
                ] as { value: UnitStructure; label: string; icon: string }[]).map(opt => {
                  const active = effectiveStructure === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.structureBtn, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '15' : colors.card }]}
                      onPress={() => set('unitStructure')(opt.value)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={opt.icon as any} size={16} color={active ? colors.primary : colors.textSecondary} />
                      <Text style={[styles.structureBtnText, { color: active ? colors.primary : colors.textSecondary }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.structureHint, { color: colors.textMuted }]}>
                {effectiveStructure === 'single'
                  ? 'سيتم إنشاء وحدة رئيسية واحدة تلقائياً'
                  : 'ستضيف الوحدات يدوياً بعد حفظ العقار'}
              </Text>
            </View>
          ) : null}

          <FormSelect label="المدينة" value={form.cityId} options={cityOptions} onSelect={set('cityId')} required placeholder="اختر المدينة..." error={errors.cityId} />
          <FormInput label="الموقع" value={form.location} onChangeText={set('location')} placeholder="مثال: الرياض - حي العليا" required icon="location-outline" error={errors.location} />
          <FormInput label="عدد الطوابق" value={form.floors} onChangeText={set('floors')} placeholder="مثال: 8" keyboardType="number-pad" required icon="layers-outline" error={errors.floors} />
          <FormSelect label="المالك" value={form.ownerId} options={ownerOptions} onSelect={set('ownerId')} required placeholder="اختر المالك..." error={errors.ownerId} />
          <FormSelect label="عملة العقار" value={form.currency} options={CURRENCY_OPTIONS} onSelect={set('currency')} required icon="cash-outline" />
          <FormInput label="رقم الصك (اختياري)" value={form.deedNumber} onChangeText={set('deedNumber')} placeholder="مثال: 1234567890" icon="document-outline" />
          <FormInput label="المساحة بالمتر المربع (اختياري)" value={form.area} onChangeText={set('area')} placeholder="مثال: 500" keyboardType="number-pad" icon="resize-outline" />
          <FormInput label="الوصف (اختياري)" value={form.description} onChangeText={set('description')} placeholder="وصف موجز للعقار..." multiline numberOfLines={3} icon="document-text-outline" />
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
  structureRow: { gap: 8 },
  structureLabel: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.medium },
  structureBtns: { flexDirection: 'row', gap: 10 },
  structureBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: Theme.radius.lg, borderWidth: 1.5,
  },
  structureBtnText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.medium },
  structureHint: { fontSize: Theme.fontSize.xs, textAlign: 'center' },
});
