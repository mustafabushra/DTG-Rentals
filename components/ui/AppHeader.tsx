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

  // منصات: هيدر أبيض بحد سفلي رفيع ونص داكن
  const bgColor   = transparent ? 'transparent' : colors.card;
  const textColor = transparent ? '#FFFFFF' : colors.text;
  const iconColor = transparent ? '#FFFFFF' : colors.textSecondary;
  // في صفحات التفاصيل زر الرجوع يكفي؛ زر القائمة للصفحات الرئيسية فقط
  const showHamburger = Platform.OS === 'web' && !isDesktop && !showBack;

  // Compact title on small phones
  const titleSize = isSmallPhone ? 17 : 19;

  return (
    <View style={[
      styles.container,
      {
        paddingTop: insets.top + (isSmallPhone ? spacing[1] : spacing[2]),
        paddingHorizontal: hPad,
        backgroundColor: bgColor,
      },
      !transparent && { borderBottomWidth: 1, borderBottomColor: colors.border },
    ]}
      accessibilityRole="header"
    >
      <View style={styles.row}>

        <View style={[styles.sideStart, { flexDirection: 'row', gap: 2 }]}>
          {showBack && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
              accessibilityRole="button"
              accessibilityLabel="رجوع"
              accessibilityHint="العودة للشاشة السابقة"
            >
              <Ionicons name="arrow-forward" size={20} color={iconColor} />
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
              <Ionicons name="menu-outline" size={26} color={iconColor} />
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
              // "إضافة" هو الإجراء الرئيسي في الصفحة ⇒ زر ممتلئ؛ غيره أيقونة هادئة
              style={[styles.iconBtn, rightAction.icon === 'add' && !transparent && { backgroundColor: colors.primary }]}
              onPress={rightAction.onPress}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={rightAction.label ?? title}
              accessibilityHint={rightAction.badge ? `${rightAction.badge} إشعار` : undefined}
            >
              <Ionicons name={rightAction.icon as any} size={22} color={rightAction.icon === 'add' && !transparent ? colors.textInverse : iconColor} />
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
              <View style={[styles.textBtn, { borderColor: transparent ? 'rgba(255,255,255,0.5)' : colors.borderStrong }]}>
                <Text style={[styles.actionText, { color: transparent ? '#FFFFFF' : colors.text }]}>{rightText.label}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

      </View>
    </View>
  );
}

const HEADER_HEIGHT = 44;

const styles = StyleSheet.create({
  container: { paddingBottom: spacing[2] },
  row:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: HEADER_HEIGHT },
  side:      { minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  sideStart: { alignItems: 'center', justifyContent: 'flex-start' },
  backBtn:   { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  backText:  { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  // العنوان يبدأ من جهة البداية (يمين) كعناوين الصفحات، لا في المنتصف
  title:     { flex: 1, fontWeight: fontWeight.semibold, textAlign: 'right', paddingHorizontal: spacing[2] },
  actionText:{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  textBtn:   { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, height: 34, justifyContent: 'center' },
  iconBtn:   { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  badge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: '#D92D20', borderRadius: radius.full,
    minWidth: 16, height: 16,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
});
