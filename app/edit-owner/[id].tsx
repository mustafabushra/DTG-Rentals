import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { FormInput } from '../../components/forms/FormInput';
import { AppHeader } from '../../components/ui/AppHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormContainer } from '../../components/ui/FormContainer';
import { useAppTheme } from '../../hooks/useAppTheme';

export default function EditOwnerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { owners, updateOwner } = useApp();

  const owner = owners.find(o => o.id === id);

  const [form, setForm] = useState({
    name: owner?.name || '', phone: owner?.phone || '',
    email: owner?.email || '', nationalId: owner?.nationalId || '', iban: owner?.iban || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (owner) {
      setForm({
        name: owner.name || '', phone: owner.phone || '',
        email: owner.email || '', nationalId: owner.nationalId || '', iban: owner.iban || '',
      });
    }
  }, [owner?.id]);

  if (!owner) return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="تعديل المالك" />
      <EmptyState icon="person-outline" title="المالك غير موجود" />
    </View>
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'الاسم مطلوب';
    if (!form.phone.match(/^(\+?\d{7,15}|0\d{9})$/)) e.phone = 'رقم الجوال غير صحيح';
    if (form.email && !form.email.includes('@')) e.email = 'البريد غير صحيح';
    if (!form.nationalId.trim()) e.nationalId = 'رقم الهوية مطلوب';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    updateOwner(id, {
      name: form.name.trim(), phone: form.phone.trim(),
      email: form.email.trim(), nationalId: form.nationalId.trim(), iban: form.iban.trim(),
    });
    router.back();
  };

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
        <Text style={styles.headerTitle}>تعديل بيانات المالك</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <Text style={styles.saveText}>حفظ</Text>
        </TouchableOpacity>
      </View>

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FormInput label="الاسم الكامل" value={form.name} onChangeText={set('name')} required icon="person-outline" error={errors.name} />
        <FormInput label="رقم الجوال" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" required icon="call-outline" error={errors.phone} />
        <FormInput label="البريد الإلكتروني" value={form.email} onChangeText={set('email')} keyboardType="email-address" icon="mail-outline" error={errors.email} autoCapitalize="none" />
        <FormInput label="رقم الهوية الوطنية" value={form.nationalId} onChangeText={set('nationalId')} keyboardType="number-pad" required icon="card-outline" error={errors.nationalId} />
        <FormInput label="رقم IBAN" value={form.iban} onChangeText={set('iban')} icon="business-outline" autoCapitalize="characters" />
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
