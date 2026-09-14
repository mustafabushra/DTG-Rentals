/**
 * تجديد العقود — العقود المنتهية والتي قاربت الانتهاء، مع تذكير المستأجر وتجديد بضغطة.
 *
 * كان التطبيق ينبّه أن عقداً يقترب من الانتهاء ثم يتركك: تفتح واتساب يدوياً،
 * وتنتظر حتى ينتهي العقد فعلاً ليظهر زر التجديد — وقد فرّغ الوحدة قبلها.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { AppHeader } from '../components/ui/AppHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { AlertModal, ConfirmModal } from '../components/ui/Modal';
import { CurrencyText } from '../components/ui/CurrencyText';
import { useAppTheme } from '../hooks/useAppTheme';
import { formatDate } from '../data/mockData';
import { RenewalService, type RenewalRow } from '../domain/services/RenewalService';
import { CollectionService } from '../domain/services/CollectionService';

const WINDOWS = [30, 60, 90] as const;

export default function RenewalsScreen() {
  const { colors } = useAppTheme();
  const { contracts, tenants, units, properties, renewContract, markContractsReminded, canWrite } = useApp();
  const [windowDays, setWindowDays] = useState<number>(30);
  const [confirmRenew, setConfirmRenew] = useState<RenewalRow | null>(null);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const rows = useMemo(
    () => RenewalService.buildRows({ contracts, tenants, units, properties }, { today, windowDays }),
    [contracts, tenants, units, properties, today, windowDays],
  );
  const summary = useMemo(() => RenewalService.summarize(rows), [rows]);

  const tierColor = (u: RenewalRow['urgency']) =>
    u === 'expired' ? colors.danger : u === 'critical' ? colors.warning
      : u === 'soon' ? colors.purple : colors.textSecondary;

  const tierLabel = (row: RenewalRow) =>
    row.daysLeft < 0  ? `انتهى منذ ${-row.daysLeft} يوماً`
  : row.daysLeft === 0 ? 'ينتهي اليوم'
  : `باقٍ ${row.daysLeft} يوماً`;

  const remind = async (row: RenewalRow) => {
    const phone = CollectionService.normalizePhone(row.tenantPhone, row.currency);
    if (!phone) {
      setAlert({ title: 'لا يوجد رقم', message: `لم يُسجَّل رقم هاتف صالح للمستأجر ${row.tenantName}. أضِف الرقم من صفحة المستأجر أولاً.` });
      return;
    }
    const msg = RenewalService.buildReminder(row, today);
    try {
      await Linking.openURL(CollectionService.whatsappUrl(phone, msg));
    } catch {
      if (Platform.OS !== 'web') {
        try { await Linking.openURL(CollectionService.whatsappAppUrl(phone, msg)); }
        catch { setAlert({ title: 'تعذّر الإرسال', message: 'لم يُفتح واتساب. تأكد من تثبيته.' }); return; }
      } else {
        setAlert({ title: 'تعذّر الإرسال', message: 'لم يُفتح تطبيق المراسلة على هذا الجهاز.' });
        return;
      }
    }
    if (canWrite) markContractsReminded([row.contractId]);
  };

  const doRenew = () => {
    if (!confirmRenew) return;
    const term = renewContract(confirmRenew.contractId);
    setConfirmRenew(null);
    setAlert(term
      ? { title: 'تم التجديد', message: `العقد ${confirmRenew.contractNumber} صار سارياً حتى ${formatDate(term.endDate)}، وأُضيف جدول أقساط الفترة الجديدة. دفعات الفترة السابقة بقيت كما هي.` }
      : { title: 'تعذّر التجديد', message: 'تواريخ العقد غير صالحة. عدّلها من صفحة العقد أولاً.' });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="تجديد العقود" />

      <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sumCell}>
          <Text style={[styles.sumVal, { color: colors.danger }]}>{summary.expired}</Text>
          <Text style={[styles.sumLbl, { color: colors.textSecondary }]}>منتهٍ</Text>
        </View>
        <View style={[styles.sumDiv, { backgroundColor: colors.border }]} />
        <View style={styles.sumCell}>
          <Text style={[styles.sumVal, { color: colors.warning }]}>{summary.critical}</Text>
          <Text style={[styles.sumLbl, { color: colors.textSecondary }]}>خلال أسبوع</Text>
        </View>
        <View style={[styles.sumDiv, { backgroundColor: colors.border }]} />
        <View style={styles.sumCell}>
          <CurrencyText amount={summary.totalValue} style={[styles.sumVal, { color: colors.primary }]} />
          <Text style={[styles.sumLbl, { color: colors.textSecondary }]}>قيمة معرّضة</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {WINDOWS.map(w => {
          const active = windowDays === w;
          return (
            <TouchableOpacity
              key={w}
              style={[styles.tab, { backgroundColor: active ? colors.primary : colors.inputBg, borderColor: active ? colors.primary : colors.border }]}
              onPress={() => setWindowDays(w)}
            >
              <Text style={[styles.tabText, { color: active ? '#FFF' : colors.textSecondary }]}>خلال {w} يوماً</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {rows.length === 0 ? (
          <EmptyState icon="checkmark-done-outline" title={`لا عقود تنتهي خلال ${windowDays} يوماً`} />
        ) : rows.map(row => {
          const color    = tierColor(row.urgency);
          const reminded = CollectionService.reminderLabel(row.lastRemindedAt, today);
          return (
            <View key={row.contractId} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Theme.shadow.sm]}>
              <TouchableOpacity
                style={styles.cardHead}
                onPress={() => router.push(`/contract/${row.contractId}`)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tenant, { color: colors.text }]} numberOfLines={1}>{row.tenantName}</Text>
                  <Text style={[styles.place, { color: colors.textMuted }]} numberOfLines={1}>
                    {[row.propertyName, row.unitNumber && `وحدة ${row.unitNumber}`].filter(Boolean).join(' — ')}
                  </Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.chip, { backgroundColor: color + '18' }]}>
                      <Text style={[styles.chipText, { color }]}>{tierLabel(row)}</Text>
                    </View>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>ينتهي {formatDate(row.endDate)}</Text>
                    {!!reminded && <Text style={[styles.reminded, { color: colors.success }]}>· {reminded}</Text>}
                  </View>
                </View>
                <View style={styles.valueCol}>
                  <CurrencyText amount={row.annualValue} currency={row.currency} style={[styles.value, { color }]} />
                  <Text style={[styles.valueLbl, { color: colors.textMuted }]}>سنوياً</Text>
                </View>
              </TouchableOpacity>

              <View style={[styles.actions, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#25D36618', borderColor: '#25D366' }]}
                  onPress={() => remind(row)}
                >
                  <Ionicons name="logo-whatsapp" size={17} color="#25D366" />
                  <Text style={[styles.actionText, { color: '#25D366' }]}>تذكير بالتجديد</Text>
                </TouchableOpacity>
                {canWrite && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
                    onPress={() => setConfirmRenew(row)}
                  >
                    <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                    <Text style={[styles.actionText, { color: colors.primary }]}>تجديد</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <ConfirmModal
        visible={!!confirmRenew}
        onClose={() => setConfirmRenew(null)}
        onConfirm={doRenew}
        title="تجديد العقد"
        message={confirmRenew
          ? `سيُجدَّد عقد ${confirmRenew.tenantName} بنفس المدة والقيمة (${confirmRenew.annualValue.toLocaleString('en-US')})، وتبدأ الفترة الجديدة في اليوم التالي لانتهاء الحالية. تبقى دفعات الفترة السابقة كما هي — المسدَّدة والمتأخرة على حدٍّ سواء.`
          : ''}
        confirmLabel="تأكيد التجديد"
      />
      <AlertModal
        visible={!!alert}
        onClose={() => setAlert(null)}
        title={alert?.title ?? ''}
        message={alert?.message ?? ''}
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
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Theme.radius.md, borderWidth: 1 },
  tabText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  list: { padding: Theme.spacing.base, gap: Theme.spacing.md, paddingBottom: 40 },
  card: { borderRadius: Theme.radius.lg, borderWidth: 1, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: Theme.spacing.md },
  tenant: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  place:  { fontSize: Theme.fontSize.sm, textAlign: 'right', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Theme.radius.full },
  chipText: { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.semibold },
  meta: { fontSize: Theme.fontSize.xs },
  reminded: { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.medium },
  valueCol: { alignItems: 'center', gap: 2 },
  value: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  valueLbl: { fontSize: Theme.fontSize.xs },
  actions: { flexDirection: 'row', gap: 8, padding: Theme.spacing.md, borderTopWidth: 1 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: Theme.radius.md, borderWidth: 1,
  },
  actionText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
});
