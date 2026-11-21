/**
 * الشيكات — وين كل شيك الحين، وإيش الخطوة الجاية.
 * البطاقات فوق تفلتر القائمة بضغطة، وكل شيك له زر واحد للخطوة التالية.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { HubTabs } from '../components/navigation/HubTabs';
import { AppHeader } from '../components/ui/AppHeader';
import { CurrencyText } from '../components/ui/CurrencyText';
import { EmptyState } from '../components/ui/EmptyState';
import { AlertModal, Modal } from '../components/ui/Modal';
import { FormInput } from '../components/forms/FormInput';
import { useApp } from '../context/AppProvider';
import { useAppTheme } from '../hooks/useAppTheme';
import { useCheques } from '../hooks/useCheques';
import { formatDate } from '../data/mockData';
import { ChequeService, CHEQUE_STATUS, type ChequeRow, type ChequeStatus } from '../domain/services/ChequeService';

type Filter = 'action' | 'held' | 'deposited' | 'bounced' | 'cleared';
const STEPS: ChequeStatus[] = ['held', 'deposited', 'cleared'];

export default function ChequesScreen() {
  const { colors } = useAppTheme();
  const { payments, contracts, tenants, units, properties, canWrite } = useApp();
  const { advance } = useCheques();
  const today = new Date().toISOString().split('T')[0];
  const [filter, setFilter] = useState<Filter>('action');
  const [bounceRow, setBounceRow] = useState<ChequeRow | null>(null);
  const [reason, setReason] = useState('');
  const [alert, setAlert] = useState<{ title: string; message: string; variant?: 'info' | 'warning' } | null>(null);

  const rows = useMemo(
    () => ChequeService.buildRows({ payments, contracts, tenants, units, properties } as any, today),
    [payments, contracts, tenants, units, properties, today],
  );
  const sum = useMemo(() => ChequeService.summarize(rows), [rows]);

  const tone = (s: ChequeStatus) =>
    s === 'bounced' ? colors.danger : s === 'cleared' ? colors.success : s === 'deposited' ? colors.info : colors.warning;

  const shown = rows.filter(r =>
    filter === 'action' ? (r.depositDue || r.cheque.status === 'deposited' || r.cheque.status === 'bounced')
    : r.cheque.status === filter);

  const tiles: { key: Filter; label: string; hint: string; count: number; total: number; color: string; icon: string }[] = [
    { key: 'action', label: 'تحتاج إجراء', hint: 'إيداع، أو تأكيد صرف، أو ارتداد', count: sum.depositDue.count + sum.deposited.count + sum.bounced.count, total: sum.depositDue.total + sum.deposited.total + sum.bounced.total, color: colors.primary, icon: 'flash-outline' },
    { key: 'held', label: 'في الخزنة', hint: 'استلمتها وما أودعتها', count: sum.held.count, total: sum.held.total, color: colors.warning, icon: 'archive-outline' },
    { key: 'deposited', label: 'في البنك', hint: 'تنتظر تنصرف', count: sum.deposited.count, total: sum.deposited.total, color: colors.info, icon: 'business-outline' },
    { key: 'bounced', label: 'مرتدة', hint: 'تابع المستأجر', count: sum.bounced.count, total: sum.bounced.total, color: colors.danger, icon: 'alert-circle-outline' },
    { key: 'cleared', label: 'انصرفت', hint: 'المبلغ وصل', count: sum.cleared.count, total: sum.cleared.total, color: colors.success, icon: 'checkmark-circle-outline' },
  ];

  const act = async (row: ChequeRow, key: 'deposit' | 'clear' | 'bounce' | 'redeposit') => {
    if (key === 'bounce') { setReason(''); setBounceRow(row); return; }
    const r: any = await advance(row.paymentId, key);
    if (key === 'clear') setAlert(r.warning
      ? { title: 'انصرف الشيك', message: r.warning, variant: 'warning' }
      : { title: 'انصرف الشيك', message: `القسط صار مدفوع، وصدر سند القبض باسم ${row.tenantName}.`, variant: 'info' });
  };

  const dateLine = (r: ChequeRow) => {
    const c = r.cheque;
    if (c.status === 'held') return r.daysToDate > 0 ? `يتودع بعد ${r.daysToDate} يوم (${formatDate(c.date)})` : r.daysToDate === 0 ? 'تاريخه اليوم — أودعه' : `تاريخه فات من ${-r.daysToDate} يوم — أودعه`;
    if (c.status === 'deposited') return `أودعته ${c.depositedAt ? formatDate(c.depositedAt) : ''}`;
    if (c.status === 'bounced') return `ارتد ${c.bouncedAt ? formatDate(c.bouncedAt) : ''}${c.bounceReason ? ` — ${c.bounceReason}` : ''}`;
    return `انصرف ${c.clearedAt ? formatDate(c.clearedAt) : ''}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="التحصيل" showBack={false} />
      <HubTabs hub="collections" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* بطاقات تفلتر بضغطة */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2 }}>
          {tiles.map(t => {
            const on = filter === t.key;
            return (
              <TouchableOpacity key={t.key} onPress={() => setFilter(t.key)} activeOpacity={0.85}
                style={[styles.tile, { backgroundColor: on ? t.color : colors.card, borderColor: on ? t.color : colors.border }]}
                accessibilityRole="tab" accessibilityState={{ selected: on }}>
                <View style={styles.tileTop}>
                  <Ionicons name={t.icon as any} size={16} color={on ? '#fff' : t.color} />
                  <Text style={[styles.tileLabel, { color: on ? '#fff' : colors.text }]}>{t.label}</Text>
                </View>
                <Text style={[styles.tileCount, { color: on ? '#fff' : colors.text }]}>{t.count}</Text>
                <Text style={[styles.tileHint, { color: on ? 'rgba(255,255,255,0.85)' : colors.textMuted }]} numberOfLines={1}>{t.hint}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {rows.length === 0 ? (
          <EmptyState icon="card-outline" title="ما في شيكات مسجّلة"
            subtitle="افتح أي عقد واضغط «تسجيل شيكات العقد» — تكتب أول رقم والبنك، والباقي يتعبّى تلقائي." />
        ) : shown.length === 0 ? (
          <View style={[styles.done, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="checkmark-done-outline" size={26} color={colors.success} />
            <Text style={[styles.doneText, { color: colors.textSecondary }]}>
              {filter === 'action' ? 'ما في شيك يحتاج شي الحين.' : 'ما في شيكات بهذي الحالة.'}
            </Text>
          </View>
        ) : shown.map(r => {
          const c = r.cheque;
          const col = tone(c.status);
          const stepIdx = c.status === 'bounced' ? 1 : STEPS.indexOf(c.status);
          return (
            <View key={r.paymentId} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.rail, { backgroundColor: col }]} />
              <TouchableOpacity style={styles.cardBody} onPress={() => router.push(`/payment/${r.paymentId}` as any)} activeOpacity={0.8}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tenant, { color: colors.text }]} numberOfLines={1}>{r.tenantName}</Text>
                    <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
                      شيك {c.number}{c.bank ? ` · ${c.bank}` : ''}{r.place ? ` · ${r.place}` : ''}
                    </Text>
                  </View>
                  <CurrencyText amount={r.amount} currency={r.currency} size={15} color={colors.text} />
                </View>

                {/* مسار الشيك: خزنة ← بنك ← انصرف */}
                <View style={styles.track}>
                  {STEPS.map((s, i) => {
                    const reached = i <= stepIdx;
                    const isBounce = c.status === 'bounced' && i === 1;
                    const dot = isBounce ? colors.danger : reached ? col : colors.border;
                    return (
                      <React.Fragment key={s}>
                        {i > 0 && <View style={[styles.trackLine, { backgroundColor: i <= stepIdx ? col : colors.border }]} />}
                        <View style={styles.trackStep}>
                          <View style={[styles.trackDot, { backgroundColor: reached || isBounce ? dot : 'transparent', borderColor: dot }]} />
                          <Text style={[styles.trackLabel, { color: reached ? colors.text : colors.textMuted }]}>
                            {isBounce ? 'ارتد' : CHEQUE_STATUS[s].label}
                          </Text>
                        </View>
                      </React.Fragment>
                    );
                  })}
                </View>

                <Text style={[styles.when, { color: r.depositDue || c.status === 'bounced' ? col : colors.textSecondary }]}>{dateLine(r)}</Text>
              </TouchableOpacity>

              {canWrite && ChequeService.nextActions(c.status).length > 0 && (
                <View style={[styles.actions, { borderTopColor: colors.border }]}>
                  {ChequeService.nextActions(c.status).map(a => {
                    const danger = a.key === 'bounce';
                    const primary = a.key === 'clear' || a.key === 'deposit' || a.key === 'redeposit';
                    return (
                      <TouchableOpacity key={a.key} onPress={() => act(r, a.key)}
                        style={[styles.actBtn, primary
                          ? { backgroundColor: colors.primary }
                          : { borderWidth: 1, borderColor: danger ? colors.danger : colors.border }]}>
                        <Text style={[styles.actText, { color: primary ? colors.textInverse : danger ? colors.danger : colors.text }]}>{a.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!bounceRow} onClose={() => setBounceRow(null)} title="الشيك ارتد" scrollable
        footer={
          <TouchableOpacity
            style={[styles.actBtn, { backgroundColor: colors.danger, height: 48 }]}
            onPress={async () => {
              const r = bounceRow!; setBounceRow(null);
              await advance(r.paymentId, 'bounce', reason.trim() || undefined);
              setAlert({ title: 'سجّلنا الارتداد', message: `القسط باقي غير مدفوع على ${r.tenantName}. تقدر تذكّره من صفحة التحصيل، أو تسجّل إعادة الإيداع هنا.`, variant: 'warning' });
            }}>
            <Text style={[styles.actText, { color: '#fff' }]}>تأكيد الارتداد</Text>
          </TouchableOpacity>
        }>
        <Text style={[styles.sub, { color: colors.textSecondary, fontSize: 13 }]}>
          شيك {bounceRow?.cheque.number} من {bounceRow?.tenantName}. القسط يبقى غير مدفوع.
        </Text>
        <FormInput label="السبب (اختياري)" value={reason} onChangeText={setReason} placeholder="مثال: عدم كفاية الرصيد" icon="information-circle-outline" />
      </Modal>
      <AlertModal visible={!!alert} onClose={() => setAlert(null)} title={alert?.title ?? ''} message={alert?.message ?? ''} variant={alert?.variant} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40, width: '100%', maxWidth: 900, alignSelf: 'center' },
  tile: { width: 132, borderRadius: 14, borderWidth: 1, padding: 12, gap: 4 },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileLabel: { fontSize: 13, fontWeight: '600' },
  tileCount: { fontSize: 24, fontWeight: '700', textAlign: 'right' },
  tileHint: { fontSize: 11, textAlign: 'right' },
  done: { alignItems: 'center', gap: 8, padding: 28, borderRadius: 14, borderWidth: 1 },
  doneText: { fontSize: 14 },
  card: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden', flexWrap: 'wrap' },
  rail: { width: 4 },
  cardBody: { flex: 1, padding: 14, gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tenant: { fontSize: 15, fontWeight: '600', textAlign: 'right' },
  sub: { fontSize: 12, textAlign: 'right', marginTop: 2 },
  track: { flexDirection: 'row', alignItems: 'center' },
  trackStep: { alignItems: 'center', gap: 4, minWidth: 54 },
  trackDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  trackLine: { flex: 1, height: 2, marginBottom: 18 },
  trackLabel: { fontSize: 11 },
  when: { fontSize: 13, fontWeight: '500', textAlign: 'right' },
  actions: { width: '100%', flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1 },
  actBtn: { flex: 1, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actText: { fontSize: 14, fontWeight: '600' },
});
