import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { router } from 'expo-router';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../hooks/useAppTheme';

const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                       'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

interface Props {
  collected: number;
  totalDue: number;
  currency?: string;
}

function fmt(n: number) {
  return n.toLocaleString('en-US');
}

export function CollectionProgress({ collected, totalDue, currency = 'ريال' }: Props) {
  const { colors } = useAppTheme();
  const pct = totalDue > 0 ? Math.min(100, Math.round((collected / totalDue) * 100)) : 0;
  const remaining = Math.max(0, totalDue - collected);

  const barColor = pct >= 80 ? '#27AE60' : pct >= 50 ? '#F39C12' : '#E74C3C';
  const badgeBg  = pct >= 80 ? '#E8F8F0' : pct >= 50 ? '#FEF9E7' : '#FDEDEC';

  const now = new Date();
  const monthLabel = ARABIC_MONTHS[now.getMonth()];

  const animWidth = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(animWidth, { toValue: pct, duration: 800, useNativeDriver: false }).start();
  }, [pct]);

  const animatedWidth = animWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push('/payments' as any)}
      activeOpacity={0.85}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.badgeTxt, { color: barColor }]}>{pct}%</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>مؤشر التحصيل — {monthLabel}</Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <Animated.View style={[styles.fill, { width: animatedWidth, backgroundColor: barColor }]} />
      </View>

      {/* Stats row */}
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={[styles.statLbl, { color: colors.textMuted }]}>متبقي</Text>
          <Text style={[styles.statVal, { color: '#E74C3C' }]}>{fmt(remaining)} {currency}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={[styles.stat, { alignItems: 'flex-end' }]}>
          <Text style={[styles.statLbl, { color: colors.textMuted }]}>محصّل</Text>
          <Text style={[styles.statVal, { color: '#27AE60' }]}>{fmt(collected)} {currency}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Theme.radius.xl, borderWidth: 1,
    padding: Theme.spacing.md, gap: Theme.spacing.sm,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:  { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  badge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Theme.radius.full },
  badgeTxt: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },
  track: { height: 12, borderRadius: 6, overflow: 'hidden' },
  fill:  { height: 12, borderRadius: 6 },
  row:   { flexDirection: 'row', alignItems: 'center' },
  stat:  { flex: 1, gap: 2 },
  statLbl: { fontSize: Theme.fontSize.xs, textAlign: 'right' },
  statVal: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  divider: { width: 1, height: 32, marginHorizontal: Theme.spacing.sm },
});
