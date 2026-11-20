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
    { icon: 'cash-outline', label: 'المدفوعات', route: '/payments', color: '#079455' },
    { icon: 'wallet-outline', label: 'مصاريف العقارات', route: '/expenses', color: '#D92D20' },
    { icon: 'briefcase-outline', label: 'مصاريف المكتب', route: '/office-expenses', color: '#B54708' },
    { icon: 'documents-outline', label: 'السندات', route: '/vouchers', color: '#0F2A47' },
    { icon: 'person-outline', label: 'المستأجرون', route: '/tenants', color: '#1570EF' },
    { icon: 'home-outline', label: 'الوحدات', route: '/units', color: '#365A80' },
  ],
  [
    { icon: 'construct-outline', label: 'الصيانة', route: '/maintenance', color: '#DC6803' },
    { icon: 'bar-chart-outline', label: 'التقارير المالية', route: '/financial-reports', color: '#0F2A47' },
    { icon: 'calendar-outline', label: 'التقويم', route: '/calendar', color: '#B54708' },
  ],
  [
    { icon: 'time-outline', label: 'سجل العمليات', route: '/audit-log', color: '#16A085' },
    { icon: 'sparkles-outline', label: 'التحديثات الجديدة', route: '/updates', color: '#F1C40F' },
    { icon: 'notifications-outline', label: 'الإشعارات', route: '/notifications', color: '#D92D20' },
    { icon: 'settings-outline', label: 'الإعدادات', route: '/settings', color: '#6C737F' },
  ],
];

const GROUP_TITLES = ['الإدارة', 'التشغيل', 'النظام'];

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>المزيد</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {menuItems.map((group, gi) => (
          <View key={gi} style={{ gap: 8 }}>
            <Text style={[styles.groupTitle, { color: colors.textMuted }]}>{GROUP_TITLES[gi]}</Text>
            <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {group.map((item, i) => (
                <TouchableOpacity
                  key={item.route}
                  style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
                    <Ionicons name={item.icon as any} size={19} color={colors.primary} />
                  </View>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>{item.label}</Text>
                  <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.appInfo}>
          <Image source={require('../../assets/images/icon.png')} style={styles.appLogoImage} resizeMode="contain" />
          <Text style={[styles.appVersion, { color: colors.textMuted }]}>نظام إدارة العقارات v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 14, paddingHorizontal: 16, minHeight: 60, justifyContent: 'flex-end', borderBottomWidth: 1 },
  headerTitle: { fontSize: 19, fontWeight: '600', textAlign: 'right' },
  content: { padding: 16, paddingBottom: 32, gap: 20, width: '100%', maxWidth: 720, alignSelf: 'center' },
  groupTitle: { fontSize: 13, fontWeight: '500', textAlign: 'right', paddingHorizontal: 4 },
  group: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 54 },
  iconWrap: { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500', textAlign: 'right' },
  appInfo: { alignItems: 'center', paddingTop: 8, gap: 6 },
  appLogoImage: { width: 64, height: 64, borderRadius: 12 },
  appVersion: { fontSize: 12 },
});
