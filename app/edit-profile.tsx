import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { FormInput } from '../components/forms/FormInput';
import { AppHeader } from '../components/ui/AppHeader';
import { FormContainer } from '../components/ui/FormContainer';
import { useAppTheme } from '../hooks/useAppTheme';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { currentUser, updateProfile } = useApp();

  const [form, setForm] = useState({
    name: currentUser.name, phone: currentUser.phone,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // تحديث النموذج عند تحميل بيانات المستخدم
  useEffect(() => {
    setForm({ name: currentUser.name, phone: currentUser.phone });
  }, [currentUser.name, currentUser.phone]);

  const set = (key: string) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'الاسم مطلوب';
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    updateProfile({ name: form.name.trim(), phone: form.phone.trim() });
    router.back();
  };

  const initials = (currentUser.name || '؟').split(' ').slice(0, 2).map((n: string) => n[0] ?? '').join('') || '؟';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="تعديل الملف الشخصي" rightText={{ label: 'حفظ', onPress: handleSave }} />

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <TouchableOpacity
            style={[styles.changeAvatarBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => Alert.alert('قريباً', 'ميزة تغيير الصورة الشخصية ستتوفر في التحديث القادم')}
          >
            <Ionicons name="camera-outline" size={16} color={colors.primary} />
            <Text style={[styles.changeAvatarText, { color: colors.primary }]}>تغيير الصورة</Text>
          </TouchableOpacity>
        </View>

        <FormInput label="الاسم الكامل" value={form.name} onChangeText={set('name')} required icon="person-outline" error={errors.name} />
        <FormInput label="رقم الجوال" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" icon="call-outline" />
        {/* البريد الإلكتروني والدور للعرض فقط */}
        <FormInput label="البريد الإلكتروني" value={currentUser.email} onChangeText={() => {}} icon="mail-outline" editable={false} />
        <FormInput label="الصلاحية" value={currentUser.role} onChangeText={() => {}} icon="briefcase-outline" editable={false} />

        {/* Change Password Link */}
        <TouchableOpacity
          style={[styles.changePassBtn, { backgroundColor: colors.accent, borderColor: colors.border }]}
          onPress={() => router.push('/change-password')}
        >
          <Ionicons name="chevron-back-outline" size={16} color={colors.secondary} />
          <Text style={[styles.changePassText, { color: colors.secondary }]}>تغيير كلمة المرور</Text>
          <Ionicons name="lock-closed-outline" size={18} color={colors.secondary} />
        </TouchableOpacity>
      </ScrollView></FormContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Theme.spacing.base, gap: Theme.spacing.lg, paddingBottom: 48 },
  avatarSection: { alignItems: 'center', gap: 12, paddingVertical: Theme.spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  initials: { color: '#FFF', fontSize: 28, fontWeight: '700' },
  changeAvatarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: Theme.radius.full, borderWidth: 1 },
  changeAvatarText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.medium },
  changePassBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Theme.spacing.md, borderRadius: Theme.radius.lg, borderWidth: 1, marginTop: 4 },
  changePassText: { flex: 1, fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.semibold },
});
