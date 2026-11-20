/**
 * تبويبات القسم: تجمع الصفحات المتشابهة تحت قسم واحد (مثلاً التحصيل: المتابعة/الدفعات/حسب العقد).
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useAppTheme } from '../../hooks/useAppTheme';
import { HUBS, HubKey } from '../../constants/Navigation';
import { useApp } from '../../context/AppProvider';

export function HubTabs({ hub }: { hub: HubKey }) {
  const { colors } = useAppTheme();
  const pathname = usePathname();
  const { isOwner, previewing } = useApp();
  let tabs = HUBS[hub];
  // المالك لا يحتاج تبويب "الوحدات" المنفصل ولا أدوات الموظفين
  if ((isOwner || previewing) && hub !== 'properties') return null;
  if (tabs.length < 2) return null;
  const active = tabs.findIndex(t => pathname === t.match || pathname.startsWith(t.match + '/'));
  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {tabs.map((t, i) => {
          const on = i === (active < 0 ? 0 : active);
          return (
            <TouchableOpacity
              key={t.route}
              onPress={() => !on && router.replace(t.route as any)}
              style={[styles.tab, on && { borderBottomColor: colors.primary }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.label, { color: on ? colors.text : colors.textMuted }, on && { fontWeight: '600' }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: 1 },
  row: { flexDirection: 'row', paddingHorizontal: 12, gap: 4, flexGrow: 1 },
  tab: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  label: { fontSize: 14, fontWeight: '500' },
});
