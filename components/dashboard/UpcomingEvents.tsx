/**
 * الأحداث القادمة (شهرين): إيجارات مستحقة، عقود تنتهي، مستندات تنتهي، مواعيد.
 * تفاعلية: من نفس السطر تذكّر المستأجر بالواتساب، تسجّل الدفعة، أو تفتح العقد للتجديد.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../../context/AppProvider';
import { useAppTheme } from '../../hooks/useAppTheme';
import { CurrencyText } from '../ui/CurrencyText';
import { buildUpcoming, whenLabel, rentReminder, renewalReminder, UpcomingEvent, UpcomingKind } from '../../domain/services/UpcomingService';
import { CollectionService } from '../../domain/services/CollectionService';
import { CURRENCY_MAP } from '../../utils/currency';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const KIND: Record<UpcomingKind, { icon: string; label: string }> = {
  rent: { icon: 'cash-outline', label: 'إيجار' },
  contract_end: { icon: 'document-text-outline', label: 'عقد' },
  document: { icon: 'folder-open-outline', label: 'مستند' },
  calendar: { icon: 'calendar-outline', label: 'موعد' },
};
type Tab = 'all' | 'rent' | 'contract_end' | 'other';

export function UpcomingEvents({ days = 60, initial = 8 }: { days?: number; initial?: number }) {
  const { colors } = useAppTheme();
  const { payments, contracts, units, properties, tenants, attachments, calendarEvents, canWrite, isOwner, previewing } = useApp();
  const staff = canWrite && !isOwner && !previewing;
  const [tab, setTab] = useState<Tab>('all');
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const all = useMemo(() => buildUpcoming({
    payments: payments as any, contracts: contracts as any, units: units as any, properties: properties as any,
    tenants: tenants as any, attachments: attachments as any, calendarEvents: calendarEvents as any,
  }, { days }), [payments, contracts, units, properties, tenants, attachments, calendarEvents, days]);

  const counts = {
    all: all.length,
    rent: all.filter(e => e.kind === 'rent').length,
    contract_end: all.filter(e => e.kind === 'contract_end').length,
    other: all.filter(e => e.kind === 'document' || e.kind === 'calendar').length,
  };
  const list = all.filter(e => tab === 'all' || (tab === 'other' ? (e.kind === 'document' || e.kind === 'calendar') : e.kind === tab));
  const shown = expanded ? list : list.slice(0, initial);

  const groups: { key: string; title: string; items: UpcomingEvent[] }[] = [];
  for (const e of shown) {
    const key = e.date.slice(0, 7);
    let g = groups.find(x => x.key === key);
    if (!g) { const [y, m] = key.split('-'); g = { key, title: `${MONTHS[+m - 1]} ${y}`, items: [] }; groups.push(g); }
    g.items.push(e);
  }

  const whatsapp = async (e: UpcomingEvent) => {
    const phone = CollectionService.normalizePhone(e.tenantPhone, e.currency);
    if (!phone) { setNote(`ما فيه رقم جوال صالح لـ ${e.tenantName ?? 'المستأجر'}. أضفه من صفحة المستأجر.`); return; }
    const symbol = CURRENCY_MAP[(e.currency ?? 'SAR') as keyof typeof CURRENCY_MAP]?.symbol ?? e.currency ?? '';
    const msg = e.kind === 'rent' ? rentReminder(e, symbol) : renewalReminder(e);
    try { await Linking.openURL(CollectionService.whatsappUrl(phone, msg)); }
    catch {
      if (Platform.OS !== 'web') { try { await Linking.openURL(CollectionService.whatsappAppUrl(phone, msg)); } catch { setNote('ما انفتح الواتساب على هذا الجهاز.'); } }
      else setNote('ما انفتح الواتساب على هذا الجهاز.');
    }
  };

  const tone = (e: UpcomingEvent) => e.daysLeft <= 3 ? colors.danger : e.daysLeft <= 14 ? colors.warning : colors.textMuted;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all', label: 'الكل' }, { key: 'rent', label: 'الإيجارات' },
    { key: 'contract_end', label: 'العقود' }, { key: 'other', label: 'أخرى' },
  ];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>الأحداث القادمة</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>خلال الشهرين القادمين</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.filter(t => t.key === 'all' || counts[t.key] > 0).map(t => {
          const on = tab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => { setTab(t.key); setExpanded(false); }}
              style={[styles.tab, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card }]}>
              <Text style={[styles.tabText, { color: on ? colors.textInverse : colors.textSecondary }]}>{t.label} {counts[t.key]}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {note && (
        <TouchableOpacity onPress={() => setNote(null)} style={[styles.note, { backgroundColor: colors.warningSubtle }]}>
          <Text style={{ color: colors.warning, fontSize: 12, textAlign: 'right', flex: 1 }}>{note}</Text>
          <Ionicons name="close" size={14} color={colors.warning} />
        </TouchableOpacity>
      )}

      {list.length === 0 && <Text style={[styles.empty, { color: colors.textMuted }]}>ما فيه شي قادم خلال الشهرين الجايين.</Text>}

      {groups.map(g => (
        <View key={g.key}>
          <Text style={[styles.month, { color: colors.textMuted, backgroundColor: colors.surface }]}>{g.title}</Text>
          {g.items.map((e, i) => {
            const k = KIND[e.kind];
            return (
              <View key={e.id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <TouchableOpacity style={styles.main} onPress={() => e.route && router.push(e.route as any)} activeOpacity={0.7}>
                  <View style={[styles.date, { borderColor: colors.border }]}>
                    <Text style={[styles.day, { color: colors.text }]}>{+e.date.slice(8, 10)}</Text>
                    <Text style={[styles.mon, { color: colors.textMuted }]}>{MONTHS[+e.date.slice(5, 7) - 1]}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.titleLine}>
                      <Ionicons name={k.icon as any} size={14} color={colors.textSecondary} />
                      <Text style={[styles.evTitle, { color: colors.text }]} numberOfLines={1}>{e.title}</Text>
                    </View>
                    <Text style={[styles.evSub, { color: colors.textMuted }]} numberOfLines={1}>
                      <Text style={{ color: tone(e), fontWeight: '600' }}>{whenLabel(e.daysLeft)}</Text>
                      {e.subtitle ? ` · ${e.subtitle}` : ''}
                    </Text>
                  </View>
                  {e.kind === 'rent' && e.amount != null && (
                    <CurrencyText amount={e.amount} currency={e.currency} size={14} color={colors.text} />
                  )}
                </TouchableOpacity>

                {staff && (e.kind === 'rent' || e.kind === 'contract_end') && (
                  <View style={styles.actions}>
                    {!!e.tenantPhone && (
                      <TouchableOpacity onPress={() => whatsapp(e)} style={[styles.act, { borderColor: '#25D36655', backgroundColor: '#25D36612' }]}>
                        <Ionicons name="logo-whatsapp" size={14} color="#128C4A" />
                        <Text style={[styles.actText, { color: '#128C4A' }]}>{e.kind === 'rent' ? 'ذكّره بالدفعة' : 'اسأله عن التجديد'}</Text>
                      </TouchableOpacity>
                    )}
                    {e.kind === 'rent' ? (
                      <TouchableOpacity onPress={() => router.push(`/record-payment?contractId=${e.contractId}` as any)} style={[styles.act, { borderColor: colors.border }]}>
                        <Ionicons name="checkmark-circle-outline" size={14} color={colors.primary} />
                        <Text style={[styles.actText, { color: colors.primary }]}>سجّل الدفعة</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => router.push(`/contract/${e.contractId}` as any)} style={[styles.act, { borderColor: colors.border }]}>
                        <Ionicons name="refresh-outline" size={14} color={colors.primary} />
                        <Text style={[styles.actText, { color: colors.primary }]}>جدّد العقد</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}

      {list.length > initial && (
        <TouchableOpacity onPress={() => setExpanded(x => !x)} style={[styles.more, { borderTopColor: colors.border }]}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>{expanded ? 'عرض أقل' : `عرض الكل (${list.length})`}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  head: { paddingHorizontal: 16, paddingTop: 16, gap: 2 },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'right' },
  subtitle: { fontSize: 12, textAlign: 'right' },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 12 },
  tab: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, height: 30, justifyContent: 'center' },
  tabText: { fontSize: 12, fontWeight: '500' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 8 },
  empty: { fontSize: 13, textAlign: 'right', paddingHorizontal: 16, paddingBottom: 16 },
  month: { fontSize: 12, fontWeight: '600', textAlign: 'right', paddingHorizontal: 16, paddingVertical: 6 },
  row: { paddingHorizontal: 16, paddingVertical: 11, gap: 8 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  date: { width: 46, borderWidth: 1, borderRadius: 8, alignItems: 'center', paddingVertical: 4 },
  day: { fontSize: 15, fontWeight: '700' },
  mon: { fontSize: 10 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  evTitle: { flex: 1, fontSize: 14, fontWeight: '500', textAlign: 'right' },
  evSub: { fontSize: 12, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 8, paddingRight: 58, flexWrap: 'wrap' },
  act: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, height: 30 },
  actText: { fontSize: 12, fontWeight: '600' },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderTopWidth: 1 },
});
