import React from 'react';
import {
  View, TouchableOpacity, StyleSheet, ViewStyle,
} from 'react-native';
import { lightColors, darkColors, spacing, radius, shadow } from '../../constants/DesignTokens';
import { useAppTheme } from '../../hooks/useAppTheme';

type CardElevation = 'flat' | 'sm' | 'md' | 'lg';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  elevation?: CardElevation;
  style?: ViewStyle;
  padding?: number;
  noBorder?: boolean;
}

export function Card({
  children,
  onPress,
  elevation = 'sm',
  style,
  padding,
  noBorder = false,
}: CardProps) {
  const { colors } = useAppTheme();

  const elevationStyle = elevation === 'flat' ? {} : shadow[elevation as 'sm' | 'md' | 'lg'];

  const cardStyle: ViewStyle = {
    backgroundColor: colors.card,
    borderColor:     colors.border,
    borderWidth:     noBorder ? 0 : 1,
    borderRadius:    radius.xl,
    padding:         padding ?? spacing[4],
    ...elevationStyle,
  };

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[cardStyle, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[cardStyle, style]}>
      {children}
    </View>
  );
}

// ─── Card sub-components ──────────────────────────────────────────────────────

interface CardRowProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function CardRow({ children, style }: CardRowProps) {
  return (
    <View style={[styles.row, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
