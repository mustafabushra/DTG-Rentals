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
import { resolvePaymentCurrency, type CurrencyCode } from '../utils/currency';

const COUNTRY_LABELS: Partial<Record<CurrencyCode, string>> = {
  SAR: 'السعودية', AED: 'الإمارات', EGP: 'مصر',
  KWD: 'الكويت',  BHD: 'البحرين',  QAR: 'قطر',
  OMR: 'عُمان',   GBP: 'بريطانيا', USD: 'أمريكا', EUR: 'أوروبا',
};

type Filter = 'all' | PaymentStatus;

export default function PaymentsScreen() {
  const { colors } = useAppTheme();
  const { payments, contracts, tenants, units, properties, deletePayment, confirmPayment, dataLoading } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [filterCountry, setFilterCountry] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);

  const countryOptions = useMemo(() => {
    const codes = Array.from(new Set(
      payments.map(p => resolvePaymentCurrency(p, contracts, units, properties))
    ));
    return [
      { label: 'كل الدول', value: '' },
      ...codes.map(code => ({
        label: COUNTRY_LABELS[code as CurrencyCode] ?? code,
        value: code,
      })),
    ];
  }, [payments, contracts, units, properties]);

  const filtered = useMemo(() => {
    return payments.filter(p => {
      if (filterCountry && resolvePaymentCurrency(p, contracts, units, properties) !== filterCountry) return false;
      let matchSearch = true;
      if (search) {
        const contract = contracts.find(c => c.id === p.contractId);
        const tenant   = contract ? tenants.find(t => t.id === contract.tenantId) : null;
        matchSearch =
          (p.receiptNumber ?? '').includes(search) ||
          (tenant?.name ?? '').includes(search) ||
          String(p.amount).includes(search) ||
          p.dueDate.includes(search) ||
          (contract?.contractNumber ?? '').includes(search);
      }
      const matchFilter = filter === 'all' || p.status === filter;
      return matchSearch && matchFilter;
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

      {/* Country filter chips */}
      {countryOptions.length > 2 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.countryBar}>
          {countryOptions.map(opt => {
            const active = filterCountry === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.countryChip, {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                }]}
                onPress={() => setFilterCountry(active && opt.value ? '' : opt.value)}
                activeOpacity={0.8}
              >
                {opt.value && <Ionicons name="globe-outline" size={12} color={active ? '#FFF' : colors.textMuted} />}
                <Text style={[styles.countryChipText, { color: active ? '#FFF' : colors.text }]}>{opt.label}</Text>
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
  },
  total: { flex: 1, alignItems: 'center', gap: 2 },
  tv: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  tl: { fontSize: Theme.fontSize.xs },
  td: { width: 1, marginVertical: 4 },
  ledgerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: Theme.spacing.base,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
  },
  ledgerLinkText: { flex: 1, fontSize: Theme.fontSize.sm, fontWeight: '600' },
  countryBar: {
    paddingHorizontal: Theme.spacing.base,
    paddingBottom: 8,
    gap: 8,
    flexDirection: 'row',
  },
  countryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.radius.full,
    borderWidth: 1,
  },
  countryChipText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
});
