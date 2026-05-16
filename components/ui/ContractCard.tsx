import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../../constants/Theme';
import { Contract, formatDate } from '../../data/mockData';
import { CurrencyText } from './CurrencyText';
import { useApp } from '../../context/AppProvider';
import { StatusBadge } from './StatusBadge';
import { DeleteButton } from './DeleteButton';
import { useAppTheme } from '../../hooks/useAppTheme';

interface ContractCardProps {
  contract: Contract;
  onDelete?: () => void;
}

export function ContractCard({ contract, onDelete }: ContractCardProps) {
  const { colors } = useAppTheme();
  const { tenants, units } = useApp();
  const tenant = tenants.find(t => t.id === contract.tenantId);
  const unit = units.find(u => u.id === contract.unitId);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Theme.shadow.sm]}
      onPress={() => router.push(`/contract/${contract.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <StatusBadge status={contract.status} size="sm" />
        <Text style={[styles.number, { color: colors.primary }]}>{contract.contractNumber}</Text>
        {onDelete && (
          <DeleteButton variant="icon" onPress={() => onDelete()} />
        )}
      </View>

      <View style={styles.row}>
        <CurrencyText amount={contract.annualValue} color={colors.success} size={15} />
        <View style={styles.tenantRow}>
          <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.name, { color: colors.text }]}>{tenant?.name || '—'}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.infoItem}>
          <Text style={[styles.infoValue, { color: colors.textSecondary }]}>
            {formatDate(contract.endDate)}
          </Text>
          <Text style={[styles.infoLabel, { color: colors.textMuted }]}>تاريخ الانتهاء</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={[styles.infoValue, { color: colors.textSecondary }]}>
            {unit?.number || '—'}
          </Text>
          <Text style={[styles.infoLabel, { color: colors.textMuted }]}>رقم الوحدة</Text>
        </View>
        <Ionicons name="chevron-back-outline" size={16} color={colors.textMuted} />
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
  number: {
    fontSize: Theme.fontSize.base,
    fontWeight: Theme.fontWeight.bold,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  name: {
    fontSize: Theme.fontSize.md,
    fontWeight: Theme.fontWeight.medium,
  },
  value: {
    fontSize: Theme.fontSize.lg,
    fontWeight: Theme.fontWeight.bold,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  infoItem: {
    alignItems: 'flex-start',
    gap: 2,
  },
  infoValue: {
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.medium,
  },
  infoLabel: {
    fontSize: Theme.fontSize.xs,
  },
});
