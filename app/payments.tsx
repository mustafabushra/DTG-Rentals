import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ResponsiveGrid } from '../components/ui/ResponsiveGrid';
import { router } from 'expo-router';
import { Theme } from '../constants/Theme';
import { SearchBar } from '../components/ui/SearchBar';
import { PaymentCard } from '../components/ui/PaymentCard';
import { EmptyState } from '../components/ui/EmptyState';
import { AppHeader } from '../components/ui/AppHeader';
import { FilterBar, PAYMENT_FILTERS } from '../components/ui/FilterBar';
import { PaymentStatus } from '../data/mockData';
import { ConfirmModal } from '../components/ui/Modal';
import { ListSkeleton } from '../components/ui/Skeleton';
import { useApp } from '../context/AppProvider';
import { useAppTheme } from '../hooks/useAppTheme';
import { CurrencyText } from '../components/ui/CurrencyText';
import { resolvePaymentCurrency, countryLabel, type CurrencyCode } from '../utils/currency';

type Filter = 'all' | PaymentStatus;

interface CountryStat { code: string; paid: number; pending: number; overdue: number; }

export default function PaymentsScreen() {
  const { colors } = useAppTheme();
  const { payments, contracts, tenants, units, properties, deletePayment, confirmPayment, dataLoading } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [filterCountry, setFilterCountry] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);

  // ── Country stats (all payments, no status filter) ─────────────────────────
  const countryStats = useMemo((): CountryStat[] => {
    const map = new Map<string, CountryStat>();
    payments.forEach(p => {
      const code = resolvePaymentCurrency(p, contracts, units, properties);
      if (!map.has(code)) map.set(code, { code, paid: 0, pending: 0, overdue: 0 });
      const s = map.get(code)!;
      if (p.status === 'paid')    s.paid    += p.amount;
      if (p.status === 'pending') s.pending += p.amount;
      if (p.status === 'overdue') s.overdue += p.amount;
    });
    return Array.from(map.values());
  }, [payments, contracts, units, properties]);

  const countryOptions = useMemo(() => [
    { label: 'كل الدول', value: '' },
    ...countryStats.map(s => ({ label: countryLabel(s.code), value: s.code })),
  ], [countryStats]);

  const filtered = useMemo(() => {
    return payments.filter(p => {
      if (filterCountry && resolvePaymentCurrency(p, contracts, units, properties) !== filterCountry) return false;
      const matchFilter = filter === 'all' || p.status === filter;
      if (!matchFilter) return false;
      if (search) {
        const contract = contracts.find(c => c.id === p.contractId);
        const tenant   = contract ? tenants.find(t => t.id === contract.tenantId) : null;
        return (
          (p.receiptNumber ?? '').includes(search) ||
          (tenant?.name ?? '').includes(search) ||
          String(p.amount).includes(search) ||
          p.dueDate.includes(search) ||
          (contract?.contractNumber ?? '').includes(search)
        );
      }
      return true;
    });
  }, [payments, contracts, tenants, units, properties, search, filter, filterCountry]);

  const totals = useMemo(() => {
    const base = filterCountry
      ? payments.filter(p => resolvePaymentCurrency(p, contracts, units, properties) === filterCountry)
      : payments;
    return {
      paid:    base.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0),
      pending: base.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0),
      overdue: base.filter(p => p.status === 'overdue').reduce((s, p) => s + p.amount, 0),
    };
  }, [payments, contracts, units, properties, filterCountry]);

  if (dataLoading) return <ListSkeleton count={5} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="المدفوعات" rightAction={{ icon: 'add', onPress: () => router.push('/record-payment') }} />

      <SearchBar value={search} onChangeText={setSearch} placeholder="ابحث بالاسم أو الإيصال أو المبلغ..." />

      <FilterBar options={PAYMENT_FILTERS} value={filter} onChange={v => setFilter(v as Filter)} />

      {/* Country breakdown cards */}
      {countryStats.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.countryScroll}>
          {countryStats.map(s => {
            const active = filterCountry === s.code;
            return (
              <TouchableOpacity
                key={s.code}
                style={[styles.countryCard, {
                  backgroundColor: active ? colors.primary + '10' : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                }]}
                onPress={() => setFilterCountry(active ? '' : s.code)}
                activeOpacity={0.8}
              >
                <View style={styles.countryCardHeader}>
                  <Ionicons name="globe-outline" size={13} color={active ? colors.primary : colors.textMuted} />
                  <Text style={[styles.countryName, { color: active ? colors.primary : colors.text }]} numberOfLines={1}>
                    {countryLabel(s.code)}
                  </Text>
                </View>
                <View style={styles.countryStats}>
                  <View style={styles.countryStat}>
                    <CurrencyText amount={s.paid} currency={s.code} style={[styles.countryStatVal, { color: colors.success }]} />
                    <Text style={[styles.countryStatLbl, { color: colors.textMuted }]}>محصّل</Text>
                  </View>
                  <View style={[styles.countryDiv, { backgroundColor: colors.border }]} />
                  <View style={styles.countryStat}>
                    <CurrencyText amount={s.pending} currency={s.code} style={[styles.countryStatVal, { color: colors.warning }]} />
                    <Text style={[styles.countryStatLbl, { color: colors.textMuted }]}>معلق</Text>
                  </View>
                  <View style={[styles.countryDiv, { backgroundColor: colors.border }]} />
                  <View style={styles.countryStat}>
                    <CurrencyText amount={s.overdue} currency={s.code} style={[styles.countryStatVal, { color: colors.danger }]} />
                    <Text style={[styles.countryStatLbl, { color: colors.textMuted }]}>متأخر</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Link to ledger */}
      <TouchableOpacity
        style={[styles.ledgerLink, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}
        onPress={() => router.push('/ledger')}
        activeOpacity={0.8}
      >
        <Ionicons name="receipt-outline" size={15} color={colors.primary} />
        <Text style={[styles.ledgerLinkText, { color: colors.primary }]}>عرض سجل المدفوعات مجمّعاً لكل مستأجر</Text>
        <Ionicons name="chevron-back" size={14} color={colors.primary} />
      </TouchableOpacity>

      {/* Totals */}
      <View style={[styles.totalsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {filterCountry && (
          <TouchableOpacity style={styles.clearCountry} onPress={() => setFilterCountry('')}>
            <Ionicons name="close-circle" size={14} color={colors.primary} />
            <Text style={[styles.clearCountryText, { color: colors.primary }]}>{countryLabel(filterCountry)}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.total}>
          <CurrencyText amount={totals.paid} currency={filterCountry || undefined} style={[styles.tv, { color: colors.success }]} />
          <Text style={[styles.tl, { color: colors.textMuted }]}>محصّل</Text>
        </View>
        <View style={[styles.td, { backgroundColor: colors.border }]} />
        <View style={styles.total}>
          <CurrencyText amount={totals.pending} currency={filterCountry || undefined} style={[styles.tv, { color: colors.warning }]} />
          <Text style={[styles.tl, { color: colors.textMuted }]}>معلق</Text>
        </View>
        <View style={[styles.td, { backgroundColor: colors.border }]} />
        <View style={styles.total}>
          <CurrencyText amount={totals.overdue} currency={filterCountry || undefined} style={[styles.tv, { color: colors.danger }]} />
          <Text style={[styles.tl, { color: colors.textMuted }]}>متأخر</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {filtered.length === 0 ? (
          <EmptyState icon="cash-outline" title="لا توجد دفعات" />
        ) : (
          <ResponsiveGrid>{filtered.map(p => (
            <PaymentCard
              key={p.id}
              payment={p}
              onDelete={p.status === 'pending' ? () => setPendingDelete(p.id) : undefined}
              onConfirm={(p.status === 'pending' || p.status === 'overdue') ? () => setPendingConfirm(p.id) : undefined}
            />
          ))}</ResponsiveGrid>
        )}
      </ScrollView>

      <ConfirmModal
        visible={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { deletePayment(pendingDelete!); setPendingDelete(null); }}
        title="حذف الدفعة"
        message="هل أنت متأكد من حذف هذه الدفعة المعلقة؟ لا يمكن التراجع."
        confirmLabel="حذف"
        variant="danger"
      />
      <ConfirmModal
        visible={!!pendingConfirm}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => { confirmPayment(pendingConfirm!); setPendingConfirm(null); }}
        title="تأكيد استلام الدفعة"
        message="هل تأكدت من استلام هذه الدفعة؟ سيتم تسجيلها كمدفوعة وإنشاء إيصال تلقائي."
        confirmLabel="تأكيد الاستلام"
        variant="warning"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  totalsRow: {
    flexDirection: 'row', marginHorizontal: Theme.spacing.base,
    borderRadius: Theme.radius.lg, borderWidth: 1, padding: Theme.spacing.md, marginBottom: 8,
    flexWrap: 'wrap', gap: 4,
  },
  total: { flex: 1, alignItems: 'center', gap: 2 },
  tv: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  tl: { fontSize: Theme.fontSize.xs },
  td: { width: 1, marginVertical: 4 },
  clearCountry: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingBottom: 6, marginBottom: 2,
  },
  clearCountryText: { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.semibold },
  ledgerLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: Theme.spacing.base, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Theme.radius.md, borderWidth: 1,
  },
  ledgerLinkText: { flex: 1, fontSize: Theme.fontSize.sm, fontWeight: '600' },
  countryScroll: {
    flexDirection: 'row',
    paddingHorizontal: Theme.spacing.base, paddingBottom: 8, gap: 8,
  },
  countryCard: {
    borderRadius: Theme.radius.lg, borderWidth: 1,
    padding: Theme.spacing.sm, minWidth: 180, gap: 8,
  },
  countryCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  countryName: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold, flex: 1 },
  countryStats: { flexDirection: 'row', alignItems: 'center' },
  countryStat: { flex: 1, alignItems: 'center', gap: 2 },
  countryStatVal: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },
  countryStatLbl: { fontSize: 10 },
  countryDiv: { width: 1, height: 28, marginHorizontal: 4 },
});
