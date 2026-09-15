/**
 * شريط وضع المعاينة — يظهر فوق التطبيق كله ما دام المدير يعاين بعين مالك.
 *
 * الغرض أن يستحيل نسيان الوضع: البيانات المعروضة مفلترة وليست كل بيانات
 * المؤسسة، والكتابة معطّلة. بلا هذا الشريط قد يظن المدير أن بيانات ناقصة أو
 * أن أزراراً اختفت بخلل.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';

export function OwnerPreviewBanner() {
  const insets = useSafeAreaInsets();
  const { previewing, previewOwnerId, owners, stopOwnerPreview } = useApp();

  if (!previewing) return null;

  const owner = owners.find(o => o.id === previewOwnerId);

  return (
    <View style={[styles.wrap, { paddingTop: Platform.OS === 'web' ? 10 : insets.top + 8 }]}>
      <Ionicons name="eye-outline" size={17} color="#021C36" />
      <Text style={styles.text} numberOfLines={1}>
        تعاين بعين المالك: <Text style={styles.name}>{owner?.name ?? previewOwnerId}</Text> — عرض فقط
      </Text>
      <TouchableOpacity style={styles.exit} onPress={stopOwnerPreview} hitSlop={8}>
        <Text style={styles.exitText}>خروج</Text>
        <Ionicons name="close" size={15} color="#021C36" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#C3AF76',
    paddingHorizontal: Theme.spacing.base, paddingBottom: 10,
    ...(Platform.OS === 'web' ? { position: 'sticky' as any, top: 0, zIndex: 1000 } : {}),
  },
  text: { flex: 1, color: '#021C36', fontSize: Theme.fontSize.sm, textAlign: 'right' },
  name: { fontWeight: Theme.fontWeight.bold },
  exit: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(2,28,54,0.12)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Theme.radius.full,
  },
  exitText: { color: '#021C36', fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.bold },
});
