import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Theme } from '../constants/Theme';
import { AppHeader } from '../components/ui/AppHeader';
import { FormContainer } from '../components/ui/FormContainer';
import { useAppTheme } from '../hooks/useAppTheme';

const SECTIONS = [
  {
    title: '١. القبول بالشروط',
    body: 'باستخدامك لتطبيق DTG Rentals فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي من هذه الشروط، يُرجى التوقف عن استخدام التطبيق.',
  },
  {
    title: '٢. وصف الخدمة',
    body: 'DTG Rentals هو تطبيق لإدارة العقارات والإيجارات يتيح للمستخدمين:\n• إدارة العقارات والوحدات والعقود.\n• تتبع المدفوعات والإيرادات.\n• إدارة بيانات المستأجرين والملاك.\n• جدولة المواعيد والتذكيرات عبر Google Calendar.\n• إنشاء التقارير المالية.',
  },
  {
    title: '٣. حساب المستخدم',
    body: 'أنت مسؤول عن:\n• الحفاظ على سرية بيانات تسجيل الدخول الخاصة بك.\n• جميع الأنشطة التي تجري تحت حسابك.\n• إخطارنا فوراً عند الاشتباه في أي استخدام غير مصرح به لحسابك.\n\nنحتفظ بالحق في إيقاف الحسابات التي تنتهك هذه الشروط.',
  },
  {
    title: '٤. الاستخدام المقبول',
    body: 'يوافق المستخدم على عدم:\n• استخدام التطبيق لأغراض غير مشروعة أو احتيالية.\n• محاولة اختراق أو تعطيل أنظمة التطبيق.\n• نشر أو مشاركة بيانات مستخدمين آخرين دون إذن.\n• رفع محتوى ضار أو مسيء.\n• انتهاك حقوق الملكية الفكرية للتطبيق.',
  },
  {
    title: '٥. تكامل Google Calendar',
    body: 'عند ربط حساب Google Calendar:\n• توافق على شروط خدمة Google بالإضافة إلى شروطنا.\n• نحصل على إذن محدود لإنشاء الأحداث فقط في تقويمك.\n• يمكنك إلغاء هذا الإذن في أي وقت من إعدادات التطبيق أو من إعدادات حساب Google.\n• لسنا مسؤولين عن أي تغييرات تطرأ على خدمة Google Calendar.',
  },
  {
    title: '٦. الملكية الفكرية',
    body: 'جميع حقوق الملكية الفكرية المتعلقة بالتطبيق، بما في ذلك التصميم والكود البرمجي والمحتوى، مملوكة لـ DTG Rentals. لا يمنحك استخدام التطبيق أي حق في نسخه أو توزيعه أو تعديله.',
  },
  {
    title: '٧. البيانات والخصوصية',
    body: 'يخضع جمع بياناتك واستخدامها لسياسة الخصوصية الخاصة بنا والمتاحة على التطبيق. أنت تمتلك بياناتك التي تدخلها في التطبيق، ويمكنك طلب تصديرها أو حذفها في أي وقت.',
  },
  {
    title: '٨. إخلاء المسؤولية',
    body: 'يُقدَّم التطبيق "كما هو" دون ضمانات من أي نوع. لا نتحمل المسؤولية عن:\n• أي خسائر تجارية أو مالية ناتجة عن استخدام التطبيق.\n• انقطاعات الخدمة أو فقدان البيانات بسبب ظروف خارجة عن إرادتنا.\n• دقة المعلومات التي يدخلها المستخدمون.',
  },
  {
    title: '٩. التعديلات على الشروط',
    body: 'نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سنُعلمك بالتغييرات الجوهرية عبر إشعار داخل التطبيق أو بريد إلكتروني. استمرارك في الاستخدام بعد التحديث يُعدّ قبولاً للشروط الجديدة.',
  },
  {
    title: '١٠. القانون المطبق',
    body: 'تخضع هذه الشروط لقوانين المملكة العربية السعودية. أي نزاع ينشأ عن استخدام التطبيق يُحال للجهات القضائية المختصة في المملكة العربية السعودية.',
  },
  {
    title: '١١. التواصل معنا',
    body: 'لأي استفسار حول هذه الشروط، تواصل معنا عبر:\n• البريد الإلكتروني: support@dtgrentals.com\n• أوقات العمل: الأحد – الخميس، 9ص – 5م',
  },
];

export default function TermsOfServiceScreen() {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="شروط الخدمة" />

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.updatedBanner, { backgroundColor: colors.accent, borderColor: colors.border }]}>
          <Text style={[styles.updatedText, { color: colors.textSecondary }]}>آخر تحديث: ١١ يونيو ٢٠٢٦</Text>
        </View>

        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          يُرجى قراءة هذه الشروط بعناية قبل استخدام تطبيق DTG Rentals. باستخدامك للتطبيق فأنت توافق على الالتزام بهذه الشروط والأحكام.
        </Text>

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
