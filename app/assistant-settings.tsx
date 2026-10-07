/**
 * ضبط المساعد — مفتاح Gemini واسم النموذج.
 *
 * المفتاح يُحفَظ في settings/assistant الذي تحرسه قاعدة Firestore فتقصر قراءته
 * وكتابته على المدير. ولا يُحزَم في ملف التطبيق أبداً: حزمة الويب تُخدَم علناً،
 * فما فيها يقرؤه أي زائر مجهول.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { AppHeader } from '../components/ui/AppHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/forms/FormInput';
import { FormContainer } from '../components/ui/FormContainer';
import { AlertModal, ConfirmModal } from '../components/ui/Modal';
import { useAppTheme } from '../hooks/useAppTheme';
import { getOne, setOne, getActiveOrgId } from '../lib/firestoreService';

const KEY_DOC = 'assistant';

export default function AssistantSettingsScreen() {
  const { colors } = useAppTheme();
  const { isAdmin } = useApp();

  const [apiKey, setApiKey]   = useState('');
  const [model, setModel]     = useState('');
  const [hasKey, setHasKey]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string; variant: 'info' | 'warning' } | null>(null);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    let alive = true;
    (async () => {
      try {
        const doc = await getOne(getActiveOrgId(), 'settings', KEY_DOC);
        if (!alive) return;
        // المفتاح لا يُعاد عرضه — يُعرض أنه مضبوط فقط
        setHasKey(typeof doc?.apiKey === 'string' && doc.apiKey.trim().length > 0);
        setModel(typeof doc?.model === 'string' ? doc.model : '');
      } catch {
        if (alive) setHasKey(false);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isAdmin]);

  const save = async () => {
    if (saving) return;
    const key = apiKey.trim();
    if (!key && !hasKey) {
      setAlert({ title: 'المفتاح مطلوب', message: 'الصق مفتاح Gemini أولاً.', variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const patch: Record<string, unknown> = { enabled: true, model: model.trim() || undefined };
      if (key) patch.apiKey = key;
      await setOne(getActiveOrgId(), 'settings', KEY_DOC, patch);
      setApiKey('');
      setHasKey(true);
      setAlert({
        title: 'تم الحفظ',
        message: 'المساعد جاهز. افتحه من القائمة ← المساعد الذكي.',
        variant: 'info',
      });
    } catch {
      setAlert({
        title: 'تعذّر الحفظ',
        message: 'لم يُحفظ المفتاح. تحقّق من صلاحيتك ومن الاتصال.',
        variant: 'warning',
      });
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setConfirmClear(false);
    setSaving(true);
    try {
      await setOne(getActiveOrgId(), 'settings', KEY_DOC, { apiKey: '', enabled: false });
      setHasKey(false);
      setApiKey('');
      setAlert({ title: 'أُزيل المفتاح', message: 'تعطّل المساعد.', variant: 'info' });
    } catch {
      setAlert({ title: 'تعذّر الإزالة', message: 'أعد المحاولة.', variant: 'warning' });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title="ضبط المساعد" />
        <EmptyState icon="lock-closed-outline" title="هذه الإعدادات للمدير فقط" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="ضبط المساعد" />

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Ionicons
              name={hasKey ? 'checkmark-circle' : 'alert-circle-outline'}
              size={20}
              color={hasKey ? colors.success : colors.warning}
            />
            <Text style={[styles.status, { color: hasKey ? colors.success : colors.warning }]}>
              {loading ? 'جارٍ التحقق...' : hasKey ? 'المساعد مهيّأ ويعمل' : 'المفتاح غير مضبوط'}
            </Text>
          </View>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            المساعد يحتاج مفتاح Gemini. الطبقة المجانية تكفي الاستخدام الإداري، ولا تتطلّب بطاقة.
          </Text>
          <TouchableOpacity
            style={styles.link}
            onPress={() => Linking.openURL('https://aistudio.google.com/apikey').catch(() => {})}
          >
            <Ionicons name="open-outline" size={15} color={colors.secondary} />
            <Text style={[styles.linkText, { color: colors.secondary }]}>احصل على مفتاح مجاني</Text>
          </TouchableOpacity>
        </View>

        <FormInput
          label={hasKey ? 'مفتاح جديد (اتركه فارغاً للإبقاء على الحالي)' : 'مفتاح Gemini'}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="AIza..."
          icon="key-outline"
          secureTextEntry
        />
        <FormInput
          label="اسم النموذج (اختياري)"
          value={model}
          onChangeText={setModel}
          placeholder="gemini-2.0-flash"
          icon="cube-outline"
        />

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.success }]}
          onPress={save}
          disabled={saving}
        >
          <Ionicons name="save-outline" size={18} color="#FFF" />
          <Text style={styles.saveText}>{saving ? 'جارٍ الحفظ...' : 'حفظ'}</Text>
        </TouchableOpacity>

        {hasKey && (
          <TouchableOpacity
            style={[styles.clearBtn, { borderColor: colors.danger + '55' }]}
            onPress={() => setConfirmClear(true)}
            disabled={saving}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={[styles.clearText, { color: colors.danger }]}>إزالة المفتاح وتعطيل المساعد</Text>
          </TouchableOpacity>
        )}

        {/* إفصاح صريح: المستخدم يقرّر وهو يعرف */}
        <View style={[styles.notice, { backgroundColor: colors.warningSubtle, borderColor: colors.warning }]}>
          <Ionicons name="information-circle-outline" size={17} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.noticeTitle, { color: colors.warning }]}>ما يجب أن تعرفه</Text>
            <Text style={[styles.noticeText, { color: colors.warning }]}>
              • المفتاح يُحفَظ في قاعدة بياناتك وتحرسه قاعدة تقصر قراءته على المدير — لا يُحزَم في التطبيق.{'\n'}
              • لكنه يصل إلى متصفّح المدير ليعمل، فمن يملك حساب مدير يستطيع استخراجه.
              استخدم مفتاحاً من حساب منفصل بلا فاتورة: أقصى الضرر استهلاك حصّة مجانية.{'\n'}
              • أسماء المستأجرين تُرسَل إلى Google للإجابة. أرقام الهويات والهواتف والبُرد
              <Text style={{ fontWeight: Theme.fontWeight.bold }}> لا تُرسَل</Text>.{'\n'}
              • راجع شروط استخدام البيانات للطبقة المجانية إن كانت الخصوصية تهمّك.
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.openBtn} onPress={() => router.push('/assistant')}>
          <Ionicons name="sparkles-outline" size={17} color={colors.primary} />
          <Text style={[styles.openText, { color: colors.primary }]}>فتح المساعد</Text>
        </TouchableOpacity>
      </ScrollView></FormContainer>

      <ConfirmModal
        visible={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clear}
        title="إزالة المفتاح"
        message="سيتعطّل المساعد حتى تضبط مفتاحاً جديداً. هل تريد المتابعة؟"
        confirmLabel="إزالة"
        variant="danger"
      />
      <AlertModal
        visible={!!alert}
        onClose={() => setAlert(null)}
        title={alert?.title ?? ''}
        message={alert?.message ?? ''}
        variant={alert?.variant ?? 'info'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Theme.spacing.base, gap: Theme.spacing.lg, paddingBottom: 48 },
  card: { padding: Theme.spacing.md, borderRadius: Theme.radius.lg, borderWidth: 1, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold },
  hint: { fontSize: Theme.fontSize.sm, textAlign: 'right', lineHeight: 20 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 },
  linkText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: Theme.radius.md,
  },
  saveText: { color: '#FFF', fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 12, borderRadius: Theme.radius.md, borderWidth: 1,
  },
  clearText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9,
    padding: Theme.spacing.md, borderRadius: Theme.radius.md, borderWidth: 1,
  },
  noticeTitle: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold, textAlign: 'right', marginBottom: 4 },
  noticeText: { fontSize: Theme.fontSize.xs, textAlign: 'right', lineHeight: 20 },
  openBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 10 },
  openText: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold },
});
