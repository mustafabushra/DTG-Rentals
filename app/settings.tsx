import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert, Platform, ActivityIndicator,
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
import {
  connectGoogleCalendar, disconnectCalendar, loadToken,
  syncToGoogleCalendar, buildSyncItems,
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
    contracts, payments, tenants, units, properties,
  } = useApp();

  const [showReset,        setShowReset]        = useState(false);
  const [calConnected,     setCalConnected]     = useState(false);
  const [calLoading,       setCalLoading]       = useState(false);
  const [calSyncing,       setCalSyncing]       = useState(false);
  const isAdmin = isAdminRole(currentUser.role);
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
  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={[styles.sectionHeader, { color: colors.textMuted, backgroundColor: colors.surface }]}>
      {title}
    </Text>
  );

  const Item = ({
    icon, label, value, onPress, color, danger,
    isSwitch, switchVal, onSwitch,
  }: {
    icon: string; label: string; value?: string; onPress?: () => void;
    color?: string; danger?: boolean; isSwitch?: boolean;
    switchVal?: boolean; onSwitch?: (v: boolean) => void;
  }) => (
    <TouchableOpacity
      style={[styles.item, { borderBottomColor: colors.border }]}
      onPress={isSwitch ? undefined : onPress}
      activeOpacity={isSwitch ? 1 : 0.7}
    >
      <View style={styles.itemRight}>
        {isSwitch ? (
          <Switch
            value={switchVal}
            onValueChange={onSwitch}
            trackColor={{ false: colors.border, true: color || '#03284C' }}
            thumbColor="#FFF"
          />
        ) : (
          <>
            {value && (
              <Text style={[styles.itemValue, { color: colors.textMuted }]}>{value}</Text>
            )}
            <Ionicons name="chevron-back-outline" size={16} color={danger ? colors.danger : colors.textMuted} />
          </>
        )}
      </View>
      <View style={styles.itemLeft}>
        <View style={[styles.itemIcon, { backgroundColor: `${color || (danger ? colors.danger : colors.primary)}18` }]}>
          <Ionicons name={icon as any} size={18} color={color || (danger ? colors.danger : colors.primary)} />
        </View>
        <Text style={[styles.itemLabel, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );

  // ── Google Calendar ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return;
    loadToken(currentUser.id).then(t => setCalConnected(!!t?.connected));
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: '#021C36' }]}>
        <View style={styles.headerRow}>
          {Platform.OS === 'web' && !isDesktop && (
            <TouchableOpacity onPress={toggleSidebar} style={styles.menuBtn}>
              <Ionicons name="menu-outline" size={26} color="#FFF" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>الإعدادات</Text>
          <View style={{ width: Platform.OS === 'web' && !isDesktop ? 34 : 0 }} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Desktop: two-column layout */}
        <View style={isDesktop ? styles.desktopLayout : undefined}>

        {/* ── LEFT COLUMN on desktop (profile + stats + account) ── */}
        <View style={isDesktop ? styles.desktopLeft : undefined}>

        {/* ── Profile Card ── */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/edit-profile')}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back-outline" size={18} color={colors.textMuted} />
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>{currentUser.name}</Text>
            <Text style={[styles.profileRole, { color: colors.textSecondary }]}>{currentUser.role}</Text>
            <Text style={[styles.profileEmail, { color: colors.textMuted }]}>{currentUser.email}</Text>
            {currentUser.phone ? (
              <Text style={[styles.profileEmail, { color: colors.textMuted }]}>{currentUser.phone}</Text>
            ) : null}
          </View>
          <View style={[styles.avatar, { backgroundColor: '#C3AF76' }]}>
            <Text style={[styles.avatarText, { color: '#021C36' }]}>{initials}</Text>
          </View>
        </TouchableOpacity>

        {/* ── Quick Stats ── */}
        {(() => {
          const stats = [
            { label: 'عقار',         value: kpis.totalProperties,  color: colors.primary,  icon: 'business-outline' },
            { label: 'عقد نشط',      value: kpis.activeContracts,  color: colors.success,  icon: 'document-text-outline' },
            { label: 'وحدة شاغرة',   value: kpis.vacantUnits,      color: colors.warning,  icon: 'home-outline' },
            { label: 'دفعة متأخرة',  value: kpis.overduePayments,  color: colors.danger,   icon: 'alert-circle-outline' },
          ];
          return (
            <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {stats.map((s, i) => (
                <View
                  key={i}
                  style={[
                    styles.statItem,
                    i % 2 === 0 && { borderRightWidth: 1, borderRightColor: colors.border },
                    i < 2      && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={[styles.statIconWrap, { backgroundColor: `${s.color}18` }]}>
                    <Ionicons name={s.icon as any} size={18} color={s.color} />
                  </View>
                  <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
                  <Text style={[styles.statLbl, { color: colors.textMuted }]}>{s.label}</Text>
                </View>
              ))}
            </View>
          );
        })()}

        </View>{/* end desktopLeft */}

        {/* ── RIGHT COLUMN on desktop (appearance + notifications + account + admin) ── */}
        <View style={isDesktop ? styles.desktopRight : undefined}>

        {/* ── Appearance ── */}
        <SectionHeader title="المظهر والعرض" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Theme Selector */}
          <View style={[styles.themeRow, { borderBottomColor: colors.border }]}>
            <View style={styles.itemLeft}>
              <View style={[styles.itemIcon, { backgroundColor: '#03284C18' }]}>
                <Ionicons name="color-palette-outline" size={18} color="#03284C" />
              </View>
              <Text style={[styles.itemLabel, { color: colors.text }]}>المظهر</Text>
            </View>
            <View style={styles.themeOptions}>
              {([
                { key: 'light', label: 'فاتح', icon: 'sunny-outline' },
                { key: 'system', label: 'تلقائي', icon: 'phone-portrait-outline' },
                { key: 'dark', label: 'داكن', icon: 'moon-outline' },
              ] as { key: ThemeMode; label: string; icon: string }[]).map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.themeChip,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    theme === opt.key && { borderColor: '#C3AF76', backgroundColor: '#03284C' },
                  ]}
                  onPress={() => handleTheme(opt.key)}
                >
                  <Ionicons name={opt.icon as any} size={14} color={theme === opt.key ? '#C3AF76' : colors.textMuted} />
                  <Text style={[styles.themeChipText, { color: theme === opt.key ? '#C3AF76' : colors.textMuted }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Theme Preview */}
          <View style={[styles.themePreview, { borderBottomColor: colors.border }]}>
            <View style={styles.previewRow}>
              {/* Light preview */}
              <View style={[styles.previewBox, theme === 'light' && styles.previewBoxActive, { backgroundColor: '#F8F5EA', borderColor: theme === 'light' ? '#C3AF76' : '#E5E7EB' }]}>
                <View style={[styles.previewHeader, { backgroundColor: '#021C36' }]} />
                <View style={styles.previewBody}>
                  <View style={[styles.previewCard, { backgroundColor: '#FFF' }]} />
                  <View style={[styles.previewCard, { backgroundColor: '#FFF' }]} />
                </View>
                <Text style={[styles.previewLabel, { color: theme === 'light' ? '#C3AF76' : colors.textMuted }]}>فاتح</Text>
              </View>
              {/* Auto preview */}
              <View style={[styles.previewBox, theme === 'system' && styles.previewBoxActive, { backgroundColor: '#F0EDE8', borderColor: theme === 'system' ? '#C3AF76' : '#E5E7EB' }]}>
                <View style={[styles.previewHeader, { backgroundColor: '#03284C' }]} />
                <View style={styles.previewBody}>
                  <View style={[styles.previewCard, { backgroundColor: '#E6EDF5' }]} />
                  <View style={[styles.previewCard, { backgroundColor: '#E6EDF5' }]} />
                </View>
                <Text style={[styles.previewLabel, { color: theme === 'system' ? '#C3AF76' : colors.textMuted }]}>تلقائي</Text>
              </View>
              {/* Dark preview */}
              <View style={[styles.previewBox, theme === 'dark' && styles.previewBoxActive, { backgroundColor: '#080F1A', borderColor: theme === 'dark' ? '#C3AF76' : '#E5E7EB' }]}>
                <View style={[styles.previewHeader, { backgroundColor: '#C3AF76' }]} />
                <View style={styles.previewBody}>
                  <View style={[styles.previewCard, { backgroundColor: '#111F33' }]} />
                  <View style={[styles.previewCard, { backgroundColor: '#111F33' }]} />
                </View>
                <Text style={[styles.previewLabel, { color: theme === 'dark' ? '#C3AF76' : colors.textMuted }]}>داكن</Text>
              </View>
            </View>
          </View>

          {/* Language */}
          <View style={[styles.themeRow, { borderBottomColor: colors.border }]}>
            <View style={styles.itemLeft}>
              <View style={[styles.itemIcon, { backgroundColor: `${colors.secondary}18` }]}>
                <Ionicons name="language-outline" size={18} color={colors.secondary} />
              </View>
              <Text style={[styles.itemLabel, { color: colors.text }]}>اللغة</Text>
            </View>
            <View style={styles.themeOptions}>
              {[
                { key: 'ar', label: 'العربية' },
                { key: 'en', label: 'English' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.themeChip,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    opt.key === 'ar' && { borderColor: '#C3AF76', backgroundColor: '#03284C' },
                  ]}
                  onPress={() => handleLanguage(opt.key as 'ar' | 'en')}
                >
                  <Text style={[styles.themeChipText, { color: opt.key === 'ar' ? '#C3AF76' : colors.textMuted }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ── Notifications ── */}
        <SectionHeader title="الإشعارات" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Item
            icon="document-text-outline" label="إشعارات العقود" color={colors.primary}
            isSwitch switchVal={notificationPrefs.contracts}
            onSwitch={v => setNotificationPref('contracts', v)}
          />
          <Item
            icon="cash-outline" label="إشعارات الدفعات" color={colors.success}
            isSwitch switchVal={notificationPrefs.payments}
            onSwitch={v => setNotificationPref('payments', v)}
          />
          <Item
            icon="attach-outline" label="إشعارات المستندات" color={colors.warning}
            isSwitch switchVal={notificationPrefs.documents}
            onSwitch={v => setNotificationPref('documents', v)}
          />
          <Item
            icon="construct-outline" label="إشعارات الصيانة" color={colors.secondary}
            isSwitch switchVal={notificationPrefs.maintenance}
            onSwitch={v => setNotificationPref('maintenance', v)}
          />
        </View>

        {/* ── Integrations ── */}
        <SectionHeader title="التكاملات" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.integrationRow, { borderBottomColor: colors.border }]}>
            {/* Icon + info */}
            <View style={styles.integrationLeft}>
              <View style={[styles.integrationIcon, { backgroundColor: '#E8F0FE' }]}>
                <Ionicons name="calendar-outline" size={22} color="#4285F4" />
              </View>
              <View>
                <Text style={[styles.integrationTitle, { color: colors.text }]}>Google Calendar</Text>
                <Text style={[styles.integrationSub, { color: calConnected ? '#27AE60' : colors.textMuted }]}>
                  {calConnected ? 'مرتبط ✓' : 'غير مرتبط'}
                </Text>
              </View>
            </View>
            {/* Buttons */}
            <View style={styles.integrationBtns}>
              {calConnected ? (
                <>
                  <TouchableOpacity
                    style={[styles.integrationBtn, { backgroundColor: '#1B4F72' }]}
                    onPress={handleSyncCalendar}
                    disabled={calSyncing}
                  >
                    {calSyncing
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <Ionicons name="sync-outline" size={16} color="#FFF" />}
                    <Text style={styles.integrationBtnText}>مزامنة</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.integrationBtn, { backgroundColor: '#FDEDEC', borderWidth: 1, borderColor: '#E74C3C' }]}
                    onPress={handleDisconnectCalendar}
                  >
                    <Ionicons name="unlink-outline" size={16} color="#E74C3C" />
                    <Text style={[styles.integrationBtnText, { color: '#E74C3C' }]}>قطع</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.integrationBtn, { backgroundColor: '#4285F4' }]}
                  onPress={handleConnectCalendar}
                  disabled={calLoading}
                >
                  {calLoading
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <Ionicons name="link-outline" size={16} color="#FFF" />}
                  <Text style={styles.integrationBtnText}>ربط</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ── Account ── */}
        <SectionHeader title="الحساب" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Item icon="person-outline" label="تعديل الملف الشخصي" color={colors.primary}
            onPress={() => router.push('/edit-profile')} />
          <Item icon="lock-closed-outline" label="تغيير كلمة المرور" color={colors.warning}
            onPress={() => router.push('/change-password')} />
          <Item icon="shield-outline" label="سياسة الخصوصية" color={colors.textSecondary}
            onPress={() => router.push('/privacy-policy')} />
        </View>

        {/* ── Support ── */}
        <SectionHeader title="الدعم والمساعدة" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Item icon="help-circle-outline" label="مركز المساعدة" color={colors.success}
            onPress={() => router.push('/help-center')} />
          <Item icon="chatbubble-outline" label="اتصل بنا" color={colors.secondary}
            onPress={() => router.push('/contact-us')} />
          <Item icon="information-circle-outline" label="الإصدار" value="1.0.0" color={colors.textMuted} onPress={() => {}} />
        </View>

        {/* ── Admin: System Settings ── */}
        {isAdmin && (
          <>
            <SectionHeader title="إعدادات النظام (الأدمن)" />
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Item icon="people-outline" label="إدارة المستخدمين" color={colors.primary}
                onPress={() => router.push('/user-management')} />
              <Item icon="toggle-outline" label="وحدات النظام والصلاحيات" color={colors.accent}
                onPress={() => router.push('/system-settings')} />
              <Item icon="bar-chart-outline" label="تقارير النظام" color="#8E44AD"
                onPress={() => router.push('/audit-log')} />
              <Item icon="cloud-upload-outline" label="نسخ احتياطي" color={colors.success}
                onPress={() => router.push('/backup')} />
              <TouchableOpacity
                style={[styles.resetItem, { borderTopColor: colors.border }]}
                onPress={() => setShowReset(true)}
                activeOpacity={0.7}
              >
                <View style={styles.itemRight}>
                  <Ionicons name="chevron-back-outline" size={16} color={colors.danger} />
                </View>
                <View style={styles.itemLeft}>
                  <View style={[styles.itemIcon, { backgroundColor: `${colors.danger}18` }]}>
                    <Ionicons name="nuclear-outline" size={18} color={colors.danger} />
                  </View>
                  <View>
                    <Text style={[styles.itemLabel, { color: colors.danger }]}>تصفير النظام</Text>
                    <Text style={[styles.itemSub, { color: colors.danger + '99' }]}>حذف جميع بيانات النظام</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Logout ── */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: '#FDEDEC', borderColor: colors.danger }]}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Text style={[styles.logoutText, { color: colors.danger }]}>تسجيل الخروج</Text>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        </TouchableOpacity>

        </View>{/* end desktopRight */}
        </View>{/* end desktopLayout */}
      </ScrollView>

      {/* ── System Reset Confirm Modal ── */}
      <ConfirmModal
        visible={showReset}
        onClose={() => setShowReset(false)}
        onConfirm={handleResetConfirm}
        title="تصفير النظام"
        message={`⚠️ تحذير: سيتم حذف جميع بيانات النظام:\n\n• الملاك والعقارات والوحدات\n• المستأجرون والعقود والدفعات\n• الصيانة والمستندات والإشعارات\n\nسيتم الاحتفاظ بـ:\n• حسابات المستخدمين\n• إعدادات النظام\n\nلا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="تصفير النظام"
        variant="danger"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 14, paddingHorizontal: Theme.spacing.base,
    alignItems: 'center', minHeight: 60, justifyContent: 'flex-end',
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%',
  },
  menuBtn: { padding: 4 },
  headerTitle: { color: '#FFF', fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold, flex: 1, textAlign: 'center' },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', margin: Theme.spacing.base,
    padding: Theme.spacing.md, borderRadius: Theme.radius.lg, borderWidth: 1, gap: 12,
  },
  avatar:      { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  avatarText:  { color: '#FFF', fontSize: 20, fontWeight: '700' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  profileRole: { fontSize: Theme.fontSize.md, marginTop: 2, textAlign: 'right' },
  profileEmail:{ fontSize: Theme.fontSize.sm, marginTop: 2, textAlign: 'right' },

  // Desktop 2-column layout
  scrollDesktop: {},
  desktopLayout: { flexDirection: 'row', alignItems: 'flex-start', gap: 0 },
  desktopLeft:   { width: 340 },
  desktopRight:  { flex: 1 },

  statsCard: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginHorizontal: Theme.spacing.base, marginBottom: 4,
    borderRadius: Theme.radius.lg, borderWidth: 1, overflow: 'hidden',
  },
  statItem: {
    width: '50%', alignItems: 'center', gap: 6,
    paddingVertical: Theme.spacing.md, paddingHorizontal: 8,
  },
  statIconWrap: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  statVal:  { fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold },
  statLbl:  { fontSize: Theme.fontSize.xs, textAlign: 'center' },

  sectionHeader: {
    fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold,
    paddingHorizontal: Theme.spacing.base, paddingVertical: 8, textAlign: 'right',
  },
  section: {
    marginHorizontal: Theme.spacing.base, borderRadius: Theme.radius.lg,
    borderWidth: 1, marginBottom: 4, overflow: 'hidden',
  },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md, paddingVertical: 14, borderBottomWidth: 1,
  },
  itemLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemIcon:  { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  itemLabel: { fontSize: Theme.fontSize.base, textAlign: 'right' },
  itemValue: { fontSize: Theme.fontSize.sm, textAlign: 'right' },
  itemSub:   { fontSize: Theme.fontSize.xs, marginTop: 1, textAlign: 'right' },

  // Theme selector row
  themeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md, paddingVertical: 12, borderBottomWidth: 1,
  },
  themeOptions: { flexDirection: 'row', gap: 6 },
  themeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 12,
    minHeight: 44, borderRadius: Theme.radius.full, borderWidth: 1.5,
  },
  themeChipText: { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.semibold },

  // Reset item (special layout with sub-label)
  resetItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md, paddingVertical: 14, borderTopWidth: 1,
  },

  themePreview: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
  },
  previewRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  previewBox: {
    flex: 1, borderRadius: Theme.radius.lg, borderWidth: 2,
    overflow: 'hidden', alignItems: 'center', paddingBottom: 8,
  },
  previewBoxActive: { borderWidth: 2 },
  previewHeader: { width: '100%', height: 18, marginBottom: 6 },
  previewBody: { width: '100%', paddingHorizontal: 6, gap: 4 },
  previewCard: { height: 10, borderRadius: 4, width: '100%' },
  previewLabel: { fontSize: 10, fontWeight: '600', marginTop: 6 },

  integrationRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md, paddingVertical: 14,
  },
  integrationLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  integrationIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  integrationTitle: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  integrationSub:   { fontSize: Theme.fontSize.xs, marginTop: 2, textAlign: 'right' },
  integrationBtns:  { flexDirection: 'row', gap: 8 },
  integrationBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Theme.radius.full, minHeight: 36,
  },
  integrationBtnText: { color: '#FFF', fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, margin: Theme.spacing.base, marginTop: Theme.spacing.md,
    padding: Theme.spacing.md, borderRadius: Theme.radius.lg, borderWidth: 1,
  },
  logoutText: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
});
