/**
 * شريط التنقل السفلي للجوال (ويب): أكثر الأقسام استخداماً بضغطة وحدة،
 * و"المزيد" يفتح القائمة الكاملة. يظهر في صفحات الأقسام فقط، ويختفي
 * داخل التفاصيل والنماذج عشان ما يغطي أزرار الحفظ.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import { useApp } from '../../context/AppProvider';
import { useSidebar } from '../../context/SidebarContext';
import { useAppTheme } from '../../hooks/useAppTheme';
import { STAFF_NAV, OWNER_NAV, isNavActive, NavItem } from '../../constants/Navigation';

type BarItem = { key: string; icon: string; label: string; nav?: NavItem; badge?: number };

/** صفحات الأقسام اللي يظهر فيها الشريط */
const SECTION_PAGES = new Set([
  '/', '/properties', '/units', '/owners', '/contracts', '/tenants', '/renewals',
  '/collections', '/payments', '/ledger', '/expenses', '/office-expenses', '/vouchers',
  '/maintenance', '/financial-reports', '/reports', '/notifications', '/settings', '/more',
  '/owner-statement', '/owner-timeline', '/attachments', '/calendar',
]);

export function shouldShowBottomBar(pathname: string) {
  const p = pathname.replace('/(tabs)', '').replace(/\/$/, '') || '/';
  return SECTION_PAGES.has(p);
}

export function WebBottomBar() {
  const { colors } = useAppTheme();
  const pathname = usePathname();
  const { open: drawerOpen, toggle } = useSidebar();
  const { payments, systemSettings, isOwner, previewing } = useApp();
  const ownerMode = isOwner || previewing;
  const modules = systemSettings.modules;

  if (!shouldShowBottomBar(pathname)) return null;

  const overdue = payments.filter(p => p.status === 'overdue').length;
  const pick = (list: NavItem[], routes: string[], short: Record<string, string> = {}) =>
    routes
      .map(r => list.find(i => i.route === r))
      .filter((i): i is NavItem => !!i && (!i.moduleKey || !!modules[i.moduleKey]))
      .map(i => ({ key: i.route, icon: i.icon, label: short[i.route] ?? i.label, nav: i, badge: i.badge === 'overdue' ? overdue : undefined }));

  const items: BarItem[] = ownerMode
    ? pick(OWNER_NAV, ['/(tabs)/', '/(tabs)/properties', '/owner-statement', '/owner-timeline'], { '/owner-statement': 'الدخل', '/owner-timeline': 'الأحداث' })
    : pick(STAFF_NAV, ['/(tabs)/', '/(tabs)/properties', '/(tabs)/contracts', '/collections'], { '/(tabs)/contracts': 'العقود' });

  const anyMainActive = items.some(i => i.nav && isNavActive(i.nav, pathname));
  const moreActive = drawerOpen || !anyMainActive;

  const Tab = ({ item, active, onPress }: { item: BarItem; active: boolean; onPress: () => void }) => {
    const icon = active && item.icon.endsWith('-outline') ? item.icon.replace('-outline', '') : item.icon;
    return (
      <TouchableOpacity style={styles.tab} onPress={onPress} activeOpacity={0.7} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={item.label}>
        <View style={[styles.indicator, { backgroundColor: active ? '#B08D4F' : 'transparent' }]} />
        <View>
          <Ionicons name={icon as any} size={22} color={active ? colors.primary : colors.textMuted} />
          {!!item.badge && item.badge > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.card }]}>
              <Text style={styles.badgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.label, { color: active ? colors.primary : colors.textMuted }, active && styles.labelActive]} numberOfLines={1}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.bar, { backgroundColor: colors.card, borderTopColor: colors.border }]} accessibilityRole="tablist">
      {items.map(i => (
        <Tab key={i.key} item={i} active={!drawerOpen && !!i.nav && isNavActive(i.nav, pathname)} onPress={() => router.navigate(i.key as any)} />
      ))}
      <Tab item={{ key: 'more', icon: 'menu-outline', label: 'المزيد' }} active={moreActive} onPress={toggle} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1, height: 60 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingBottom: 4 },
  indicator: { position: 'absolute', top: 0, width: 28, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  label: { fontSize: 11 },
  labelActive: { fontWeight: '600' },
  badge: { position: 'absolute', top: -5, right: -9, minWidth: 17, height: 17, borderRadius: 9, borderWidth: 2, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
});
