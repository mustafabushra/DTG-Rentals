/**
 * ContractCountdown — Live countdown display for contract expiry.
 * Used in contract detail and contract cards.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { lightColors, darkColors, spacing, fontSize, fontWeight, radius } from '../../constants/DesignTokens';
import { ContractService } from '../../domain/services/ContractService';
import type { Contract } from '../../domain/models';
import { useAppTheme } from '../../hooks/useAppTheme';

interface ContractCountdownProps {
  contract: Contract;
  showProgress?: boolean;
}

export function ContractCountdown({ contract, showProgress = false }: ContractCountdownProps) {
  const { colors } = useAppTheme();
  const urgency = ContractService.urgency(contract);
  const label   = ContractService.countdownLabel(contract);
  const days    = ContractService.daysRemaining(contract);

  const colorMap: Record<string, string> = {
    normal:    colors.success,
    warning:   colors.warning,
    critical:  colors.danger,
    expired:   colors.textMuted,
    cancelled: colors.textMuted,
  };

  const bgMap: Record<string, string> = {
    normal:    colors.successSubtle,
    warning:   colors.warningSubtle,
    critical:  colors.dangerSubtle,
    expired:   colors.surface,
    cancelled: colors.surface,
  };

  const iconMap: Record<string, string> = {
    normal:    'time-outline',
    warning:   'alert-circle-outline',
    critical:  'warning-outline',
    expired:   'close-circle-outline',
    cancelled: 'ban-outline',
  };

  const activeColor = colorMap[urgency];
  const activeBg    = bgMap[urgency];

  // Progress percentage (0–100) based on elapsed contract duration
  const progress = React.useMemo(() => {
    if (!showProgress || urgency === 'cancelled') return 0;
    const start = new Date(contract.startDate).getTime();
    const end   = new Date(contract.endDate).getTime();
    const total = end - start;
    if (total <= 0) return 100;
    const elapsed = Date.now() - start;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  }, [contract, showProgress, urgency]);

  return (
    <View style={[styles.container, { backgroundColor: activeBg, borderColor: activeColor + '40' }]}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: activeColor }]}>{label}</Text>
        <Ionicons name={iconMap[urgency] as any} size={18} color={activeColor} />
      </View>

      {showProgress && urgency !== 'cancelled' && (
        <View style={styles.progressSection}>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${progress}%` as any, backgroundColor: activeColor }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={[styles.progressPct, { color: activeColor }]}>{progress}%</Text>
            <Text style={[styles.progressSub, { color: colors.textMuted }]}>مدة العقد المنقضية</Text>
          </View>
        </View>
      )}

      {urgency !== 'cancelled' && urgency !== 'expired' && days >= 0 && (
        <View style={styles.datesRow}>
          <Text style={[styles.dateText, { color: colors.textMuted }]}>
            ينتهي: {contract.endDate}
          </Text>
          <Text style={[styles.dateText, { color: colors.textMuted }]}>
            بدأ: {contract.startDate}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    textAlign: 'right',
  },
  progressSection: { gap: spacing[1] },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPct: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  progressSub: { fontSize: fontSize.xs },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateText: { fontSize: fontSize.xs, textAlign: 'right' },
});
