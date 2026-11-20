/**
 * مفتاح تشغيل/إيقاف بهوية DTG. بديل Switch: على الويب وفي الاتجاه من اليمين
 * لليسار كان مقبض Switch لا يظهر فيبدو المفتاح شريطاً ملوّناً فقط.
 */
import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';

interface Props {
  value?: boolean;
  onValueChange?: (v: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  [k: string]: any;
}

export function Toggle({ value = false, onValueChange, disabled, accessibilityLabel }: Props) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={() => !disabled && onValueChange?.(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={[styles.track, { backgroundColor: value ? colors.primary : colors.borderStrong, opacity: disabled ? 0.5 : 1 }]}
    >
      {/* RNW يعكس left في الاتجاه العربي: التشغيل يظهر المقبض جهة اليسار */}
      <View style={[styles.thumb, value ? { left: 21 } : { left: 3 }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 44, height: 26, borderRadius: 13, justifyContent: 'center' },
  thumb: {
    position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
});
