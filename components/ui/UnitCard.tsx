import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../../constants/Theme';
import { Unit, getUnitTypeLabel } from '../../data/mockData';
import { CurrencyText } from './CurrencyText';
import { useApp } from '../../context/AppProvider';
import { StatusBadge } from './StatusBadge';
import { DeleteButton } from './DeleteButton';
import { useAppTheme } from '../../hooks/useAppTheme';

interface UnitCardProps {
  unit: Unit & { photos?: { uri: string; isMain: boolean }[] };
  onDelete?: () => void;
}

export function UnitCard({ unit, onDelete }: UnitCardProps) {
  const { colors } = useAppTheme();
  const { properties } = useApp();
  const property  = properties.find(p => p.id === unit.propertyId);
  const mainPhoto = unit.photos?.find(p => p.isMain) ?? unit.photos?.[0];

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Theme.shadow.sm]}
      onPress={() => router.push(`/unit/${unit.id}`)}
      activeOpacity={0.85}
    >
      {/* Thumbnail */}
      {mainPhoto && (
        <Image source={{ uri: mainPhoto.uri }} style={styles.thumbnail} />
      )}
      <View style={styles.header}>
        <StatusBadge status={unit.status} size="sm" />
        <Text style={[styles.number, { color: colors.text }]}>وحدة {unit.number}</Text>
        {onDelete && (
          <DeleteButton variant="icon" onPress={() => onDelete()} />
        )}
      </View>

      <Text style={[styles.property, { color: colors.textSecondary }]}>{property?.name}</Text>

      <View style={styles.row}>
        <CurrencyText amount={unit.monthlyRent} color={colors.success} size={14} />
        <View style={styles.typeRow}>
          <Ionicons name="resize-outline" size={13} color={colors.textMuted} />
          <Text style={[styles.area, { color: colors.textMuted }]}>{unit.area} م²</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.type, { color: colors.textSecondary }]}>{getUnitTypeLabel(unit.type)}</Text>
        <View style={styles.floorRow}>
          <Ionicons name="layers-outline" size={12} color={colors.textMuted} />
          <Text style={[styles.floor, { color: colors.textMuted }]}>الطابق {unit.floor}</Text>
        </View>
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
    gap: 6,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%', height: 120,
    borderRadius: Theme.radius.md,
    marginBottom: 4,
    resizeMode: 'cover',
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
  property: {
    fontSize: Theme.fontSize.sm,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rent: {
    fontSize: Theme.fontSize.lg,
    fontWeight: Theme.fontWeight.bold,
  },
  area: {
    fontSize: Theme.fontSize.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  type: {
    fontSize: Theme.fontSize.sm,
  },
  floorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  floor: {
    fontSize: Theme.fontSize.sm,
  },
});
