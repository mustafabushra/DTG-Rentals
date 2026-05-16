/**
 * RTLTabBar — Custom bottom navigation bar.
 *
 * RTL is inherited from the root direction:'rtl' set in _layout.tsx.
 * flexDirection:'row' flows right-to-left naturally — no row-reverse needed.
 *
 * Visual order (right → left): الرئيسية | الملاك | العقارات | العقود | المزيد
 * DOM order matches visual order exactly.
 *
 * "المزيد" opens MoreMenu full-screen modal — never navigates to a screen.
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, I18nManager, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { lightColors, darkColors, spacing, fontSize, fontWeight } from '../../constants/DesignTokens';
import { MoreMenu } from '../features/MoreMenu';
import { useAppTheme } from '../../hooks/useAppTheme';

// Visual order (right→left): الرئيسية | الملاك | العقارات | العقود | المزيد
// DOM order matches visual order — direction:'rtl' from root handles the rest.
const TAB_CONFIG = [
  { name: 'index',      label: 'الرئيسية', icon: 'grid-outline'          },
  { name: 'owners',     label: 'الملاك',   icon: 'people-outline'        },
  { name: 'properties', label: 'العقارات', icon: 'business-outline'      },
  { name: 'contracts',  label: 'العقود',   icon: 'document-text-outline' },
] as const;

// "المزيد" is the leftmost tab visually — placed last in DOM, flows left in RTL.
const MORE_TAB = { name: 'more', label: 'المزيد', icon: 'apps-outline' } as const;

export function RTLTabBar({ state, navigation }: BottomTabBarProps) {
  // Sidebar handles navigation on web — hide tab bar entirely
  if (Platform.OS === 'web') return null;

  const { colors } = useAppTheme();
  const insets  = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSmall = width < 390;
  const [moreVisible, setMoreVisible] = useState(false);

  const activeRouteName = state.routes[state.index]?.name ?? '';

  const active   = colors.primary;
  const inactive = colors.textMuted;

  const navigateTo = (name: string) => {
    const route = state.routes.find(r => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) {
      navigation.navigate(name);
    }
  };

  return (
    <>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.border,
            // Use real safe area insets — handles iPhone X+ home indicator
            paddingBottom: insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? 16 : 8),
          },
        ]}
      >
        {TAB_CONFIG.map(tab => {
          const isActive = activeRouteName === tab.name;
          const color    = isActive ? active : inactive;
          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => navigateTo(tab.name)}
              style={styles.tab}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, isActive && { backgroundColor: `${active}18` }]}>
                <Ionicons name={tab.icon} size={isSmall ? 20 : 22} color={color} />
              </View>
              <Text style={[styles.label, { color, fontSize: isSmall ? 10 : fontSize.xs }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}

        {/* المزيد — last in DOM → leftmost visually */}
        <TouchableOpacity
          onPress={() => setMoreVisible(true)}
          style={styles.tab}
          accessibilityRole="button"
          accessibilityLabel={MORE_TAB.label}
          activeOpacity={0.75}
        >
          <View style={styles.iconWrap}>
            <Ionicons name={MORE_TAB.icon} size={isSmall ? 20 : 22} color={inactive} />
          </View>
          <Text style={[styles.label, { color: inactive, fontSize: isSmall ? 10 : fontSize.xs }]}>{MORE_TAB.label}</Text>
        </TouchableOpacity>
      </View>

      <MoreMenu visible={moreVisible} onClose={() => setMoreVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    borderTopWidth: 1,
    paddingTop: spacing[2],
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 4,
    minHeight: 50,
  },
  iconWrap: {
    width: 44,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
});
