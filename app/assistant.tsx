/**
 * المساعد الذكي — يجيب عن بياناتك، ولا ينفّذ شيئاً.
 *
 * معرفته هي بيانات التطبيق نفسها: الأرقام تُحسَب بالخدمات المختبَرة وتُسلَّم
 * للنموذج جاهزة، فدوره أن يشرح ويربط لا أن يجمع. وهو **للقراءة فقط**: لو طُلب
 * منه إجراء، يدلّك على مكانه في التطبيق.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { AppHeader } from '../components/ui/AppHeader';
import { useAppTheme } from '../hooks/useAppTheme';
import { buildContext, ASSISTANT_SYSTEM } from '../domain/services/AssistantContext';
import {
  loadAssistantConfig, askAssistant,
  type AssistantConfig, type ChatTurn,
} from '../lib/assistantClient';
import { getActiveOrgId } from '../lib/firestoreService';

const SUGGESTIONS = [
  'من أكثر المستأجرين تأخراً وكم يدين؟',
  'أي عقارٍ فيه أكبر عدد وحدات شاغرة؟',
  'ما مجموع ما سأخسره لو لم تُجدَّد العقود المنتهية؟',
  'قارن الإيراد المحصَّل بغير المسدَّد',
];

export default function AssistantScreen() {
  const { colors } = useAppTheme();
  const app = useApp();
  const { properties, units, contracts, tenants, payments, bookings, isAdmin, systemSettings } = app;

  const [config, setConfig]   = useState<AssistantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [turns, setTurns]     = useState<ChatTurn[]>([]);
  const [draft, setDraft]     = useState('');
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [notice, setNotice]   = useState<string | null>(null);
  // افتراضيّاً: مجاميع بلا أسماء — الأقل تسريباً هو الافتراضي
  const [detail, setDetail]   = useState<'aggregates' | 'named'>('aggregates');
  const [showSent, setShowSent] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // الإعداد يُقرأ مرة واحدة؛ القاعدة تمنع غير المدير فيرجع null
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cfg = await loadAssistantConfig(getActiveOrgId());
        if (alive) setConfig(cfg);
      } catch {
        if (alive) setConfig(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const context = useMemo(
    () => buildContext(
      { properties, units, contracts, tenants, payments, bookings },
      { currency: systemSettings?.currency ?? 'SAR', detail },
    ),
    [properties, units, contracts, tenants, payments, bookings, systemSettings?.currency, detail],
  );

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy || !config) return;
    setError(null);
    setDraft('');
    setTurns(prev => [...prev, { role: 'user', text: q }]);
    setBusy(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    const res = await askAssistant({
      config,
      system: ASSISTANT_SYSTEM,
      context,
      question: q,
      history: turns,
    });
    setBusy(false);

    if (res.ok) {
      setTurns(prev => [...prev, { role: 'model', text: res.answer }]);
      // النموذج المحفوظ أُوقِف وعمل بديل: أخبِر المدير ليحفظه فيتوقّف الاكتشاف المتكرر
      if (res.switchedFrom) {
        setNotice(`النموذج «${res.switchedFrom}» أُوقِف. استُخدم «${res.usedModel}» — احفظه في ضبط المساعد.`);
      }
    } else setError(res.message);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="المساعد" />
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    );
  }

  // غير مهيّأ: سبب واضح وخطوات، لا خطأ غامض
  if (!config) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="المساعد" />
        <View style={styles.center}>
          <Ionicons name="sparkles-outline" size={46} color={colors.textMuted} />
          <Text style={[styles.offTitle, { color: colors.text }]}>المساعد غير مهيّأ</Text>
          <Text style={[styles.offBody, { color: colors.textSecondary }]}>
            {isAdmin
              ? 'يحتاج المساعد مفتاح Gemini — وهو مجاني. دقيقة واحدة وتبدأ السؤال.'
              : 'المساعد متاح للمدير فقط. تواصل مع مدير النظام لتهيئته.'}
          </Text>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/assistant-settings')}
            >
              <Ionicons name="key-outline" size={17} color="#FFF" />
              <Text style={styles.ctaText}>تهيئة المساعد</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="المساعد" />

        <View style={[styles.privacyBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={styles.privacyToggle}
            onPress={() => setDetail(d => (d === 'aggregates' ? 'named' : 'aggregates'))}
          >
            <Ionicons
              name={detail === 'aggregates' ? 'eye-off-outline' : 'eye-outline'}
              size={16}
              color={detail === 'aggregates' ? colors.success : colors.warning}
            />
            <Text style={[styles.privacyText, { color: detail === 'aggregates' ? colors.success : colors.warning }]}>
              {detail === 'aggregates' ? 'بلا أسماء (مُوصى به)' : 'بالأسماء'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSent(v => !v)} hitSlop={8}>
            <Text style={[styles.privacyLink, { color: colors.secondary }]}>
              {showSent ? 'إخفاء' : 'ما يُرسَل؟'}
            </Text>
          </TouchableOpacity>
        </View>

        {showSent && (
          <ScrollView style={[styles.sentBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Text style={[styles.sentText, { color: colors.textSecondary }]} selectable>{context}</Text>
          </ScrollView>
        )}

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.feed}
          keyboardShouldPersistTaps="handled"
        >
          {turns.length === 0 && (
            <View style={[styles.intro, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="sparkles-outline" size={22} color={colors.primary} />
              <Text style={[styles.introTitle, { color: colors.text }]}>اسألني عن بياناتك</Text>
              <Text style={[styles.introBody, { color: colors.textSecondary }]}>
                أرى أرقام عقاراتك ووحداتك وعقودك ودفعاتك. أجيب وأحلّل، ولا أنفّذ أي إجراء.
                وافتراضيّاً **لا تُرسَل الأسماء** — اضغط «ما يُرسَل؟» لتراه بنفسك قبل أي سؤال.
              </Text>
              <View style={styles.chips}>
                {SUGGESTIONS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                    onPress={() => ask(s)}
                  >
                    <Text style={[styles.chipText, { color: colors.primary }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {turns.map((t, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                t.role === 'user'
                  ? { backgroundColor: colors.primary, alignSelf: 'flex-start' }
                  : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, alignSelf: 'flex-end' },
              ]}
            >
              <Text style={[styles.bubbleText, { color: t.role === 'user' ? '#FFF' : colors.text }]}>
                {t.text}
              </Text>
            </View>
          ))}

          {busy && (
            <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, alignSelf: 'flex-end' }]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}

          {notice && (
            <TouchableOpacity
              style={[styles.errorBox, { backgroundColor: colors.warning + '12', borderColor: colors.warning + '55' }]}
              onPress={() => router.push('/assistant-settings')}
            >
              <Ionicons name="swap-horizontal-outline" size={16} color={colors.warning} />
              <Text style={[styles.errorText, { color: colors.warning }]}>{notice}</Text>
            </TouchableOpacity>
          )}
          {error && (
            <View style={[styles.errorBox, { backgroundColor: colors.danger + '12', borderColor: colors.danger + '55' }]}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.composer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
            value={draft}
            onChangeText={setDraft}
            placeholder="اكتب سؤالك..."
            placeholderTextColor={colors.textMuted}
            multiline
            textAlign="right"
            onSubmitEditing={() => ask(draft)}
          />
          <TouchableOpacity
            style={[styles.send, { backgroundColor: draft.trim() && !busy ? colors.primary : colors.inputBg }]}
            onPress={() => ask(draft)}
            disabled={!draft.trim() || busy}
          >
            <Ionicons name="arrow-up" size={20} color={draft.trim() && !busy ? '#FFF' : colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: Theme.spacing.xl },
  offTitle: { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold, textAlign: 'center' },
  offBody: { fontSize: Theme.fontSize.sm, textAlign: 'center', lineHeight: 22, maxWidth: 360 },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4,
    paddingVertical: 11, paddingHorizontal: 18, borderRadius: Theme.radius.full,
  },
  ctaText: { color: '#FFF', fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold },
  feed: { padding: Theme.spacing.base, gap: 10, paddingBottom: 20 },
  intro: { padding: Theme.spacing.md, borderRadius: Theme.radius.lg, borderWidth: 1, gap: 8, alignItems: 'flex-end' },
  introTitle: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  introBody: { fontSize: Theme.fontSize.sm, textAlign: 'right', lineHeight: 21 },
  chips: { gap: 7, width: '100%', marginTop: 4 },
  chip: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: Theme.radius.md, borderWidth: 1 },
  chipText: { fontSize: Theme.fontSize.sm, textAlign: 'right' },
  bubble: { maxWidth: '88%', padding: Theme.spacing.md, borderRadius: Theme.radius.lg },
  bubbleText: { fontSize: Theme.fontSize.md, lineHeight: 24, textAlign: 'right' },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: Theme.spacing.md, borderRadius: Theme.radius.md, borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: Theme.fontSize.sm, textAlign: 'right', lineHeight: 20 },
  privacyBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.base, paddingVertical: 8, borderBottomWidth: 1,
  },
  privacyToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  privacyText: { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.semibold },
  privacyLink: { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.semibold },
  sentBox: { maxHeight: 190, margin: Theme.spacing.base, padding: 10, borderRadius: Theme.radius.md, borderWidth: 1 },
  sentText: { fontSize: 11, lineHeight: 17, textAlign: 'right', fontFamily: 'monospace' },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: Theme.spacing.md, borderTopWidth: 1,
  },
  input: {
    flex: 1, maxHeight: 110, minHeight: 44,
    paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11,
    borderRadius: Theme.radius.lg, borderWidth: 1, fontSize: Theme.fontSize.md,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
