import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { AppHeader } from '../components/ui/AppHeader';
import { SearchBar } from '../components/ui/SearchBar';
import { EmptyState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatDate } from '../data/mockData';
import { CurrencyText } from '../components/ui/CurrencyText';
import type { PaymentStatus } from '../data/mockData';
import { useAppTheme } from '../hooks/useAppTheme';
import { resolvePaymentCurrency } from '../utils/currency';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LedgerRow {
  id: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: PaymentStatus;
  receiptNumber: string;
  paymentId: string;
  currency: string;
}

interface TenantLedger {
  tenantId: string;
  tenantName: string;
  contractId: string;
  contractNumber: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  totalValue: number;
  currency: string;
  rows: LedgerRow[];
  paid: number;
  pending: number;
  overdue: number;
  paidCount: number;
  totalCount: number;
}

const STATUS_COLORS: Record<PaymentStatus, string> = {
  paid: '#27AE60',
  pending: '#F39C12',
  overdue: '#E74C3C',
};

const STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: 'مدفوع',
  pending: 'معلق',
  overdue: 'متأخر',
};

const STATUS_ICONS: Record<PaymentStatus, keyof typeof Ionicons.glyphMap> = {
  paid: 'checkmark-circle',
  pending: 'time',
  overdue: 'alert-circle',
};

// ─── Ledger Row Component ─────────────────────────────────────────────────────

function LedgerRowItem({ row, colors }: { row: LedgerRow; colors: any }) {
  const statusColor = STATUS_COLORS[row.status];
  return (
    <TouchableOpacity
      style={[styles.rowItem, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/payment/${row.paymentId}`)}
      activeOpacity={0.7}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.statusDot, { backgroundColor: statusColor + '25' }]}>
          <Ionicons name={STATUS_ICONS[row.status]} size={14} color={statusColor} />
        </View>
        <View>
          <Text style={[styles.installmentNum, { color: colors.textSecondary }]}>
            قسط {row.installmentNumber}
          </Text>
          <Text style={[styles.rowDate, { color: colors.textMuted }]}>
            {row.status === 'paid'
              ? `دُفع: ${formatDate(row.paidDate!)}`
              : `استحقاق: ${formatDate(row.dueDate)}`}
          </Text>
        </View>
      </View>
      <View style={styles.rowRight}>
        <CurrencyText amount={row.amount} currency={row.currency} style={[styles.rowAmount, { color: statusColor }]} />
        <Text style={[styles.statusLabel, { color: statusColor }]}>
          {STATUS_LABELS[row.status]}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Tenant Ledger Card ───────────────────────────────────────────────────────

function TenantLedgerCard({ ledger, colors }: { ledger: TenantLedger; colors: any }) {
  const [expanded, setExpanded] = useState(true);
  const progress = ledger.totalCount > 0 ? ledger.paidCount / ledger.totalCount : 0;
  const initials = (ledger.tenantName ?? '؟').split(' ').slice(0, 2).map(n => n[0] ?? '').join('');

  return (
    <View style={[styles.ledgerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Card Header */}
      <TouchableOpacity style={styles.ledgerHeader} onPress={() => setExpanded(e => !e)} activeOpacity={0.8}>
        <View style={styles.tenantInfo}>
          <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => router.push(`/tenant/${ledger.tenantId}`)}>
              <Text style={[styles.tenantName, { color: colors.primary }]}>{ledger.tenantName}</Text>
            </TouchableOpacity>
            <Text style={[styles.contractInfo, { color: colors.textSecondary }]}>
              {ledger.propertyName} · وحدة {ledger.unitNumber}
            </Text>
            <TouchableOpacity onPress={() => router.push(`/contract/${ledger.contractId}`)}>
              <Text style={[styles.contractNum, { color: colors.textMuted }]}>
                {ledger.contractNumber}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.success }]} />
        </View>
        <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
          {ledger.paidCount}/{ledger.totalCount} أقساط · {Math.round(progress * 100)}% محصّل
        </Text>
      </View>

      {/* Financial Summary */}
      <View style={[styles.financialSummary, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
        <View style={styles.finItem}>
          <CurrencyText amount={ledger.paid} currency={ledger.currency} style={[styles.finValue, { color: colors.success }]} />
          <Text style={[styles.finLabel, { color: colors.textMuted }]}>محصّل</Text>
        </View>
        <View style={[styles.finDiv, { backgroundColor: colors.border }]} />
        <View style={styles.finItem}>
          <CurrencyText amount={ledger.pending} currency={ledger.currency} style={[styles.finValue, { color: colors.warning }]} />
          <Text style={[styles.finLabel, { color: colors.textMuted }]}>معلق</Text>
        </View>
        <View style={[styles.finDiv, { backgroundColor: colors.border }]} />
        <View style={styles.finItem}>
          <CurrencyText amount={ledger.overdue} currency={ledger.currency} style={[styles.finValue, { color: colors.danger }]} />
          <Text style={[styles.finLabel, { color: colors.textMuted }]}>متأخر</Text>
        </View>
        <View style={[styles.finDiv, { backgroundColor: colors.border }]} />
        <View style={styles.finItem}>
          <CurrencyText amount={ledger.totalValue} currency={ledger.currency} style={[styles.finValue, { color: colors.text }]} />
          <Text style={[styles.finLabel, { color: colors.textMuted }]}>الإجمالي</Text>
        </View>
      </View>

      {/* Payment Rows */}
      {expanded && (
        <View>
          {ledger.rows.map(row => (
            <LedgerRowItem key={row.id} row={row} colors={colors} />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Filter Pill ──────────────────────────────────────────────────────────────

function FilterPill({
  label, value, options, onChange, colors, baseZIndex = 10,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  colors: any;
  baseZIndex?: number;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <View style={{ position: 'relative', zIndex: open ? 999 : baseZIndex }}>
      <TouchableOpacity
        style={[styles.pill, { backgroundColor: colors.card, borderColor: value ? colors.primary : colors.border }]}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.8}
      >
        <Text style={[styles.pillText, { color: value ? colors.primary : colors.textSecondary }]}>
          {selected?.label ?? label}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={value ? colors.primary : colors.textMuted} />
      </TouchableOpacity>
      {open && (
        <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border, ...Theme.shadow.md }]}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.dropdownItem, opt.value === value && { backgroundColor: colors.primary + '15' }]}
              onPress={() => { onChange(opt.value === value ? '' : opt.value); setOpen(false); }}
            >
              <Text style={[styles.dropdownText, { color: opt.value === value ? colors.primary : colors.text }]}>
                {opt.label}
              </Text>
              {opt.value === value && <Ionicons name="checkmark" size={14} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LedgerScreen() {
  const { colors } = useAppTheme();
  const { payments, contracts, tenants, units, properties, dataLoading } = useApp();

  const [search, setSearch] = useState('');
  const [filterTenant, setFilterTenant] = useState('');
  const [filterProperty, setFilterProperty] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // ── Build tenant ledger list ───────────────────────────────────────────────
  const ledgers = useMemo((): TenantLedger[] => {
    const map = new Map<string, TenantLedger>();

    contracts.forEach(contract => {
      if (!['active', 'expired', 'terminated'].includes(contract.status)) return;

      const tenant = tenants.find(t => t.id === contract.tenantId);
      const unit = units.find(u => u.id === contract.unitId);
      const property = unit ? properties.find(p => p.id === unit.propertyId) : null;
      if (!tenant || !unit || !property) return;

      const contractPayments = payments
        .filter(p => p.contractId === contract.id)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      const contractCurrency = resolvePaymentCurrency(
        { currency: contract.currency, contractId: contract.id },
        contracts, units, properties,
      );

      const rows: LedgerRow[] = contractPayments.map((p, i) => ({
        id: p.id,
        paymentId: p.id,
        installmentNumber: p.installmentNumber ?? i + 1,
        amount: p.amount,
        dueDate: p.dueDate,
        paidDate: p.paidDate,
        status: p.status,
        receiptNumber: p.receiptNumber,
        currency: contractCurrency,
      }));

      const paid    = rows.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);
      const pending = rows.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
      const overdue = rows.filter(r => r.status === 'overdue').reduce((s, r) => s + r.amount, 0);

      map.set(contract.id, {
        tenantId: tenant.id,
        tenantName: tenant.name,
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        propertyId: property.id,
        propertyName: property.name,
        unitNumber: unit.number,
        totalValue: contract.annualValue,
        currency: contractCurrency,
        rows,
        paid,
        pending,
        overdue,
        paidCount: rows.filter(r => r.status === 'paid').length,
        totalCount: rows.length,
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      a.tenantName.localeCompare(b.tenantName, 'ar')
    );
  }, [contracts, tenants, units, properties, payments]);

  // ── Filter options ─────────────────────────────────────────────────────────
  const tenantOptions = useMemo(() => [
    { label: 'كل المستأجرين', value: '' },
    ...Array.from(new Map(ledgers.map(l => [l.tenantId, l.tenantName])).entries())
      .map(([id, name]) => ({ label: name, value: id })),
  ], [ledgers]);

  const propertyOptions = useMemo(() => [
    { label: 'كل العقارات', value: '' },
    ...Array.from(new Map(ledgers.map(l => [l.propertyId, l.propertyName])).entries())
      .map(([id, name]) => ({ label: name, value: id })),
  ], [ledgers]);

  const statusOptions = [
    { label: 'كل الحالات', value: '' },
    { label: 'مدفوع', value: 'paid' },
    { label: 'معلق', value: 'pending' },
    { label: 'متأخر', value: 'overdue' },
  ];

  // ── Apply filters ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return ledgers
      .filter(l => {
        if (filterTenant && l.tenantId !== filterTenant) return false;
        if (filterProperty && l.propertyId !== filterProperty) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!l.tenantName.toLowerCase().includes(q) &&
              !l.contractNumber.toLowerCase().includes(q) &&
              !l.propertyName.toLowerCase().includes(q) &&
              !l.unitNumber.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .map(l => {
        if (!filterStatus) return l;
        // Filter rows by status but keep the ledger visible if it has matching rows
        const filteredRows = l.rows.filter(r => r.status === filterStatus);
        if (filteredRows.length === 0) return null;
        return { ...l, rows: filteredRows };
      })
      .filter(Boolean) as TenantLedger[];
  }, [ledgers, filterTenant, filterProperty, filterStatus, search]);

  // ── Grand totals ───────────────────────────────────────────────────────────
  const totals = useMemo(() => ({
    paid:    filtered.reduce((s, l) => s + l.paid, 0),
    pending: filtered.reduce((s, l) => s + l.pending, 0),
    overdue: filtered.reduce((s, l) => s + l.overdue, 0),
    total:   filtered.reduce((s, l) => s + l.totalValue, 0),
  }), [filtered]);

  const hasActiveFilters = !!(filterTenant || filterProperty || filterStatus || search);

  if (dataLoading) return <ListSkeleton count={4} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="سجل المدفوعات" />

      {/* Search */}
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="ابحث بالاسم أو العقار أو العقد..."
      />

      {/* Filters */}
      <View style={styles.filtersRow}>
        <FilterPill
          label="المستأجر"
          value={filterTenant}
          options={tenantOptions}
          onChange={setFilterTenant}
          colors={colors}
          baseZIndex={30}
        />
        <FilterPill
          label="العقار"
          value={filterProperty}
          options={propertyOptions}
          onChange={setFilterProperty}
          colors={colors}
          baseZIndex={20}
        />
        <FilterPill
          label="الحالة"
          value={filterStatus}
          options={statusOptions}
          onChange={setFilterStatus}
          colors={colors}
          baseZIndex={10}
        />
        {hasActiveFilters && (
          <TouchableOpacity
            style={[styles.clearBtn, { borderColor: colors.danger }]}
            onPress={() => { setFilterTenant(''); setFilterProperty(''); setFilterStatus(''); setSearch(''); }}
          >
            <Ionicons name="close-circle-outline" size={14} color={colors.danger} />
            <Text style={[styles.clearText, { color: colors.danger }]}>مسح</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Grand Summary */}
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {[
          { label: 'محصّل', value: totals.paid,    color: colors.success },
          { label: 'معلق',  value: totals.pending,  color: colors.warning },
          { label: 'متأخر', value: totals.overdue,  color: colors.danger  },
          { label: 'الإجمالي', value: totals.total, color: colors.text    },
        ].map((item, i, arr) => (
          <React.Fragment key={item.label}>
            <View style={styles.summaryItem}>
              <CurrencyText amount={item.value} style={[styles.summaryValue, { color: item.color }]} />
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{item.label}</Text>
            </View>
            {i < arr.length - 1 && <View style={[styles.summaryDiv, { backgroundColor: colors.border }]} />}
          </React.Fragment>
        ))}
      </View>

      {/* Tenant count badge */}
      <View style={styles.countRow}>
        <Text style={[styles.countText, { color: colors.textMuted }]}>
          {filtered.length} عقد{filtered.length !== 1 ? '' : ''}
        </Text>
      </View>

      {/* Ledger list */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        style={{ zIndex: 1 }}
      >
        {filtered.length === 0 ? (
          <EmptyState icon="receipt-outline" title="لا توجد سجلات" subtitle="لا توجد دفعات تطابق معايير البحث" />
        ) : (
          filtered.map(ledger => (
            <TenantLedgerCard key={ledger.contractId} ledger={ledger} colors={colors} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Filters
  filtersRow: {
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    zIndex: 100,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Theme.radius.full,
    borderWidth: 1,
  },
  pillText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  dropdown: {
    position: 'absolute',
    top: 38,
    right: 0,
    minWidth: 170,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 200,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownText: { fontSize: Theme.fontSize.sm },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Theme.radius.full,
    borderWidth: 1,
  },
  clearText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },

  // Summary
  summaryCard: {
    flexDirection: 'row',
    marginHorizontal: Theme.spacing.base,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    padding: Theme.spacing.md,
    marginBottom: 4,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },
  summaryLabel: { fontSize: 10 },
  summaryDiv: { width: 1, marginVertical: 4 },

  countRow: { paddingHorizontal: Theme.spacing.base, paddingVertical: 4 },
  countText: { fontSize: Theme.fontSize.xs },

  // Ledger Card
  ledgerCard: {
    marginHorizontal: Theme.spacing.base,
    marginBottom: Theme.spacing.base,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  ledgerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Theme.spacing.md,
  },
  tenantInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: Theme.fontSize.base, fontWeight: '700' },
  tenantName: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  contractInfo: { fontSize: Theme.fontSize.sm, marginTop: 1 },
  contractNum: { fontSize: Theme.fontSize.xs, marginTop: 1 },

  // Progress
  progressSection: { paddingHorizontal: Theme.spacing.md, paddingBottom: Theme.spacing.sm },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: Theme.fontSize.xs, textAlign: 'right' },

  // Financial Summary
  financialSummary: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: Theme.spacing.sm,
  },
  finItem: { flex: 1, alignItems: 'center', gap: 2 },
  finValue: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },
  finLabel: { fontSize: 10 },
  finDiv: { width: 1, marginVertical: 4 },

  // Row
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  statusDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  installmentNum: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  rowDate: { fontSize: Theme.fontSize.xs, marginTop: 1 },
  rowAmount: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  statusLabel: { fontSize: Theme.fontSize.xs },
});
