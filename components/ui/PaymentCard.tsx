import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../../constants/Theme';
import { Payment, formatDate } from '../../data/mockData';
import { CurrencyText } from './CurrencyText';
import { useApp } from '../../context/AppProvider';
import { StatusBadge } from './StatusBadge';
import { useAppTheme } from '../../hooks/useAppTheme';

interface PaymentCardProps {
  payment: Payment;
  onDelete?: () => void;
  onConfirm?: () => void;
}

const methodLabels: Record<string, string> = {
  transfer: 'تحويل', cash: 'نقد', check: 'شيك',
};

export function PaymentCard({ payment, onDelete, onConfirm }: PaymentCardProps) {
  const { colors } = useAppTheme();
  const { contracts, tenants } = useApp();
  const contract = contracts.find(c => c.id === payment.contractId);
  const tenant = contract ? tenants.find(t => t.id === contract.tenantId) : null;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Theme.shadow.sm]}
      onPress={() => router.push(`/payment/${payment.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <StatusBadge status={payment.status} size="sm" />
        <View style={styles.headerRight}>
          <Text style={[styles.receipt, { color: colors.text }]}>{payment.receiptNumber}</Text>
          {(payment.status === 'pending' || payment.status === 'overdue') && onConfirm && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.success + '20', borderColor: colors.success }]}
              onPress={(e) => { e.stopPropagation(); onConfirm(); }}
            >
              <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
              <Text style={[styles.actionText, { color: colors.success }]}>تأكيد</Text>
            </TouchableOpacity>
          )}
          {payment.status === 'pending' && onDelete && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.danger + '15', borderColor: colors.danger }]}
              onPress={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Ionicons name="trash-outline" size={14} color={colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.row}>
        <CurrencyText amount={payment.amount} color={colors.success} size={16} />
        <Text style={[styles.tenant, { color: colors.textSecondary }]}>{tenant?.name || '—'}</Text>
      </View>

      <View style={styles.footer}>
        {payment.paidDate ? (
          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle-outline" size={13} color={colors.success} />
            <Text style={[styles.date, { color: colors.success }]}>{formatDate(payment.paidDate)}</Text>
          </View>
        ) : (
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={13} color={colors.warning} />
            <Text style={[styles.date, { color: colors.warning }]}>استحقاق: {formatDate(payment.dueDate)}</Text>
          </View>
        )}
        {payment.method && (
          <View style={[styles.methodBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.method, { color: colors.primary }]}>{methodLabels[payment.method]}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    marginHorizontal: Theme.spacing.base,
    marginBottom: Theme.spacing.sm,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: Theme.radius.full,
    borderWidth: 1,
  },
  actionText: {
    fontSize: Theme.fontSize.xs,
    fontWeight: Theme.fontWeight.semibold,
  },
  receipt: {
    fontSize: Theme.fontSize.base,
    fontWeight: Theme.fontWeight.bold,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amount: {
    fontSize: Theme.fontSize.xl,
    fontWeight: Theme.fontWeight.bold,
  },
  tenant: {
    fontSize: Theme.fontSize.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  date: {
    fontSize: Theme.fontSize.sm,
  },
  methodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.radius.full,
  },
  method: {
    fontSize: Theme.fontSize.xs,
    fontWeight: Theme.fontWeight.semibold,
  },
});
