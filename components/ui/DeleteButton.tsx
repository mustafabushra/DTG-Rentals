/**
 * DeleteButton — Unified danger action button.
 *
 * Two variants:
 *  • icon  — compact trash icon (used inside cards / list rows)
 *  • full  — full-width danger button with label (used on detail pages)
 *
 * Visibility: renders nothing when the current user cannot delete.
 * Call useCanDelete() before rendering if you need to conditionally
 * adjust surrounding layout instead of just hiding the button.
 */
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { lightColors, darkColors, spacing, fontSize, fontWeight, radius } from '../../constants/DesignTokens';
import { useCanDelete } from '../../hooks/useDelete';
import { useAppTheme } from '../../hooks/useAppTheme';

interface DeleteButtonProps {
  onPress: () => void;
  variant?: 'icon' | 'full';
  label?: string;
  style?: ViewStyle;
}

export function DeleteButton({
  onPress,
  variant = 'icon',
  label = 'حذف',
  style,
}: DeleteButtonProps) {
  const canDelete = useCanDelete();
  const { colors } = useAppTheme();

  if (!canDelete) return null;

  if (variant === 'full') {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[styles.full, { backgroundColor: colors.dangerSubtle, borderColor: colors.danger }, style]}
        activeOpacity={0.75}
      >
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
        <Text style={[styles.fullText, { color: colors.danger }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.icon, { backgroundColor: colors.dangerSubtle }, style]}
      activeOpacity={0.75}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="trash-outline" size={16} color={colors.danger} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  full: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
    marginBottom: spacing[6],
  },
  fullText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
});
