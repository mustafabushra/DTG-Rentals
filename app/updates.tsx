import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { AppHeader } from '../components/ui/AppHeader';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useAppTheme } from '../hooks/useAppTheme';
import { db } from '../lib/firebase';

interface AppUpdate {
  id: string;
  version: string;
  date: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  order?: number;
}

export default function UpdatesScreen() {
  const { colors } = useAppTheme();
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  // اشتراك لحظي بسجل تحديثات التطبيق (appUpdates) — أي إضافة/تعديل/حذف ينعكس فوراً
  // على كل الجلسات والتبويبات عبر onSnapshot. الترتيب: الأحدث أولاً (order تنازلياً).
  useEffect(() => {
    const q = query(collection(db, 'appUpdates'), orderBy('order', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      snap => {
        // اللقطة هي مصدر الحقيقة الوحيد (مفتاح = معرّف المستند) → لا تكرار ولا أشباح
        setUpdates(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<AppUpdate, 'id'>) })));
        setLoading(false);
      },
      err => {
        console.error('[updates] snapshot error:', err);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="آخر التحديثات" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.introBox}>
          <Text style={[styles.introTitle, { color: colors.text }]}>ما الجديد؟</Text>
          <Text style={[styles.introSub, { color: colors.textSecondary }]}>
            هنا تجد شرحاً بسيطاً لكل الميزات الجديدة والإصلاحات التي نقوم بها لتطوير تجربتك.
          </Text>
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : updates.length === 0 ? (
          <View style={styles.stateBox}>
            <Ionicons name="megaphone-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.stateText, { color: colors.textMuted }]}>لا توجد تحديثات بعد</Text>
          </View>
        ) : (
          <View style={styles.timelineContainer}>
            {updates.map((update, index) => (
              <View key={update.id} style={styles.updateItem}>
                {/* Timeline Connector */}
                <View style={styles.timelineLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: update.color || colors.primary }]}>
                    <Ionicons name={(update.icon || 'sparkles-outline') as any} size={22} color="#FFF" />
                  </View>
                  {index !== updates.length - 1 && (
                    <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                  )}
                </View>

                {/* Update Card */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.updateVersion, { color: update.color || colors.primary }]}>{update.version}</Text>
                    <Text style={[styles.updateDate, { color: colors.textMuted }]}>{update.date}</Text>
                  </View>

                  <Text style={[styles.updateTitle, { color: colors.text }]}>{update.title}</Text>
                  <Text style={[styles.updateDesc, { color: colors.textSecondary }]}>{update.description}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: Theme.spacing.base },
  introBox: { marginBottom: 24, paddingHorizontal: 4 },
  introTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 8, textAlign: 'right' },
  introSub: { fontSize: 15, lineHeight: 22, textAlign: 'right' },
  stateBox: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
  stateText: { fontSize: 15, textAlign: 'center' },
  timelineContainer: { paddingRight: 4 },
  updateItem: { flexDirection: 'row-reverse', gap: 16, marginBottom: 20 },
  timelineLeft: { alignItems: 'center', width: 44 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  timelineLine: { width: 2, flex: 1, marginVertical: 4 },
  card: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 16, gap: 8, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  updateVersion: { fontSize: 13, fontWeight: 'bold' },
  updateDate: { fontSize: 12 },
  updateTitle: { fontSize: 17, fontWeight: 'bold', textAlign: 'right' },
  updateDesc: { fontSize: 14, lineHeight: 21, textAlign: 'right' },
});
