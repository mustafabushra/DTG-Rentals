/**
 * الخط الزمني للمالك: ما استُلم، ما تأخر، ما هو قادم، والعقود والصيانة والمصاريف — بترتيب زمني.
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../../context/AppProvider';
import { useFinance } from '../../context/FinanceProvider';
import { useAppTheme } from '../../hooks/useAppTheme';
import { CurrencyText } from '../ui/CurrencyText';
import { buildOwnerTimeline, groupTimeline, TimelineKind } from '../../domain/services/TimelineService';
import { formatDate } from '../../data/mockData';

const KIND: Record<TimelineKind, { icon: string; tone: 'success' | 'danger' | 'warning' | 'info' | 'muted' }> = {
  payment_paid:     { icon: 'checkmark-circle', tone: 'success' },
  payment_overdue:  { icon: 'alert-circle',     tone: 'danger' },
  payment_due:      { icon: 'time',             tone: 'warning' },
  contract_start:   { icon: 'document-text',    tone: 'info' },
  contract_ending:  { icon: 'hourglass',        tone: 'warning' },
  contract_end:     { icon: 'document',         tone: 'muted' },
  maintenance_open: { icon: 'construct',        tone: 'warning' },
  maintenance_done: { icon: 'build',            tone: 'success' },
  expense:          { icon: 'wallet',           tone: 'muted' },
};

export function OwnerTimeline({ ownerId, limit, title = 'الخط الزمني', showAll }: { ownerId?: string; limit?: number; title?: string; showAll?: string }) {
  const { colors } = useAppTheme();
  const { units, properties, contracts, tenants, payments, maintenance } = useApp() as any;
  const { expenses } = useFinance();

  const events = useMemo(() => buildOwnerTimeline(
    { units, properties, contracts, tenants, payments, maintenance, expenses: expenses as any },
    { ownerId },
  ), [units, properties, contracts, tenants, payments, maintenance, expenses, ownerId]);

  const shown = limit ? events.slice(0, limit) : events;
  const groups = groupTimeline(shown);
  const tone = (t: string) => t === 'success' ? colors.success : t === 'danger' ? colors.danger : t === 'warning' ? colors.warning : t === 'info' ? colors.primary : colors.textMuted;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {showAll && events.length > (limit ?? Infinity) && (
          <TouchableOpacity onPress={() => router.push(showAll as any)} hitSlop={8}>
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>عرض الكل</Text>
          </TouchableOpacity>
        )}
      </View>

      {groups.length === 0 && (
        <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد أحداث بعد.</Text>
      )}

      {groups.map(g => (
        <View key={g.title} style={{ gap: 0 }}>
          <Text style={[styles.group, { color: colors.textMuted }]}>{g.title}</Text>
          {g.events.map((e, i) => {
            const k = KIND[e.kind]; const c = tone(k.tone);
            const last = i === g.events.length - 1;
            return (
              <TouchableOpacity key={e.id} style={styles.row} disabled={!e.route} onPress={() => e.route && router.push(e.route as any)} activeOpacity={0.7}>
                <View style={styles.rail}>
                  <View style={[styles.dot, { backgroundColor: c + '1A' }]}>
                    <Ionicons name={k.icon as any} size={15} color={c} />
                  </View>
                  {!last && <View style={[styles.line, { backgroundColor: colors.border }]} />}
                </View>
                <View style={[styles.body, !last && { paddingBottom: 14 }]}>
                  <View style={styles.line1}>
                    <Text style={[styles.evTitle, { color: colors.text }]} numberOfLines={2}>{e.title}</Text>
                    {e.amount != null && (
                      <CurrencyText amount={e.amount} currency={e.currency} size={14} color={e.kind === 'payment_paid' ? colors.success : e.kind === 'payment_overdue' ? colors.danger : colors.text} />
                    )}
                  </View>
                  <Text style={[styles.evSub, { color: colors.textMuted }]} numberOfLines={1}>
                    {formatDate(e.date)}{e.subtitle ? `، ${e.subtitle}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'right' },
  group: { fontSize: 12, fontWeight: '600', textAlign: 'right', marginTop: 10, marginBottom: 8 },
  empty: { fontSize: 13, textAlign: 'right', paddingVertical: 8 },
  row: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 30 },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, marginTop: 2 },
  body: { flex: 1, gap: 3, paddingTop: 4 },
  line1: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' },
  evTitle: { flex: 1, fontSize: 14, fontWeight: '500', textAlign: 'right' },
  evSub: { fontSize: 12, textAlign: 'right' },
});
