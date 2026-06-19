import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { FormInput } from '../../components/forms/FormInput';
import { FormSelect } from '../../components/forms/FormSelect';
import { EmptyState } from '../../components/ui/EmptyState';
import { AppHeader } from '../../components/ui/AppHeader';
import { FormContainer } from '../../components/ui/FormContainer';
import { useAppTheme } from '../../hooks/useAppTheme';
import { CURRENCY_OPTIONS } from '../../utils/currency';

export default function EditPropertyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { properties, owners, cities, updateProperty } = useApp();

  const property = properties.find(p => p.id === id);

  const [form, setForm] = useState({
    name: property?.name || '',
    type: property?.type || '',
    location: property?.location || '',
    floors: property?.floors?.toString() || '',
    ownerId: property?.ownerId || '',
    cityId: property?.cityId || '',
    status: property?.status || 'active',
    currency: property?.currency || 'SAR',
    description: property?.description || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (property) {
      setForm({
        name: property.name || '',
        type: property.type || '',
        location: property.location || '',
        floors: property.floors?.toString() || '',
        ownerId: property.ownerId || '',
        cityId: property.cityId || '',
        status: property.status || 'active',
        currency: property.currency || 'SAR',
        description: property.description || '',
      });
    }
  }, [property?.id]);

  if (!property) return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="تعديل العقار" />
      <EmptyState icon="business-outline" title="العقار غير موجود" />
    </View>
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'اسم العقار مطلوب';
    if (!form.type) e.type = 'النوع مطلوب';
    if (!form.location.trim()) e.location = 'الموقع مطلوب';
    if (!form.floors || isNaN(Number(form.floors))) e.floors = 'عدد الطوابق مطلوب';
    if (!form.ownerId) e.ownerId = 'المالك مطلوب';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    updateProperty(id, {
      name: form.name.trim(), type: form.type as any,
      location: form.location.trim(), floors: Number(form.floors),
      ownerId: form.ownerId, cityId: form.cityId || undefined,
      status: form.status as any,
      currency: form.currency,
      description: form.description.trim(),
    });
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
    { label: 'مكتب', value: 'office' }, { label: 'محل', value: 'shop' },
  ];
  const statusOptions = [
    { label: 'نشط', value: 'active' }, { label: 'غير نشط', value: 'inactive' },
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
        <Text style={styles.headerTitle}>تعديل العقار</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <Text style={styles.saveText}>حفظ</Text>
        </TouchableOpacity>
      </View>

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FormInput label="اسم العقار" value={form.name} onChangeText={set('name')} required icon="business-outline" error={errors.name} />
        <FormSelect label="نوع العقار" value={form.type} options={typeOptions} onSelect={set('type')} required error={errors.type} />
        <FormInput label="الموقع" value={form.location} onChangeText={set('location')} required icon="location-outline" error={errors.location} />
        <FormSelect label="المدينة" value={form.cityId} options={cityOptions} onSelect={set('cityId')} required placeholder="اختر المدينة..." />
        <FormInput label="عدد الطوابق" value={form.floors} onChangeText={set('floors')} keyboardType="number-pad" required icon="layers-outline" error={errors.floors} />
        <FormSelect label="المالك" value={form.ownerId} options={ownerOptions} onSelect={set('ownerId')} required error={errors.ownerId} />
        <FormSelect label="الحالة" value={form.status} options={statusOptions} onSelect={set('status')} required />
        <FormSelect label="عملة العقار" value={form.currency} options={CURRENCY_OPTIONS} onSelect={set('currency')} required />
        <FormInput label="الوصف" value={form.description} onChangeText={set('description')} multiline numberOfLines={3} icon="document-text-outline" />
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
});
