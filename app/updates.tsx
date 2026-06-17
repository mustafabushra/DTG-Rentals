import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { AppHeader } from '../components/ui/AppHeader';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useAppTheme } from '../hooks/useAppTheme';

interface AppUpdate {
  id: string;
  version: string;
  date: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

const APP_UPDATES: AppUpdate[] = [
  {
    id: '4',
    version: 'v1.0.4',
    date: '2026-06-17',
    title: 'تحسين نظام التخزين السحابي',
    description: 'قمنا بتطوير نظام تخزين الملفات والصور ليعمل بشكل احترافي عبر السحاب. هذا يضمن ظهور الصور والمستندات بسرعة فائقة وبجودة عالية على جميع أنواع الأجهزة، مع حل مشكلة التعليق أثناء التحميل بشكل نهائي.',
    icon: 'cloud-done-outline',
    color: '#9B59B6',
  },
  {
    id: '3',
    version: 'v1.0.3',
    date: '2026-06-17',
    title: 'إصلاح مشكلة المرفقات والملفات',
    description: 'تم حل مشكلة الملفات والصور التي لم تكن تظهر أبداً. الآن يمكنك رفع صور العقود، الهويات، والوصولات بكل سهولة وستبقى محفوظة وتظهر لك في أي وقت ومن أي جهاز.',
    icon: 'attach-outline',
    color: '#3498DB',
  },
  {
    id: '2',
    version: 'v1.0.2',
    date: '2026-06-15',
    title: 'تحسين سرعة حفظ البيانات',
    description: 'قمنا بجعل التطبيق أسرع في حفظ المعلومات وتحديثها، لضمان عدم ضياع أي بيانات أثناء العمل حتى لو كان الاتصال ضعيفاً.',
    icon: 'flash-outline',
    color: '#F1C40F',
  },
  {
    id: '1',
    version: 'v1.0.1',
    date: '2026-06-10',
    title: 'إطلاق نظام إدارة العقارات',
    description: 'البدء الفعلي للتطبيق مع ميزات إدارة الملاك، المستأجرين، العقارات، والوحدات، مع نظام متطور لمتابعة العقود والتحصيل المالي.',
    icon: 'rocket-outline',
    color: '#27AE60',
  },
];

export default function UpdatesScreen() {
  const { colors } = useAppTheme();

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

        <View style={styles.timelineContainer}>
          {APP_UPDATES.map((update, index) => (
            <View key={update.id} style={styles.updateItem}>
              {/* Timeline Connector */}
              <View style={styles.timelineLeft}>
                <View style={[styles.iconCircle, { backgroundColor: update.color }]}>
                  <Ionicons name={update.icon as any} size={22} color="#FFF" />
                </View>
                {index !== APP_UPDATES.length - 1 && (
                  <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                )}
              </View>

              {/* Update Card */}
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.updateVersion, { color: update.color }]}>{update.version}</Text>
                  <Text style={[styles.updateDate, { color: colors.textMuted }]}>{update.date}</Text>
                </View>
                
                <Text style={[styles.updateTitle, { color: colors.text }]}>{update.title}</Text>
                <Text style={[styles.updateDesc, { color: colors.textSecondary }]}>{update.description}</Text>
              </View>
            </View>
          ))}
        </View>
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
