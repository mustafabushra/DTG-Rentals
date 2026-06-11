import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../hooks/useAppTheme';

export interface SmartAlertData {
  id: string;
  message: string;
  type: 'danger' | 'warning' | 'success';
  actionLabel?: string;
  actionRoute?: string;
  onAction?: () => void;
}

interface Props {
  alert: SmartAlertData;
  onDismiss: (id: string) => void;
}

const CONFIG = {
  danger:  { icon: 'alert-circle-outline'  as const },
  warning: { icon: 'information-circle-outline' as const },
  success: { icon: 'checkmark-circle-outline' as const },
};

export function SmartAlert({ alert, onDismiss }: Props) {
  const { colors } = useAppTheme();
  const translateY = useRef(new Animated.Value(-20)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const cfg = CONFIG[alert.type];

  const alertBg: Record<string, string> = {
    danger:  colors.dangerSubtle,
    warning: colors.warningSubtle,
    success: colors.successSubtle,
  };
  const alertBorder: Record<string, string> = {
    danger:  colors.danger,
    warning: colors.warning,
    success: colors.success,
  };

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacity,    { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    if (alert.type === 'success') {
      const t = setTimeout(() => handleDismiss(), 5000);
      return () => clearTimeout(t);
    }
  }, []);

  const handleDismiss = () => {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onDismiss(alert.id));
  };

  const handleAction = () => {
    if (alert.onAction) { alert.onAction(); return; }
    if (alert.actionRoute) router.push(alert.actionRoute as any);
  };

  return (
    <Animated.View style={[
      styles.card,
      { backgroundColor: alertBg[alert.type], borderRightColor: alertBorder[alert.type], transform: [{ translateY }], opacity },
    ]}>
      <View style={styles.top}>
        <TouchableOpacity onPress={handleDismiss} style={styles.dismissBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.msgRow}>
          <Text style={[styles.msg, { color: colors.text }]}>{alert.message}</Text>
          <Ionicons name={cfg.icon} size={20} color={alertBorder[alert.type]} />
        </View>
      </View>
      {alert.actionLabel && (
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleAction}>
          <Text style={[styles.actionText, { color: colors.textInverse }]}>{alert.actionLabel}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ─── Builder: generates the top-priority alert from app data ─────────────────

interface AlertInput {
  expiringContracts: { id: string; contractNumber?: string; endDate: string }[];
  overduePayments: number;
  collectionRate: number;
  vacantUnits: { id: string; number: string }[];
  vacantSinceDays: Record<string, number>;
}

export function buildSmartAlert(input: AlertInput): SmartAlertData | null {
  const { expiringContracts, overduePayments, collectionRate, vacantUnits, vacantSinceDays } = input;

  // Priority 1: contracts expiring this month with none renewed
  if (expiringContracts.length > 0) {
    return {
      id: 'expiring_contracts',
      type: 'danger',
      message: `${expiringContracts.length} عقد${expiringContracts.length === 1 ? '' : ' عقود'} تنتهي هذا الشهر ولم يتم تجديد أي منها`,
      actionLabel: 'عرض العقود',
      actionRoute: '/(tabs)/contracts',
    };
  }

  // Priority 2: low collection rate + overdue payments
  if (overduePayments > 0 && collectionRate < 60) {
    return {
      id: 'low_collection',
      type: 'warning',
      message: `معدل التحصيل ${collectionRate}% — ${overduePayments} دفعة متأخرة تحتاج متابعة`,
      actionLabel: 'عرض الدفعات المتأخرة',
      actionRoute: '/payments',
    };
  }

  // Priority 3: unit vacant > 60 days
  const longVacant = vacantUnits.find(u => (vacantSinceDays[u.id] ?? 0) > 60);
  if (longVacant) {
    const days = vacantSinceDays[longVacant.id];
    return {
      id: `vacant_${longVacant.id}`,
      type: 'warning',
      message: `وحدة ${longVacant.number} شاغرة منذ ${days} يوماً`,
      actionLabel: 'إضافة عقد',
      actionRoute: '/add-contract',
    };
  }

  // Priority 4: celebrate high collection
  if (collectionRate >= 95) {
    return {
      id: 'great_collection',
      type: 'success',
      message: `ممتاز! تم تحصيل ${collectionRate}% من الإيجارات هذا الشهر`,
    };
  }

  return null;
}

const styles = StyleSheet.create({
  card: {
    borderRightWidth: 4,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.base,
    gap: 12,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  msgRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8, justifyContent: 'flex-end' },
  msg: { flex: 1, fontSize: Theme.fontSize.md, textAlign: 'right', lineHeight: 22 },
  dismissBtn: { padding: 2 },
  actionBtn: {
    borderRadius: Theme.radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionText: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold },
});
