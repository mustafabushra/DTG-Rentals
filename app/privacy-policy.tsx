import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Theme } from '../constants/Theme';
import { AppHeader } from '../components/ui/AppHeader';
import { FormContainer } from '../components/ui/FormContainer';
import { useAppTheme } from '../hooks/useAppTheme';

const SECTIONS = [
  {
    title: '١. مقدمة',
    body: 'مرحباً بك في تطبيق DTG Rentals. نحن نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. توضح هذه السياسة كيفية جمع معلوماتك واستخدامها والحفاظ عليها عند استخدامك للتطبيق.',
  },
  {
    title: '٢. البيانات التي نجمعها',
    body: 'نجمع المعلومات التالية:\n• بيانات الحساب: الاسم، البريد الإلكتروني، رقم الجوال.\n• بيانات العقارات والعقود: المعلومات التي تدخلها بنفسك لإدارة أعمالك.\n• بيانات الاستخدام: سجلات الوصول وأنماط الاستخدام لتحسين الخدمة.\n• بيانات الجهاز: نظام التشغيل، إصدار التطبيق، معرّف الجهاز.',
  },
  {
    title: '٣. كيف نستخدم بياناتك',
    body: 'نستخدم بياناتك من أجل:\n• توفير خدمات إدارة العقارات والعقود والمدفوعات.\n• إرسال الإشعارات المتعلقة بمواعيد الإيجار والصيانة.\n• تحسين أداء التطبيق وتجربة المستخدم.\n• الامتثال للمتطلبات القانونية والتنظيمية في المملكة العربية السعودية.',
  },
  {
    title: '٤. مشاركة البيانات',
    body: 'لا نبيع بياناتك الشخصية ولا نشاركها مع أطراف ثالثة إلا في الحالات التالية:\n• عند الحصول على موافقتك الصريحة.\n• عند الاقتضاء القانوني أو بموجب أمر قضائي.\n• مع مزودي الخدمات الموثوقين الملتزمين بسرية البيانات.',
  },
  {
    title: '٥. أمان البيانات',
    body: 'نتخذ إجراءات أمنية صارمة لحماية بياناتك، تشمل:\n• تشفير البيانات أثناء النقل (TLS/SSL).\n• تشفير قواعد البيانات في حالة السكون.\n• ضوابط وصول مشددة وتدقيق دوري.\n• نسخ احتياطية منتظمة.',
  },
  {
    title: '٦. حقوقك',
    body: 'يحق لك في أي وقت:\n• الاطلاع على بياناتك الشخصية وتصحيحها.\n• طلب حذف بياناتك.\n• تقييد معالجة بياناتك.\n• الاعتراض على استخدام بياناتك لأغراض تسويقية.\n• طلب نقل بياناتك إلى خدمة أخرى.\n\nللإعمال أي من هذه الحقوق تواصل معنا عبر صفحة "اتصل بنا".',
  },
  {
    title: '٧. الاحتفاظ بالبيانات',
    body: 'نحتفظ ببياناتك طوال فترة نشاط حسابك. بعد إغلاق الحساب، قد نحتفظ ببعض البيانات لمدة لا تتجاوز 3 سنوات للامتثال للمتطلبات القانونية والمحاسبية.',
  },
  {
    title: '٨. ملفات تعريف الارتباط',
    body: 'يستخدم التطبيق تخزيناً محلياً (Local Storage / AsyncStorage) لحفظ إعداداتك وتفضيلاتك. لا نستخدم ملفات تعريف الارتباط لأغراض إعلانية.',
  },
  {
    title: '٩. التغييرات على هذه السياسة',
    body: 'قد نُحدّث هذه السياسة من وقت لآخر. سنُعلمك بأي تغييرات جوهرية عبر إشعار داخل التطبيق أو بريد إلكتروني. استمرارك في استخدام التطبيق بعد التحديث يعني قبولك للسياسة الجديدة.',
  },
  {
    title: '١٠. التواصل معنا',
    body: 'إذا كان لديك أي استفسار حول هذه السياسة أو ممارساتنا المتعلقة بالخصوصية، يمكنك التواصل معنا عبر:\n• البريد الإلكتروني: privacy@dtgrentals.com\n• الهاتف: 920 000 000\n• أوقات العمل: الأحد – الخميس، 9ص – 5م',
  },
];

export default function PrivacyPolicyScreen() {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="سياسة الخصوصية" />

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Last Updated */}
        <View style={[styles.updatedBanner, { backgroundColor: colors.accent, borderColor: colors.border }]}>
          <Text style={[styles.updatedText, { color: colors.textSecondary }]}>آخر تحديث: ١ يناير ٢٠٢٥</Text>
        </View>

        {/* Intro */}
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          يُرجى قراءة هذه السياسة بعناية قبل استخدام التطبيق. باستخدامك لـ DTG Rentals فأنت توافق على الشروط الواردة فيها.
        </Text>

        {/* Sections */}
        {SECTIONS.map((sec, i) => (
          <View key={i} style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>{sec.title}</Text>
            <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{sec.body}</Text>
          </View>
        ))}
      </ScrollView></FormContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Theme.spacing.base, gap: Theme.spacing.md, paddingBottom: 48 },
  updatedBanner: { borderRadius: Theme.radius.md, borderWidth: 1, padding: Theme.spacing.sm, alignItems: 'center' },
  updatedText: { fontSize: Theme.fontSize.sm },
  intro: { fontSize: Theme.fontSize.md, lineHeight: 24 },
  section: { borderRadius: Theme.radius.lg, borderWidth: 1, padding: Theme.spacing.md, gap: 8 },
  sectionTitle: { fontSize: Theme.fontSize.base, fontWeight: '700' },
  sectionBody: { fontSize: Theme.fontSize.md, lineHeight: 26 },
});
