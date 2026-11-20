/**
 * خيارات التصفية الإضافية مخفية خلف زر واحد. الفلتر الأساسي يبقى ظاهراً خارجها.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppTheme } from '../../hooks/useAppTheme';

export function FilterPanel({ children, activeCount = 0 }: { children: React.ReactNode; activeCount?: number }) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <View style={styles.bar}>
        <TouchableOpacity
          onPress={() => setOpen(o => !o)}
          style={[styles.btn, { borderColor: activeCount ? colors.primary : colors.border, backgroundColor: colors.card }]}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <Ionicons name="options-outline" size={16} color={activeCount ? colors.primary : colors.textSecondary} />
          <Text style={[styles.label, { color: activeCount ? colors.primary : colors.textSecondary }]}>
            {activeCount ? `تصفية (${activeCount})` : 'تصفية'}
          </Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      {open && <View style={{ paddingBottom: 4 }}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, height: 34 },
  label: { fontSize: 13, fontWeight: '500' },
});
