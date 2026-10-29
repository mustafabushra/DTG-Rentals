import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, TouchableWithoutFeedback, Platform, Image,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import { lightColors, darkColors, spacing, fontSize, fontWeight, radius } from '../../constants/DesignTokens';
import { useApp } from '../../context/AppProvider';
import { useSidebar } from '../../context/SidebarContext';
import { WEB_SIDEBAR_W } from '../../hooks/useScreenSize';

const DRAWER_W = 260;

import { ModuleFlags } from '../../constants/SystemDefaults';
import { useAppTheme } from '../../hooks/useAppTheme';

type NavItem = { icon: string; label: string; route: string; moduleKey?: keyof ModuleFlags | null };

const TAB_ITEMS: NavItem[] = [
  { icon: 'grid-outline',          label: 'الرئيسية',         route: '/(tabs)/',             moduleKey: null },
  { icon: 'business-outline',      label: 'العقارات',         route: '/(tabs)/properties',   moduleKey: 'properties' },
  { icon: 'people-outline',        label: 'الملاك',           route: '/(tabs)/owners',       moduleKey: 'owners' },
  { icon: 'document-text-outline', label: 'العقود',           route: '/(tabs)/contracts',    moduleKey: 'contracts' },
  { icon: 'location-outline',      label: 'المدن',            route: '/cities',              moduleKey: null },
];

const MORE_ITEMS: NavItem[] = [
  { icon: 'home-outline',          label: 'الوحدات',          route: '/units',               moduleKey: 'units' },
  { icon: 'person-outline',        label: 'المستأجرون',       route: '/tenants',             moduleKey: 'tenants' },
  { icon: 'cash-outline',          label: 'الدفعات',          route: '/payments',            moduleKey: 'payments' },
  { icon: 'megaphone-outline',     label: 'مركز التحصيل',     route: '/collections',         moduleKey: 'payments' },
  { icon: 'sparkles-outline',      label: 'المساعد الذكي',    route: '/assistant',           moduleKey: 'reports' },
  { icon: 'refresh-outline',       label: 'تجديد العقود',     route: '/renewals',            moduleKey: 'contracts' },
  { icon: 'scan-outline',          label: 'مسح عقد بالصورة', route: '/scan-contract',       moduleKey: 'contracts' },
  { icon: 'receipt-outline',       label: 'سجل المدفوعات',    route: '/ledger',              moduleKey: 'ledger' },
  { icon: 'construct-outline',     label: 'الصيانة',          route: '/maintenance',         moduleKey: 'maintenance' },
  { icon: 'document-outline',      label: 'المرفقات',         route: '/attachments',         moduleKey: null },
  { icon: 'bar-chart-outline',     label: 'التقارير المالية', route: '/financial-reports',   moduleKey: 'reports' },
  { icon: 'calendar-outline',      label: 'التقويم',          route: '/calendar',            moduleKey: 'calendar' },
  { icon: 'sparkles-outline',      label: 'التحديثات الجديدة', route: '/updates',             moduleKey: null },
  { icon: 'list-outline',          label: 'سجل الإجراءات',   route: '/audit-log',           moduleKey: 'auditLog' },
  { icon: 'notifications-outline', label: 'الإشعارات',        route: '/notifications',       moduleKey: null },
  { icon: 'settings-outline',      label: 'الإعدادات',        route: '/settings',            moduleKey: null },
];

function SideItem({
  icon, label, route, badge, colors, isActive, onPress,
}: { icon: string; label: string; route: string; badge?: number; colors: any; isActive: boolean; onPress: () => void }) {
  // منصات: عنصر تنقل بزوايا 4px، النشط بخلفية خضراء فاتحة ونص أخضر وشريط جانبي
  const activeIcon = isActive ? (icon.endsWith('-outline') ? icon.replace('-outline', '') : icon) : icon;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.item, isActive && { backgroundColor: colors.primarySubtle }]}
      activeOpacity={0.75}
      accessibilityRole="link"
      accessibilityState={{ selected: isActive }}
    >
      {isActive && <View style={[styles.activeBar, { backgroundColor: colors.primary }]} />}
      <View style={styles.iconWrap}>
        <Ionicons name={activeIcon as any} size={20} color={isActive ? colors.primary : colors.textMuted} />
        {!!badge && badge > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.danger }]}>
            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      <Text
        style={[
          styles.label,
          { color: isActive ? colors.primary : colors.textSecondary },
          isActive && { fontWeight: fontWeight.semibold },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SidebarContent({ colors, onNavigate }: { colors: any; onNavigate: (route: string) => void }) {
  const pathname = usePathname();
  const { scheme } = useAppTheme();
  const { payments, contracts, currentUser, systemSettings } = useApp();
  const modules = systemSettings.modules;
  const visibleTab  = TAB_ITEMS.filter(i => !i.moduleKey || modules[i.moduleKey]);
  const visibleMore = MORE_ITEMS.filter(i => !i.moduleKey || modules[i.moduleKey]);

  const overdueCount   = payments.filter(p => p.status === 'overdue').length;
  const expiringCount  = contracts.filter(c => {
    if (c.status !== 'active') return false;
    const days = Math.ceil((new Date(c.endDate).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 30;
  }).length;
  const notifBadge = overdueCount + expiringCount;

  const isActive = (route: string) => {
    if (route === '/(tabs)/') return pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/';
    return pathname.startsWith(route.replace('/(tabs)', ''));
  };

  const logo = scheme === 'dark'
    ? require('../../assets/images/sidebar-logo.png')
    : require('../../assets/images/sidebar-logo-dark.png');

  return (
    <View style={[styles.sidebar, { backgroundColor: colors.card, borderLeftColor: colors.border }]}>
      {/* Logo */}
      <View style={[styles.logoRow, { borderBottomColor: colors.border }]}>
        <Image source={logo} style={styles.logoImage} resizeMode="contain" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: spacing[2] }}>
        <Text style={[styles.section, { color: colors.textMuted }]}>الرئيسية</Text>
        {visibleTab.map(item => (
          <SideItem
            key={item.route}
            icon={item.icon}
            label={item.label}
            route={item.route}
            colors={colors}
            isActive={isActive(item.route)}
            onPress={() => onNavigate(item.route)}
          />
        ))}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.section, { color: colors.textMuted }]}>أدوات</Text>
        {visibleMore.map(item => (
          <SideItem
            key={item.route}
            icon={item.icon}
            label={item.label}
            route={item.route}
            badge={item.route === '/notifications' ? notifBadge : undefined}
            colors={colors}
            isActive={isActive(item.route)}
            onPress={() => onNavigate(item.route)}
          />
        ))}
      </ScrollView>

      {/* User Footer */}
      <TouchableOpacity
        style={[styles.userRow, { borderTopColor: colors.border }]}
        onPress={() => onNavigate('/settings')}
        activeOpacity={0.8}
      >
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.textInverse }]}>
            {(currentUser.name ?? 'م').split(' ').slice(0, 2).map((n: string) => n[0]).join('')}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>{currentUser.name}</Text>
          <Text style={[styles.userRole, { color: colors.textMuted }]} numberOfLines={1}>{currentUser.role}</Text>
        </View>
        <Ionicons name="settings-outline" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Static sidebar (desktop) ──────────────────────────────────────────────────

export function WebSidebar() {
  const { colors } = useAppTheme();

  return (
    <View style={{ width: WEB_SIDEBAR_W }}>
      <SidebarContent
        colors={colors}
        onNavigate={route => router.push(route as any)}
      />
    </View>
  );
}

// ─── Drawer sidebar (mobile / tablet) ─────────────────────────────────────────

export function WebDrawer() {
  const { colors } = useAppTheme();
  const { open, close } = useSidebar();

  const slideAnim   = useRef(new Animated.Value(DRAWER_W)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(slideAnim,   { toValue: 0,   duration: 260, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(overlayAnim, { toValue: 0.45, duration: 260, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim,   { toValue: DRAWER_W, duration: 220, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(overlayAnim, { toValue: 0,         duration: 220, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    }
  }, [open]);

  // Always render so animation state is preserved; pointerEvents controls interaction

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents={open ? 'auto' : 'none'}>
      {/* Overlay */}
      <TouchableWithoutFeedback onPress={close} disabled={!open}>
        <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} />
      </TouchableWithoutFeedback>

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* Close button */}
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: colors.surface }]}
          onPress={close}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
        <SidebarContent
          colors={colors}
          onNavigate={route => { close(); router.push(route as any); }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    borderLeftWidth: 1,
    flexDirection: 'column',
  },

  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing[4],
    borderBottomWidth: 1,
  },
  logoIcon: {
    width: 32, height: 32, borderRadius: radius.md,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  logoText: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    textAlign: 'right',
  },
  logoImage: {
    width: 168, height: 56,
    alignSelf: 'center',
  },

  section: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    textAlign: 'right',
  },

  item: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    minHeight: 40, paddingVertical: spacing[2], paddingHorizontal: spacing[3],
    marginHorizontal: spacing[3], marginVertical: 2,
    borderRadius: radius.sm, position: 'relative', overflow: 'hidden',
  },
  iconWrap: {
    width: 24, height: 24,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  label: {
    flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.medium, textAlign: 'right',
  },
  activeBar: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: 4,
  },
  badge: {
    position: 'absolute', top: -6, right: -8,
    minWidth: 16, height: 16, borderRadius: 99,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  divider: { height: 1, marginVertical: spacing[3], marginHorizontal: spacing[5] },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: spacing[3], paddingHorizontal: spacing[4], borderTopWidth: 1,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  avatarText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'right' },
  userRole: { fontSize: fontSize.xs, textAlign: 'right' },

  // Drawer styles
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 99,
  },
  drawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_W,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing[3],
    right: spacing[3],
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
