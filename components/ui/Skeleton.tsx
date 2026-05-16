import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle, Platform } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const { scheme } = useAppTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  }, []);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
  const bg = scheme === 'dark' ? '#2D3748' : '#E2E8F0';

  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius, backgroundColor: bg, opacity }, style]}
    />
  );
}

// ── Preset skeletons ──────────────────────────────────────────────────────────

export function CardSkeleton() {
  return (
    <View style={sk.card}>
      <View style={sk.row}>
        <Skeleton width={44} height={44} borderRadius={12} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton height={14} width="60%" />
          <Skeleton height={11} width="40%" />
        </View>
      </View>
      <Skeleton height={11} style={{ marginTop: 10 }} />
      <Skeleton height={11} width="75%" style={{ marginTop: 6 }} />
    </View>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: 12, padding: 16 }}>
      {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
    </View>
  );
}

export function StatSkeleton() {
  return (
    <View style={sk.stat}>
      <Skeleton width={32} height={32} borderRadius={8} />
      <Skeleton height={22} width="50%" style={{ marginTop: 10 }} />
      <Skeleton height={11} width="70%" style={{ marginTop: 6 }} />
    </View>
  );
}

const sk = StyleSheet.create({
  card: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    gap: 8,
  },
  row:  { flexDirection: 'row', gap: 12, alignItems: 'center' },
  stat: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
});
