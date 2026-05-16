import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { FormInput } from '../components/forms/FormInput';
import { Owner } from '../data/mockData';
import { FormContainer } from '../components/ui/FormContainer';
import { sanitizeText, sanitizePhone, sanitizeEmail } from '../utils/sanitize';
import { validateRequired, validateEmail, validatePhone } from '../utils/validation';
import { useAppTheme } from '../hooks/useAppTheme';

export default function AddOwnerScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { addOwner } = useApp();

  const [form, setForm] = useState({ name: '', phone: '', email: '', nationalId: '', iban: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'الاسم مطلوب';
    if (!form.phone.match(/^(\+?\d{7,15}|0\d{9})$/)) e.phone = 'رقم الجوال غير صحيح';
    if (form.email && !form.email.includes('@')) e.email = 'البريد الإلكتروني غير صحيح';
    if (!form.nationalId.trim()) e.nationalId = 'رقم الهوية مطلوب';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const owner: Owner = {
      id:          `o${Date.now()}`,
      name:        sanitizeText(form.name),
      phone:       sanitizePhone(form.phone),
      email:       sanitizeEmail(form.email),
      nationalId:  sanitizeText(form.nationalId),
      iban:        sanitizeText(form.iban),
      propertyIds: [],
      createdAt:   new Date().toISOString().split('T')[0],
    };
    addOwner(owner);
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
        <Text style={styles.headerTitle}>إضافة مالك جديد</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <Text style={styles.saveText}>حفظ</Text>
        </TouchableOpacity>
      </View>

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FormInput label="الاسم الكامل" value={form.name} onChangeText={set('name')} placeholder="مثال: عبدالعزيز بن محمد الرشيد" required icon="person-outline" error={errors.name} />
        <FormInput label="رقم الجوال" value={form.phone} onChangeText={set('phone')} placeholder="05xxxxxxxx" keyboardType="phone-pad" required icon="call-outline" error={errors.phone} />
        <FormInput label="البريد الإلكتروني" value={form.email} onChangeText={set('email')} placeholder="example@email.com" keyboardType="email-address" icon="mail-outline" error={errors.email} autoCapitalize="none" />
        <FormInput label="رقم الهوية الوطنية" value={form.nationalId} onChangeText={set('nationalId')} placeholder="رقم الهوية" keyboardType="default" required icon="card-outline" error={errors.nationalId} />
        <FormInput label="رقم IBAN" value={form.iban} onChangeText={set('iban')} placeholder="SAxx xxxx xxxx xxxx xxxx xxxx" icon="business-outline" error={errors.iban} autoCapitalize="characters" />
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
