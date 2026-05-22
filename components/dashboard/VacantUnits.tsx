import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../hooks/useAppTheme';

export interface VacantUnit {
  id: string;
  number: string;
  floor?: number;
  type?: string;
  propertyName?: string;
  vacantDays?: number;
  status: 'vacant' | 'maintenance';
}

interface Props {
  units: VacantUnit[];
}

export function VacantUnits({ units }: Props) {
  const { colors } = useAppTheme();
  const shown = [...units]
    .sort((a, b) => (b.vacantDays ?? 0) - (a.vacantDays ?? 0))
    .slice(0, 6);

  if (units.length === 0) {
    return (
      <View style={[styles.card, styles.allRented, { backgroundColor: '#F0FFF4', borderColor: '#27AE60' }]}>
        <Ionicons name="checkmark-circle-outline" size={28} color="#27AE60" />
        <Text style={styles.allRentedTxt}>جميع الوحدات مؤجرة</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/units' as any)}>
          <Text style={[styles.seeAll, { color: '#C3AF76' }]}>عرض الكل</Text>
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <View style={[styles.countBadge, { backgroundColor: '#FDEDEC' }]}>
            <Text style={[styles.countTxt, { color: '#E74C3C' }]}>{units.length}</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>الوحدات الشاغرة</Text>
        </View>
      </View>

      {/* Rows */}
      {shown.map((u, idx) => {
        const isLast = idx === shown.length - 1;
        const dotColor = u.status === 'maintenance' ? '#F39C12' : '#E74C3C';
        const rowBg    = u.status === 'maintenance' ? '#FFFBF0' : '#FFF5F5';
        return (
          <View
            key={u.id}
            style={[styles.row, { backgroundColor: rowBg }, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
          >
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: '#C3AF76' }]}
              onPress={() => router.push('/add-contract' as any)}
            >
              <Ionicons name="add" size={14} color="#021C36" />
              <Text style={styles.addTxt}>إضافة عقد</Text>
            </TouchableOpacity>

            <View style={styles.info}>
              <View style={styles.nameRow}>
                <View style={[styles.dot, { backgroundColor: dotColor }]} />
                <Text style={[styles.unitNum, { color: colors.text }]}>وحدة {u.number}</Text>
              </View>
              {u.propertyName && (
                <Text style={[styles.propName, { color: colors.textSecondary }]} numberOfLines={1}>{u.propertyName}</Text>
              )}
              {u.vacantDays !== undefined && u.vacantDays > 0 && (
                <Text style={[styles.vacantSince, { color: colors.textMuted }]}>شاغرة منذ {u.vacantDays} يوم</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Theme.radius.xl, borderWidth: 1, overflow: 'hidden' },
  allRented: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Theme.spacing.md },
  allRentedTxt: { color: '#27AE60', fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Theme.spacing.base, paddingTop: Theme.spacing.base, paddingBottom: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:    { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  seeAll:   { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.semibold },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  countTxt:   { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.bold },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Theme.spacing.base, paddingVertical: 13,
  },
  info:     { flex: 1 },
  nameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end' },
  dot:      { width: 8, height: 8, borderRadius: 4 },
  unitNum:  { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  propName: { fontSize: Theme.fontSize.xs, textAlign: 'right', marginTop: 1 },
  vacantSince: { fontSize: 10, textAlign: 'right', marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Theme.radius.md,
  },
  addTxt: { fontSize: 11, fontWeight: Theme.fontWeight.bold, color: '#021C36' },
});
