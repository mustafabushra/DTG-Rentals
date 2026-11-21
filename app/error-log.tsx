/** سجل الأخطاء — اللي صار عند المستخدمين، مجمّع، وتقدر تعلّمه "انحل" */
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppHeader } from '../components/ui/AppHeader';
import { PageHint } from '../components/ui/PageHint';
import { useAppTheme } from '../hooks/useAppTheme';
import { useErrorLogs } from '../hooks/useErrorLogs';
import { useApp } from '../context/AppProvider';

function ago(iso: string) {
  const m = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (m < 60) return m <= 1 ? 'قبل دقيقة' : `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60); if (h < 24) return h === 1 ? 'قبل ساعة' : `قبل ${h} ساعات`;
  const d = Math.floor(h / 24); return d === 1 ? 'أمس' : `قبل ${d} أيام`;
}

export default function ErrorLogScreen() {
  const { colors } = useAppTheme();
  const { isAdmin } = useApp();
  const { groups, loading, reload, resolve } = useErrorLogs();
  const [open, setOpen] = useState<string | null>(null);

  if (!isAdmin) return <View style={{ flex: 1, backgroundColor: colors.background }}><AppHeader title="سجل الأخطاء" /></View>;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="سجل الأخطاء" rightText={{ label: loading ? '...' : 'تحديث', onPress: reload }} />
      <PageHint text="الأخطاء اللي صارت عند المستخدمين تنسجّل هنا تلقائياً. نفس الخطأ يطلع سطر واحد مع عدد مرّاته. أرسلها لي، ولما تنحل اضغط «انحل»." />
      <ScrollView contentContainerStyle={styles.content}>
        {groups.length === 0 && !loading && (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark-outline" size={30} color={colors.success} />
            <Text style={[styles.emptyT, { color: colors.text }]}>ما في أخطاء مسجّلة</Text>
          </View>
        )}
        {groups.map(g => {
          const isOpen = open === g.fingerprint;
          const fresh = Date.now() - Date.parse(g.lastAt) < 24 * 3600 * 1000;
          return (
            <View key={g.fingerprint} style={[styles.card, { backgroundColor: colors.card, borderColor: fresh ? colors.danger + '55' : colors.border }]}>
              <TouchableOpacity onPress={() => setOpen(isOpen ? null : g.fingerprint)} style={{ gap: 6 }}>
                <View style={styles.top}>
                  <View style={[styles.count, { backgroundColor: fresh ? colors.dangerSubtle : colors.surface }]}>
                    <Text style={{ color: fresh ? colors.danger : colors.textSecondary, fontWeight: '700' }}>{g.count}×</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.msg, { color: colors.text }]} numberOfLines={isOpen ? undefined : 2}>{g.message}</Text>
                    <Text style={[styles.sub, { color: colors.textMuted }]}>
                      {g.where} · آخر مرة {ago(g.lastAt)} · {g.users.slice(0, 3).join('، ')}{g.users.length > 3 ? ` +${g.users.length - 3}` : ''}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
              {isOpen && (
                <View style={[styles.detail, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.sub, { color: colors.textSecondary }]}>الصفحات: {g.pages.join('، ') || '—'}</Text>
                  {!!g.code && <Text style={[styles.sub, { color: colors.textSecondary }]}>الرمز: {g.code}</Text>}
                  <Text style={[styles.sub, { color: colors.textSecondary }]}>أول مرة {ago(g.firstAt)}</Text>
                  {!!g.stack && <Text style={[styles.stack, { color: colors.textMuted }]} selectable>{g.stack}</Text>}
                </View>
              )}
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => resolve(g)} style={[styles.btn, { borderColor: colors.border }]}>
                  <Ionicons name="checkmark" size={16} color={colors.success} />
                  <Text style={{ color: colors.text, fontWeight: '600' }}>انحل</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 40, width: '100%', maxWidth: 820, alignSelf: 'center' },
  empty: { alignItems: 'center', gap: 8, padding: 28, borderRadius: 14, borderWidth: 1 },
  emptyT: { fontSize: 15, fontWeight: '600' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  top: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  count: { minWidth: 40, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  msg: { fontSize: 14, fontWeight: '500', textAlign: 'right', lineHeight: 20 },
  sub: { fontSize: 12, textAlign: 'right' },
  detail: { borderRadius: 10, padding: 10, gap: 4 },
  stack: { fontSize: 11, textAlign: 'left', writingDirection: 'ltr', fontFamily: 'monospace' as any, marginTop: 4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-start' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, height: 34 },
});
