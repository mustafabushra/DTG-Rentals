import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { lightColors, darkColors, spacing, fontSize, fontWeight, radius, shadow } from '../../constants/DesignTokens';
import { useScreenSize } from '../../hooks/useScreenSize';
import { useAppTheme } from '../../hooks/useAppTheme';

interface KPICardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  fullWidth?: boolean;
}

export function KPICard({ label, value, icon, color, trend, trendValue, fullWidth }: KPICardProps) {
  const { colors } = useAppTheme();
  const { isSmallPhone } = useScreenSize();

  const trendColor = trend === 'up' ? colors.success : trend === 'down' ? colors.danger : colors.textSecondary;
  const trendIcon  = trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove';

  // Scale down on iPhone SE / mini
  const valSize   = isSmallPhone ? fontSize.xl  : fontSize['2xl']; // 20 vs 24
  const iconSize  = isSmallPhone ? 18            : 22;
  const iconWrapS = isSmallPhone ? 34            : 40;
  const pad       = isSmallPhone ? spacing[2]    : spacing[3];     // 8 vs 12

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, padding: pad },
        fullWidth && styles.fullWidth,
        shadow.sm,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}${trendValue ? `، ${trendValue}` : ''}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${color}18`, width: iconWrapS, height: iconWrapS, borderRadius: iconWrapS / 4 }]}>
        <Ionicons name={icon as any} size={iconSize} color={color} />
      </View>
      <Text style={[styles.value, { color: colors.text, fontSize: valSize }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
      {trend && trendValue && (
        <View style={styles.trendRow}>
          <Ionicons name={trendIcon as any} size={12} color={trendColor} />
          <Text style={[styles.trendText, { color: trendColor }]} numberOfLines={1}>{trendValue}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'flex-start',
    gap: spacing[1],
    minWidth: 0,
  },
  fullWidth: {
    flex: undefined,
    width: '100%',
  },
  iconWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  value: {
    fontWeight: fontWeight.bold,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[1],
  },
  trendText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
});
