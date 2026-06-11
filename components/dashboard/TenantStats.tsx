import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../hooks/useAppTheme';

interface Props {
  activeTenants: number;
  avgTenancyMonths: number;
  topTenant?: { name: string; totalPaid: number; id: string };
  currency?: string;
}

function fmt(n: number) { return n.toLocaleString('en-US'); }

export function TenantStats({ activeTenants, avgTenancyMonths, topTenant, currency = 'ريال' }: Props) {
  const { colors } = useAppTheme();
  const avgColor = avgTenancyMonths < 12 ? colors.danger : colors.success;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>إحصائيات المستأجرين</Text>

      <View style={styles.strip}>
        {/* Active tenants */}
        <TouchableOpacity style={styles.cell} onPress={() => router.push('/(tabs)/tenants' as any)}>
          <Text style={[styles.val, { color: colors.primary }]}>{activeTenants}</Text>
          <Text style={[styles.lbl, { color: colors.textMuted }]}>مستأجر{'\n'}نشط</Text>
        </TouchableOpacity>

        <View style={[styles.vDiv, { backgroundColor: colors.border }]} />

        {/* Avg tenancy */}
        <View style={styles.cell}>
          <Text style={[styles.val, { color: avgColor }]}>{avgTenancyMonths}</Text>
          <Text style={[styles.lbl, { color: colors.textMuted }]}>متوسط{'\n'}الإقامة (شهر)</Text>
        </View>

        <View style={[styles.vDiv, { backgroundColor: colors.border }]} />

        {/* Top payer */}
        {topTenant ? (
          <TouchableOpacity style={styles.cell} onPress={() => router.push(`/tenant/${topTenant.id}` as any)}>
            <View style={[styles.avatar, { backgroundColor: colors.accentGold }]}>
              <Text style={[styles.avatarTxt, { color: colors.primary }]}>{topTenant.name[0]}</Text>
            </View>
            <Text style={[styles.topName, { color: colors.text }]} numberOfLines={1}>{topTenant.name}</Text>
            <Text style={[styles.topAmt, { color: colors.success }]}>{fmt(topTenant.totalPaid)}</Text>
            <Text style={[styles.lbl, { color: colors.textMuted }]}>{currency}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.cell}>
            <Text style={[styles.val, { color: colors.textMuted }]}>—</Text>
            <Text style={[styles.lbl, { color: colors.textMuted }]}>أعلى{'\n'}دافع</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1, borderRadius: Theme.radius.xl, borderWidth: 1,
    padding: Theme.spacing.base, gap: 12,
  },
  title: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  strip: { flexDirection: 'row', alignItems: 'center' },
  cell:  { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  val:   { fontSize: 22, fontWeight: Theme.fontWeight.bold },
  lbl:   { fontSize: 10, textAlign: 'center', lineHeight: 14 },
  vDiv:  { width: 1, height: 44, marginHorizontal: 4 },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarTxt: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  topName:   { fontSize: 11, fontWeight: Theme.fontWeight.semibold, maxWidth: 70, textAlign: 'center' },
  topAmt:    { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },
});
