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
import { ScrollView, TouchableOpacity, Text, StyleSheet, ViewStyle, Platform } from 'react-native';
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

export function FilterBar({ options, value, onChange, containerStyle }: FilterBarProps) {
  const { colors, scheme } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  // في الـ dark mode الخلفية النشطة ذهبية فاتحة → نص داكن. في light mode الخلفية داكنة → نص أبيض
  const activeTextColor = scheme === 'dark' ? '#0F1923' : '#FFFFFF';

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
      {options.map(opt => {
        const isActive = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.pill,
              {
                backgroundColor: isActive ? colors.filterActive : colors.filterInactive,
                borderColor:     isActive ? colors.filterActive : colors.border,
              },
            ]}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.pillText, { color: isActive ? activeTextColor : colors.textSecondary }]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  content: {
    flexDirection: 'row',        // direction:'rtl' from root → flows right-to-left
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[2],
    gap:               spacing[2],
    alignItems:        'center',
  },
  pill: {
    height:            34,       // fixed — identical on every page
    paddingHorizontal: spacing[4],
    borderRadius:      radius.full,
    borderWidth:       1,
    flexShrink:        0,        // never compresses — no overlap, no clipping
    justifyContent:    'center',
    alignItems:        'center',
  },
  pillText: {
    fontSize:   fontSize.sm,
    fontWeight: fontWeight.semibold,
    flexShrink: 0,
  },
});
