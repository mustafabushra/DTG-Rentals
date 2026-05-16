import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Theme } from '../constants/Theme';
import { AppHeader } from '../components/ui/AppHeader';
import { FormInput } from '../components/forms/FormInput';
import { changePassword } from '../lib/auth';
import { FormContainer } from '../components/ui/FormContainer';
import { useAppTheme } from '../hooks/useAppTheme';

export default function ChangePasswordScreen() {
  const { colors } = useAppTheme();
  const [form, setForm] = useState({ current: '', newPass: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (key: string) => (val: string) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  const handleSave = async () => {
    const e: Record<string, string> = {};
    if (!form.current.trim()) e.current = 'كلمة المرور الحالية مطلوبة';
    if (form.newPass.length < 6) e.newPass = 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل';
    if (form.newPass !== form.confirm) e.confirm = 'كلمة المرور غير متطابقة';
    if (form.newPass === form.current) e.newPass = 'كلمة المرور الجديدة يجب أن تختلف عن الحالية';
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setLoading(true);
    try {
      await changePassword(form.current, form.newPass);
      router.back();
    } catch (err: any) {
      const msg = err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential'
        ? 'كلمة المرور الحالية غير صحيحة'
        : err?.code === 'auth/too-many-requests'
        ? 'محاولات كثيرة، حاول لاحقاً'
        : 'حدث خطأ، حاول مجدداً';
      Alert.alert('خطأ', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="تغيير كلمة المرور" />

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.infoCard, { backgroundColor: colors.accent, borderColor: colors.border }]}>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            يجب أن تكون كلمة المرور الجديدة 6 أحرف على الأقل وتختلف عن الحالية
          </Text>
        </View>

        <FormInput label="كلمة المرور الحالية" value={form.current} onChangeText={set('current')} isPassword required icon="lock-closed-outline" error={errors.current} />
        <FormInput label="كلمة المرور الجديدة" value={form.newPass} onChangeText={set('newPass')} isPassword required icon="lock-open-outline" error={errors.newPass} />
        <FormInput label="تأكيد كلمة المرور" value={form.confirm} onChangeText={set('confirm')} isPassword required icon="checkmark-circle-outline" error={errors.confirm} />

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.saveBtnText}>تغيير كلمة المرور</Text>
          }
        </TouchableOpacity>
      </ScrollView></FormContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Theme.spacing.base, gap: Theme.spacing.lg, paddingBottom: 48 },
  infoCard: { padding: Theme.spacing.md, borderRadius: Theme.radius.md, borderWidth: 1 },
  infoText: { fontSize: Theme.fontSize.md, lineHeight: 22 },
  saveBtn: { borderRadius: Theme.radius.lg, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#FFF', fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },
});
