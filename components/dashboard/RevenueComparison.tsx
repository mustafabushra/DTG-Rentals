import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../hooks/useAppTheme';

interface Props {
  currentMonth: number;
  lastMonth: number;
  currency?: string;
}

function fmt(n: number) { return n.toLocaleString('en-US'); }

export function RevenueComparison({ currentMonth, lastMonth, currency = 'ريال' }: Props) {
  const { colors } = useAppTheme();

  const delta = currentMonth - lastMonth;
  const deltaPct = lastMonth > 0 ? Math.round(Math.abs(delta / lastMonth) * 100) : 0;
  const direction: 'up' | 'down' | 'same' =
    delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';

  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
  const trendColor = direction === 'up' ? '#27AE60' : direction === 'down' ? '#E74C3C' : colors.textMuted;

  const now = new Date();
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>مقارنة الإيرادات</Text>

      {/* Current month */}
      <View style={styles.row}>
        <View style={[styles.trendBadge, { backgroundColor: trendColor + '18' }]}>
          <Text style={[styles.trendTxt, { color: trendColor }]}>{arrow} {deltaPct}%</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.monthLbl, { color: colors.textMuted }]}>{MONTHS[now.getMonth()]}</Text>
          <Text style={[styles.amount, { color: colors.text }]}>{fmt(currentMonth)}</Text>
          <Text style={[styles.cur, { color: colors.textMuted }]}>{currency}</Text>
        </View>
      </View>

      <View style={[styles.sep, { backgroundColor: colors.border }]} />

      {/* Last month */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.monthLbl, { color: colors.textMuted }]}>{MONTHS[prevDate.getMonth()]}</Text>
          <Text style={[styles.amountSm, { color: colors.textSecondary }]}>{fmt(lastMonth)}</Text>
          <Text style={[styles.cur, { color: colors.textMuted }]}>{currency}</Text>
        </View>
      </View>

      {/* Delta */}
      {delta !== 0 && (
        <View style={[styles.deltaRow, { backgroundColor: trendColor + '10', borderRadius: Theme.radius.md }]}>
          <Text style={[styles.deltaTxt, { color: trendColor }]}>
            {direction === 'up' ? '+' : ''}{fmt(delta)} {currency} عن الشهر الماضي
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1, borderRadius: Theme.radius.xl, borderWidth: 1,
    padding: Theme.spacing.base, gap: 12,
  },
  title:    { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold, textAlign: 'right', marginBottom: 2 },
  row:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 8 },
  monthLbl: { fontSize: Theme.fontSize.xs, textAlign: 'right' },
  amount:   { fontSize: 22, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  amountSm: { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  cur:      { fontSize: Theme.fontSize.xs, textAlign: 'right', marginTop: -2 },
  trendBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Theme.radius.full, alignSelf: 'flex-start', marginTop: 4 },
  trendTxt:   { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },
  sep:      { height: 1 },
  deltaRow: { padding: 8 },
  deltaTxt: { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
});
