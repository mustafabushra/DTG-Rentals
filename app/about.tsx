import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

const FEATURES = [
  { icon: 'business-outline',       title: 'إدارة العقارات',    desc: 'إدارة كاملة للعقارات والوحدات السكنية والتجارية' },
  { icon: 'document-text-outline',  title: 'عقود الإيجار',      desc: 'إنشاء العقود وتجديدها وتتبع حالتها بسهولة' },
  { icon: 'cash-outline',           title: 'الدفعات والإيرادات', desc: 'تتبع المدفوعات والمتأخرات وتقارير الإيرادات الشهرية' },
  { icon: 'people-outline',         title: 'إدارة المستأجرين',   desc: 'ملفات شاملة لكل مستأجر مع سجل كامل للتعاملات' },
  { icon: 'calendar-outline',       title: 'Google Calendar',    desc: 'مزامنة تلقائية للمواعيد والتذكيرات مع Google Calendar' },
  { icon: 'bar-chart-outline',      title: 'التقارير المالية',   desc: 'تقارير تفصيلية وإحصائيات لمساعدتك في اتخاذ القرارات' },
];

export default function AboutScreen() {
  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={styles.topBar}>
        <Text style={styles.brandName}>DTG Rentals</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.replace('/login')}>
          <Text style={styles.loginBtnText}>تسجيل الدخول</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <Ionicons name="business" size={56} color="#C3AF76" />
          </View>
          <Text style={styles.heroTitle}>DTG Rentals</Text>
          <Text style={styles.heroSub}>منصة إدارة العقارات والإيجارات الذكية</Text>
          <Text style={styles.heroDesc}>
            نظام متكامل يساعد ملاك العقارات وشركات الإدارة على تتبع العقود والمدفوعات
            والمستأجرين في مكان واحد — بسهولة وكفاءة عالية.
          </Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => router.replace('/login')}>
            <Text style={styles.ctaBtnText}>ابدأ الآن</Text>
            <Ionicons name="arrow-back-outline" size={18} color="#021C36" style={{ marginRight: 6 }} />
          </TouchableOpacity>
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>مميزات التطبيق</Text>
          <View style={styles.featuresGrid}>
            {FEATURES.map((f, i) => (
              <View key={i} style={styles.featureCard}>
                <View style={styles.featureIconWrap}>
                  <Ionicons name={f.icon as any} size={28} color="#C3AF76" />
                </View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer links */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
            <Text style={styles.footerLink}>سياسة الخصوصية</Text>
          </TouchableOpacity>
          <Text style={styles.footerDot}>·</Text>
          <TouchableOpacity onPress={() => router.push('/terms-of-service')}>
            <Text style={styles.footerLink}>شروط الخدمة</Text>
          </TouchableOpacity>
          <Text style={styles.footerDot}>·</Text>
          <TouchableOpacity onPress={() => router.push('/contact-us')}>
            <Text style={styles.footerLink}>تواصل معنا</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.copyright}>© {new Date().getFullYear()} DTG Rentals. جميع الحقوق محفوظة.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#021C36' },
  topBar:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(195,175,118,0.2)' },
  brandName:     { color: '#C3AF76', fontSize: 20, fontWeight: '800' },
  loginBtn:      { backgroundColor: '#C3AF76', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  loginBtnText:  { color: '#021C36', fontSize: 14, fontWeight: '700' },
  content:       { paddingBottom: 48 },
  hero:          { alignItems: 'center', paddingHorizontal: 32, paddingTop: 48, paddingBottom: 40 },
  logoWrap:      { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(195,175,118,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 2, borderColor: 'rgba(195,175,118,0.3)' },
  heroTitle:     { color: '#C3AF76', fontSize: 32, fontWeight: '800', marginBottom: 8 },
  heroSub:       { color: '#FFFFFF', fontSize: 17, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  heroDesc:      { color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 26, textAlign: 'center', marginBottom: 28 },
  ctaBtn:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#C3AF76', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 30 },
  ctaBtnText:    { color: '#021C36', fontSize: 16, fontWeight: '800' },
  featuresSection: { paddingHorizontal: 20, paddingTop: 8 },
  sectionTitle:  { color: '#FFFFFF', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  featuresGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  featureCard:   { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 20, width: '47%', minWidth: 150, borderWidth: 1, borderColor: 'rgba(195,175,118,0.15)', gap: 8 },
  featureIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(195,175,118,0.1)', justifyContent: 'center', alignItems: 'center' },
  featureTitle:  { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  featureDesc:   { color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 18 },
  footer:        { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 40, flexWrap: 'wrap' },
  footerLink:    { color: 'rgba(195,175,118,0.8)', fontSize: 13 },
  footerDot:     { color: 'rgba(255,255,255,0.3)', fontSize: 13 },
  copyright:     { color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', marginTop: 12 },
});
