import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { FormInput } from '../components/forms/FormInput';
import { loginUser, registerUser, resetPassword, loginWithGoogle } from '../lib/auth';
import { useAppTheme } from '../hooks/useAppTheme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const [mode, setMode]         = useState<'login' | 'register'>('login');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<'company' | 'independent'>('company');
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(false);
  const [authError, setAuthError] = useState('');

  const validate = () => {
    const e: Record<string, string> = {};
    if (mode === 'register' && !name.trim()) e.name = 'الاسم مطلوب';
    if (!email.trim()) e.email = 'البريد الإلكتروني مطلوب';
    else if (!email.includes('@')) e.email = 'البريد الإلكتروني غير صحيح';
    if (!password.trim()) e.password = 'كلمة المرور مطلوبة';
    else if (password.length < 6) e.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const clearError = (field: string) =>
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });

  const handleSubmit = async () => {
    if (!validate()) return;
    setAuthError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await loginUser(email.trim(), password);
      } else {
        await registerUser(name.trim(), email.trim(), password, accountType);
      }
      // Navigation handled by onAuthChange in _layout.tsx
    } catch (err: any) {
      const msg = err?.code === 'auth/user-not-found' || err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential'
        ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
        : err?.code === 'auth/email-already-in-use'
        ? 'البريد الإلكتروني مستخدم بالفعل'
        : err?.code === 'auth/too-many-requests'
        ? 'محاولات كثيرة، حاول لاحقاً'
        : err?.message === 'Auth not available'
        ? 'خطأ في الاتصال، أعد تحميل الصفحة'
        : `حدث خطأ: ${err?.code ?? err?.message ?? 'غير معروف'}`;
      setAuthError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* الخلفية */}
        <View style={[styles.topBg, { backgroundColor: '#021C36' }]}>
          <View style={[styles.circle1, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          <View style={[styles.circle2, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* الشعار */}
          <View style={styles.logoSection}>
            <Image
              source={require('../assets/images/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.appSubtitle}>نظام إدارة العقارات</Text>
          </View>

          {/* النموذج */}
          <View style={[styles.formCard, { backgroundColor: colors.card, ...Theme.shadow.lg }]}>

            {/* Tabs */}
            <View style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.tab, mode === 'login' && { backgroundColor: '#03284C' }]}
                onPress={() => { setMode('login'); setErrors({}); }}
              >
                <Text style={[styles.tabText, { color: mode === 'login' ? '#FFF' : colors.textSecondary }]}>
                  تسجيل الدخول
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, mode === 'register' && { backgroundColor: '#03284C' }]}
                onPress={() => { setMode('register'); setErrors({}); }}
              >
                <Text style={[styles.tabText, { color: mode === 'register' ? '#FFF' : colors.textSecondary }]}>
                  حساب جديد
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'register' && (
              <FormInput
                label="الاسم الكامل"
                value={name}
                onChangeText={v => { setName(v); clearError('name'); }}
                placeholder="أدخل اسمك الكامل"
                required
                icon="person-outline"
                error={errors.name}
              />
            )}

            {mode === 'register' && (
              <View style={styles.accountTypeWrapper}>
                <Text style={[styles.accountTypeLabel, { color: colors.text }]}>نوع الحساب</Text>
                <View style={[styles.accountTypeToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.accountTypeOption, accountType === 'company' && { backgroundColor: '#03284C' }]}
                    onPress={() => setAccountType('company')}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="business-outline"
                      size={18}
                      color={accountType === 'company' ? '#FFF' : colors.textSecondary}
                    />
                    <Text style={[styles.accountTypeText, { color: accountType === 'company' ? '#FFF' : colors.textSecondary }]}>
                      شركة
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.accountTypeOption, accountType === 'independent' && { backgroundColor: '#03284C' }]}
                    onPress={() => setAccountType('independent')}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="person-outline"
                      size={18}
                      color={accountType === 'independent' ? '#FFF' : colors.textSecondary}
                    />
                    <Text style={[styles.accountTypeText, { color: accountType === 'independent' ? '#FFF' : colors.textSecondary }]}>
                      مالك مستقل
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.accountTypeHint, { color: colors.textMuted }]}>
                  {accountType === 'company'
                    ? 'شركة تدير عدة ملاك وعقاراتهم'
                    : 'مالك يدير عقاراته الخاصة فقط'}
                </Text>
              </View>
            )}

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
              placeholder={mode === 'register' ? '6 أحرف على الأقل' : 'أدخل كلمة المرور'}
              isPassword
              required
              icon="lock-closed-outline"
              error={errors.password}
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
                <Text style={styles.submitBtnText}>
                  {mode === 'login' ? 'جاري الدخول...' : 'جاري إنشاء الحساب...'}
                </Text>
              ) : (
                <>
                  <Ionicons name={mode === 'login' ? 'log-in-outline' : 'person-add-outline'} size={20} color="#021C36" />
                  <Text style={styles.submitBtnText}>
                    {mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {mode === 'login' && (
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={async () => {
                  if (!email.trim() || !email.includes('@')) {
                    Alert.alert('تنبيه', 'أدخل بريدك الإلكتروني أولاً ثم اضغط نسيت كلمة المرور');
                    return;
                  }
                  try {
                    await resetPassword(email.trim());
                    Alert.alert('تم الإرسال', 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني');
                  } catch {
                    Alert.alert('خطأ', 'تعذر إرسال البريد. تحقق من العنوان وحاول مجدداً');
                  }
                }}
              >
                <Text style={[styles.forgotText, { color: colors.secondary }]}>نسيت كلمة المرور؟</Text>
              </TouchableOpacity>
            )}

            {/* فاصل */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textMuted }]}>أو</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* زر Google */}
            <TouchableOpacity
              style={[styles.googleBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={async () => {
                setAuthError('');
                setLoading(true);
                try {
                  await loginWithGoogle();
                  // Navigation handled by onAuthChange in _layout.tsx
                } catch (err: any) {
                  if (err?.code !== 'auth/popup-closed-by-user') {
                    setAuthError(err?.code === 'auth/popup-blocked'
                      ? 'تم حجب النافذة المنبثقة. أتح النوافذ المنبثقة لهذا الموقع وأعد المحاولة'
                      : `حدث خطأ: ${err?.code ?? err?.message ?? 'غير معروف'}`
                    );
                  }
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              activeOpacity={0.85}
            >
              {/* Google G logo */}
              <Text style={styles.googleLogo}>G</Text>
              <Text style={[styles.googleBtnText, { color: colors.text }]}>المتابعة بحساب Google</Text>
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
  logoImage: { width: 160, height: 160, borderRadius: 16 },
  appName: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
  appSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: Theme.fontSize.md, textAlign: 'center' },
  formCard: {
    borderRadius: Theme.radius.xl, padding: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  tabs: {
    flexDirection: 'row', borderRadius: Theme.radius.lg,
    borderWidth: 1, padding: 4, gap: 4,
  },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: Theme.radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  tabText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  accountTypeWrapper: { gap: 6 },
  accountTypeLabel: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  accountTypeToggle: {
    flexDirection: 'row', borderRadius: Theme.radius.lg,
    borderWidth: 1, padding: 4, gap: 4,
  },
  accountTypeOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: Theme.radius.md, minHeight: 44,
  },
  accountTypeText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  accountTypeHint: { fontSize: Theme.fontSize.xs, textAlign: 'right' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: Theme.radius.lg, paddingVertical: 16, marginTop: 4,
  },
  submitBtnText: { color: '#021C36', fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },
  forgotBtn: { alignItems: 'center' },
  forgotText: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.medium },
  errorBox: { backgroundColor: '#FDEDEC', borderRadius: Theme.radius.md, padding: 12 },
  errorText: { color: '#C0392B', fontSize: Theme.fontSize.sm, textAlign: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: Theme.fontSize.sm },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: Theme.radius.lg, paddingVertical: 14,
    borderWidth: 1.5,
  },
  googleLogo: {
    fontSize: 18, fontWeight: '800', color: '#4285F4',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  googleBtnText: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold },
});
