import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export function OfflineBanner() {
  const { isOnline, isWeak } = useNetworkStatus();
  const slideAnim = useRef(new Animated.Value(-48)).current;

  const show = !isOnline || isWeak;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: show ? 0 : -48,
      useNativeDriver: Platform.OS !== 'web',
      tension: 80,
      friction: 12,
    }).start();
  }, [show]);

  const bg    = !isOnline ? '#E74C3C' : '#E67E22';
  const label = !isOnline ? 'لا يوجد اتصال بالإنترنت' : 'اتصال ضعيف — بعض الميزات قد تتأخر';
  const icon  = !isOnline ? 'cloud-offline-outline' : 'wifi-outline';

  return (
    <Animated.View style={[s.bar, { backgroundColor: bg, transform: [{ translateY: slideAnim }] }]}>
      <Ionicons name={icon as any} size={14} color="#FFF" />
      <Text style={s.text}>{label}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  bar:  { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8, zIndex: 9999 },
  text: { color: '#FFF', fontSize: 12, fontWeight: '600' },
});
