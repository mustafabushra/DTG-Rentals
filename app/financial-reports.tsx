import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Share, Platform, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { AppHeader } from '../components/ui/AppHeader';
import { CurrencyText } from '../components/ui/CurrencyText';
import { useAppTheme } from '../hooks/useAppTheme';
import { CURRENCIES, getCurrency, convertToSAR, formatAmount, type CurrencyCode } from '../utils/currency';
import { BookingService } from '../domain/services/BookingService';

type Period     = '1m' | '3m' | '6m' | '1y';
type ActiveTab  = 'overview' | 'owners' | 'overdue' | 'countries';
type CountryFilter = 'all' | CurrencyCode;

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const BAR_MAX_H = 100;

/** Returns the effective currency code for a contract (contract → property → SAR) */
function contractCurrency(
  contractId: string,
  contracts: any[], units: any[], properties: any[],
): CurrencyCode {
  const c = contracts.find(x => x.id === contractId);
  if (!c) return 'SAR';
  if (c.currency) return c.currency as CurrencyCode;
  const u = units.find(x => x.id === c.unitId);
  const p = u ? properties.find(x => x.id === u.propertyId) : null;
  return (p?.currency ?? 'SAR') as CurrencyCode;
}

/** Country label for a currency code */
function countryLabel(code: CurrencyCode): string {
  const labels: Partial<Record<CurrencyCode, string>> = {
    SAR: 'السعودية', AED: 'الإمارات', EGP: 'مصر',
    KWD: 'الكويت',  BHD: 'البحرين',  QAR: 'قطر',
    OMR: 'عُمان',   USD: 'أمريكا',   GBP: 'بريطانيا', EUR: 'أوروبا',
  };
  return labels[code] ?? code;
}

export default function FinancialReportsScreen() {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const isMobile  = width < 768;
  const isDesktop = width >= 1024;
  const { payments, contracts, properties, units, owners, tenants, bookings } = useApp();

  const [period,        setPeriod]        = useState<Period>('6m');
  const [activeTab,     setActiveTab]     = useState<ActiveTab>('overview');
  const [countryFilter, setCountryFilter] = useState<CountryFilter>('all');

  const periodMonths: Record<Period, number> = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 };
  const months = periodMonths[period];

  // ── Derive which currencies exist in the data ──────────────────────────────
  const activeCurrencies = useMemo((): CurrencyCode[] => {
    const seen = new Set<CurrencyCode>();
    properties.forEach(p => seen.add((p.currency ?? 'SAR') as CurrencyCode));
    contracts.forEach(c => {
      if (c.currency) seen.add(c.currency as CurrencyCode);
    });
    return CURRENCIES.map(c => c.code).filter(code => seen.has(code));
  }, [properties, contracts]);

  // ── Filter helpers (apply countryFilter) ──────────────────────────────────
  const filteredContracts = useMemo(() =>
    countryFilter === 'all'
      ? contracts
      : contracts.filter(c => contractCurrency(c.id, contracts, units, properties) === countryFilter),
  [contracts, units, properties, countryFilter]);

  const filteredPayments = useMemo(() => {
    if (countryFilter === 'all') return payments;
    const cids = new Set(filteredContracts.map(c => c.id));
    return payments.filter(p => cids.has(p.contractId));
  }, [payments, filteredContracts, countryFilter]);

  const filteredProperties = useMemo(() =>
    countryFilter === 'all'
      ? properties
      : properties.filter(p => (p.currency ?? 'SAR') === countryFilter),
  [properties, countryFilter]);

  // عملة الحجز: من الحجز نفسه، أو من عملة العقار الأب
  const bookingCurrency = (b: { currency?: string; propertyId: string }): CurrencyCode =>
    (b.currency ?? (properties.find(p => p.id === b.propertyId)?.currency ?? 'SAR')) as CurrencyCode;

  const filteredBookings = useMemo(() =>
    countryFilter === 'all'
      ? bookings
      : bookings.filter(b => bookingCurrency(b) === countryFilter),
  [bookings, properties, countryFilter]);

  // ── Main stats ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now    = new Date();
    const pad    = (n: number) => String(n).padStart(2, '0');
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1).toISOString().split('T')[0];
    const periodEnd = now.toISOString().split('T')[0];
    // نهاية حصرية لحساب ليالي الحجوزات (اليوم التالي، بتوقيت محلي لتفادي انزياح UTC)
    const periodEndExcl = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate() + 1)}`;

    const periodPayments = filteredPayments.filter(p =>
      (p.paidDate && p.paidDate >= cutoff) || (p.dueDate >= cutoff && p.status !== 'paid'),
    );

    const leaseRevenue = filteredContracts
      .filter(c => c.startDate <= periodEnd && c.endDate >= cutoff)
      .reduce((s: number, c: any) => {
        const overlapStart = c.startDate > cutoff    ? c.startDate : cutoff;
        const overlapEnd   = c.endDate   < periodEnd ? c.endDate   : periodEnd;
        const overlapDays  = Math.ceil((new Date(overlapEnd).getTime() - new Date(overlapStart).getTime()) / 86400000) + 1;
        return s + Math.round(c.annualValue * (overlapDays / 365));
      }, 0);

    // إيراد بيوت المصيف: يُحتسب فقط لليالي المشغولة فعلياً ضمن الفترة (لا افتراض دخل مستمر)
    const holidayRevenue = BookingService.revenueForPeriod(filteredBookings, cutoff, periodEndExcl);
    const holidayCollected = filteredBookings
      .filter(b => b.status === 'confirmed' && BookingService.nightsInPeriod(b, cutoff, periodEndExcl) > 0)
      .reduce((s, b) => s + (b.paidAmount || 0), 0);

    const totalRevenue = leaseRevenue + holidayRevenue;

    const collected      = periodPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0) + holidayCollected;
    const overdue        = periodPayments.filter(p => p.status === 'overdue').reduce((s, p) => s + p.amount, 0);
    const collectionRate = totalRevenue > 0 ? Math.min(100, Math.round((collected / totalRevenue) * 100)) : 0;

    // Monthly bar
    const barData: { month: string; value: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthPaid = filteredPayments
        .filter(p => p.paidDate?.startsWith(monthStr))
        .reduce((s, p) => s + p.amount, 0);
      // إيراد الحجوزات المعترف به لهذا الشهر (ليالٍ مشغولة داخل حدوده)
      const mStart   = `${monthStr}-01`;
      const mEndExcl = d.getMonth() === 11
        ? `${d.getFullYear() + 1}-01-01`
        : `${d.getFullYear()}-${pad(d.getMonth() + 2)}-01`;
      const monthHoliday = BookingService.revenueForPeriod(filteredBookings, mStart, mEndExcl);
      barData.push({ month: MONTHS_AR[d.getMonth()], value: monthPaid + monthHoliday });
    }

    // By property (عقود + حجوزات)
    const byProperty = filteredProperties.map(prop => {
      const propUnits     = units.filter(u => u.propertyId === prop.id);
      const propUnitIds   = new Set(propUnits.map(u => u.id));
      const propContracts = filteredContracts.filter(c => propUnitIds.has(c.unitId) && c.status === 'active');
      const leaseRev      = propContracts.reduce((s, c) => s + Math.round(c.annualValue / 12 * months), 0);
      const holidayRev    = BookingService.revenueForPeriod(
        filteredBookings.filter(b => propUnitIds.has(b.unitId)), cutoff, periodEndExcl);
      const currency      = (prop.currency ?? 'SAR') as CurrencyCode;
      return { name: prop.name, revenue: leaseRev + holidayRev, currency };
    }).filter(p => p.revenue > 0).sort((a, b) => b.revenue - a.revenue);

    // By owner (عقود + حجوزات)
    const byOwner = owners.map(owner => {
      const ownerProps     = filteredProperties.filter(p => p.ownerId === owner.id);
      const ownerUnits     = units.filter(u => ownerProps.find(p => p.id === u.propertyId));
      const ownerUnitIds   = new Set(ownerUnits.map(u => u.id));
      const ownerContracts = filteredContracts.filter(c => ownerUnitIds.has(c.unitId));
      const ownerBookings  = filteredBookings.filter(b => ownerUnitIds.has(b.unitId));
      const ownerRevenue   = ownerContracts.filter(c => c.status === 'active')
        .reduce((s, c) => s + Math.round(c.annualValue / 12 * months), 0)
        + BookingService.revenueForPeriod(ownerBookings, cutoff, periodEndExcl);
      const ownerCollected = filteredPayments
        .filter(p => ownerContracts.find(c => c.id === p.contractId) && p.status === 'paid' && (p.paidDate ?? '') >= cutoff)
        .reduce((s, p) => s + p.amount, 0)
        + ownerBookings
          .filter(b => b.status === 'confirmed' && BookingService.nightsInPeriod(b, cutoff, periodEndExcl) > 0)
          .reduce((s, b) => s + (b.paidAmount || 0), 0);
      return { name: owner.name, revenue: ownerRevenue, collected: ownerCollected, unitCount: ownerUnits.length };
    }).filter(o => o.unitCount > 0).sort((a, b) => b.revenue - a.revenue);

    // Overdue list
    const overdueList = filteredPayments
      .filter(p => p.status === 'overdue')
      .map(p => {
        const c    = contracts.find(cc => cc.id === p.contractId);
        const t    = c ? tenants.find(tt => tt.id === c.tenantId) : null;
        const u    = c ? units.find(uu => uu.id === c.unitId) : null;
        const prop = u ? properties.find(pp => pp.id === u.propertyId) : null;
        const cur  = contractCurrency(p.contractId, contracts, units, properties);
        return {
          id: p.id, amount: p.amount, dueDate: p.dueDate,
          tenantName: t?.name ?? '—', propertyName: prop?.name ?? '—',
          unitNum: u?.number ?? '—', currency: cur,
        };
      }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return { totalRevenue, leaseRevenue, holidayRevenue, collected, overdue, collectionRate, barData, byProperty, byOwner, overdueList };
  }, [filteredPayments, filteredContracts, filteredProperties, filteredBookings, units, owners, tenants, properties, contracts, months]);

  // ── Per-country breakdown (for "الدول" tab) ────────────────────────────────
  const byCountry = useMemo(() => {
    const now    = new Date();
    const pad    = (n: number) => String(n).padStart(2, '0');
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1).toISOString().split('T')[0];
    const periodEndExcl = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate() + 1)}`;

    return activeCurrencies.map(code => {
      const cContracts = contracts.filter(c => contractCurrency(c.id, contracts, units, properties) === code);
      const cPayments  = payments.filter(p => cContracts.find(c => c.id === p.contractId));
      const cProps     = properties.filter(p => (p.currency ?? 'SAR') === code);
      const cBookings  = bookings.filter(b => bookingCurrency(b) === code);

      const revenue   = cContracts.filter(c => c.status === 'active')
        .reduce((s, c) => s + Math.round(c.annualValue / 12 * months), 0)
        + BookingService.revenueForPeriod(cBookings, cutoff, periodEndExcl);
      const collected = cPayments.filter(p => p.status === 'paid' && (p.paidDate ?? '') >= cutoff)
        .reduce((s, p) => s + p.amount, 0)
        + cBookings
          .filter(b => b.status === 'confirmed' && BookingService.nightsInPeriod(b, cutoff, periodEndExcl) > 0)
          .reduce((s, b) => s + (b.paidAmount || 0), 0);
      const overdue   = cPayments.filter(p => p.status === 'overdue')
        .reduce((s, p) => s + p.amount, 0);
      const rate      = revenue > 0 ? Math.min(100, Math.round((collected / revenue) * 100)) : 0;

      return {
        code,
        country:   countryLabel(code),
        meta:      getCurrency(code),
        propCount: cProps.length,
        unitCount: units.filter(u => cProps.find(p => p.id === u.propertyId)).length,
        contractCount: cContracts.filter(c => c.status === 'active').length,
        revenue, collected, overdue, rate,
      };
    }).filter(c => c.propCount > 0 || c.contractCount > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [activeCurrencies, contracts, payments, properties, units, bookings, months]);

  const maxBar = Math.max(...stats.barData.map(d => d.value), 1);

  // ── SAR totals across all countries (for multi-currency summary card) ───────
  const sarTotals = useMemo(() => {
    const now    = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1).toISOString().split('T')[0];
    let revenue = 0, collected = 0, overdue = 0;
    byCountry.forEach(c => {
      revenue   += convertToSAR(c.revenue,   c.code as CurrencyCode);
      collected += convertToSAR(c.collected, c.code as CurrencyCode);
      overdue   += convertToSAR(c.overdue,   c.code as CurrencyCode);
    });
    const rate = revenue > 0 ? Math.min(100, Math.round((collected / revenue) * 100)) : 0;
    return { revenue, collected, overdue, rate };
  }, [byCountry, months]);

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    const filterLabel = countryFilter === 'all' ? 'كل الدول' : `${countryLabel(countryFilter)} (${countryFilter})`;
    const lines = [
      `تقرير مالي — ${new Date().toLocaleDateString('ar-SA')}`,
      `الفترة: ${period === '1m' ? 'شهر' : period === '3m' ? '3 أشهر' : period === '6m' ? '6 أشهر' : 'سنة'}`,
      `الدولة: ${filterLabel}`,
      '',
      `الإيرادات المتوقعة,${stats.totalRevenue}`,
      `  منها عقود طويلة,${stats.leaseRevenue}`,
      `  منها حجوزات يومية,${stats.holidayRevenue}`,
      `المحصّلة,${stats.collected}`,
      `المتأخرة,${stats.overdue}`,
      `نسبة التحصيل,${stats.collectionRate}%`,
      '',
      'الإيرادات الشهرية',
      ...stats.barData.map(d => `${d.month},${d.value}`),
      '',
      'إيرادات حسب العقار',
      ...stats.byProperty.map(p => `${p.name},${p.revenue},${p.currency}`),
      '',
      'إيرادات حسب المالك',
      ...stats.byOwner.map(o => `${o.name},${o.revenue},${o.collected}`),
      '',
      'ملخص حسب الدولة',
      'الدولة,العملة,العقارات,الوحدات,العقود,الإيرادات,المحصّل,المتأخر,نسبة التحصيل',
      ...byCountry.map(c => `${c.country},${c.code},${c.propCount},${c.unitCount},${c.contractCount},${c.revenue},${c.collected},${c.overdue},${c.rate}%`),
      '',
      'الدفعات المتأخرة',
      'المستأجر,العقار,الوحدة,المبلغ,العملة,تاريخ الاستحقاق',
      ...stats.overdueList.map(o => `${o.tenantName},${o.propertyName},${o.unitNum},${o.amount},${o.currency},${o.dueDate}`),
    ].join('\n');

    if (Platform.OS === 'web') {
      const blob = new Blob(['﻿' + lines], { type: 'text/csv;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `financial_report_${countryFilter}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      await Share.share({ message: lines, title: 'تقرير مالي' });
    }
  };

  const periodOptions: { label: string; value: Period }[] = [
    { label: 'شهر', value: '1m' }, { label: '3 أشهر', value: '3m' },
    { label: '6 أشهر', value: '6m' }, { label: 'سنة', value: '1y' },
  ];

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: 'overview',   label: 'نظرة عامة' },
    { key: 'owners',     label: 'الملاك' },
    { key: 'overdue',    label: 'المتأخرات' },
    { key: 'countries',  label: 'الدول' },
  ];

  const selectedMeta = countryFilter !== 'all' ? getCurrency(countryFilter) : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="التقارير المالية" rightAction={{ icon: 'share-outline', onPress: handleExport }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Country Filter ──────────────────────────────────────────────── */}
        {activeCurrencies.length > 1 && (
          <View style={styles.countrySection}>
            <View style={styles.countryHeader}>
              <Ionicons name="globe-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.countryHeaderText, { color: colors.textSecondary }]}>تصفية حسب الدولة</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.countryChips}>
              {/* All */}
              <TouchableOpacity
                style={[
                  styles.chip,
                  { borderColor: countryFilter === 'all' ? colors.primary : colors.border,
                    backgroundColor: countryFilter === 'all' ? colors.primary : colors.card },
                ]}
                onPress={() => setCountryFilter('all')}
              >
                <Text style={[styles.chipText, { color: countryFilter === 'all' ? '#FFF' : colors.textSecondary }]}>
                  🌍 كل الدول
                </Text>
              </TouchableOpacity>

              {activeCurrencies.map(code => {
                const meta     = getCurrency(code);
                const active   = countryFilter === code;
                const countryN = countryLabel(code);
                return (
                  <TouchableOpacity
                    key={code}
                    style={[
                      styles.chip,
                      { borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primary : colors.card },
                    ]}
                    onPress={() => setCountryFilter(code)}
                  >
                    <Text style={[styles.chipText, { color: active ? '#FFF' : colors.textSecondary }]}>
                      {countryN}
                    </Text>
                    <Text style={[styles.chipSub, { color: active ? 'rgba(255,255,255,0.8)' : colors.textMuted }]}>
                      {meta.symbol}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Active filter banner */}
            {selectedMeta && (
              <View style={[styles.filterBanner, { backgroundColor: colors.primarySubtle, borderColor: colors.primary + '30' }]}>
                <Ionicons name="funnel" size={13} color={colors.primary} />
                <Text style={[styles.filterBannerText, { color: colors.primary }]}>
                  يعرض بيانات {countryLabel(countryFilter as CurrencyCode)} فقط ({selectedMeta.symbol} {countryFilter})
                </Text>
                <TouchableOpacity onPress={() => setCountryFilter('all')}>
                  <Ionicons name="close-circle" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── Period Selector ─────────────────────────────────────────────── */}
        <View style={[styles.periodRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {periodOptions.map(p => (
            <TouchableOpacity
              key={p.value}
              style={[styles.periodBtn, period === p.value && { backgroundColor: colors.primary }]}
              onPress={() => setPeriod(p.value)}
            >
              <Text style={[styles.periodText, { color: period === p.value ? '#FFF' : colors.textSecondary }]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab Row ─────────────────────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
          <View style={[styles.tabRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {tabs.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tabBtn, activeTab === t.key && { backgroundColor: colors.primary }]}
                onPress={() => setActiveTab(t.key)}
              >
                {t.key === 'countries' && activeCurrencies.length > 1 && (
                  <View style={[styles.tabBadge, { backgroundColor: activeTab === t.key ? 'rgba(255,255,255,0.3)' : colors.primary }]}>
                    <Text style={styles.tabBadgeText}>{activeCurrencies.length}</Text>
                  </View>
                )}
                <Text style={[styles.tabText, { color: activeTab === t.key ? '#FFF' : colors.textSecondary }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* ── Country Cards (multi-currency only) ─────────────────────────── */}
        {activeCurrencies.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.countryScroll} contentContainerStyle={styles.countryScrollContent}>
            {/* SAR total card */}
            <View style={[styles.countryCard, styles.sarCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
              <View style={styles.countryCardHeader}>
                <Ionicons name="swap-horizontal-outline" size={13} color={colors.primary} />
                <Text style={[styles.countryCardName, { color: colors.primary }]} numberOfLines={1}>المجموع الكلي بالريال</Text>
              </View>
              <View style={styles.countryStats}>
                <View style={styles.countryStat}>
                  <Text style={[styles.countryStatVal, { color: colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>{formatAmount(sarTotals.revenue, 'SAR')}</Text>
                  <Text style={[styles.countryStatLbl, { color: colors.textMuted }]}>متوقع</Text>
                </View>
                <View style={[styles.countryDiv, { backgroundColor: colors.primary + '40' }]} />
                <View style={styles.countryStat}>
                  <Text style={[styles.countryStatVal, { color: colors.success }]} numberOfLines={1} adjustsFontSizeToFit>{formatAmount(sarTotals.collected, 'SAR')}</Text>
                  <Text style={[styles.countryStatLbl, { color: colors.textMuted }]}>محصّل</Text>
                </View>
                <View style={[styles.countryDiv, { backgroundColor: colors.primary + '40' }]} />
                <View style={styles.countryStat}>
                  <Text style={[styles.countryStatVal, { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>{formatAmount(sarTotals.overdue, 'SAR')}</Text>
                  <Text style={[styles.countryStatLbl, { color: colors.textMuted }]}>متأخر</Text>
                </View>
                <View style={[styles.countryDiv, { backgroundColor: colors.primary + '40' }]} />
                <View style={styles.countryStat}>
                  <Text style={[styles.countryStatVal, { color: sarTotals.rate >= 80 ? colors.success : sarTotals.rate >= 50 ? colors.warning : colors.danger }]} numberOfLines={1}>{sarTotals.rate}%</Text>
                  <Text style={[styles.countryStatLbl, { color: colors.textMuted }]}>تحصيل</Text>
                </View>
              </View>
              <Text style={[styles.sarNote, { color: colors.textMuted }]}>أسعار صرف تقريبية</Text>
            </View>

            {/* Per-country cards */}
            {byCountry.map(c => {
              const active = countryFilter === c.code;
              return (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.countryCard, { minWidth: 220, backgroundColor: active ? colors.primary + '10' : colors.card, borderColor: active ? colors.primary : colors.border }]}
                  onPress={() => setCountryFilter(active ? 'all' : c.code as CountryFilter)}
                  activeOpacity={0.8}
                >
                  <View style={styles.countryCardHeader}>
                    <Ionicons name="globe-outline" size={13} color={active ? colors.primary : colors.textMuted} />
                    <Text style={[styles.countryCardName, { color: active ? colors.primary : colors.text }]} numberOfLines={1}>{c.country}</Text>
                  </View>
                  <View style={styles.countryStats}>
                    <View style={styles.countryStat}>
                      <Text style={[styles.countryStatVal, { color: colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>{formatAmount(c.revenue, c.code as CurrencyCode)}</Text>
                      <Text style={[styles.countryStatLbl, { color: colors.textMuted }]}>متوقع</Text>
                    </View>
                    <View style={[styles.countryDiv, { backgroundColor: colors.border }]} />
                    <View style={styles.countryStat}>
                      <Text style={[styles.countryStatVal, { color: colors.success }]} numberOfLines={1} adjustsFontSizeToFit>{formatAmount(c.collected, c.code as CurrencyCode)}</Text>
                      <Text style={[styles.countryStatLbl, { color: colors.textMuted }]}>محصّل</Text>
                    </View>
                    <View style={[styles.countryDiv, { backgroundColor: colors.border }]} />
                    <View style={styles.countryStat}>
                      <Text style={[styles.countryStatVal, { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>{formatAmount(c.overdue, c.code as CurrencyCode)}</Text>
                      <Text style={[styles.countryStatLbl, { color: colors.textMuted }]}>متأخر</Text>
                    </View>
                    <View style={[styles.countryDiv, { backgroundColor: colors.border }]} />
                    <View style={styles.countryStat}>
                      <Text style={[styles.countryStatVal, { color: c.rate >= 80 ? colors.success : c.rate >= 50 ? colors.warning : colors.danger }]} numberOfLines={1}>{c.rate}%</Text>
                      <Text style={[styles.countryStatLbl, { color: colors.textMuted }]}>تحصيل</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ── KPI Row ─────────────────────────────────────────────────────── */}
        <View style={[styles.kpiGrid, isDesktop && styles.kpiGridDesktop]}>
          {[
            { label: 'الإيرادات المتوقعة', amount: stats.totalRevenue, color: colors.primary,  icon: 'trending-up-outline' },
            { label: 'المحصّلة',           amount: stats.collected,    color: colors.success,  icon: 'checkmark-circle-outline' },
            { label: 'المتأخرة',           amount: stats.overdue,      color: colors.danger,   icon: 'alert-circle-outline' },
            { label: 'نسبة التحصيل',       text: `${stats.collectionRate}%`, color: colors.secondary, icon: 'pie-chart-outline' },
          ].map(kpi => (
            <View key={kpi.label} style={[styles.kpiCard, isDesktop && styles.kpiCardDesktop, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.kpiIcon, { backgroundColor: `${kpi.color}20` }]}>
                <Ionicons name={kpi.icon as any} size={18} color={kpi.color} />
              </View>
              {'amount' in kpi
                ? <CurrencyText amount={kpi.amount} currency={countryFilter !== 'all' ? countryFilter : undefined} style={[styles.kpiVal, { color: kpi.color }]} />
                : <Text style={[styles.kpiVal, { color: kpi.color }]}>{kpi.text}</Text>
              }
              <Text style={[styles.kpiLbl, { color: colors.textMuted }]}>{kpi.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Revenue split: lease (accrual) vs holiday (occupancy) ────────── */}
        {stats.holidayRevenue > 0 && (
          <View style={[styles.splitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.splitHeader}>
              <Ionicons name="layers-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.splitTitle, { color: colors.text }]}>تفصيل الإيرادات المتوقعة</Text>
            </View>
            <View style={styles.splitRow}>
              <View style={styles.splitItem}>
                <View style={styles.splitDotRow}>
                  <View style={[styles.splitDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.splitLabel, { color: colors.textSecondary }]}>عقود طويلة</Text>
                </View>
                <CurrencyText amount={stats.leaseRevenue} currency={countryFilter !== 'all' ? countryFilter : undefined} style={[styles.splitVal, { color: colors.text }]} />
              </View>
              <View style={[styles.splitDivider, { backgroundColor: colors.border }]} />
              <View style={styles.splitItem}>
                <View style={styles.splitDotRow}>
                  <View style={[styles.splitDot, { backgroundColor: colors.purple }]} />
                  <Text style={[styles.splitLabel, { color: colors.textSecondary }]}>حجوزات يومية</Text>
                </View>
                <CurrencyText amount={stats.holidayRevenue} currency={countryFilter !== 'all' ? countryFilter : undefined} style={[styles.splitVal, { color: colors.purple }]} />
              </View>
            </View>
            <Text style={[styles.splitHint, { color: colors.textMuted }]}>
              إيراد الحجوزات يُحتسب فقط لليالي المشغولة فعلياً خلال الفترة
            </Text>
          </View>
        )}

        {/* ══ OVERVIEW TAB ══ */}
        {activeTab === 'overview' && (
          <View style={isDesktop ? styles.overviewDesktop : undefined}>
            <View style={isDesktop ? styles.overviewLeft : undefined}>
              {/* Collection Rate */}
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>نسبة التحصيل</Text>
                <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
                  <View style={[styles.progressFill, {
                    width: `${stats.collectionRate}%` as any,
                    backgroundColor: stats.collectionRate >= 80 ? colors.success : stats.collectionRate >= 50 ? colors.warning : colors.danger,
                  }]} />
                </View>
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>{stats.collectionRate}% من الإيرادات المتوقعة تم تحصيلها</Text>
              </View>

              {/* Bar Chart */}
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>الإيرادات الشهرية</Text>
                <View style={styles.barChart}>
                  {stats.barData.map((d, i) => {
                    const showLabel = !isMobile || stats.barData.length <= 6 || i % 2 === 0;
                    const barH = maxBar > 0 ? Math.round((d.value / maxBar) * BAR_MAX_H) : 0;
                    return (
                      <View key={i} style={styles.barItem}>
                        <Text style={[styles.barValue, { color: colors.textMuted }]}>
                          {d.value > 0 ? (d.value >= 1000 ? `${Math.round(d.value / 1000)}k` : d.value) : ''}
                        </Text>
                        <View style={styles.barWrap}>
                          <View style={[styles.bar, { height: Math.max(barH, 4), backgroundColor: colors.primary }]} />
                        </View>
                        <Text style={[styles.barLabel, { color: colors.textMuted }]}>{showLabel ? d.month.substring(0, 3) : ''}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={isDesktop ? styles.overviewRight : undefined}>
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>إيرادات حسب العقار</Text>
                {stats.byProperty.length === 0 ? (
                  <Text style={[styles.noData, { color: colors.textMuted }]}>لا توجد بيانات</Text>
                ) : (
                  <>
                    <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.thLabel, { color: colors.textSecondary }]}>الإيراد</Text>
                      <Text style={[styles.thName, { color: colors.textSecondary }]}>العقار</Text>
                    </View>
                    {stats.byProperty.map((p, i) => (
                      <View key={p.name} style={[styles.tableRow, i < stats.byProperty.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                        <CurrencyText amount={p.revenue} currency={p.currency} style={[styles.tdValue, { color: colors.success }]} />
                        <Text style={[styles.tdName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ══ OWNERS TAB ══ */}
        {activeTab === 'owners' && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>ملخص الملاك</Text>
            {stats.byOwner.length === 0 ? (
              <Text style={[styles.noData, { color: colors.textMuted }]}>لا توجد بيانات</Text>
            ) : stats.byOwner.map((o, i) => {
              const rate = o.revenue > 0 ? Math.round((o.collected / o.revenue) * 100) : 0;
              return (
                <View key={o.name} style={[styles.ownerRow, { borderBottomColor: colors.border, borderBottomWidth: i < stats.byOwner.length - 1 ? 1 : 0 }]}>
                  <View style={[styles.ownerAvatar, { backgroundColor: colors.primarySubtle }]}>
                    <Text style={[styles.ownerAvatarText, { color: colors.primary }]}>{(o.name ?? '؟')[0]}</Text>
                  </View>
                  <View style={styles.ownerInfo}>
                    <Text style={[styles.ownerName, { color: colors.text }]}>{o.name}</Text>
                    <Text style={[styles.ownerSub, { color: colors.textMuted }]}>{o.unitCount} وحدة</Text>
                    <View style={[styles.miniProgress, { backgroundColor: colors.border }]}>
                      <View style={[styles.miniProgressFill, { width: `${Math.min(rate, 100)}%` as any, backgroundColor: rate >= 80 ? colors.success : rate >= 50 ? colors.warning : colors.danger }]} />
                    </View>
                  </View>
                  <View style={styles.ownerAmounts}>
                    <CurrencyText amount={o.revenue}   currency={countryFilter !== 'all' ? countryFilter : undefined} style={[styles.ownerRevenue,   { color: colors.primary }]} />
                    <CurrencyText amount={o.collected} currency={countryFilter !== 'all' ? countryFilter : undefined} style={[styles.ownerCollected, { color: colors.success }]} />
                    <Text style={[styles.ownerRate, { color: rate >= 80 ? colors.success : rate >= 50 ? colors.warning : colors.danger }]}>{rate}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ══ OVERDUE TAB ══ */}
        {activeTab === 'overdue' && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.overdueSummary}>
              <Ionicons name="alert-circle-outline" size={24} color={colors.danger} />
              <CurrencyText amount={stats.overdue} currency={countryFilter !== 'all' ? countryFilter : undefined} style={[styles.overdueTotal, { color: colors.danger }]} />
              <Text style={[styles.overdueSub, { color: colors.textMuted }]}>{stats.overdueList.length} دفعة متأخرة</Text>
            </View>
            {stats.overdueList.length === 0 ? (
              <View style={styles.noOverdue}>
                <Ionicons name="checkmark-circle-outline" size={40} color={colors.success} />
                <Text style={[styles.noData, { color: colors.success }]}>لا توجد دفعات متأخرة</Text>
              </View>
            ) : stats.overdueList.map((o, i) => (
              <View key={o.id} style={[styles.overdueRow, { borderBottomColor: colors.border, borderBottomWidth: i < stats.overdueList.length - 1 ? 1 : 0 }]}>
                <View style={styles.overdueInfo}>
                  <Text style={[styles.overdueTenant, { color: colors.text }]}>{o.tenantName}</Text>
                  <Text style={[styles.overdueLocation, { color: colors.textMuted }]}>{o.propertyName} — وحدة {o.unitNum}</Text>
                  <Text style={[styles.overdueDate, { color: colors.danger }]}>استحقاق: {o.dueDate}</Text>
                </View>
                <CurrencyText amount={o.amount} currency={o.currency} style={[styles.overdueAmount, { color: colors.danger }]} />
              </View>
            ))}
          </View>
        )}

        {/* ══ COUNTRIES TAB ══ */}
        {activeTab === 'countries' && (
          <View>
            {byCountry.length === 0 ? (
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.noData, { color: colors.textMuted }]}>لا توجد بيانات متعددة الدول</Text>
              </View>
            ) : byCountry.map(c => (
              <View key={c.code} style={[styles.countryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* Card Header */}
                <View style={styles.countryCardHeader}>
                  <View style={[styles.countryCodeBadge, { backgroundColor: colors.primarySubtle }]}>
                    <Text style={[styles.countryCodeText, { color: colors.primary }]}>{c.code}</Text>
                  </View>
                  <View style={styles.countryCardTitle}>
                    <Text style={[styles.countryName, { color: colors.text }]}>{c.country}</Text>
                    <Text style={[styles.countrySub, { color: colors.textMuted }]}>
                      {c.propCount} عقار · {c.unitCount} وحدة · {c.contractCount} عقد نشط
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.countryFilterBtn, { backgroundColor: colors.primarySubtle }]}
                    onPress={() => { setCountryFilter(c.code); setActiveTab('overview'); }}
                  >
                    <Ionicons name="funnel-outline" size={13} color={colors.primary} />
                    <Text style={[styles.countryFilterBtnText, { color: colors.primary }]}>تصفية</Text>
                  </TouchableOpacity>
                </View>

                {/* Stats Row */}
                <View style={[styles.countryStatsRow, { borderTopColor: colors.border }]}>
                  <View style={styles.countryStat}>
                    <CurrencyText amount={c.revenue} currency={c.code} style={[styles.countryStatVal, { color: colors.primary }]} />
                    <Text style={[styles.countryStatLbl, { color: colors.textMuted }]}>متوقع</Text>
                  </View>
                  <View style={[styles.countryDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.countryStat}>
                    <CurrencyText amount={c.collected} currency={c.code} style={[styles.countryStatVal, { color: colors.success }]} />
                    <Text style={[styles.countryStatLbl, { color: colors.textMuted }]}>محصّل</Text>
                  </View>
                  <View style={[styles.countryDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.countryStat}>
                    <CurrencyText amount={c.overdue} currency={c.code} style={[styles.countryStatVal, { color: colors.danger }]} />
                    <Text style={[styles.countryStatLbl, { color: colors.textMuted }]}>متأخر</Text>
                  </View>
                  <View style={[styles.countryDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.countryStat}>
                    <Text style={[styles.countryStatVal, { color: c.rate >= 80 ? colors.success : c.rate >= 50 ? colors.warning : colors.danger }]}>{c.rate}%</Text>
                    <Text style={[styles.countryStatLbl, { color: colors.textMuted }]}>تحصيل</Text>
                  </View>
                </View>

                {/* Collection Progress */}
                <View style={[styles.progressBg, { backgroundColor: colors.border, marginTop: 8 }]}>
                  <View style={[styles.progressFill, {
                    width: `${Math.min(c.rate, 100)}%` as any,
                    backgroundColor: c.rate >= 80 ? colors.success : c.rate >= 50 ? colors.warning : colors.danger,
                  }]} />
                </View>
              </View>
            ))}

            {/* Summary across all countries */}
            {byCountry.length > 1 && (
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>ملخص الدول ({byCountry.length})</Text>
                {byCountry.map((c, i) => (
                  <View key={c.code} style={[styles.tableRow, i < byCountry.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <View style={styles.countryTableLeft}>
                      <Text style={[styles.tdName, { color: colors.text }]}>{c.country}</Text>
                      <Text style={[styles.countrySub, { color: colors.textMuted }]}>{c.meta.symbol}</Text>
                    </View>
                    <View style={styles.countryTableRight}>
                      <CurrencyText amount={c.revenue} currency={c.code} style={[styles.tdValue, { color: colors.primary }]} />
                      <Text style={[styles.ownerRate, { color: c.rate >= 80 ? colors.success : c.rate >= 50 ? colors.warning : colors.danger }]}>{c.rate}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Country filter
  countrySection: { paddingHorizontal: Theme.spacing.base, paddingTop: Theme.spacing.sm, gap: 8 },
  countryHeader:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  countryHeaderText: { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.semibold },
  countryChips:   { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Theme.radius.full, borderWidth: 1.5,
  },
  chipText:  { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  chipSub:   { fontSize: Theme.fontSize.xs },
  filterBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Theme.radius.md, borderWidth: 1,
  },
  filterBannerText: { flex: 1, fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.semibold },

  // Period / Tabs
  periodRow: {
    flexDirection: 'row', margin: Theme.spacing.base,
    borderRadius: Theme.radius.lg, borderWidth: 1, padding: 4, gap: 4,
  },
  periodBtn:  { flex: 1, paddingVertical: 8, borderRadius: Theme.radius.md, alignItems: 'center' },
  periodText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  tabScroll:  { marginHorizontal: Theme.spacing.base, marginBottom: 4 },
  tabRow:     { flexDirection: 'row', borderRadius: Theme.radius.lg, borderWidth: 1, padding: 4, gap: 4 },
  tabBtn:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Theme.radius.md, alignItems: 'center', flexDirection: 'row', gap: 4 },
  tabText:    { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  tabBadge:   { width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  tabBadgeText: { fontSize: 9, color: '#FFF', fontWeight: '700' },

  // KPIs
  kpiGrid:        { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Theme.spacing.base, gap: Theme.spacing.sm, marginBottom: 4 },
  kpiGridDesktop: { flexWrap: 'nowrap' },
  kpiCard:        { width: '48%', flexGrow: 1, borderRadius: Theme.radius.lg, borderWidth: 1, padding: Theme.spacing.md, gap: 4, alignItems: 'flex-start' },
  kpiCardDesktop: { width: undefined, flex: 1 },
  kpiIcon:        { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  kpiVal:         { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  kpiLbl:         { fontSize: Theme.fontSize.xs, textAlign: 'right' },
  splitCard:      { marginHorizontal: Theme.spacing.base, marginTop: Theme.spacing.sm, padding: Theme.spacing.md, borderRadius: Theme.radius.lg, borderWidth: 1, gap: 10 },
  splitHeader:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  splitTitle:     { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  splitRow:       { flexDirection: 'row', alignItems: 'center' },
  splitItem:      { flex: 1, alignItems: 'center', gap: 4 },
  splitDotRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  splitDot:       { width: 8, height: 8, borderRadius: 4 },
  splitLabel:     { fontSize: Theme.fontSize.xs },
  splitVal:       { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold },
  splitDivider:   { width: 1, height: 34 },
  splitHint:      { fontSize: Theme.fontSize.xs, textAlign: 'center', lineHeight: 16 },

  // Shared section
  section: {
    marginHorizontal: Theme.spacing.base, marginBottom: Theme.spacing.sm,
    borderRadius: Theme.radius.lg, borderWidth: 1, padding: Theme.spacing.md,
  },
  sectionTitle: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, marginBottom: 12, textAlign: 'right' },
  progressBg:   { height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 5 },
  progressLabel:{ fontSize: Theme.fontSize.sm, textAlign: 'right' },

  // Bar chart
  barChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 130 },
  barItem:  { flex: 1, alignItems: 'center', gap: 3 },
  barWrap:  { height: BAR_MAX_H, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  bar:      { width: '80%', borderRadius: 4, minHeight: 4 },
  barValue: { fontSize: 9, textAlign: 'center' },
  barLabel: { fontSize: 9, textAlign: 'center' },

  // Table
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 8, borderBottomWidth: 1 },
  thName:  { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  thLabel: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  tableRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  tdName:  { fontSize: Theme.fontSize.base, flex: 1, textAlign: 'right' },
  tdValue: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  noData:  { textAlign: 'center', paddingVertical: 16 },

  // Desktop 2-col
  overviewDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  overviewLeft:    { flex: 2 },
  overviewRight:   { flex: 1 },

  // Owners
  ownerRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  ownerAvatar:      { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  ownerAvatarText:  { fontSize: 16, fontWeight: '700' },
  ownerInfo:        { flex: 1, gap: 3 },
  ownerName:        { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  ownerSub:         { fontSize: Theme.fontSize.xs, textAlign: 'right' },
  miniProgress:     { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 2 },
  miniProgressFill: { height: '100%', borderRadius: 3 },
  ownerAmounts:     { alignItems: 'flex-end', gap: 2 },
  ownerRevenue:     { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  ownerCollected:   { fontSize: Theme.fontSize.xs },
  ownerRate:        { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },

  // Overdue
  overdueSummary: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, marginBottom: 4 },
  overdueTotal:   { fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold },
  overdueSub:     { fontSize: Theme.fontSize.sm },
  noOverdue:      { alignItems: 'center', gap: 10, paddingVertical: 20 },
  overdueRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  overdueInfo:    { flex: 1, gap: 2 },
  overdueTenant:  { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  overdueLocation:{ fontSize: Theme.fontSize.xs, textAlign: 'right' },
  overdueDate:    { fontSize: Theme.fontSize.xs, textAlign: 'right' },
  overdueAmount:  { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },

  // Countries tab cards
  countryCard: {
    marginHorizontal: Theme.spacing.base, marginBottom: Theme.spacing.sm,
    borderRadius: Theme.radius.xl, borderWidth: 1, padding: Theme.spacing.md,
  },
  countryCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  countryCodeBadge:  { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Theme.radius.md },
  countryCodeText:   { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },
  countryCardTitle:  { flex: 1 },
  countryName:       { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  countrySub:        { fontSize: Theme.fontSize.xs, textAlign: 'right' },
  countryFilterBtn:  { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: Theme.radius.md },
  countryFilterBtnText: { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.semibold },

  countryStatsRow:  { flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1 },
  countryStat:      { flex: 1, alignItems: 'center', gap: 2 },
  countryStatVal:   { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },
  countryStatLbl:   { fontSize: 10 },
  countryDivider:   { width: 1, height: 30 },

  countryTableLeft:  { flex: 1, gap: 2 },
  countryTableRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  // Horizontal country cards (overview tab)
  countryScroll:        { marginBottom: 4 },
  countryScrollContent: { paddingHorizontal: Theme.spacing.base, gap: 10, paddingVertical: 4 },
  countryCardName:      { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  countryStats:         { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  countryDiv:           { width: 1, height: 28, marginHorizontal: 4 },
  sarCard:              { minWidth: 260 },
  sarNote:              { fontSize: 9, textAlign: 'center', marginTop: 6 },
});
