/**
 * CollapsibleSection — A reusable collapsible/expandable group container
 * for hierarchical data display (e.g., City → Properties).
 * Pure UI component — no business logic.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppTheme } from '../../hooks/useAppTheme';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  count?: number;
  icon?: keyof typeof Ionicons.glyphMap;
  defaultExpanded?: boolean;
  headerColor?: string;  // background tint for the header
  children: React.ReactNode;
  /** Optional right action next to the count */
  rightAction?: React.ReactNode;
}

export function CollapsibleSection({
  title,
  subtitle,
  count,
  icon = 'folder-outline',
  defaultExpanded = true,
  headerColor,
  children,
  rightAction,
}: CollapsibleSectionProps) {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const animatedRotation = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;

  const toggle = useCallback(() => {
    // Animate the chevron rotation
    Animated.timing(animatedRotation, {
      toValue: expanded ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Animate content appearance with LayoutAnimation
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  }, [expanded, animatedRotation]);

  const rotateInterpolation = animatedRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const bgColor = headerColor || colors.primary + '10';

  return (
    <View style={styles.wrapper}>
      {/* Header — pressable to toggle */}
      <TouchableOpacity
        style={[styles.header, { backgroundColor: bgColor, borderColor: colors.border }]}
        onPress={toggle}
        activeOpacity={0.7}
      >
        {/* Left: chevron */}
        <Animated.View style={{ transform: [{ rotate: rotateInterpolation }] }}>
          <Ionicons name="chevron-down" size={18} color={colors.text} />
        </Animated.View>

        {/* Icon */}
        <Ionicons name={icon} size={18} color={colors.primary} />

        {/* Title + subtitle */}
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
          )}
        </View>

        {/* Right: count + optional action */}
        <View style={styles.headerRight}>
          {rightAction}
          {count !== undefined && (
            <View style={[styles.countBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.countText, { color: colors.primary }]}>{count}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Content — shown/hidden with LayoutAnimation */}
      {expanded && (
        <View style={styles.content}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  headerText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    minWidth: 26,
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    paddingTop: 4,
    paddingHorizontal: 4,
  },
});