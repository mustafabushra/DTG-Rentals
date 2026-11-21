import { Toggle } from '../components/ui/Toggle';
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../constants/Theme';
import { useApp, ThemeMode } from '../context/AppProvider';
import { ConfirmModal } from '../components/ui/Modal';
import { isAdminRole } from '../utils/roleUtils';
import { useScreenSize } from '../hooks/useScreenSize';
import { useSidebar } from '../context/SidebarContext';
import { useAppTheme } from '../hooks/useAppTheme';
import { AppHeader } from '../components/ui/AppHeader';
import {
  connectGoogleCalendar, disconnectCalendar, loadToken,
  syncToGoogleCalendar, buildSyncItems, parseOAuthRedirectHash, saveToken,
} from '../lib/googleCalendar';

export default function SettingsScreen() {
  const insets   = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const {
    currentUser, logout,
    theme, setTheme,
    notificationPrefs, setNotificationPref,
    resetSystem,
    kpis,
    contracts, payments, tenants, units, properties, isOwner, previewing,
  } = useApp();

  const [showReset,        setShowReset]        = useState(false);
  const [calConnected,     setCalConnected]     = useState(false);
  const [calLoading,       setCalLoading]       = useState(false);
  const [calSyncing,       setCalSyncing]       = useState(false);
  const isAdmin = isAdminRole(currentUser.role);
  const ownerMode = isOwner || previewing;
  const initials = (currentUser.name || '؟').split(' ').slice(0, 2).map((n: string) => n[0] ?? '').join('') || '؟';
  const { isMobile, isDesktop, isTablet } = useScreenSize();
  const { toggle: toggleSidebar } = useSidebar();

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleLogout = () => {
    const doLogout = () => { logout(); router.replace('/login'); };
    if (typeof window !== 'undefined' && !window.confirm) {
      doLogout();
      return;
    }
    if (typeof window !== 'undefined') {
      if (window.confirm('هل أنت متأكد من تسجيل الخروج؟')) doLogout();
      return;
    }
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد من تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: doLogout },
    ]);
  };

  const handleTheme = (t: ThemeMode) => {
    setTheme(t);
  };

  const handleLanguage = (lang: 'ar' | 'en') => {
    if (lang === 'en') {
      Alert.alert('قريباً', 'اللغة الإنجليزية ستتوفر في التحديث القادم. حالياً النظام يعمل بالعربية فقط.');
    } else {
      Alert.alert('اللغة العربية', 'اللغة العربية محددة حالياً.');
    }
  };

  const handleResetConfirm = async () => {
    setShowReset(false);
    try {
      await resetSystem();
      Alert.alert('تم التصفير', 'تم تصفير جميع بيانات النظام بنجاح.\nتم الاحتفاظ بحسابات المستخدمين والإعدادات.');
    } catch {
      Alert.alert('خطأ', 'حدث خطأ أثناء التصفير، حاول مجدداً');
    }
  };

  // ── sub-components ─────────────────────────────────────────────────────────
  // عنوان قسم: نص صغير هادئ فوق البطاقة، بدون شريط خلفية
  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>{title}</Text>
  );

  // بطاقة مجموعة: تشيل الخط الفاصل من آخر عنصر
  const Group = ({ children }: { children: React.ReactNode }) => {
    const kids = React.Children.toArray(children).filter(Boolean);
    return (
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {kids.map((c, i) => React.isValidElement(c) ? React.cloneElement(c as any, { last: i === kids.length - 1 }) : c)}
      </View>
    );
  };

  const Item = ({
    icon, label, sub, value, onPress, danger,
    isSwitch, switchVal, onSwitch, last,
  }: {
    icon: string; label: string; sub?: string; value?: string; onPress?: () => void;
    color?: string; danger?: boolean; isSwitch?: boolean;
    switchVal?: boolean; onSwitch?: (v: boolean) => void; last?: boolean;
  }) => {
    const tint = danger ? colors.danger : colors.primary;
    return (
      <TouchableOpacity
        style={[styles.item, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
        onPress={isSwitch ? () => onSwitch?.(!switchVal) : onPress}
        activeOpacity={0.7}
        accessibilityRole={isSwitch ? 'switch' : 'button'}
      >
        <View style={[styles.itemIcon, { backgroundColor: tint + '1A' }]}>
          <Ionicons name={icon as any} size={17} color={tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemLabel, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
          {!!sub && <Text style={[styles.itemSub, { color: colors.textMuted }]}>{sub}</Text>}
        </View>
        {isSwitch ? (
          <Toggle value={switchVal} onValueChange={onSwitch}
            trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#FFFFFF" />
        ) : (
          <>
            {!!value && <Text style={[styles.itemValue, { color: colors.textMuted }]}>{value}</Text>}
            <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
          </>
        )}
      </TouchableOpacity>
    );
  };

  // ── Google Calendar ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return;
    loadToken(currentUser.id).then(t => setCalConnected(!!t?.connected));
  }, [currentUser?.id]);

  // استقبال token بعد redirect من Google على الجوال
  useEffect(() => {
    if (!currentUser?.id || Platform.OS !== 'web') return;
    const result = parseOAuthRedirectHash();
    if (!result) return;
    // نظف الـ hash من URL
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
    }
    const token = {
      accessToken: result.accessToken,
      expiresAt:   Date.now() + (result.expiresIn - 60) * 1000,
      connected:   true,
    };
    saveToken(currentUser.id, token).then(() => {
      setCalConnected(true);
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('تم ربط Google Calendar بنجاح ✓');
      }
    });
  }, [currentUser?.id]);

  const handleConnectCalendar = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('غير متاح', 'ربط Google Calendar متاح على الويب فقط حالياً.');
      return;
    }
    setCalLoading(true);
    try {
      await connectGoogleCalendar(currentUser.id);
      setCalConnected(true);
      Alert.alert('تم الربط ✓', 'تم ربط Google Calendar بنجاح. اضغط "مزامنة" لرفع المواعيد.');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message ?? 'فشل الربط، حاول مجدداً');
    } finally {
      setCalLoading(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    if (typeof window !== 'undefined' && window.confirm) {
      if (!window.confirm('هل تريد قطع الاتصال بـ Google Calendar؟')) return;
    }
    await disconnectCalendar(currentUser.id);
    setCalConnected(false);
  };

  const handleSyncCalendar = async () => {
    setCalSyncing(true);
    try {
      const items = buildSyncItems({ contracts, payments, tenants, units, properties });
      const result = await syncToGoogleCalendar(currentUser.id, items);
      if (result.error === 'token_expired') {
        Alert.alert('انتهت الصلاحية', 'انتهت صلاحية الربط، اضغط "ربط" مرة أخرى.');
        setCalConnected(false);
      } else {
        Alert.alert('تمت المزامنة ✓', `تمت إضافة ${result.created} حدث جديد.\n${result.skipped} حدث موجود مسبقاً.`);
      }
    } catch (e: any) {
      Alert.alert('خطأ في المزامنة', e?.message ?? 'حاول مجدداً');
    } finally {
      setCalSyncing(false);
    }
  };

  const themeLabel = theme === 'dark' ? 'داكن' : theme === 'light' ? 'فاتح' : 'تلقائي';

  const themes: { key: ThemeMode; label: string; icon: string }[] = [
    { key: 'light', label: 'فاتح', icon: 'sunny-outline' },
    { key: 'dark', label: 'داكن', icon: 'moon-outline' },
    { key: 'system', label: 'حسب الجهاز', icon: 'phone-portrait-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="الإعدادات" showBack={false} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* ── الملف الشخصي ── */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/edit-profile')}
          activeOpacity={0.85}
        >
          <View style={[styles.avatar, { backgroundColor: '#B08D4F' }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>{currentUser.name}</Text>
            <Text style={[styles.profileEmail, { color: colors.textMuted }]} numberOfLines={1}>
              {currentUser.role}{currentUser.email ? ` · ${currentUser.email}` : ''}
            </Text>
          </View>
          <Text style={[styles.editLink, { color: colors.primary }]}>تعديل</Text>
        </TouchableOpacity>

        {/* ── المظهر ── */}
        <SectionHeader title="المظهر" />
        <View style={[styles.segment, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {themes.map(opt => {
            const on = theme === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.segBtn, on && { backgroundColor: colors.primary }]}
                onPress={() => handleTheme(opt.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Ionicons name={opt.icon as any} size={16} color={on ? colors.textInverse : colors.textSecondary} />
                <Text style={[styles.segText, { color: on ? colors.textInverse : colors.textSecondary }, on && { fontWeight: '600' }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── الإشعارات ── */}
        <SectionHeader title="نبّهني عن" />
        <Group>
          <Item icon="document-text-outline" label="العقود" sub="قرب انتهاء العقود والعقود المنتهية"
            isSwitch switchVal={notificationPrefs.contracts} onSwitch={v => setNotificationPref('contracts', v)} />
          <Item icon="cash-outline" label="الدفعات" sub="المتأخرة والمستحقة خلال أسبوع"
            isSwitch switchVal={notificationPrefs.payments} onSwitch={v => setNotificationPref('payments', v)} />
          <Item icon="attach-outline" label="المستندات" sub="المستندات اللي قرب ينتهي تاريخها"
            isSwitch switchVal={notificationPrefs.documents} onSwitch={v => setNotificationPref('documents', v)} />
          <Item icon="construct-outline" label="الصيانة" sub="طلبات الصيانة الجديدة"
            isSwitch switchVal={notificationPrefs.maintenance} onSwitch={v => setNotificationPref('maintenance', v)} />
        </Group>

        {/* ── التكاملات ── */}
        <SectionHeader title="الربط" />
        <View style={[styles.section, styles.integrationRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.itemIcon, { backgroundColor: colors.primary + '1A' }]}>
            <Ionicons name="calendar-outline" size={17} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemLabel, { color: colors.text }]}>تقويم Google</Text>
            <Text style={[styles.itemSub, { color: calConnected ? colors.success : colors.textMuted }]}>
              {calConnected ? 'مربوط — مواعيد الإيجارات والعقود تنزل في تقويمك' : 'غير مربوط'}
            </Text>
          </View>
          {calConnected ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                style={[styles.smallBtn, { borderColor: colors.border }]}
                onPress={handleSyncCalendar}
                disabled={calSyncing}
              >
                {calSyncing
                  ? <ActivityIndicator size="small" color={colors.text} />
                  : <Text style={[styles.smallBtnText, { color: colors.text }]}>مزامنة</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDisconnectCalendar} hitSlop={8}>
                <Text style={[styles.smallBtnText, { color: colors.danger }]}>فصل</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={handleConnectCalendar}
              disabled={calLoading}
            >
              {calLoading
                ? <ActivityIndicator size="small" color={colors.textInverse} />
                : <Text style={[styles.smallBtnText, { color: colors.textInverse }]}>ربط</Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* ── الأدوات ── */}
        {!ownerMode && (
          <>
            <SectionHeader title="أدوات" />
            <Group>
              <Item icon="calendar-outline" label="التقويم" onPress={() => router.push('/calendar')} />
              <Item icon="sparkles-outline" label="المساعد الذكي" onPress={() => router.push('/assistant')} />
              <Item icon="scan-outline" label="قراءة عقد من صورة" onPress={() => router.push('/scan-contract')} />
              <Item icon="folder-open-outline" label="كل المرفقات" onPress={() => router.push('/attachments')} />
              <Item icon="location-outline" label="المدن" onPress={() => router.push('/cities')} />
              <Item icon="documents-outline" label="رفع مستندات الوحدات" sub="سندات ومخططات دفعة وحدة — تتعبّى الملكية تلقائياً" onPress={() => router.push('/import-deeds' as any)} />
              <Item icon="document-attach-outline" label="استيراد عقارات من Excel" onPress={() => router.push('/bulk-import-properties')} />
              <Item icon="time-outline" label="سجل الإجراءات" sub="مين عدّل إيش ومتى" onPress={() => router.push('/audit-log')} />
            </Group>
          </>
        )}

        {/* ── إدارة النظام ── */}
        {isAdmin && (
          <>
            <SectionHeader title="إدارة النظام" />
            <Group>
              <Item icon="people-outline" label="المستخدمون" sub="إضافة موظفين وملاك وتحديد صلاحياتهم" onPress={() => router.push('/user-management')} />
              <Item icon="options-outline" label="أقسام النظام" sub="تشغيل وإيقاف الأقسام" onPress={() => router.push('/system-settings')} />
              <Item icon="sparkles-outline" label="إعدادات المساعد الذكي" onPress={() => router.push('/assistant-settings')} />
              <Item icon="cloud-download-outline" label="النسخ الاحتياطي" onPress={() => router.push('/backup')} />
            </Group>
          </>
        )}

        {/* ── الحساب والدعم ── */}
        <SectionHeader title="الحساب والمساعدة" />
        <Group>
          <Item icon="lock-closed-outline" label="تغيير كلمة المرور" onPress={() => router.push('/change-password')} />
          <Item icon="help-circle-outline" label="مركز المساعدة" onPress={() => router.push('/help-center')} />
          <Item icon="chatbubble-ellipses-outline" label="تواصل معنا" onPress={() => router.push('/contact-us')} />
          {!ownerMode && <Item icon="gift-outline" label="الجديد في التطبيق" onPress={() => router.push('/updates')} />}
        </Group>

        {/* ── الخروج ── */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={[styles.logoutText, { color: colors.danger }]}>تسجيل الخروج</Text>
        </TouchableOpacity>

        {/* ── منطقة الخطر: بعيدة عن الاستخدام اليومي ── */}
        {isAdmin && !ownerMode && (
          <TouchableOpacity style={styles.dangerLink} onPress={() => setShowReset(true)} hitSlop={8}>
            <Text style={[styles.dangerText, { color: colors.textMuted }]}>
              تصفير النظام <Text style={{ color: colors.danger }}>(يحذف كل البيانات)</Text>
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>DTG Rentals · الإصدار 1.0.0</Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
              <Text style={[styles.footerLink, { color: colors.textMuted }]}>سياسة الخصوصية</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/terms-of-service')}>
              <Text style={[styles.footerLink, { color: colors.textMuted }]}>شروط الخدمة</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={showReset}
        onClose={() => setShowReset(false)}
        onConfirm={handleResetConfirm}
        title="تصفير النظام"
        message={`سيتم حذف كل بيانات النظام:\n\n• الملاك والعقارات والوحدات\n• المستأجرون والعقود والدفعات\n• الصيانة والمستندات والإشعارات\n\nتبقى حسابات المستخدمين وإعدادات النظام.\n\nلا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="تصفير النظام"
        variant="danger"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' },

  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  profileName: { fontSize: 16, fontWeight: '600', textAlign: 'right' },
  profileEmail: { fontSize: 12, textAlign: 'right' },
  editLink: { fontSize: 13, fontWeight: '600' },

  sectionHeader: { fontSize: 13, fontWeight: '600', textAlign: 'right', marginTop: 22, marginBottom: 8, paddingHorizontal: 4 },
  section: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },

  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 54, paddingVertical: 10 },
  itemIcon: { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  itemLabel: { fontSize: 15, textAlign: 'right' },
  itemSub: { fontSize: 12, marginTop: 2, textAlign: 'right' },
  itemValue: { fontSize: 13 },

  segment: { flexDirection: 'row', padding: 4, borderRadius: 12, borderWidth: 1, gap: 4 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 9 },
  segText: { fontSize: 13 },

  integrationRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  smallBtn: { height: 34, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  smallBtnText: { fontSize: 13, fontWeight: '600' },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14, borderWidth: 1, marginTop: 28 },
  logoutText: { fontSize: 15, fontWeight: '600' },

  dangerLink: { alignSelf: 'center', marginTop: 20, padding: 6 },
  dangerText: { fontSize: 12 },

  footer: { alignItems: 'center', gap: 8, marginTop: 24 },
  footerText: { fontSize: 12 },
  footerLink: { fontSize: 12, textDecorationLine: 'underline' },
});
