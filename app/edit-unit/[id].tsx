import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { FormInput } from '../../components/forms/FormInput';
import { FormSelect } from '../../components/forms/FormSelect';
import { AppHeader } from '../../components/ui/AppHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { UnitType } from '../../data/mockData';
import { FormContainer } from '../../components/ui/FormContainer';
import { useAppTheme } from '../../hooks/useAppTheme';

const FEATURE_OPTIONS = [
  'مكيف مركزي', 'مطبخ مجهز', 'باركنج', 'أمن 24 ساعة', 'تراس',
  'غرفة خادمة', 'مسبح', 'حديقة', 'إطلالة بانورامية', 'إنترنت فايبر',
  'غرفة غسيل', 'جاكوزي', 'مطبخ أمريكي', 'موقف سيارتين', 'نظام أمني',
];

export default function EditUnitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { units, updateUnit } = useApp();

  const unit = units.find(u => u.id === id);

  const [form, setForm] = useState({
    number: unit?.number || '', type: unit?.type || '' as UnitType | '',
    floor: unit?.floor?.toString() || '', area: unit?.area?.toString() || '',
    monthlyRent: unit?.monthlyRent?.toString() || '', description: unit?.description || '',
  });
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(unit?.features || []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (unit) {
      setForm({
        number: unit.number || '',
        type: unit.type || '' as UnitType | '',
        floor: unit.floor?.toString() || '',
        area: unit.area?.toString() || '',
        monthlyRent: unit.monthlyRent?.toString() || '',
        description: unit.description || '',
      });
      setSelectedFeatures(unit.features || []);
    }
  }, [unit?.id]);

  if (!unit) return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="تعديل الوحدة" />
      <EmptyState icon="home-outline" title="الوحدة غير موجودة" />
    </View>
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.number.trim()) e.number = 'رقم الوحدة مطلوب';
    if (!form.type) e.type = 'النوع مطلوب';
    if (!form.floor || isNaN(Number(form.floor))) e.floor = 'الطابق مطلوب';
    if (!form.area || isNaN(Number(form.area))) e.area = 'المساحة مطلوبة';
    if (!form.monthlyRent || isNaN(Number(form.monthlyRent))) e.monthlyRent = 'الإيجار الشهري مطلوب';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const monthly = Number(form.monthlyRent);
    updateUnit(id, {
      number: form.number.trim(), type: form.type as UnitType,
      floor: Number(form.floor), area: Number(form.area),
      monthlyRent: monthly, annualRent: monthly * 12,
      description: form.description.trim(), features: selectedFeatures,
    });
    router.back();
  };

  const typeOptions = [
    { label: 'استوديو', value: 'studio' }, { label: 'شقة غرفة', value: 'apartment_1' },
    { label: 'شقة غرفتين', value: 'apartment_2' }, { label: 'شقة 3 غرف', value: 'apartment_3' },
    { label: 'شقة 4 غرف', value: 'apartment_4' }, { label: 'فيلا', value: 'villa' },
    { label: 'مكتب', value: 'office' }, { label: 'محل', value: 'shop' },
  ];

  const set = (key: string) => (val: string) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  const toggleFeature = (f: string) => {
    setSelectedFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تعديل الوحدة</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <Text style={styles.saveText}>حفظ</Text>
        </TouchableOpacity>
      </View>

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FormInput label="رقم الوحدة" value={form.number} onChangeText={set('number')} required icon="keypad-outline" error={errors.number} />
        <FormSelect label="نوع الوحدة" value={form.type} options={typeOptions} onSelect={set('type')} required error={errors.type} />
        <FormInput label="رقم الطابق" value={form.floor} onChangeText={set('floor')} keyboardType="number-pad" required icon="layers-outline" error={errors.floor} />
        <FormInput label="المساحة (م²)" value={form.area} onChangeText={set('area')} keyboardType="decimal-pad" required icon="resize-outline" error={errors.area} />
        <FormInput label="الإيجار الشهري (ر.س)" value={form.monthlyRent} onChangeText={set('monthlyRent')} keyboardType="number-pad" required icon="cash-outline" error={errors.monthlyRent} />
        <FormInput label="الوصف" value={form.description} onChangeText={set('description')} multiline numberOfLines={3} icon="document-text-outline" />

        <View style={styles.featuresSection}>
          <Text style={[styles.featLabel, { color: colors.text }]}>المميزات</Text>
          <View style={styles.featWrap}>
            {FEATURE_OPTIONS.map(feat => {
              const selected = selectedFeatures.includes(feat);
              return (
                <TouchableOpacity
                  key={feat}
                  style={[styles.featChip, { backgroundColor: selected ? colors.primary : colors.inputBg, borderColor: selected ? colors.primary : colors.border }]}
                  onPress={() => toggleFeature(feat)}
                >
                  {selected && <Ionicons name="checkmark" size={12} color="#FFF" />}
                  <Text style={[styles.featText, { color: selected ? '#FFF' : colors.textSecondary }]}>{feat}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
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
  featuresSection: { gap: 8 },
  featLabel: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold },
  featWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Theme.radius.full, borderWidth: 1 },
  featText: { fontSize: Theme.fontSize.sm },
});
