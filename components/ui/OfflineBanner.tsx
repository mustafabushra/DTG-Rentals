import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export function OfflineBanner() {
  const { isOnline, isWeak } = useNetworkStatus();
  const slideAnim   = useRef(new Animated.Value(-52)).current;
  const [mode, setMode] = useState<'offline' | 'weak' | 'recovered' | 'hidden'>('hidden');
  const prevOnline  = useRef(true);
  const hideTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const wasOnline = prevOnline.current;
    prevOnline.current = isOnline;

    if (hideTimer.current) clearTimeout(hideTimer.current);

    if (!isOnline) {
      setMode('offline');
    } else if (isWeak) {
      setMode('weak');
    } else if (!wasOnline) {
      // عادت الشبكة
      setMode('recovered');
      hideTimer.current = setTimeout(() => setMode('hidden'), 2500);
    } else {
      setMode('hidden');
    }
  }, [isOnline, isWeak]);

  const visible = mode !== 'hidden';

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : -52,
      useNativeDriver: Platform.OS !== 'web',
      tension: 80,
      friction: 12,
    }).start();
  }, [visible]);

  const retry = () => window.location.reload();

  const config = {
    offline:   { bg: '#E74C3C', icon: 'cloud-offline-outline', label: 'لا يوجد اتصال بالإنترنت', showRetry: true },
    weak:      { bg: '#E67E22', icon: 'wifi-outline',          label: 'اتصال ضعيف — بعض الميزات قد تتأخر', showRetry: false },
    recovered: { bg: '#27AE60', icon: 'checkmark-circle-outline', label: 'تم استعادة الاتصال ✓', showRetry: false },
    hidden:    { bg: '#27AE60', icon: 'checkmark-circle-outline', label: '', showRetry: false },
  }[mode];

  return (
    <Animated.View style={[s.bar, { backgroundColor: config.bg, transform: [{ translateY: slideAnim }] }]}>
      <Ionicons name={config.icon as any} size={14} color="#FFF" />
      <Text style={s.text}>{config.label}</Text>
      {config.showRetry && (
        <TouchableOpacity style={s.retryBtn} onPress={retry}>
          <Text style={s.retryText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    zIndex: 9999,
    ...(Platform.OS === 'web' ? { position: 'fixed' as any } : {}),
  },
  text:      { color: '#FFF', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  retryBtn:  { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingVertical: 3, paddingHorizontal: 10 },
  retryText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
});
