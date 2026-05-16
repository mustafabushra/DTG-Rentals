import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { lightColors, darkColors, spacing, fontSize, fontWeight, radius } from '../../constants/DesignTokens';
import { useAppTheme } from '../../hooks/useAppTheme';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'folder-open-outline', title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySubtle }]}>
        <Ionicons name={icon as any} size={48} color={colors.textMuted} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={onAction}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],  // 32
    paddingVertical:   spacing[10], // 40
    gap: spacing[3],                // 12
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  title: {
    fontSize: fontSize.xl,          // 20
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,          // 14
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    marginTop: spacing[2],
    paddingHorizontal: spacing[6],  // 24
    paddingVertical: spacing[3],    // 12
    borderRadius: radius.lg,        // 12
  },
  btnText: {
    color: '#FFF',
    fontSize: fontSize.base,        // 15
    fontWeight: fontWeight.semibold,
  },
});
