/**
 * مركز التحصيل — من عليه مستحقات، وكم، ومن ذُكِّر ومتى.
 *
 * التطبيق كان يعرف المتأخرات ولا يساعد على تحصيلها: تفتح واتساب يدوياً وتكتب
 * الرسالة من الذاكرة في كل مرة. هنا تُرسَل رسالة واحدة جاهزة تغطي كل أقساط
 * المستأجر المستحقة، ويُسجَّل التذكير حتى لا تُلحّ على من ذكّرته للتو.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { AppHeader } from '../components/ui/AppHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { AlertModal } from '../components/ui/Modal';
import { CurrencyText } from '../components/ui/CurrencyText';
import { useAppTheme } from '../hooks/useAppTheme';
import { formatDate } from '../data/mockData';
import { CollectionService, type CollectionRow } from '../domain/services/CollectionService';

type Scope = 'overdue' | 'soon';

export default function CollectionsScreen() {
  const { colors } = useAppTheme();
  const { payments, contracts, tenants, units, properties, markPaymentsReminded, canWrite } = useApp();
  const [scope, setScope]       = useState<Scope>('overdue');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [alert, setAlert]       = useState<{ title: string; message: string } | null>(null);

  const today = new Date().toISOString().split('T')[0];

  // نافذة 14 يوماً للقادم — كافية لتذكير قبل الاستحقاق دون إغراق القائمة
  const allRows = useMemo(
    () => CollectionService.buildRows(
      { payments, contracts, tenants, units, properties },
      { today, upcomingDays: 14 },
    ),
    [payments, contracts, tenants, units, properties, today],
  );

  const rows = useMemo(() => allRows
    .map(r => ({ ...r, items: r.items.filter(i => scope === 'overdue' ? i.daysOverdue > 0 : i.daysOverdue <= 0) }))
    .filter(r => r.items.length > 0)
    .map(r => ({
      ...r,
      totalDue:       r.items.reduce((s, i) => s + i.amount, 0),
      maxDaysOverdue: Math.max(...r.items.map(i => i.daysOverdue)),
    })),
  [allRows, scope]);

  const summary = useMemo(() => CollectionService.summarize(allRows), [allRows]);

  const send = async (row: CollectionRow, channel: 'whatsapp' | 'sms') => {
    const phone = CollectionService.normalizePhone(row.tenantPhone, row.currency);
    if (!phone) {
      setAlert({ title: 'لا يوجد رقم', message: `لم يُسجَّل رقم هاتف صالح للمستأجر ${row.tenantName}. أضِف الرقم من صفحة المستأجر أولاً.` });
      return;
    }
    const msg = CollectionService.buildReminder(row, today);
    const url = channel === 'whatsapp'
      ? CollectionService.whatsappUrl(phone, msg)
      : CollectionService.smsUrl(phone, msg);

    try {
      await Linking.openURL(url);
    } catch {
      if (channel === 'whatsapp' && Platform.OS !== 'web') {
        try { await Linking.openURL(CollectionService.whatsappAppUrl(phone, msg)); }
        catch { setAlert({ title: 'تعذّر الإرسال', message: 'لم يُفتح واتساب. تأكد من تثبيته أو استخدم الرسائل النصية.' }); return; }
      } else {
        setAlert({ title: 'تعذّر الإرسال', message: 'لم يُفتح تطبيق المراسلة على هذا الجهاز.' });
        return;
      }
    }
    // يُسجَّل بعد فتح المراسلة فعلاً — لا نَعُدّ تذكيراً لم يُرسَل
    if (canWrite) markPaymentsReminded(row.items.map(i => i.paymentId));
  };

  const urgencyColor = (days: number) =>
    days > 30 ? colors.danger : days > 7 ? colors.warning : days > 0 ? colors.purple : colors.textSecondary;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="مركز التحصيل" />

      {/* ملخّص */}
      <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sumCell}>
          <CurrencyText amount={summary.overdueAmount} style={[styles.sumVal, { color: colors.danger }]} />
          <Text style={[styles.sumLbl, { color: colors.textSecondary }]}>متأخر ({summary.overdueRows})</Text>
        </View>
        <View style={[styles.sumDiv, { backgroundColor: colors.border }]} />
        <View style={styles.sumCell}>
          <CurrencyText amount={summary.upcomingAmount} style={[styles.sumVal, { color: colors.warning }]} />
          <Text style={[styles.sumLbl, { color: colors.textSecondary }]}>يستحق قريباً ({summary.upcomingRows})</Text>
        </View>
        <View style={[styles.sumDiv, { backgroundColor: colors.border }]} />
        <View style={styles.sumCell}>
          <Text style={[styles.sumVal, { color: colors.primary }]}>{summary.notRemindedRows}</Text>
          <Text style={[styles.sumLbl, { color: colors.textSecondary }]}>لم يُذكَّروا بعد</Text>
        </View>
      </View>

      {/* مبدّل النطاق */}
      <View style={styles.tabs}>
        {([
          { key: 'overdue', label: `المتأخرات (${summary.overdueRows})`,   icon: 'alert-circle-outline' },
          { key: 'soon',    label: `تستحق قريباً (${summary.upcomingRows})`, icon: 'time-outline' },
        ] as const).map(t => {
          const active = scope === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, { backgroundColor: active ? colors.primary : colors.inputBg, borderColor: active ? colors.primary : colors.border }]}
              onPress={() => setScope(t.key)}
            >
              <Ionicons name={t.icon} size={15} color={active ? '#FFF' : colors.textSecondary} />
              <Text style={[styles.tabText, { color: active ? '#FFF' : colors.textSecondary }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {rows.length === 0 ? (
          <EmptyState
            icon="checkmark-done-outline"
            title={scope === 'overdue' ? 'لا توجد متأخرات' : 'لا دفعات تستحق خلال أسبوعين'}
          />
        ) : rows.map(row => {
          const isOpen    = expanded === row.key;
          const reminded  = CollectionService.reminderLabel(row.lastRemindedAt, today);
          const dayColor  = urgencyColor(row.maxDaysOverdue);
          return (
            <View key={row.key} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Theme.shadow.sm]}>
              <TouchableOpacity
                style={styles.cardHead}
                onPress={() => setExpanded(isOpen ? null : row.key)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tenant, { color: colors.text }]} numberOfLines={1}>{row.tenantName}</Text>
                  <Text style={[styles.place, { color: colors.textMuted }]} numberOfLines={1}>
                    {[row.propertyName, row.unitNumber && `وحدة ${row.unitNumber}`].filter(Boolean).join(' — ')}
                  </Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.chip, { backgroundColor: dayColor + '18' }]}>
                      <Text style={[styles.chipText, { color: dayColor }]}>
                        {row.maxDaysOverdue > 0 ? `متأخر ${row.maxDaysOverdue} يوماً`
                          : row.maxDaysOverdue === 0 ? 'يستحق اليوم'
                          : `بعد ${-row.maxDaysOverdue} يوماً`}
                      </Text>
                    </View>
                    <Text style={[styles.count, { color: colors.textMuted }]}>
                      {row.items.length === 1 ? 'قسط واحد' : `${row.items.length} أقساط`}
                    </Text>
                    {!!reminded && (
                      <Text style={[styles.reminded, { color: colors.success }]}>· {reminded}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.amountCol}>
                  <CurrencyText amount={row.totalDue} currency={row.currency} style={[styles.amount, { color: dayColor }]} />
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                </View>
              </TouchableOpacity>

              {isOpen && (
                <View style={[styles.details, { borderTopColor: colors.border }]}>
                  {row.items.map(it => (
                    <TouchableOpacity
                      key={it.paymentId}
                      style={styles.itemRow}
                      onPress={() => router.push(`/payment/${it.paymentId}`)}
                    >
                      <Text style={[styles.itemText, { color: colors.textSecondary }]}>
                        القسط {it.installmentNumber} — استحقاق {formatDate(it.dueDate)}
                      </Text>
                      <CurrencyText amount={it.amount} currency={row.currency} style={[styles.itemAmount, { color: colors.text }]} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={[styles.actions, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#25D36618', borderColor: '#25D366' }]}
                  onPress={() => send(row, 'whatsapp')}
                >
                  <Ionicons name="logo-whatsapp" size={17} color="#25D366" />
                  <Text style={[styles.actionText, { color: '#25D366' }]}>تذكير واتساب</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                  onPress={() => send(row, 'sms')}
                >
                  <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.actionText, { color: colors.textSecondary }]}>رسالة</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                  onPress={() => router.push(`/tenant/${row.tenantId}`)}
                >
                  <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <AlertModal
        visible={!!alert}
        onClose={() => setAlert(null)}
        title={alert?.title ?? ''}
        message={alert?.message ?? ''}
        variant="warning"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summary: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Theme.spacing.base, marginTop: Theme.spacing.sm,
    padding: Theme.spacing.md, borderRadius: Theme.radius.lg, borderWidth: 1,
  },
  sumCell: { flex: 1, alignItems: 'center', gap: 3 },
  sumVal:  { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  sumLbl:  { fontSize: Theme.fontSize.xs, textAlign: 'center' },
  sumDiv:  { width: 1, alignSelf: 'stretch', marginVertical: 4 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: Theme.spacing.base, paddingVertical: Theme.spacing.sm },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: Theme.radius.md, borderWidth: 1,
  },
  tabText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  list: { padding: Theme.spacing.base, gap: Theme.spacing.md, paddingBottom: 40 },
  card: { borderRadius: Theme.radius.lg, borderWidth: 1, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: Theme.spacing.md },
  tenant: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  place:  { fontSize: Theme.fontSize.sm, textAlign: 'right', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Theme.radius.full },
  chipText: { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.semibold },
  count: { fontSize: Theme.fontSize.xs },
  reminded: { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.medium },
  amountCol: { alignItems: 'center', gap: 4 },
  amount: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  details: { borderTopWidth: 1, paddingHorizontal: Theme.spacing.md, paddingVertical: 6 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  itemText: { fontSize: Theme.fontSize.sm, textAlign: 'right', flex: 1 },
  itemAmount: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  actions: { flexDirection: 'row', gap: 8, padding: Theme.spacing.md, borderTopWidth: 1 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: Theme.radius.md, borderWidth: 1,
  },
  actionText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
});
