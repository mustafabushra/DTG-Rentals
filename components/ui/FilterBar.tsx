/**
 * FilterBar — Global filter system controller.
 *
 * RTL is inherited from direction:'rtl' set on the root in _layout.tsx.
 * No row-reverse, no array reversal, no visual tricks needed.
 * flexDirection:'row' + direction:'rtl' → items flow right-to-left,
 * scroll origin is at the right, first option (الكل) is always visible.
 *
 * Rules enforced here (not per-page):
 *   • Fixed height 34 on every pill
 *   • flexShrink: 0 — pills never compress or overlap
 *   • Identical spacing, font, padding across all modules
 *   • Stateless: receives state, dispatches changes up
 */
import React, { useRef, useEffect } from 'react';
import { ScrollView, TouchableOpacity, Text, View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { lightColors, darkColors, spacing, fontSize, fontWeight, radius } from '../../constants/DesignTokens';
import { useAppTheme } from '../../hooks/useAppTheme';
export interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  containerStyle?: ViewStyle;
}

// ─── Preset option sets (reused across modules) ────────────────────────────────

export const CONTRACT_FILTERS: FilterOption[] = [
  { value: 'all',       label: 'الكل' },
  { value: 'active',    label: 'نشط' },
  { value: 'expired',   label: 'منتهي' },
  { value: 'cancelled', label: 'ملغي' },
  { value: 'pending',   label: 'معلق' },
];

export const PAYMENT_FILTERS: FilterOption[] = [
  { value: 'all',     label: 'الكل' },
  { value: 'paid',    label: 'مدفوع' },
  { value: 'pending', label: 'معلق' },
  { value: 'overdue', label: 'متأخر' },
];

export const UNIT_FILTERS: FilterOption[] = [
  { value: 'all',         label: 'الكل' },
  { value: 'vacant',      label: 'شاغرة' },
  { value: 'rented',      label: 'مؤجرة' },
  { value: 'maintenance', label: 'صيانة' },
  { value: 'reserved',    label: 'محجوزة' },
];

export const MAINTENANCE_FILTERS: FilterOption[] = [
  { value: 'all',         label: 'الكل' },
  { value: 'new',         label: 'جديد' },
  { value: 'in_progress', label: 'قيد التنفيذ' },
  { value: 'completed',   label: 'مكتمل' },
  { value: 'cancelled',   label: 'ملغي' },
];

export const PROPERTY_FILTERS: FilterOption[] = [
  { value: 'all',       label: 'الكل' },
  { value: 'apartment', label: 'شقة' },
  { value: 'villa',     label: 'فيلا' },
  { value: 'office',    label: 'مكتب' },
  { value: 'shop',      label: 'محل' },
  { value: 'building',  label: 'عمارة' },
];

export const AUDIT_FILTERS: FilterOption[] = [
  { value: 'all',    label: 'الكل' },
  { value: 'add',    label: 'إضافة' },
  { value: 'edit',   label: 'تعديل' },
  { value: 'delete', label: 'حذف' },
];

export const GENERAL_FILTERS: FilterOption[] = [
  { value: 'all',       label: 'الكل' },
  { value: 'active',    label: 'نشط' },
  { value: 'expired',   label: 'منتهي' },
  { value: 'cancelled', label: 'ملغي' },
  { value: 'paid',      label: 'مدفوع' },
  { value: 'overdue',   label: 'متأخر' },
];

// ─── Component ────────────────────────────────────────────────────────────────
// شكل "مقطّع" (segmented): مجموعة واحدة هادئة بدل حبوب داكنة متكررة —
// الخيار النشط بطاقة بيضاء مرفوعة بنص كحلي، والباقي نص رمادي على أرضية رمادية.

export function FilterBar({ options, value, onChange, containerStyle }: FilterBarProps) {
  const { colors, scheme } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const activeBg   = scheme === 'dark' ? colors.borderStrong : colors.card;
  const activeText = scheme === 'dark' ? colors.text : colors.primary;

  // على web RTL يبدأ الـ scroll من اليسار (الـ end) — نعيده لليمين (الـ start) بعد mount
  useEffect(() => {
    if (Platform.OS === 'web') {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 0);
    }
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={[styles.content, containerStyle]}
    >
      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {options.map(opt => {
          const isActive = opt.value === value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[
                styles.seg,
                isActive && [styles.segActive, { backgroundColor: activeBg, borderColor: colors.border }],
              ]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[styles.segText, { color: isActive ? activeText : colors.textSecondary }, isActive && { fontWeight: fontWeight.semibold }]}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  content: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingVertical:   6,
    alignItems:        'center',
  },
  group: {
    flexDirection: 'row',
    borderRadius:  10,
    borderWidth:   1,
    padding:       3,
    gap:           2,
  },
  seg: {
    height:            32,
    paddingHorizontal: 14,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       'transparent',
    flexShrink:        0,
    justifyContent:    'center',
    alignItems:        'center',
  },
  segActive: {
    shadowColor: '#071729',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  segText: {
    fontSize:   13,
    fontWeight: fontWeight.medium,
    flexShrink: 0,
  },
});
