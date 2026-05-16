import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle, View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { lightColors, darkColors, spacing, fontSize, fontWeight, radius } from '../../constants/DesignTokens';
import { useAppTheme } from '../../hooks/useAppTheme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize    = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'start' | 'end';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'start',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const { colors } = useAppTheme();

  const variantStyles = getVariantStyles(variant, colors);
  const sizeStyles    = getSizeStyles(size);

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.base,
        sizeStyles.container,
        variantStyles.container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyles.loaderColor} />
      ) : (
        <View style={styles.inner}>
          {icon && iconPosition === 'start' && (
            <Ionicons
              name={icon}
              size={sizeStyles.iconSize}
              color={variantStyles.textColor}
              style={styles.iconStart}
            />
          )}
          <Text style={[sizeStyles.text, { color: variantStyles.textColor }, textStyle]}>
            {label}
          </Text>
          {icon && iconPosition === 'end' && (
            <Ionicons
              name={icon}
              size={sizeStyles.iconSize}
              color={variantStyles.textColor}
              style={styles.iconEnd}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Variant Styles ────────────────────────────────────────────────────────────

function getVariantStyles(variant: ButtonVariant, colors: Record<string, string>) {
  const map: Record<ButtonVariant, { container: ViewStyle; textColor: string; loaderColor: string }> = {
    primary: {
      container:   { backgroundColor: colors.primary },
      textColor:   colors.textInverse,
      loaderColor: colors.textInverse,
    },
    secondary: {
      container:   { backgroundColor: colors.primarySubtle },
      textColor:   colors.primary,
      loaderColor: colors.primary,
    },
    outline: {
      container:   { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
      textColor:   colors.primary,
      loaderColor: colors.primary,
    },
    ghost: {
      container:   { backgroundColor: 'transparent' },
      textColor:   colors.primary,
      loaderColor: colors.primary,
    },
    danger: {
      container:   { backgroundColor: colors.danger },
      textColor:   colors.textInverse,
      loaderColor: colors.textInverse,
    },
    success: {
      container:   { backgroundColor: colors.success },
      textColor:   colors.textInverse,
      loaderColor: colors.textInverse,
    },
  };
  return map[variant];
}

function getSizeStyles(size: ButtonSize) {
  const map = {
    sm: {
      container: { paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: radius.md } as ViewStyle,
      text:      { fontSize: fontSize.sm, fontWeight: fontWeight.semibold } as TextStyle,
      iconSize:  14,
    },
    md: {
      container: { paddingVertical: spacing[3], paddingHorizontal: spacing[5], borderRadius: radius.lg } as ViewStyle,
      text:      { fontSize: fontSize.base, fontWeight: fontWeight.semibold } as TextStyle,
      iconSize:  16,
    },
    lg: {
      container: { paddingVertical: spacing[4], paddingHorizontal: spacing[6], borderRadius: radius.lg } as ViewStyle,
      text:      { fontSize: fontSize.lg, fontWeight: fontWeight.bold } as TextStyle,
      iconSize:  18,
    },
  };
  return map[size];
}

const styles = StyleSheet.create({
  base:      { alignItems: 'center', justifyContent: 'center' },
  fullWidth: { width: '100%' },
  disabled:  { opacity: 0.45 },
  inner:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconStart: { marginStart: 2 },
  iconEnd:   { marginEnd: 2 },
});
