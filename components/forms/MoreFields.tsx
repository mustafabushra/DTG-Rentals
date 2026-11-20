/**
 * "تفاصيل إضافية" — يخفي الحقول الاختيارية خلف زر واحد حتى يبقى النموذج قصيراً.
 * يفتح تلقائياً إن كان أي حقل فيه معبّأ (عند التعديل).
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppTheme } from '../../hooks/useAppTheme';

export function MoreFields({ children, filled = false, label = 'تفاصيل إضافية (اختياري)' }: { children: React.ReactNode; filled?: boolean; label?: string }) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(filled);
  return (
    <View style={{ gap: 16 }}>
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        style={[styles.btn, { borderColor: colors.border, backgroundColor: colors.card }]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </TouchableOpacity>
      {open && children}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, height: 46 },
  label: { fontSize: 14, fontWeight: '500', textAlign: 'right' },
});
