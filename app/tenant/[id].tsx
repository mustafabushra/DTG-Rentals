/**
 * صفحة المستأجر — حسابه بنظرة وحدة:
 * كم عليه الحين، متى الدفعة الجاية، وشريط أقساطه ملوّن (اضغط أي قسط تفتحه).
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../../context/AppProvider';
import { AppHeader } from '../../components/ui/AppHeader';
import { DeleteButton } from '../../components/ui/DeleteButton';
import { ConfirmModal, AlertModal } from '../../components/ui/Modal';
import { useDelete } from '../../hooks/useDelete';
import { ContractCard } from '../../components/ui/ContractCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { AttachmentPanel } from '../../components/features/AttachmentPanel';
import { CurrencyText } from '../../components/ui/CurrencyText';
import { formatDate } from '../../data/mockData';
import { useAppTheme } from '../../hooks/useAppTheme';
import { resolvePaymentCurrency } from '../../utils/currency';
import { CollectionService } from '../../domain/services/CollectionService';
import { CHEQUE_STATUS } from '../../domain/services/ChequeService';

type Tab = 'payments' | 'contracts' | 'docs';
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export default function TenantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const { tenants, contracts, payments, units, properties, canWrite, canDelete } = useApp();
  const [tab, setTab] = useState<Tab>('payments');
  const [showAll, setShowAll] = useState(false);
  const { pending, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete } = useDelete();
  const today = new Date().toISOString().split('T')[0];

  const tenant = tenants.find(t => t.id === id);
  const tenantContracts = contracts.filter(c => c.tenantId === id);
  const ids = new Set(tenantContracts.map(c => c.id));
  const list = useMemo(() => payments
    .filter(p => ids.has(p.contractId))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [payments, contracts, id]);

  if (!tenant) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="المستأجر" />
        <EmptyState icon="person-outline" title="المستأجر غير موجود" />
      </View>
    );
  }

  const cur = (p: typeof list[0]) => resolvePaymentCurrency(p, contracts, units, properties);
  const owed = list.filter(p => p.status !== 'paid' && p.dueDate < today && !(p.cheque && (p.cheque.status === 'held' || p.cheque.status === 'deposited')));
  const owedTotal = owed.reduce((s, p) => s + p.amount, 0);
  const next = list.find(p => p.status !== 'paid' && p.dueDate >= today);
  const year = today.slice(0, 4);
  const paidYear = list.filter(p => p.status === 'paid' && (p.paidDate ?? '').startsWith(year)).reduce((s, p) => s + p.amount, 0);
  const mainCur = list[0] ? cur(list[0]) : undefined;

  const active = tenantContracts.find(c => c.status === 'active');
  const unit = active ? units.find(u => u.id === active.unitId) : undefined;
  const prop = unit ? properties.find(p => p.id === unit.propertyId) : undefined;
  const initials = (tenant.name ?? '؟').split(' ').slice(0, 2).map(n => n[0] ?? '').join('');
  const phone = CollectionService.normalizePhone(tenant.phone, mainCur);

  const tone = (p: typeof list[0]) =>
    p.status === 'paid' ? colors.success
    : p.cheque && p.cheque.status !== 'bounced' ? '#B08D4F'
    : p.dueDate < today ? colors.danger : colors.border;
  const label = (p: typeof list[0]) =>
    p.status === 'paid' ? `مدفوع ${p.paidDate ? formatDate(p.paidDate) : ''}`
    : p.cheque && p.cheque.status !== 'bounced' ? `شيك ${p.cheque.number} · ${CHEQUE_STATUS[p.cheque.status].label}`
    : p.cheque?.status === 'bounced' ? `شيك مرتد — متأخر`
    : p.dueDate < today ? `متأخر ${Math.round((Date.parse(today) - Date.parse(p.dueDate)) / 86400000)} يوم`
    : p.dueDate === today ? 'مستحق اليوم' : 'قادم';
  const shown = showAll ? list : list.slice(-8);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="المستأجر"
        rightText={canWrite ? { label: 'تعديل', onPress: () => router.push(`/edit-tenant/${id}`) } : undefined}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* من هو */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.who}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={styles.initials}>{initials}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{tenant.name}</Text>
              <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
                {active ? `${prop?.name ?? ''}${unit ? `، وحدة ${unit.number}` : ''}` : 'ما عنده عقد ساري'}
                {tenant.nationality ? ` · ${tenant.nationality}` : ''}
              </Text>
            </View>
          </View>
          <View style={styles.quick}>
            <TouchableOpacity disabled={!tenant.phone} onPress={() => Linking.openURL(`tel:${tenant.phone}`)} style={[styles.qBtn, { borderColor: colors.border }]}>
              <Ionicons name="call-outline" size={18} color={colors.primary} /><Text style={[styles.qText, { color: colors.text }]}>اتصال</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={!phone} onPress={() => phone && Linking.openURL(CollectionService.whatsappUrl(phone, ''))} style={[styles.qBtn, { borderColor: colors.border }]}>
              <Ionicons name="logo-whatsapp" size={18} color="#1DA851" /><Text style={[styles.qText, { color: colors.text }]}>واتساب</Text>
            </TouchableOpacity>
            {canWrite && (
              <TouchableOpacity onPress={() => router.push((active ? `/record-payment?contractId=${active.id}` : '/record-payment') as any)} style={[styles.qBtn, { borderColor: colors.border }]}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} /><Text style={[styles.qText, { color: colors.text }]}>سجّل دفعة</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* حسابه */}
        <View style={styles.stats}>
          <TouchableOpacity disabled={!owedTotal} onPress={() => router.push('/collections' as any)}
            style={[styles.stat, { backgroundColor: owedTotal ? colors.dangerSubtle : colors.card, borderColor: owedTotal ? colors.danger + '40' : colors.border }]}>
            <Text style={[styles.statLbl, { color: owedTotal ? colors.danger : colors.textMuted }]}>عليه الحين</Text>
            {owedTotal ? <CurrencyText amount={owedTotal} currency={mainCur} size={18} color={colors.danger} />
              : <Text style={[styles.statVal, { color: colors.success }]}>ما عليه شي</Text>}
            {owed.length > 0 && <Text style={[styles.statSub, { color: colors.danger }]}>{owed.length} {owed.length === 1 ? 'قسط' : 'أقساط'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity disabled={!next} onPress={() => next && router.push(`/payment/${next.id}` as any)}
            style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statLbl, { color: colors.textMuted }]}>الدفعة الجاية</Text>
            {next ? <CurrencyText amount={next.amount} currency={cur(next)} size={18} color={colors.text} />
              : <Text style={[styles.statVal, { color: colors.textMuted }]}>—</Text>}
            {next && <Text style={[styles.statSub, { color: colors.textMuted }]}>{formatDate(next.dueDate)}</Text>}
          </TouchableOpacity>
          <View style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statLbl, { color: colors.textMuted }]}>دفع في {year}</Text>
            <CurrencyText amount={paidYear} currency={mainCur} size={18} color={colors.success} />
          </View>
        </View>

        {/* شريط الأقساط: كل مربع قسط، اضغطه يفتح */}
        {list.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>سجل الأقساط</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
              {list.map(p => {
                const d = new Date(p.dueDate + 'T00:00:00');
                const c = tone(p);
                const filled = c !== colors.border;
                return (
                  <TouchableOpacity key={p.id} onPress={() => router.push(`/payment/${p.id}` as any)} style={styles.cell} accessibilityLabel={`القسط ${p.installmentNumber}: ${label(p)}`}>
                    <View style={[styles.block, { backgroundColor: filled ? c : 'transparent', borderColor: c }, p.dueDate.slice(0, 7) === today.slice(0, 7) && { borderWidth: 2, borderColor: colors.text }]}>
                      {p.cheque && p.status !== 'paid' && <Ionicons name="card" size={11} color="#fff" />}
                    </View>
                    <Text style={[styles.cellLbl, { color: colors.textMuted }]}>{MONTHS[d.getMonth()].slice(0, 3)}</Text>
                    <Text style={[styles.cellYr, { color: colors.textMuted }]}>{String(d.getFullYear()).slice(2)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.legend}>
              {[[colors.success, 'مدفوع'], [colors.danger, 'متأخر'], ['#B08D4F', 'عليه شيك'], [colors.border, 'قادم']].map(([c, t]) => (
                <View key={t} style={styles.legItem}><View style={[styles.legDot, { backgroundColor: c }]} /><Text style={[styles.statSub, { color: colors.textMuted }]}>{t}</Text></View>
              ))}
            </View>
          </View>
        )}

        {/* تبويبات */}
        <View style={[styles.tabs, { backgroundColor: colors.surface }]}>
          {([['payments', `الدفعات ${list.length}`], ['contracts', `العقود ${tenantContracts.length}`], ['docs', 'المستندات']] as [Tab, string][]).map(([k, t]) => (
            <TouchableOpacity key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && { backgroundColor: colors.card }]}>
              <Text style={[styles.tabText, { color: tab === k ? colors.text : colors.textMuted }, tab === k && { fontWeight: '600' }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'payments' && (list.length === 0
          ? <EmptyState icon="cash-outline" title="ما في دفعات" />
          : (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, paddingVertical: 4 }]}>
              {!showAll && list.length > 8 && (
                <TouchableOpacity onPress={() => setShowAll(true)} style={{ paddingVertical: 10 }}>
                  <Text style={{ color: colors.primary, fontWeight: '600', textAlign: 'center' }}>عرض الأقدم ({list.length - 8})</Text>
                </TouchableOpacity>
              )}
              {[...shown].reverse().map((p, i) => {
                const d = new Date(p.dueDate + 'T00:00:00');
                const c = tone(p);
                return (
                  <TouchableOpacity key={p.id} onPress={() => router.push(`/payment/${p.id}` as any)}
                    style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <View style={[styles.dateBox, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.day, { color: colors.text }]}>{d.getDate()}</Text>
                      <Text style={[styles.mon, { color: colors.textMuted }]}>{MONTHS[d.getMonth()]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: colors.text }]}>القسط {p.installmentNumber}</Text>
                      <Text style={[styles.statSub, { color: c === colors.border ? colors.textMuted : c, textAlign: 'right' }]}>{label(p)}</Text>
                    </View>
                    <CurrencyText amount={p.amount} currency={cur(p)} size={14} color={colors.text} />
                    <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

        {tab === 'contracts' && (tenantContracts.length === 0
          ? <EmptyState icon="document-text-outline" title="ما في عقود" />
          : tenantContracts.map(c => <ContractCard key={c.id} contract={c} style={{ marginHorizontal: 0 }} />))}

        {tab === 'docs' && <AttachmentPanel entityType="tenant" entityId={id!} />}

        {tenant.nationalId ? <Text style={[styles.foot, { color: colors.textMuted }]}>رقم الهوية {tenant.nationalId} · مسجّل من {formatDate(tenant.createdAt)}</Text> : null}

        {canDelete && (
          <DeleteButton variant="full" label="حذف المستأجر"
            onPress={() => requestDelete({ id: id!, entityType: 'tenant', label: tenant.name, onSuccess: () => router.back() })} />
        )}
      </ScrollView>

      <ConfirmModal visible={!!pending} onClose={cancelDelete} onConfirm={confirmDelete} title="تأكيد الحذف"
        message={`متأكد تبي تحذف "${tenant.name}"؟ بتنلغي كل العقود المرتبطة فيه. ما تقدر تتراجع.`} confirmLabel="تأكيد الحذف" variant="danger" />
      <AlertModal visible={!!blocked} onClose={clearBlocked} title="لا يمكن الحذف" message={blocked ?? ''} variant="warning" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40, width: '100%', maxWidth: 820, alignSelf: 'center' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontSize: 17, fontWeight: '700' },
  name: { fontSize: 17, fontWeight: '600', textAlign: 'right' },
  sub: { fontSize: 13, textAlign: 'right', marginTop: 2 },
  quick: { flexDirection: 'row', gap: 8 },
  qBtn: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  qText: { fontSize: 13, fontWeight: '500' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, gap: 4, alignItems: 'flex-end' },
  statLbl: { fontSize: 12, fontWeight: '500' },
  statVal: { fontSize: 15, fontWeight: '700' },
  statSub: { fontSize: 11 },
  title: { fontSize: 15, fontWeight: '600', textAlign: 'right' },
  strip: { gap: 6, paddingVertical: 2 },
  cell: { alignItems: 'center', gap: 3 },
  block: { width: 30, height: 30, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cellLbl: { fontSize: 10 },
  cellYr: { fontSize: 9, marginTop: -3 },
  legend: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legDot: { width: 10, height: 10, borderRadius: 3 },
  tabs: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  tab: { flex: 1, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  dateBox: { width: 46, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  day: { fontSize: 16, fontWeight: '700' },
  mon: { fontSize: 10 },
  rowTitle: { fontSize: 14, fontWeight: '500', textAlign: 'right' },
  foot: { fontSize: 12, textAlign: 'center' },
});
