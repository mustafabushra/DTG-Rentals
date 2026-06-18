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
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.item, isActive && { backgroundColor: 'rgba(195,175,118,0.12)' }]}
      activeOpacity={0.75}
    >
      <View style={[styles.iconWrap, isActive && { backgroundColor: 'rgba(195,175,118,0.18)' }]}>
        <Ionicons name={icon as any} size={19} color={isActive ? '#C3AF76' : 'rgba(240,231,208,0.45)'} />
        {!!badge && badge > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.danger }]}>
            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      <Text
        style={[styles.label, { color: isActive ? '#C3AF76' : 'rgba(240,231,208,0.65)' }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {isActive && <View style={[styles.activeBar, { backgroundColor: '#C3AF76' }]} />}
    </TouchableOpacity>
  );
}

function SidebarContent({ colors, onNavigate }: { colors: any; onNavigate: (route: string) => void }) {
  const pathname = usePathname();
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

  return (
    <View style={[styles.sidebar, { backgroundColor: '#021C36', borderLeftColor: '#0D2340' }]}>
      {/* Logo */}
      <View style={[styles.logoRow, { borderBottomColor: '#0D2340' }]}>
        <Image
          source={require('../../assets/images/sidebar-logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        <Text style={[styles.section, { color: 'rgba(195,175,118,0.6)' }]}>الرئيسية</Text>
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
        <Text style={[styles.section, { color: 'rgba(195,175,118,0.6)' }]}>أدوات</Text>
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
        style={[styles.userRow, { borderTopColor: '#0D2340' }]}
        onPress={() => onNavigate('/settings')}
        activeOpacity={0.8}
      >
        <View style={[styles.avatar, { backgroundColor: '#C3AF76' }]}>
          <Text style={[styles.avatarText, { color: '#021C36' }]}>
            {(currentUser.name ?? 'م').split(' ').slice(0, 2).map((n: string) => n[0]).join('')}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: '#F0E7D0' }]} numberOfLines={1}>{currentUser.name}</Text>
          <Text style={[styles.userRole, { color: 'rgba(240,231,208,0.5)' }]} numberOfLines={1}>{currentUser.role}</Text>
        </View>
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
    width: 180, height: 70,
    alignSelf: 'center',
  },

  section: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[1],
    textAlign: 'right',
    letterSpacing: 0.5,
  },

  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: spacing[2], paddingHorizontal: spacing[3],
    marginHorizontal: spacing[2], marginVertical: 1,
    borderRadius: radius.lg, position: 'relative',
  },
  iconWrap: {
    width: 34, height: 34, borderRadius: radius.md,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  label: {
    flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.medium, textAlign: 'right',
  },
  activeBar: {
    position: 'absolute', right: -spacing[2],
    top: '20%' as any, bottom: '20%' as any,
    width: 3, borderRadius: 99,
  },
  badge: {
    position: 'absolute', top: 2, right: 2,
    minWidth: 16, height: 16, borderRadius: 99,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  divider: { height: 1, marginVertical: spacing[2], marginHorizontal: spacing[4] },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: spacing[3], borderTopWidth: 1,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  avatarText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: 'right' },
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
