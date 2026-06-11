import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { lightColors, darkColors, fontSize, fontWeight, radius, spacing } from '../../constants/DesignTokens';
import type { ContractStatus, PaymentStatus, MaintenanceStatus, UnitStatus, FilterStatus } from '../../domain/models';
import { useAppTheme } from '../../hooks/useAppTheme';

type BadgeStatus = ContractStatus | PaymentStatus | MaintenanceStatus | UnitStatus | 'expiring_soon' | 'warning' | string;
type BadgeSize = 'sm' | 'md';
type BadgeVariant = 'filled' | 'soft';

interface BadgeProps {
  status: BadgeStatus;
  size?: BadgeSize;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

interface BadgeConfig {
  label: string;
  bg: string;
  text: string;
}

export function Badge({ status, size = 'md', variant = 'soft', style }: BadgeProps) {
  const { colors } = useAppTheme();

  const config = getConfig(status, colors);

  const bgColor   = variant === 'filled' ? config.text : config.bg;
  const textColor = variant === 'filled' ? colors.textInverse : config.text;

  return (
    <View style={[styles.base, size === 'sm' ? styles.sm : styles.md, { backgroundColor: bgColor }, style]}>
      <Text style={[size === 'sm' ? styles.textSm : styles.textMd, { color: textColor }]}>
        {config.label}
      </Text>
    </View>
  );
}

function getConfig(status: BadgeStatus, colors: Record<string, string>): BadgeConfig {
  const map: Record<string, BadgeConfig> = {
    // Contract
    active:        { label: 'نشط',          bg: colors.successSubtle, text: colors.success },
    expired:       { label: 'منتهي',         bg: colors.dangerSubtle,  text: colors.danger },
    cancelled:     { label: 'ملغي',          bg: colors.surface,       text: colors.textMuted },
    terminated:    { label: 'منتهي إدارياً', bg: colors.dangerSubtle,  text: colors.danger },
    pending:       { label: 'معلق',          bg: colors.warningSubtle, text: colors.warning },

    // Payment
    paid:          { label: 'مدفوع',         bg: colors.successSubtle, text: colors.success },
    overdue:       { label: 'متأخر',         bg: colors.dangerSubtle,  text: colors.danger },

    // Maintenance
    new:           { label: 'جديد',          bg: colors.primarySubtle, text: colors.primary },
    in_progress:   { label: 'قيد التنفيذ',   bg: colors.warningSubtle, text: colors.warning },
    completed:     { label: 'مكتمل',         bg: colors.successSubtle, text: colors.success },

    // Unit
    vacant:        { label: 'شاغرة',         bg: colors.surface,       text: colors.textSecondary },
    rented:        { label: 'مؤجرة',         bg: colors.successSubtle, text: colors.success },
    maintenance:   { label: 'صيانة',         bg: colors.warningSubtle, text: colors.warning },
    reserved:      { label: 'محجوزة',        bg: colors.primarySubtle, text: colors.primary },

    // Tenant
    former:        { label: 'سابق',          bg: colors.surface,       text: colors.textMuted },

    // File expiry
    expiring_soon: { label: 'تنتهي قريباً',  bg: colors.warningSubtle, text: colors.warning },
    warning:       { label: 'تحذير',         bg: colors.warningSubtle, text: colors.warning },

    // Priority
    low:           { label: 'منخفضة',        bg: colors.surface,       text: colors.textSecondary },
    medium:        { label: 'متوسطة',        bg: colors.primarySubtle, text: colors.primary },
    high:          { label: 'عالية',         bg: colors.warningSubtle, text: colors.warning },
    urgent:        { label: 'عاجل',          bg: colors.dangerSubtle,  text: colors.danger },
  };

  return map[status] ?? { label: status, bg: colors.surface, text: colors.textSecondary };
}

const styles = StyleSheet.create({
  base:   { borderRadius: radius.full, alignSelf: 'flex-start' },
  sm:     { paddingHorizontal: spacing[2], paddingVertical: 2 },
  md:     { paddingHorizontal: spacing[3], paddingVertical: spacing[1] },
  textSm: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  textMd: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
