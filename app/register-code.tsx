import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { FormInput } from '../components/forms/FormInput';
import { redeemInviteCode } from '../lib/invites';
import { useAppTheme } from '../hooks/useAppTheme';

export default function RegisterCodeScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const [code, setCode]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(false);
  const [authError, setAuthError] = useState('');

  const clearError = (field: string) =>
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!code.trim())                       e.code = 'كود الدعوة مطلوب';
    if (!email.trim())                      e.email = 'البريد الإلكتروني مطلوب';
    else if (!email.includes('@'))          e.email = 'البريد الإلكتروني غير صحيح';
    if (!password.trim())                   e.password = 'كلمة المرور مطلوبة';
    else if (password.length < 6)           e.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    if (confirm !== password)               e.confirm = 'كلمتا المرور غير متطابقتين';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setAuthError('');
    setLoading(true);
    try {
      await redeemInviteCode(code, email.trim(), password);
      // تسجيل الدخول تمّ داخل redeemInviteCode — التنقّل يتكفّل به onAuthChange في _layout
    } catch (err: any) {
      const msg = err?.message && !String(err.message).startsWith('functions/')
        ? err.message
        : 'تعذّر التسجيل — تحقق من الكود وحاول مجدداً';
      setAuthError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBg, { backgroundColor: '#021C36' }]}>
          <View style={[styles.circle1, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          <View style={[styles.circle2, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoSection}>
            <Image
              source={require('../assets/images/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.appSubtitle}>تسجيل بكود دعوة</Text>
          </View>

          <View style={[styles.formCard, { backgroundColor: colors.card, ...Theme.shadow.lg }]}>
            <Text style={[styles.intro, { color: colors.textSecondary }]}>
              أدخل الكود الذي أعطاك إياه المدير، ثم بريدك الإلكتروني وكلمة مرور جديدة.
            </Text>

            <FormInput
              label="كود الدعوة"
              value={code}
              onChangeText={v => { setCode(v); clearError('code'); }}
              placeholder="مثال: ABC-7K9"
              autoCapitalize="characters"
              required
              icon="key-outline"
              error={errors.code}
            />

            <FormInput
              label="البريد الإلكتروني"
              value={email}
              onChangeText={v => { setEmail(v); clearError('email'); }}
              placeholder="أدخل بريدك الإلكتروني"
              keyboardType="email-address"
              autoCapitalize="none"
              required
              icon="mail-outline"
              error={errors.email}
            />

            <FormInput
              label="كلمة المرور"
              value={password}
              onChangeText={v => { setPassword(v); clearError('password'); }}
              placeholder="6 أحرف على الأقل"
              isPassword
              required
              icon="lock-closed-outline"
              error={errors.password}
            />

            <FormInput
              label="تأكيد كلمة المرور"
              value={confirm}
              onChangeText={v => { setConfirm(v); clearError('confirm'); }}
              placeholder="أعد إدخال كلمة المرور"
              isPassword
              required
              icon="lock-closed-outline"
              error={errors.confirm}
            />

            {authError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{authError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: '#C3AF76' }, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <Text style={styles.submitBtnText}>جاري التسجيل...</Text>
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#021C36" />
                  <Text style={styles.submitBtnText}>تسجيل ودخول</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/login')}>
              <Text style={[styles.backText, { color: colors.secondary }]}>لديك حساب؟ تسجيل الدخول</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 260, overflow: 'hidden' },
  circle1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, top: -100, left: -80 },
  circle2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: 100, right: -50 },
  content: { paddingHorizontal: Theme.spacing.base, paddingBottom: 48 },
  logoSection: { alignItems: 'center', gap: 10, marginBottom: Theme.spacing.xl },
  logoImage: { width: 140, height: 140, borderRadius: 16 },
  appSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: Theme.fontSize.lg, fontWeight: '700', textAlign: 'center' },
  formCard: { borderRadius: Theme.radius.xl, padding: Theme.spacing.xl, gap: Theme.spacing.lg },
  intro: { fontSize: Theme.fontSize.sm, textAlign: 'center', lineHeight: 22 },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: Theme.radius.lg, paddingVertical: 16, marginTop: 4,
  },
  submitBtnText: { color: '#021C36', fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },
  backBtn: { alignItems: 'center' },
  backText: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.medium },
  errorBox: { backgroundColor: '#FDEDEC', borderRadius: Theme.radius.md, padding: 12 },
  errorText: { color: '#C0392B', fontSize: Theme.fontSize.sm, textAlign: 'center' },
});
