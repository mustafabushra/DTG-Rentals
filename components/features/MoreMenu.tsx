/**
 * MoreMenu — Full-screen popup menu triggered from the "المزيد" tab.
 */
import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { lightColors, darkColors, spacing, fontSize, fontWeight, radius } from '../../constants/DesignTokens';
import { useApp } from '../../context/AppProvider';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useColorScheme } from 'react-native';

const MENU_ITEMS = [
  { icon: 'grid-outline',          label: 'الوحدات',         route: '/units' },
  { icon: 'people-outline',        label: 'المستأجرون',      route: '/tenants' },
  { icon: 'cash-outline',          label: 'الدفعات',         route: '/payments' },
  { icon: 'bar-chart-outline',     label: 'التقارير المالية', route: '/financial-reports' },
  { icon: 'construct-outline',     label: 'الصيانة',         route: '/maintenance' },
  { icon: 'location-outline',      label: 'إدارة المدن',     route: '/cities' },
  { icon: 'settings-outline',      label: 'إدارة النظام',    route: '/settings' },
  { icon: 'calendar-outline',      label: 'التقويم',         route: '/calendar' },
  { icon: 'receipt-outline',       label: 'سجل الإجراءات',   route: '/audit-log' },
  { icon: 'notifications-outline', label: 'الإشعارات',       route: '/notifications' },
] as const;

interface MoreMenuProps {
  visible:  boolean;
  onClose:  () => void;
}

export function MoreMenu({ visible, onClose }: MoreMenuProps) {
  const { colors } = useAppTheme();
  const colorScheme = useColorScheme();
  const scheme = colorScheme ?? 'light';
  const { payments, contracts } = useApp();
  // عدد الإشعارات = الدفعات المتأخرة + العقود التي تنتهي خلال 30 يوماً
  const unread = payments.filter(p => p.status === 'overdue').length
    + contracts.filter(c => {
        if (c.status !== 'active') return false;
        const days = Math.ceil((new Date(c.endDate).getTime() - Date.now()) / 86400000);
        return days >= 0 && days <= 30;
      }).length;

  const navigate = (route: string) => {
    onClose();
    router.push(route as any);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.textInverse} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textInverse }]}>القائمة الرئيسية</Text>
          <View style={styles.closePlaceholder} />
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          {MENU_ITEMS.map(item => (
            <TouchableOpacity
              key={item.route}
              onPress={() => navigate(item.route)}
              style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.85}
            >
              <View style={[styles.tileIcon, { backgroundColor: colors.primarySubtle }]}>
                <Ionicons name={item.icon as any} size={26} color={colors.primary} />
                {item.route === '/notifications' && unread > 0 && (
                  <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                    <Text style={[styles.badgeText, { color: colors.textInverse }]}>{unread > 9 ? '9+' : unread}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tileLabel, { color: colors.text }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  headerTitle:      { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  closeBtn:         { padding: spacing[2] },
  closePlaceholder: { width: 40 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing[4],
    gap: spacing[3],
  },
  tile: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: radius.xl,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
    // 3-column grid with gap: (100% - 3*30% - 2*gap) / sides
    flexGrow: 1,
    maxWidth: '32%',
  },
  tileIcon: {
    width: 52, height: 52,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: 'center' },
  badge: {
    position: 'absolute',
    top: -4, left: -4,
    minWidth: 18, height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
});
