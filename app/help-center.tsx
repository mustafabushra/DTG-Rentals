import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../constants/Theme';
import { AppHeader } from '../components/ui/AppHeader';
import { FormContainer } from '../components/ui/FormContainer';
import { useAppTheme } from '../hooks/useAppTheme';

const FAQ = [
  { q: 'كيف أضيف عقاراً جديداً؟', a: 'من صفحة العقارات، اضغط على زر الإضافة (+) في أعلى الشاشة. أدخل البيانات المطلوبة وهي: الاسم، النوع، الموقع، عدد الطوابق، والمالك. ثم اضغط "حفظ".' },
  { q: 'كيف أسجل دفعة إيجار؟', a: 'من الصفحة الرئيسية اضغط "تسجيل دفعة" أو من قائمة المزيد ← المدفوعات ← زر الإضافة. اختر العقد والقسط المستحق، أدخل تاريخ الدفع وطريقته، ثم اضغط "تسجيل".' },
  { q: 'كيف أتابع طلبات الصيانة؟', a: 'من قائمة المزيد اختر "الصيانة". ستجد جميع الطلبات مرتبة حسب الأولوية والحالة. يمكنك فتح أي طلب لتغيير حالته أو تعيين فني.' },
  { q: 'كيف أعرف العقود التي قاربت على الانتهاء؟', a: 'الصفحة الرئيسية تعرض تنبيهات العقود التي تنتهي خلال 90 يوماً. يمكنك أيضاً مراجعة التقويم من قائمة المزيد لرؤية جميع المواعيد.' },
  { q: 'كيف أصدر تقارير مالية؟', a: 'من قائمة المزيد اختر "التقارير المالية". يمكنك تحديد الفترة الزمنية (شهر / 3 أشهر / 6 أشهر / سنة) وعرض ملخص الإيرادات والتحصيل لكل عقار.' },
  { q: 'كيف أغير كلمة المرور؟', a: 'من الإعدادات ← قسم الأمان ← "تغيير كلمة المرور". أدخل كلمة المرور الحالية، ثم كلمة المرور الجديدة مرتين للتأكيد.' },
];

export default function HelpCenterScreen() {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="مركز المساعدة" />

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header Banner */}
        <View style={[styles.banner, { backgroundColor: colors.primary }]}>
          <Ionicons name="help-buoy-outline" size={40} color="#FFFFFF" />
          <Text style={styles.bannerTitle}>كيف يمكننا مساعدتك؟</Text>
          <Text style={styles.bannerSub}>الأسئلة الشائعة والإجابات</Text>
        </View>

        {/* FAQ */}
        <View style={styles.faqSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>الأسئلة الشائعة</Text>
          {FAQ.map((item, i) => {
            const isOpen = expanded === i;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.faqCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setExpanded(isOpen ? null : i)}
                activeOpacity={0.85}
              >
                <View style={styles.faqHeader}>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                  <Text style={[styles.faqQuestion, { color: colors.text }]}>{item.q}</Text>
                  <View style={[styles.qNum, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.qNumText, { color: colors.primary }]}>{i + 1}</Text>
                  </View>
                </View>
                {isOpen && (
                  <View style={[styles.faqAnswer, { borderTopColor: colors.border }]}>
                    <Text style={[styles.faqAnswerText, { color: colors.textSecondary }]}>{item.a}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Contact Banner */}
        <View style={[styles.contactBanner, { backgroundColor: colors.accent, borderColor: colors.border }]}>
          <Text style={[styles.contactTitle, { color: colors.text }]}>لم تجد إجابتك؟</Text>
          <Text style={[styles.contactSub, { color: colors.textSecondary }]}>تواصل معنا وسنرد عليك في أقرب وقت</Text>
          <TouchableOpacity style={[styles.contactBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/contact-us')}>
            <Text style={styles.contactBtnText}>اتصل بنا</Text>
          </TouchableOpacity>
        </View>
      </ScrollView></FormContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: {
    margin: Theme.spacing.base, borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xl, alignItems: 'center', gap: 8,
  },
  bannerTitle: { color: '#FFF', fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold },
  bannerSub: { color: 'rgba(255,255,255,0.8)', fontSize: Theme.fontSize.md },
  faqSection: { paddingHorizontal: Theme.spacing.base },
  sectionTitle: { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold, marginBottom: Theme.spacing.md },
  faqCard: {
    borderRadius: Theme.radius.lg, borderWidth: 1, marginBottom: Theme.spacing.sm, overflow: 'hidden',
  },
  faqHeader: { flexDirection: 'row', alignItems: 'center', padding: Theme.spacing.md, gap: 10 },
  qNum: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  qNumText: { fontSize: Theme.fontSize.sm, fontWeight: '700' },
  faqQuestion: { flex: 1, fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.semibold },
  faqAnswer: { padding: Theme.spacing.md, borderTopWidth: 1 },
  faqAnswerText: { fontSize: Theme.fontSize.md, lineHeight: 24 },
  contactBanner: {
    margin: Theme.spacing.base, borderRadius: Theme.radius.xl, borderWidth: 1,
    padding: Theme.spacing.xl, alignItems: 'center', gap: 8,
  },
  contactTitle: { fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold },
  contactSub: { fontSize: Theme.fontSize.md, textAlign: 'center' },
  contactBtn: { marginTop: 8, paddingHorizontal: 32, paddingVertical: 12, borderRadius: Theme.radius.lg },
  contactBtnText: { color: '#FFF', fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
});
