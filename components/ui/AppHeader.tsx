import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { lightColors, darkColors, spacing, fontSize, fontWeight, radius, shadow } from '../../constants/DesignTokens';
import { useScreenSize } from '../../hooks/useScreenSize';
import { useSidebar } from '../../context/SidebarContext';
import { useAppTheme } from '../../hooks/useAppTheme';

interface AppHeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: { icon: string; onPress: () => void; badge?: number; label?: string };
  rightText?: { label: string; onPress: () => void };
  transparent?: boolean;
}

export function AppHeader({ title, showBack = true, rightAction, rightText, transparent }: AppHeaderProps) {
  const insets  = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { isDesktop, isSmallPhone, hPad } = useScreenSize();
  const { toggle } = useSidebar();

  const bgColor   = transparent ? 'transparent' : colors.primary;
  const textColor = '#FFFFFF';
  const showHamburger = Platform.OS === 'web' && !isDesktop;

  // Compact title on small phones
  const titleSize = isSmallPhone ? fontSize.lg : fontSize.xl;

  return (
    <View style={[
      styles.container,
      {
        paddingTop: insets.top + (isSmallPhone ? spacing[1] : spacing[2]),
        paddingHorizontal: hPad,
        backgroundColor: bgColor,
      },
      !transparent && shadow.sm,
    ]}
      accessibilityRole="header"
    >
      <View style={styles.row}>

        <View style={[styles.sideStart, showHamburger && showBack && { width: 100, flexDirection: 'row', gap: 4 }]}>
          {showBack && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
              accessibilityRole="button"
              accessibilityLabel="رجوع"
              accessibilityHint="العودة للشاشة السابقة"
            >
              <Ionicons name="chevron-forward" size={22} color={textColor} />
              {!showHamburger && !isSmallPhone && (
                <Text style={[styles.backText, { color: textColor }]}>رجوع</Text>
              )}
            </TouchableOpacity>
          )}
          {showHamburger && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={toggle}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="فتح القائمة الجانبية"
            >
              <Ionicons name="menu-outline" size={26} color={textColor} />
            </TouchableOpacity>
          )}
        </View>

        <Text
          style={[styles.title, { color: textColor, fontSize: titleSize }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          accessibilityRole="header"
        >
          {title}
        </Text>

        <View style={styles.side}>
          {rightAction && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={rightAction.onPress}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={rightAction.label ?? title}
              accessibilityHint={rightAction.badge ? `${rightAction.badge} إشعار` : undefined}
            >
              <Ionicons name={rightAction.icon as any} size={22} color={textColor} />
              {!!rightAction.badge && rightAction.badge > 0 && (
                <View style={styles.badge} accessibilityElementsHidden>
                  <Text style={styles.badgeText}>{rightAction.badge > 99 ? '99+' : rightAction.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          {rightText && (
            <TouchableOpacity
              onPress={rightText.onPress}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={rightText.label}
            >
              <Text style={[styles.actionText, { color: textColor }]}>{rightText.label}</Text>
            </TouchableOpacity>
          )}
        </View>

      </View>
    </View>
  );
}

const HEADER_HEIGHT = 44;

const styles = StyleSheet.create({
  container: { paddingBottom: spacing[3] },
  row:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: HEADER_HEIGHT },
  side:      { width: 72, alignItems: 'flex-end', justifyContent: 'center' },
  sideStart: { width: 72, alignItems: 'flex-start', justifyContent: 'center' },
  backBtn:   { flexDirection: 'row', alignItems: 'center', gap: spacing[1], minHeight: 44, paddingVertical: spacing[2] },
  backText:  { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  title:     { flex: 1, fontWeight: fontWeight.bold, textAlign: 'center' },
  actionText:{ fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  iconBtn:   { padding: spacing[2], minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  badge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: '#E74C3C', borderRadius: radius.full,
    minWidth: 16, height: 16,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
});
