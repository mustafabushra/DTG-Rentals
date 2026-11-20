/**
 * AttentionList — "يحتاج انتباهك": كل ما يتطلب إجراءً اليوم في قائمة واحدة مرتبة بالأولوية.
 * يحل محل التنبيه الذكي + قائمة التنبيهات + ملخص المتأخرات (كانت ثلاثة أقسام تكرر الشيء نفسه).
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useAppTheme } from '../../hooks/useAppTheme';
import { CurrencyText } from '../ui/CurrencyText';

export interface AttentionItem {
  key: string;
  tone: 'danger' | 'warning' | 'info';
  icon: string;
  title: string;
  detail: string;
  count?: number;
  amount?: number;
  route: string;
}

export function AttentionList({ items }: { items: AttentionItem[] }) {
  const { colors } = useAppTheme();
  const toneColor = { danger: colors.danger, warning: colors.warning, info: colors.info };
  const toneBg = { danger: colors.dangerSubtle, warning: colors.warningSubtle, info: colors.infoSubtle };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>يحتاج انتباهك</Text>
        {items.length > 0 && (
          <Text style={[styles.count, { color: colors.textMuted }]}>{items.length} {items.length === 1 ? 'بند' : 'بنود'}</Text>
        )}
      </View>
      {items.length === 0 ? (
        <View style={styles.clear}>
          <View style={[styles.clearIcon, { backgroundColor: colors.successSubtle }]}>
            <Ionicons name="checkmark" size={22} color={colors.success} />
          </View>
          <Text style={[styles.clearTxt, { color: colors.textSecondary }]}>لا متأخرات ولا عقود قريبة الانتهاء. كل شيء في وقته.</Text>
        </View>
      ) : items.map((it, i) => (
        <TouchableOpacity
          key={it.key}
          onPress={() => router.push(it.route as any)}
          activeOpacity={0.75}
          style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
        >
          <View style={[styles.icon, { backgroundColor: toneBg[it.tone] }]}>
            <Ionicons name={it.icon as any} size={18} color={toneColor[it.tone]} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>{it.title}</Text>
            <Text style={[styles.rowSub, { color: colors.textMuted }]} numberOfLines={1}>{it.detail}</Text>
          </View>
          {it.amount !== undefined
            ? <CurrencyText amount={it.amount} size={14} color={toneColor[it.tone]} />
            : it.count !== undefined
              ? <Text style={[styles.num, { color: toneColor[it.tone] }]}>{it.count}</Text>
              : null}
          <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingBottom: 4, overflow: 'hidden' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 16, fontWeight: '600' },
  count: { fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, position: 'relative' },
  mark: { position: 'absolute', right: -16, top: 14, bottom: 14, width: 3, borderTopLeftRadius: 2, borderBottomLeftRadius: 2 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '500', textAlign: 'right' },
  rowSub: { fontSize: 12, textAlign: 'right' },
  num: { fontSize: 18, fontWeight: '700' },
  clear: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  clearIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  clearTxt: { fontSize: 13, textAlign: 'center' },
});
