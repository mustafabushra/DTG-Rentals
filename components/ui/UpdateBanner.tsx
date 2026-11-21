/**
 * تنبيه "في نسخة جديدة": التطبيق المفتوح من الشاشة الرئيسية في الآيفون يبقى على النسخة القديمة
 * لين يتقفل بالكامل. نقارن ملف البرنامج الحالي مع اللي على الموقع، وإذا اختلف نعرض زر تحديث.
 */
import React, { useEffect, useState } from 'react';
import { Platform, Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const bundleOf = (html: string) => (html.match(/\/_expo\/static\/js\/web\/[^"']+\.js/g) ?? []).sort().join('|');

export function UpdateBanner() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const current = Array.from(document.querySelectorAll('script[src]') as any as Element[])
      .map(s => (s as HTMLScriptElement).getAttribute('src') ?? '')
      .filter(s => s.includes('/_expo/static/js/web/')).sort().join('|');
    if (!current) return;
    let stop = false;
    const check = async () => {
      try {
        const res = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' });
        const latest = bundleOf(await res.text());
        if (!stop && latest && latest !== current) setHasUpdate(true);
      } catch {}
    };
    const t = setTimeout(check, 8000);
    const i = setInterval(check, 5 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { stop = true; clearTimeout(t); clearInterval(i); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  if (!hasUpdate) return null;
  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
      <TouchableOpacity style={styles.bar} activeOpacity={0.9}
        onPress={async () => {
          try {
            const regs = await navigator.serviceWorker?.getRegistrations?.();
            await Promise.all((regs ?? []).map(r => r.update().catch(() => {})));
            const keys = await caches?.keys?.();
            await Promise.all((keys ?? []).map(k => caches.delete(k)));
          } catch {}
          window.location.reload();
        }}>
        <Ionicons name="sparkles-outline" size={18} color="#D4BC8A" />
        <Text style={styles.text}>في تحديث جديد للتطبيق</Text>
        <Text style={styles.btn}>حدّث الحين</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 999 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0F2A47', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, maxWidth: 420, marginHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 },
  text: { color: '#fff', fontSize: 14, flex: 1, textAlign: 'right' },
  btn: { color: '#D4BC8A', fontSize: 14, fontWeight: '700' },
});
