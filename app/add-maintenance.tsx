import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { FormInput } from '../components/forms/FormInput';
import { FormSelect } from '../components/forms/FormSelect';
import { Maintenance, MaintenancePriority } from '../data/mockData';
import { FormContainer } from '../components/ui/FormContainer';
import { useAppTheme } from '../hooks/useAppTheme';

export default function AddMaintenanceScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { properties, units, addMaintenance, currentUser, externalOwnedUnits } = useApp();

  const [form, setForm] = useState({
    propertyId: '', unitId: '', title: '', description: '', priority: '' as MaintenancePriority | '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.propertyId) e.propertyId = 'العقار مطلوب';
    if (!form.unitId) e.unitId = 'الوحدة مطلوبة';
    if (!form.title.trim()) e.title = 'عنوان الطلب مطلوب';
    if (!form.description.trim()) e.description = 'الوصف مطلوب';
    if (!form.priority) e.priority = 'الأولوية مطلوبة';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const item: Maintenance = {
      id: `m${Date.now()}`,
      title: form.title.trim(),
      description: form.description.trim(),
      propertyId: form.propertyId,
      unitId: form.unitId,
      priority: form.priority as MaintenancePriority,
      status: 'new',
      openedAt: new Date().toISOString().split('T')[0],
      reportedBy: currentUser.name,
    };
    addMaintenance(item);
    router.back();
  };

  // عقارات الخارجية من وحداته المملوكة في عقارات الآخرين
  const externalPropertyIds = new Set(externalOwnedUnits.map(u => u.propertyId));
  const externalProperties = externalOwnedUnits
    .filter((u, i, arr) => arr.findIndex(x => x.propertyId === u.propertyId) === i)
    .map(u => ({ label: u.parentPropertyName ?? u.propertyId, value: u.propertyId }));

  const propUnits = form.propertyId
    ? externalPropertyIds.has(form.propertyId)
      ? externalOwnedUnits.filter(u => u.propertyId === form.propertyId)
      : units.filter(u => u.propertyId === form.propertyId)
    : [];
  const propertyOptions = [
    ...properties.map(p => ({ label: p.name, value: p.id })),
    ...externalProperties,
  ];
  const unitOptions = propUnits.map(u => ({ label: `وحدة ${u.number}`, value: u.id }));
  const priorityOptions = [
    { label: 'عاجل — فوري', value: 'urgent' },
    { label: 'عالية — طارئ', value: 'high' },
    { label: 'متوسطة — عادي', value: 'medium' },
    { label: 'منخفضة — غير عاجل', value: 'low' },
  ];

  const set = (key: string) => (val: string) => {
    setForm(f => {
      const updated = { ...f, [key]: val };
      if (key === 'propertyId') updated.unitId = '';
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
        <Text style={styles.headerTitle}>طلب صيانة جديد</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <Text style={styles.saveText}>إرسال</Text>
        </TouchableOpacity>
      </View>

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FormSelect label="العقار" value={form.propertyId} options={propertyOptions} onSelect={set('propertyId')} required placeholder="اختر العقار..." error={errors.propertyId} />
        <FormSelect label="الوحدة" value={form.unitId} options={unitOptions} onSelect={set('unitId')} required placeholder={form.propertyId ? 'اختر الوحدة...' : 'اختر العقار أولاً'} error={errors.unitId} />
        <FormSelect label="الأولوية" value={form.priority} options={priorityOptions} onSelect={set('priority')} required placeholder="اختر الأولوية..." error={errors.priority} />
        <FormInput label="عنوان الطلب" value={form.title} onChangeText={set('title')} placeholder="مثال: تسريب مياه في الحمام" required icon="construct-outline" error={errors.title} />
        <FormInput label="الوصف التفصيلي" value={form.description} onChangeText={set('description')} placeholder="اشرح المشكلة بالتفصيل..." required multiline numberOfLines={4} icon="document-text-outline" error={errors.description} />
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
