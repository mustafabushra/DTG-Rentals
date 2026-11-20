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

import { STAFF_NAV, OWNER_NAV, FOOTER_NAV, isNavActive, NavItem } from '../../constants/Navigation';

function SideItem({
  icon, label, route, badge, colors, isActive, onPress,
}: { icon: string; label: string; route: string; badge?: number; colors: any; isActive: boolean; onPress: () => void }) {
  // منصات: عنصر تنقل بزوايا 4px، النشط بخلفية خضراء فاتحة ونص أخضر وشريط جانبي
  const activeIcon = isActive ? (icon.endsWith('-outline') ? icon.replace('-outline', '') : icon) : icon;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.item, isActive && { backgroundColor: 'rgba(212,188,138,0.12)' }]}
      activeOpacity={0.75}
      accessibilityRole="link"
      accessibilityState={{ selected: isActive }}
    >
      {isActive && <View style={[styles.activeBar, { backgroundColor: '#D4BC8A' }]} />}
      <View style={styles.iconWrap}>
        <Ionicons name={activeIcon as any} size={19} color={isActive ? '#D4BC8A' : colors.chromeMuted} />
        {!!badge && badge > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.danger }]}>
            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      <Text
        style={[
          styles.label,
          { color: isActive ? '#E7D8B8' : colors.chromeText },
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
  const { payments, contracts, currentUser, systemSettings, isOwner, previewing } = useApp();
  const modules = systemSettings.modules;
  const ownerMode = isOwner || previewing;
  const main = (ownerMode ? OWNER_NAV : STAFF_NAV).filter(i => !i.moduleKey || modules[i.moduleKey]);

  const overdueCount   = payments.filter(p => p.status === 'overdue').length;
  const expiringCount  = contracts.filter(c => {
    if (c.status !== 'active') return false;
    const days = Math.ceil((new Date(c.endDate).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 30;
  }).length;
  const badgeFor = (item: NavItem) =>
    item.badge === 'overdue' ? overdueCount : item.badge === 'alerts' ? overdueCount + expiringCount : undefined;

  // القائمة داكنة دائماً ⇒ الشعار الأبيض/الذهبي الأصلي
  const logo = require('../../assets/images/sidebar-logo.png');

  const render = (item: NavItem) => (
    <SideItem
      key={item.route}
      icon={item.icon}
      label={item.label}
      route={item.route}
      badge={badgeFor(item)}
      colors={colors}
      isActive={isNavActive(item, pathname)}
      onPress={() => onNavigate(item.route)}
    />
  );

  return (
    <View style={[styles.sidebar, { backgroundColor: colors.chrome, borderLeftColor: colors.chromeBorder }]}>
      {/* Logo */}
      <View style={[styles.logoRow, { borderBottomColor: colors.chromeBorder }]}>
        <Image source={logo} style={styles.logoImage} resizeMode="contain" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: spacing[3] }}>
        {main.map(render)}
      </ScrollView>

      <View style={{ paddingBottom: spacing[2] }}>
        <View style={[styles.divider, { backgroundColor: colors.chromeBorder }]} />
        {FOOTER_NAV.map(render)}
      </View>

      {/* User Footer */}
      <TouchableOpacity
        style={[styles.userRow, { borderTopColor: colors.chromeBorder, backgroundColor: colors.chromeRaised }]}
        onPress={() => onNavigate('/settings')}
        activeOpacity={0.8}
      >
        <View style={[styles.avatar, { backgroundColor: '#D4BC8A' }]}>
          <Text style={[styles.avatarText, { color: '#071729' }]}>
            {(currentUser.name ?? 'م').split(' ').slice(0, 2).map((n: string) => n[0]).join('')}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.chromeText }]} numberOfLines={1}>{currentUser.name}</Text>
          <Text style={[styles.userRole, { color: colors.chromeMuted }]} numberOfLines={1}>{currentUser.role}</Text>
        </View>
        <Ionicons name="settings-outline" size={18} color={colors.chromeMuted} />
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
          style={[styles.closeBtn, { backgroundColor: colors.chromeRaised }]}
          onPress={close}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={20} color={colors.chromeText} />
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
    width: 176, height: 58,
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
    minHeight: 38, paddingVertical: 7, paddingHorizontal: spacing[3],
    marginHorizontal: spacing[3], marginVertical: 1,
    borderRadius: 8, position: 'relative', overflow: 'hidden',
  },
  iconWrap: {
    width: 24, height: 24,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  label: {
    flex: 1, fontSize: 14, fontWeight: fontWeight.regular, textAlign: 'right',
  },
  activeBar: {
    position: 'absolute', right: 0, top: 8, bottom: 8,
    width: 3, borderRadius: 2,
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
