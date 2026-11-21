/**
 * طلبات الصرف — الموظف يطلب، والمدير يوافق أو يرفض بضغطة.
 * الموافقة تسجّل المصروف وتصدر سند الصرف تلقائياً.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { HubTabs } from '../components/navigation/HubTabs';
import { AppHeader } from '../components/ui/AppHeader';
import { CurrencyText } from '../components/ui/CurrencyText';
import { AlertModal, Modal } from '../components/ui/Modal';
import { FormInput } from '../components/forms/FormInput';
import { FormDatePicker } from '../components/forms/FormDatePicker';
import { AttachmentPanel } from '../components/features/AttachmentPanel';
import { useApp } from '../context/AppProvider';
import { useRequests } from '../context/RequestsProvider';
import { useAppTheme } from '../hooks/useAppTheme';
import { formatDate } from '../data/mockData';
import type { PaymentRequest } from '../domain/models';

type Filter = 'pending' | 'approved' | 'rejected' | 'mine';
const METHODS: { key: 'transfer' | 'cash' | 'check'; label: string; icon: string }[] = [
  { key: 'transfer', label: 'تحويل', icon: 'swap-horizontal-outline' },
  { key: 'cash', label: 'نقداً', icon: 'cash-outline' },
  { key: 'check', label: 'شيك', icon: 'card-outline' },
];

function ago(iso: string) {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  return d <= 0 ? 'اليوم' : d === 1 ? 'أمس' : d === 2 ? 'من يومين' : `من ${d} أيام`;
}

export default function RequestsScreen() {
  const { colors } = useAppTheme();
  const { properties, units, currentUser, canWrite } = useApp();
  const { requests, canApprove, approve, reject, withdraw } = useRequests();
  const [filter, setFilter] = useState<Filter>(canApprove ? 'pending' : 'mine');
  const [open, setOpen] = useState<string | null>(null);
  const [approving, setApproving] = useState<PaymentRequest | null>(null);
  const [method, setMethod] = useState<'transfer' | 'cash' | 'check'>('transfer');
  const [ref, setRef] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [rejecting, setRejecting] = useState<PaymentRequest | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string; variant?: 'info' | 'warning' } | null>(null);

  const count = (f: Filter) => requests.filter(r => f === 'mine' ? r.requestedById === currentUser.id : r.status === f).length;
  const shown = useMemo(() => requests.filter(r => filter === 'mine' ? r.requestedById === currentUser.id : r.status === filter), [requests, filter, currentUser.id]);

  const placeOf = (r: PaymentRequest) => r.scope === 'office' ? 'مصاريف المكتب'
    : [properties.find(p => p.id === r.propertyId)?.name, (units.find(u => u.id === r.unitId) as any)?.number && `وحدة ${(units.find(u => u.id === r.unitId) as any).number}`].filter(Boolean).join('، ');

  const statusChip = (r: PaymentRequest) => {
    const m = {
      pending: { t: 'بانتظار الموافقة', c: colors.warning },
      approved: { t: 'انصرف', c: colors.success },
      rejected: { t: 'مرفوض', c: colors.danger },
      withdrawn: { t: 'مسحوب', c: colors.textMuted },
    }[r.status];
    return <View style={[styles.chip, { backgroundColor: m.c + '1A' }]}><Text style={[styles.chipText, { color: m.c }]}>{m.t}</Text></View>;
  };

  const tabs: { key: Filter; label: string; show: boolean }[] = [
    { key: 'pending', label: canApprove ? 'بانتظار موافقتك' : 'بانتظار الموافقة', show: true },
    { key: 'mine', label: 'طلباتي', show: !canApprove || count('mine') > 0 },
    { key: 'approved', label: 'انصرفت', show: true },
    { key: 'rejected', label: 'مرفوضة', show: true },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="المصاريف" showBack={false} />
      <HubTabs hub="expenses" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {canWrite && (
          <View style={styles.newRow}>
            <TouchableOpacity style={[styles.newBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/add-expense?request=1&scope=property' as any)}>
              <Ionicons name="add" size={18} color={colors.textInverse} />
              <Text style={[styles.newText, { color: colors.textInverse }]}>طلب صرف لعقار</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.newBtn, { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => router.push('/add-expense?request=1&scope=office' as any)}>
              <Ionicons name="add" size={18} color={colors.text} />
              <Text style={[styles.newText, { color: colors.text }]}>طلب للمكتب</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {tabs.filter(t => t.show).map(t => {
            const on = filter === t.key; const n = count(t.key);
            return (
              <TouchableOpacity key={t.key} onPress={() => setFilter(t.key)}
                style={[styles.tab, { backgroundColor: on ? colors.primary : colors.card, borderColor: on ? colors.primary : colors.border }]}>
                <Text style={[styles.tabText, { color: on ? colors.textInverse : colors.textSecondary }]}>{t.label}</Text>
                {n > 0 && <View style={[styles.count, { backgroundColor: on ? 'rgba(255,255,255,0.25)' : colors.surface }]}><Text style={[styles.countText, { color: on ? colors.textInverse : colors.text }]}>{n}</Text></View>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {shown.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name={filter === 'pending' ? 'checkmark-done-outline' : 'document-text-outline'} size={28} color={filter === 'pending' ? colors.success : colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {filter === 'pending' ? (canApprove ? 'ما في طلبات تنتظرك' : 'ما في طلبات معلّقة') : 'ما في طلبات هنا'}
            </Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              أي موظف يحتاج يصرف مبلغ يضغط «طلب صرف»، والمدير يوافق أو يرفض من هنا.
            </Text>
          </View>
        ) : shown.map(r => {
          const isOpen = open === r.id;
          const mine = r.requestedById === currentUser.id;
          return (
            <View key={r.id} style={[styles.card, { backgroundColor: colors.card, borderColor: r.status === 'pending' && canApprove ? colors.warning + '66' : colors.border }]}>
              <TouchableOpacity onPress={() => setOpen(isOpen ? null : r.id)} activeOpacity={0.8} style={{ gap: 8 }}>
                <View style={styles.top}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cat, { color: colors.text }]} numberOfLines={1}>{r.category}{r.vendor ? ` — ${r.vendor}` : ''}</Text>
                    <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>{placeOf(r)}</Text>
                  </View>
                  <CurrencyText amount={r.amount} currency={r.currency} size={17} color={colors.text} />
                </View>
                {!!r.notes && <Text style={[styles.notes, { color: colors.textSecondary }]} numberOfLines={isOpen ? undefined : 2}>{r.notes}</Text>}
                <View style={styles.meta}>
                  {statusChip(r)}
                  <Text style={[styles.sub, { color: colors.textMuted }]}>
                    {r.requestedBy} · {ago(r.requestedAt)}{r.neededBy ? ` · يحتاجه قبل ${formatDate(r.neededBy)}` : ''}
                  </Text>
                </View>
                {r.status === 'rejected' && !!r.rejectReason && (
                  <Text style={[styles.sub, { color: colors.danger }]}>سبب الرفض: {r.rejectReason}</Text>
                )}
                {r.status === 'approved' && (
                  <Text style={[styles.sub, { color: colors.success }]}>
                    اعتمده {r.decidedBy} {r.decidedAt ? `— ${formatDate(r.decidedAt.split('T')[0])}` : ''}
                  </Text>
                )}
              </TouchableOpacity>

              {isOpen && (
                <View style={{ marginTop: 4 }}>
                  <AttachmentPanel entityType="paymentRequest" entityId={r.id} />
                  {r.status === 'approved' && r.expenseId && (
                    <TouchableOpacity onPress={() => router.push(`/expense/${r.expenseId}` as any)} style={{ paddingVertical: 8 }}>
                      <Text style={{ color: colors.primary, fontWeight: '600', textAlign: 'right' }}>عرض المصروف وسند الصرف</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {r.status === 'pending' && (canApprove || mine) && (
                <View style={[styles.actions, { borderTopColor: colors.border }]}>
                  {canApprove && (
                    <TouchableOpacity style={[styles.act, { backgroundColor: colors.success }]}
                      onPress={() => { setMethod('transfer'); setRef(''); setPayDate(new Date().toISOString().split('T')[0]); setApproving(r); }}>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={[styles.actText, { color: '#fff' }]}>موافق، اصرف</Text>
                    </TouchableOpacity>
                  )}
                  {canApprove && (
                    <TouchableOpacity style={[styles.act, { borderWidth: 1, borderColor: colors.danger }]} onPress={() => { setReason(''); setRejecting(r); }}>
                      <Text style={[styles.actText, { color: colors.danger }]}>رفض</Text>
                    </TouchableOpacity>
                  )}
                  {!canApprove && mine && (
                    <TouchableOpacity style={[styles.act, { borderWidth: 1, borderColor: colors.border }]} onPress={() => withdraw(r.id)}>
                      <Text style={[styles.actText, { color: colors.textSecondary }]}>سحب الطلب</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* الموافقة: كيف انصرف المبلغ */}
      <Modal visible={!!approving} onClose={() => setApproving(null)} title="الموافقة على الصرف" scrollable
        footer={
          <TouchableOpacity disabled={busy} style={[styles.act, { backgroundColor: colors.success, height: 48, flex: 0 }]}
            onPress={async () => {
              const r = approving!; setBusy(true);
              const res = await approve(r.id, { paymentMethod: method, referenceNumber: ref.trim() || undefined, date: payDate });
              setBusy(false); setApproving(null);
              setAlert(res.ok
                ? { title: 'تمت الموافقة', message: `تسجّل مصروف «${r.category}» وصدر سند الصرف. ${r.requestedBy} يشوف إن طلبه انصرف.`, variant: 'info' }
                : { title: 'ما تمت الموافقة', message: res.error, variant: 'warning' });
            }}>
            <Text style={[styles.actText, { color: '#fff' }]}>{busy ? 'جاري الحفظ...' : 'تأكيد وإصدار سند الصرف'}</Text>
          </TouchableOpacity>
        }>
        {approving && (
          <View style={[styles.sumBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sub, { color: colors.textMuted }]}>{approving.category} · {placeOf(approving)}</Text>
            <CurrencyText amount={approving.amount} currency={approving.currency} size={22} color={colors.text} />
          </View>
        )}
        <Text style={[styles.label, { color: colors.text }]}>كيف بتصرفه؟</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {METHODS.map(m => {
            const on = method === m.key;
            return (
              <TouchableOpacity key={m.key} onPress={() => setMethod(m.key)}
                style={[styles.method, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary + '14' : colors.card }]}>
                <Ionicons name={m.icon as any} size={18} color={on ? colors.primary : colors.textSecondary} />
                <Text style={[styles.tabText, { color: on ? colors.primary : colors.textSecondary }]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <FormDatePicker label="تاريخ الصرف" value={payDate} onChange={setPayDate} required />
        <FormInput label="رقم التحويل أو الشيك (اختياري)" value={ref} onChangeText={setRef} placeholder="اختياري" icon="barcode-outline" />
      </Modal>

      <Modal visible={!!rejecting} onClose={() => setRejecting(null)} title="رفض الطلب" scrollable
        footer={
          <TouchableOpacity style={[styles.act, { backgroundColor: colors.danger, height: 48, flex: 0 }]}
            onPress={async () => { const r = rejecting!; setRejecting(null); await reject(r.id, reason.trim()); }}>
            <Text style={[styles.actText, { color: '#fff' }]}>تأكيد الرفض</Text>
          </TouchableOpacity>
        }>
        <Text style={[styles.notes, { color: colors.textSecondary }]}>{rejecting?.requestedBy} بيشوف إن طلبه انرفض والسبب.</Text>
        <FormInput label="السبب" value={reason} onChangeText={setReason} placeholder="مثال: المبلغ عالي، جيب عرض سعر ثاني" icon="chatbox-ellipses-outline" />
      </Modal>

      <AlertModal visible={!!alert} onClose={() => setAlert(null)} title={alert?.title ?? ''} message={alert?.message ?? ''} variant={alert?.variant} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40, width: '100%', maxWidth: 820, alignSelf: 'center' },
  newRow: { flexDirection: 'row', gap: 8 },
  newBtn: { flex: 1, height: 46, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  newText: { fontSize: 14, fontWeight: '600' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: 19, borderWidth: 1 },
  tabText: { fontSize: 13, fontWeight: '600' },
  count: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  countText: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 6, padding: 28, borderRadius: 14, borderWidth: 1 },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cat: { fontSize: 15, fontWeight: '600', textAlign: 'right' },
  sub: { fontSize: 12, textAlign: 'right' },
  notes: { fontSize: 13, lineHeight: 20, textAlign: 'right' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  chipText: { fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, paddingTop: 12, marginTop: 8 },
  act: { flex: 1, height: 42, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actText: { fontSize: 14, fontWeight: '600' },
  sumBox: { borderRadius: 12, padding: 12, gap: 4, alignItems: 'flex-end' },
  label: { fontSize: 14, fontWeight: '600', textAlign: 'right' },
  method: { flex: 1, height: 64, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 4 },
});
