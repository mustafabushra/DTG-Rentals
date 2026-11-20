/**
 * الإيجارات القادمة: كل دفعة مستحقة خلال الشهرين القادمين، مجمّعة حسب الشهر،
 * مع مجموع كل شهر بعملته. تظهر في الرئيسية للموظف وللمالك.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../../context/AppProvider';
import { useAppTheme } from '../../hooks/useAppTheme';
import { CurrencyText } from '../ui/CurrencyText';
import { resolvePaymentCurrency } from '../../utils/currency';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function UpcomingRents({ days = 60, initial = 8 }: { days?: number; initial?: number }) {
  const { colors } = useAppTheme();
  const { payments, contracts, units, properties, tenants } = useApp();
  const [expanded, setExpanded] = useState(false);

  const { groups, count } = useMemo(() => {
    const now = new Date();
    const today = iso(now);
    const end = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
    const rows = payments
      .filter(p => p.status !== 'paid' && (p.status as string) !== 'cancelled' && p.dueDate >= today && p.dueDate <= end)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map(p => {
        const c = contracts.find(x => x.id === p.contractId);
        const u = c ? units.find(x => x.id === c.unitId) : undefined;
        const pr = u ? properties.find(x => x.id === u.propertyId) : undefined;
        const t = c ? tenants.find(x => x.id === c.tenantId) : undefined;
        return {
          id: p.id, date: p.dueDate, amount: p.amount,
          currency: resolvePaymentCurrency(p as any, contracts as any, units as any, properties as any),
          tenant: t?.name ?? 'مستأجر',
          place: [pr?.name, u ? `وحدة ${u.number}` : null].filter(Boolean).join('، '),
        };
      });
    const shown = expanded ? rows : rows.slice(0, initial);
    const g: { key: string; title: string; totals: Record<string, number>; rows: typeof rows }[] = [];
    for (const r of rows) {
      const key = r.date.slice(0, 7);
      let grp = g.find(x => x.key === key);
      if (!grp) { const [y, m] = key.split('-'); grp = { key, title: `${MONTHS[+m - 1]} ${y}`, totals: {}, rows: [] }; g.push(grp); }
      grp.totals[r.currency] = (grp.totals[r.currency] ?? 0) + r.amount;
      if (shown.includes(r)) grp.rows.push(r);
    }
    return { groups: g, count: rows.length };
  }, [payments, contracts, units, properties, tenants, days, expanded, initial]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>الإيجارات القادمة</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>خلال الشهرين القادمين · {count} دفعة</Text>
      </View>

      {count === 0 && <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد دفعات مستحقة خلال الشهرين القادمين.</Text>}

      {groups.map(g => (
        <View key={g.key}>
          <View style={[styles.month, { backgroundColor: colors.surface }]}>
            <Text style={[styles.monthTitle, { color: colors.text }]}>{g.title}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {Object.entries(g.totals).map(([cur, amt]) => (
                <CurrencyText key={cur} amount={amt} currency={cur} size={13} color={colors.textSecondary} />
              ))}
            </View>
          </View>
          {g.rows.map((r, i) => (
            <TouchableOpacity key={r.id} onPress={() => router.push(`/payment/${r.id}` as any)} activeOpacity={0.7}
              style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <View style={[styles.date, { borderColor: colors.border }]}>
                <Text style={[styles.day, { color: colors.text }]}>{+r.date.slice(8, 10)}</Text>
                <Text style={[styles.mon, { color: colors.textMuted }]}>{MONTHS[+r.date.slice(5, 7) - 1]}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.tenant, { color: colors.text }]} numberOfLines={1}>{r.tenant}</Text>
                <Text style={[styles.place, { color: colors.textMuted }]} numberOfLines={1}>{r.place}</Text>
              </View>
              <CurrencyText amount={r.amount} currency={r.currency} size={14} color={colors.text} />
            </TouchableOpacity>
          ))}
        </View>
      ))}

      {count > initial && (
        <TouchableOpacity onPress={() => setExpanded(e => !e)} style={[styles.more, { borderTopColor: colors.border }]}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>{expanded ? 'عرض أقل' : `عرض كل الدفعات (${count})`}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  head: { padding: 16, paddingBottom: 12, gap: 2 },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'right' },
  subtitle: { fontSize: 12, textAlign: 'right' },
  empty: { fontSize: 13, textAlign: 'right', paddingHorizontal: 16, paddingBottom: 16 },
  month: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  monthTitle: { fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  date: { width: 46, borderWidth: 1, borderRadius: 8, alignItems: 'center', paddingVertical: 4 },
  day: { fontSize: 15, fontWeight: '700' },
  mon: { fontSize: 10 },
  tenant: { fontSize: 14, fontWeight: '500', textAlign: 'right' },
  place: { fontSize: 12, textAlign: 'right' },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderTopWidth: 1 },
});
