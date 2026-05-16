import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../hooks/useAppTheme';

interface MenuItem {
  icon: string;
  label: string;
  route: string;
  color: string;
  badge?: number;
}

const menuItems: MenuItem[][] = [
  [
    { icon: 'cash-outline', label: 'المدفوعات', route: '/payments', color: '#27AE60' },
    { icon: 'person-outline', label: 'المستأجرون', route: '/tenants', color: '#2E86C1' },
    { icon: 'home-outline', label: 'الوحدات', route: '/units', color: '#8E44AD' },
  ],
  [
    { icon: 'construct-outline', label: 'الصيانة', route: '/maintenance', color: '#F39C12' },
    { icon: 'bar-chart-outline', label: 'التقارير المالية', route: '/financial-reports', color: '#1B4F72' },
    { icon: 'calendar-outline', label: 'التقويم', route: '/calendar', color: '#E67E22' },
  ],
  [
    { icon: 'time-outline', label: 'سجل العمليات', route: '/audit-log', color: '#16A085' },
    { icon: 'notifications-outline', label: 'الإشعارات', route: '/notifications', color: '#E74C3C' },
    { icon: 'settings-outline', label: 'الإعدادات', route: '/settings', color: '#7F8C8D' },
  ],
];

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
        <Text style={styles.headerTitle}>المزيد</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.grid}>
          {menuItems.flat().map((item) => (
            <TouchableOpacity
              key={item.route}
              style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }, Theme.shadow.sm]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon as any} size={28} color={item.color} />
              </View>
              <Text style={[styles.tileLabel, { color: colors.text }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.appLogoImage}
            resizeMode="contain"
          />
          <Text style={[styles.appVersion, { color: colors.textMuted }]}>نظام إدارة العقارات v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 14,
    paddingHorizontal: Theme.spacing.base,
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'flex-end',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: Theme.fontSize.xl,
    fontWeight: Theme.fontWeight.bold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Theme.spacing.base,
    gap: Theme.spacing.sm,
  },
  tile: {
    width: '30.5%',
    aspectRatio: 1,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileLabel: {
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.semibold,
    textAlign: 'center',
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
    gap: 8,
  },
  appLogo: {
    width: 64, height: 64, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  appLogoImage: {
    width: 120, height: 120, borderRadius: 16,
  },
  appName: {
    fontSize: Theme.fontSize.xl,
    fontWeight: Theme.fontWeight.bold,
  },
  appVersion: {
    fontSize: Theme.fontSize.sm,
  },
});
