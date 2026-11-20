/**
 * DashboardHero — الواجهة الكحلية أعلى الرئيسية.
 * سطر واحد يقول حالة المحفظة اليوم، وشريط ذهبي يقول كم تحصّل من مستحقات هذا الشهر.
 * هي العنصر المميز الوحيد في الصفحة؛ كل ما تحتها أبيض هادئ.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useScreenSize } from '../../hooks/useScreenSize';
import { CurrencyText } from '../ui/CurrencyText';

const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const DAYS = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

const GOLD = '#D4BC8A';
const GOLD_SOFT = '#E7D8B8';

interface Props {
  firstName: string;
  topInset: number;
  notifCount: number;
  onMenu?: () => void;
  stats: { properties: number; rented: number; totalUnits: number; monthlyRevenue: number; openMaintenance: number };
  collection: { collected: number; totalDue: number };
}

function greeting(h: number) {
  if (h < 12) return 'صباح الخير';
  if (h < 18) return 'مساء الخير';
  return 'مساء النور';
}

export function DashboardHero({ firstName, topInset, notifCount, onMenu, stats, collection }: Props) {
  const { colors } = useAppTheme();
  const { isMobile, isSmallPhone, hPad } = useScreenSize();
  const now = new Date();
  const rate = collection.totalDue > 0 ? Math.min(100, Math.round((collection.collected / collection.totalDue) * 100)) : 0;
  const remaining = Math.max(0, collection.totalDue - collection.collected);
  const occupancy = stats.totalUnits > 0 ? Math.round((stats.rented / stats.totalUnits) * 100) : 0;

  const figures = [
    { label: 'عقار', value: stats.properties.toLocaleString('en-US'), route: '/(tabs)/properties' },
    { label: `مؤجرة من ${stats.totalUnits}`, value: stats.rented.toLocaleString('en-US'), hint: `${occupancy}%`, route: '/units' },
    { label: 'صيانة مفتوحة', value: stats.openMaintenance.toLocaleString('en-US'), route: '/maintenance' },
  ];

  return (
    <View style={[styles.wrap, { backgroundColor: colors.chrome, paddingTop: topInset + (isSmallPhone ? 10 : 18), paddingHorizontal: hPad + (isMobile ? 4 : 12) }]}>
      {/* الصف العلوي */}
      <View style={styles.top}>
        {onMenu && (
          <TouchableOpacity onPress={onMenu} style={styles.iconBtn} accessibilityLabel="فتح القائمة">
            <Ionicons name="menu-outline" size={24} color={colors.chromeText} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.hello, { color: colors.chromeText }, isSmallPhone && { fontSize: 20 }]}>
            {greeting(now.getHours())}{firstName ? `، ${firstName}` : ''}
          </Text>
          <Text style={[styles.date, { color: colors.chromeMuted }]}>
            {DAYS[now.getDay()]} {now.getDate()} {MONTHS[now.getMonth()]} {now.getFullYear()}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/notifications')} style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.06)' }]} accessibilityLabel="الإشعارات">
          <Ionicons name="notifications-outline" size={21} color={colors.chromeText} />
          {notifCount > 0 && (
            <View style={styles.badge}><Text style={styles.badgeTxt}>{notifCount > 99 ? '99+' : notifCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {/* الأرقام: نص على الكحلي مفصول بخطوط رفيعة — لا كروت */}
      <View style={[styles.figures, isMobile && styles.figuresMobile]}>
        <TouchableOpacity onPress={() => router.push('/financial-reports' as any)} style={[styles.revenue, isMobile && { width: '100%' }]} activeOpacity={0.8}>
          <Text style={[styles.figLabel, { color: colors.chromeMuted }]}>الإيراد الشهري المتوقع</Text>
          <CurrencyText amount={stats.monthlyRevenue} size={isSmallPhone ? 28 : 36} color="#FFFFFF" style={{ fontWeight: '600' }} />
        </TouchableOpacity>
        <View style={[styles.figRow, isMobile && { width: '100%' }]}>
          {figures.map((f, i) => (
            <TouchableOpacity
              key={f.label}
              onPress={() => router.push(f.route as any)}
              activeOpacity={0.8}
              style={[styles.fig, isMobile ? { flex: 1 } : { minWidth: 130 }, i > 0 && { borderRightWidth: 1, borderRightColor: colors.chromeBorder }]}
            >
              <View style={styles.figValRow}>
                <Text style={[styles.figVal, isSmallPhone && { fontSize: 22 }]}>{f.value}</Text>
                {f.hint && <Text style={[styles.figHint, { color: GOLD }]}>{f.hint}</Text>}
              </View>
              <Text style={[styles.figLabel, { color: colors.chromeMuted }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* تحصيل الشهر: الشريط الذهبي */}
      <TouchableOpacity onPress={() => router.push('/collections' as any)} activeOpacity={0.85} style={[styles.collect, { borderTopColor: colors.chromeBorder }]}>
        <View style={styles.collectHead}>
          <Text style={[styles.collectTitle, { color: colors.chromeText }]}>تحصيل {MONTHS[now.getMonth()]}</Text>
          <Text style={[styles.collectPct, { color: GOLD_SOFT }]}>{rate}%</Text>
        </View>
        <View style={[styles.track, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
          <View style={[styles.fill, { width: `${rate}%` as any }]} />
        </View>
        <View style={styles.collectFoot}>
          <View style={styles.collectItem}>
            <Text style={[styles.collectLbl, { color: colors.chromeMuted }]}>تحصّل</Text>
            <CurrencyText amount={collection.collected} size={14} color="#FFFFFF" />
          </View>
          <View style={styles.collectItem}>
            <Text style={[styles.collectLbl, { color: colors.chromeMuted }]}>متبقٍ</Text>
            <CurrencyText amount={remaining} size={14} color={remaining > 0 ? GOLD_SOFT : '#FFFFFF'} />
          </View>
          <View style={styles.collectItem}>
            <Text style={[styles.collectLbl, { color: colors.chromeMuted }]}>مستحق الشهر</Text>
            <CurrencyText amount={collection.totalDue} size={14} color={colors.chromeText} />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 22,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
    ...(Platform.OS === 'web' ? { backgroundImage: 'radial-gradient(120% 140% at 100% 0%, rgba(176,141,79,0.16) 0%, rgba(176,141,79,0) 55%)' } as any : {}),
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hello: { fontSize: 24, fontWeight: '600', textAlign: 'right' },
  date: { fontSize: 13, marginTop: 2, textAlign: 'right' },
  iconBtn: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, left: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#D9432F', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTxt: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  figures: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginTop: 26, flexWrap: 'wrap' },
  figuresMobile: { flexDirection: 'column', alignItems: 'stretch', gap: 18, marginTop: 20 },
  revenue: { gap: 4 },
  figRow: { flexDirection: 'row' },
  fig: { paddingHorizontal: 16, gap: 2 },
  figValRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  figVal: { color: '#FFFFFF', fontSize: 26, fontWeight: '600', textAlign: 'right' },
  figHint: { fontSize: 13, fontWeight: '600' },
  figLabel: { fontSize: 12, textAlign: 'right' },
  collect: { marginTop: 22, paddingTop: 16, borderTopWidth: 1, gap: 10 },
  collectHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  collectTitle: { fontSize: 14, fontWeight: '500' },
  collectPct: { fontSize: 16, fontWeight: '700' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: GOLD },
  collectFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  collectItem: { gap: 2 },
  collectLbl: { fontSize: 11, textAlign: 'right' },
});
