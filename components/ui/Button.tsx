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
    // منصات "Secondary": خلفية رمادية فاتحة ونص داكن
    secondary: {
      container:   { backgroundColor: colors.surface },
      textColor:   colors.text,
      loaderColor: colors.text,
    },
    // منصات "Secondary outline": أبيض بحد محايد
    outline: {
      container:   { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderStrong },
      textColor:   colors.text,
      loaderColor: colors.text,
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
    // منصات: زوايا 4px وارتفاعات ثابتة 32 / 40 / 48
    sm: {
      container: { minHeight: 32, paddingVertical: 6, paddingHorizontal: spacing[3], borderRadius: radius.sm } as ViewStyle,
      text:      { fontSize: fontSize.sm, fontWeight: fontWeight.medium } as TextStyle,
      iconSize:  16,
    },
    md: {
      container: { minHeight: 40, paddingVertical: spacing[2], paddingHorizontal: spacing[4], borderRadius: radius.sm } as ViewStyle,
      text:      { fontSize: fontSize.md, fontWeight: fontWeight.medium } as TextStyle,
      iconSize:  18,
    },
    lg: {
      container: { minHeight: 48, paddingVertical: spacing[3], paddingHorizontal: spacing[5], borderRadius: radius.sm } as ViewStyle,
      text:      { fontSize: 16, fontWeight: fontWeight.medium } as TextStyle,
      iconSize:  20,
    },
  };
  return map[size];
}

const styles = StyleSheet.create({
  base:      { alignItems: 'center', justifyContent: 'center' },
  fullWidth: { width: '100%' },
  disabled:  { opacity: 0.4 },
  inner:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconStart: { marginStart: 2 },
  iconEnd:   { marginEnd: 2 },
});
