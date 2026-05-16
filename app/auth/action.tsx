/**
 * /auth/action — معالج روابط Firebase Auth المخصصة
 * يستقبل: ?mode=resetPassword&oobCode=...&apiKey=...
 * يعرض صفحة عربية لإعادة تعيين كلمة المرور
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { Theme } from '../../constants/Theme';
import { FormInput } from '../../components/forms/FormInput';
import { useAppTheme } from '../../hooks/useAppTheme';

type Stage = 'verifying' | 'form' | 'success' | 'error';

export default function AuthActionScreen() {
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ mode?: string; oobCode?: string }>();

  const [stage,     setStage]     = useState<Stage>('verifying');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [errMsg,    setErrMsg]    = useState('');
  const [pwError,   setPwError]   = useState('');

  const oobCode = params.oobCode ?? '';
  const mode    = params.mode    ?? '';

  // التحقق من صلاحية الرمز عند الدخول
  useEffect(() => {
    if (mode !== 'resetPassword' || !oobCode) {
      setErrMsg('رابط غير صحيح أو منتهي الصلاحية.');
      setStage('error');
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then(emailAddr => { setEmail(emailAddr); setStage('form'); })
      .catch(() => { setErrMsg('انتهت صلاحية الرابط. يرجى طلب رابط جديد.'); setStage('error'); });
  }, [oobCode, mode]);

  const handleReset = async () => {
    const errs: Record<string, string> = {};
    if (password.length < 6) errs.pw = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    if (password !== confirm) errs.pw = 'كلمة المرور وتأكيدها غير متطابقتين';
    if (errs.pw) { setPwError(errs.pw); return; }
    setPwError('');
    setSaving(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStage('success');
    } catch (e: any) {
      setErrMsg(
        e?.code === 'auth/expired-action-code' ? 'انتهت صلاحية الرابط. يرجى طلب رابط جديد.' :
        e?.code === 'auth/weak-password'        ? 'كلمة المرور ضعيفة جداً.' :
        'حدث خطأ. يرجى المحاولة مجدداً.',
      );
      setStage('error');
    } finally {
      setSaving(false);
    }
  };

  // ── جارٍ التحقق ──────────────────────────────────────────────────────────
  if (stage === 'verifying') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.hint, { color: colors.textMuted }]}>جارٍ التحقق من الرابط…</Text>
      </View>
    );
  }

  // ── خطأ ──────────────────────────────────────────────────────────────────
  if (stage === 'error') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <View style={[styles.iconBox, { backgroundColor: colors.danger + '15' }]}>
          <Ionicons name="alert-circle-outline" size={52} color={colors.danger} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>رابط غير صالح</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>{errMsg}</Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/login')}
        >
          <Text style={styles.btnText}>العودة لتسجيل الدخول</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── نجاح ──────────────────────────────────────────────────────────────────
  if (stage === 'success') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <View style={[styles.iconBox, { backgroundColor: colors.success + '15' }]}>
          <Ionicons name="checkmark-circle-outline" size={52} color={colors.success} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>تم تعيين كلمة المرور!</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          يمكنك الآن تسجيل الدخول باستخدام بريدك الإلكتروني وكلمة المرور الجديدة.
        </Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/login')}
        >
          <Ionicons name="log-in-outline" size={18} color="#FFF" />
          <Text style={styles.btnText}>تسجيل الدخول</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── فورم إعادة التعيين ────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Ionicons name="lock-closed-outline" size={32} color="#FFF" />
        <Text style={styles.headerTitle}>تعيين كلمة مرور جديدة</Text>
        <Text style={styles.headerSub}>{email}</Text>
      </View>

      <View style={styles.form}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          أهلاً بك في نظام DTG Rentals. يرجى تعيين كلمة مرور لحسابك.
        </Text>

        <FormInput
          label="كلمة المرور الجديدة *"
          value={password}
          onChangeText={v => { setPassword(v); setPwError(''); }}
          placeholder="6 أحرف على الأقل"
          icon="lock-closed-outline"
          secureTextEntry={!showPw}
          error={pwError}
        />
        <FormInput
          label="تأكيد كلمة المرور *"
          value={confirm}
          onChangeText={v => { setConfirm(v); setPwError(''); }}
          placeholder="أعد كتابة كلمة المرور"
          icon="lock-closed-outline"
          secureTextEntry={!showPw}
        />

        {/* إظهار/إخفاء */}
        <TouchableOpacity style={styles.showPw} onPress={() => setShowPw(p => !p)}>
          <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.textMuted} />
          <Text style={[styles.showPwText, { color: colors.textMuted }]}>
            {showPw ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
          </Text>
        </TouchableOpacity>

        {/* قوة كلمة المرور */}
        {password.length > 0 && (
          <View style={styles.strengthRow}>
            {[4, 6, 8, 10].map(threshold => (
              <View
                key={threshold}
                style={[
                  styles.strengthBar,
                  {
                    backgroundColor:
                      password.length >= threshold
                        ? password.length >= 10 ? colors.success
                          : password.length >= 6 ? colors.warning
                          : colors.danger
                        : colors.border,
                  },
                ]}
              />
            ))}
            <Text style={[styles.strengthLabel, {
              color: password.length >= 10 ? colors.success : password.length >= 6 ? colors.warning : colors.danger,
            }]}>
              {password.length >= 10 ? 'قوية' : password.length >= 6 ? 'متوسطة' : 'ضعيفة'}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: saving ? colors.border : colors.primary, marginTop: 24 }]}
          onPress={handleReset}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Ionicons name="checkmark-outline" size={20} color="#FFF" />}
          <Text style={styles.btnText}>{saving ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },

  header: {
    paddingTop: 60, paddingBottom: 32, paddingHorizontal: 24,
    alignItems: 'center', gap: 8,
  },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  headerSub:   { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center' },

  form: { padding: 24, gap: 4 },
  label: { fontSize: 14, textAlign: 'right', marginBottom: 8, lineHeight: 22 },

  iconBox: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center' },
  title:   { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  sub:     { fontSize: 14, textAlign: 'center', lineHeight: 22, opacity: 0.8 },
  hint:    { fontSize: 14, marginTop: 12 },

  showPw:     { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', marginTop: 4 },
  showPwText: { fontSize: 13 },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '700', minWidth: 44, textAlign: 'right' },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: Theme.radius.xl,
  },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
