import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../hooks/useAppTheme';

interface CityStat {
  city: string;
  rentedProperties: number;
  rentedUnits: number;
  /** النسبة من إجمالي العقارات المؤجرة */
  percentage: number;
}

interface Props {
  data: CityStat[];
  totalRentedProperties: number;
}

const CITY_COLORS = [
  '#2E86C1', '#27AE60', '#8E44AD', '#E67E22', '#E74C3C',
  '#1ABC9C', '#3498DB', '#9B59B6', '#F39C12', '#16A085',
];

export function CityStats({ data, totalRentedProperties }: Props) {
  const { colors } = useAppTheme();

  if (data.length === 0) return null;

  const topCity = data[0];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: colors.primarySubtle }]}>
          <Text style={[styles.badgeTxt, { color: colors.primary }]}>{data.length}</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>العقارات المؤجرة حسب المدينة</Text>
      </View>

      {/* Top city highlight */}
      <View style={[styles.topCityRow, { backgroundColor: colors.primarySubtle, borderColor: colors.primary + '30' }]}>
        <Text style={[styles.topCityLabel, { color: colors.textMuted }]}>الأكثر تأجيراً</Text>
        <Text style={[styles.topCityName, { color: colors.primary }]}>{topCity.city}</Text>
        <Text style={[styles.topCityStat, { color: colors.primary }]}>
          {topCity.rentedProperties} عقار · {topCity.rentedUnits} وحدة
        </Text>
      </View>

      {/* City list */}
      {data.map((item, idx) => {
        const barColor = CITY_COLORS[idx % CITY_COLORS.length];
        const isLast = idx === data.length - 1;
        return (
          <TouchableOpacity
            key={item.city}
            onPress={() => router.push(`/filter-properties?city=${encodeURIComponent(item.city)}` as any)}
            activeOpacity={0.75}
            style={[styles.cityRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
          >
            {/* Color indicator */}
            <View style={[styles.cityDot, { backgroundColor: barColor }]} />

            {/* City info */}
            <View style={styles.cityInfo}>
              <View style={styles.cityTopRow}>
                <Text style={[styles.cityName, { color: colors.text }]}>{item.city}</Text>
                <Text style={[styles.cityPct, { color: barColor }]}>{item.percentage}%</Text>
              </View>

              {/* Progress bar */}
              <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                <AnimatedBar width={item.percentage} color={barColor} />
              </View>

              <View style={styles.cityMeta}>
                <Text style={[styles.cityMetaText, { color: colors.success }]}>
                  {item.rentedProperties} {item.rentedProperties === 1 ? 'عقار' : 'عقارات'}
                </Text>
                <Text style={[styles.cityMetaDivider, { color: colors.textMuted }]}>·</Text>
                <Text style={[styles.cityMetaText, { color: colors.primary }]}>
                  {item.rentedUnits} {item.rentedUnits === 1 ? 'وحدة' : 'وحدات'}
                </Text>
              </View>
            </View>

            <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Animated bar sub-component ────────────────────────────────────────────────

function AnimatedBar({ width, color }: { width: number; color: string }) {
  const animWidth = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(animWidth, { toValue: width, duration: 800, useNativeDriver: false }).start();
  }, [width]);
  const animatedWidth = animWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return <Animated.View style={[styles.barFill, { width: animatedWidth, backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    padding: Theme.spacing.base,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: Theme.fontSize.base,
    fontWeight: Theme.fontWeight.bold,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
  },
  badgeTxt: {
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.bold,
  },
  topCityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
  },
  topCityLabel: {
    fontSize: Theme.fontSize.xs,
  },
  topCityName: {
    fontSize: Theme.fontSize.base,
    fontWeight: Theme.fontWeight.bold,
    flex: 1,
  },
  topCityStat: {
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.semibold,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  cityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cityInfo: {
    flex: 1,
    gap: 4,
  },
  cityTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cityName: {
    fontSize: Theme.fontSize.base,
    fontWeight: Theme.fontWeight.semibold,
  },
  cityPct: {
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.bold,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  cityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cityMetaText: {
    fontSize: Theme.fontSize.xs,
    fontWeight: Theme.fontWeight.semibold,
  },
  cityMetaDivider: {
    fontSize: Theme.fontSize.xs,
  },
});