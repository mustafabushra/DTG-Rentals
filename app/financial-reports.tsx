import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Share, Platform, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { AppHeader } from '../components/ui/AppHeader';
import { CurrencyText } from '../components/ui/CurrencyText';
import { useAppTheme } from '../hooks/useAppTheme';

type Period = '1m' | '3m' | '6m' | '1y';

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const BAR_MAX_H = 100;

export default function FinancialReportsScreen() {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const isMobile  = width < 768;
  const isDesktop = width >= 1024;
  const { payments, contracts, properties, units, owners, tenants } = useApp();
  const [period, setPeriod] = useState<Period>('6m');
  const [activeTab, setActiveTab] = useState<'overview' | 'owners' | 'overdue'>('overview');

  const periodMonths: Record<Period, number> = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 };
  const months = periodMonths[period];

  const stats = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1).toISOString().split('T')[0];
    const periodPayments = payments.filter(p => (p.paidDate && p.paidDate >= cutoff) || (p.dueDate >= cutoff && p.status !== 'paid'));

    const periodEnd = now.toISOString().split('T')[0];
    const totalRevenue = contracts
      .filter(c => c.startDate <= periodEnd && c.endDate >= cutoff)
      .reduce((s, c) => {
        const overlapStart = c.startDate > cutoff    ? c.startDate : cutoff;
        const overlapEnd   = c.endDate   < periodEnd ? c.endDate   : periodEnd;
        const overlapDays  = Math.ceil((new Date(overlapEnd).getTime() - new Date(overlapStart).getTime()) / 86400000) + 1;
        return s + Math.round(c.annualValue * (overlapDays / 365));
      }, 0);
    const collected = periodPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
    const overdue = periodPayments.filter(p => p.status === 'overdue').reduce((s, p) => s + p.amount, 0);
    const collectionRate = totalRevenue > 0 ? Math.min(100, Math.round((collected / totalRevenue) * 100)) : 0;

    // Monthly bar data (last N months)
    const barData: { month: string; value: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthPaid = payments.filter(p => p.paidDate?.startsWith(monthStr)).reduce((s, p) => s + p.amount, 0);
      barData.push({ month: MONTHS_AR[d.getMonth()], value: monthPaid });
    }

    // Property distribution
    const byProperty = properties.map(prop => {
      const propUnits = units.filter(u => u.propertyId === prop.id);
      const propContracts = contracts.filter(c => propUnits.find(u => u.id === c.unitId) && c.status === 'active');
      const revenue = propContracts.reduce((s, c) => s + Math.round(c.annualValue / 12 * months), 0);
      return { name: prop.name, revenue };
    }).filter(p => p.revenue > 0).sort((a, b) => b.revenue - a.revenue);

    // Owner distribution
    const byOwner = owners.map(owner => {
      const ownerProps = properties.filter(p => p.ownerId === owner.id);
      const ownerUnits = units.filter(u => ownerProps.find(p => p.id === u.propertyId));
      const ownerContracts = contracts.filter(c => ownerUnits.find(u => u.id === c.unitId));
      const ownerRevenue = ownerContracts
        .filter(c => c.status === 'active')
        .reduce((s, c) => s + Math.round(c.annualValue / 12 * months), 0);
      const ownerCollected = payments
        .filter(p => ownerContracts.find(c => c.id === p.contractId) && p.status === 'paid' && (p.paidDate ?? '') >= cutoff)
        .reduce((s, p) => s + p.amount, 0);
      return { name: owner.name, revenue: ownerRevenue, collected: ownerCollected, unitCount: ownerUnits.length };
    }).filter(o => o.unitCount > 0).sort((a, b) => b.revenue - a.revenue);

    // Overdue breakdown
    const overdueList = payments
      .filter(p => p.status === 'overdue')
      .map(p => {
        const c = contracts.find(cc => cc.id === p.contractId);
        const t = c ? tenants.find(tt => tt.id === c.tenantId) : null;
        const u = c ? units.find(uu => uu.id === c.unitId) : null;
        const prop = u ? properties.find(pp => pp.id === u.propertyId) : null;
        return { id: p.id, amount: p.amount, dueDate: p.dueDate, tenantName: t?.name ?? '—', propertyName: prop?.name ?? '—', unitNum: u?.number ?? '—' };
      }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return { totalRevenue, collected, overdue, collectionRate, barData, byProperty, byOwner, overdueList };
  }, [payments, contracts, properties, units, owners, tenants, months]);

  const maxBar = Math.max(...stats.barData.map(d => d.value), 1);
  const periodOptions: { label: string; value: Period }[] = [
    { label: 'شهر', value: '1m' }, { label: '3 أشهر', value: '3m' },
    { label: '6 أشهر', value: '6m' }, { label: 'سنة', value: '1y' },
  ];

  const handleExport = async () => {
    const lines = [
      `تقرير مالي — ${new Date().toLocaleDateString('ar-SA')}`,
      `الفترة: ${period === '1m' ? 'شهر' : period === '3m' ? '3 أشهر' : period === '6m' ? '6 أشهر' : 'سنة'}`,
      '',
      `الإيرادات المتوقعة,${stats.totalRevenue}`,
      `المحصّلة,${stats.collected}`,
      `المتأخرة,${stats.overdue}`,
      `نسبة التحصيل,${stats.collectionRate}%`,
      '',
      'الإيرادات الشهرية',
      ...stats.barData.map(d => `${d.month},${d.value}`),
      '',
      'إيرادات حسب العقار',
      ...stats.byProperty.map(p => `${p.name},${p.revenue}`),
      '',
      'إيرادات حسب المالك',
      ...stats.byOwner.map(o => `${o.name},${o.revenue},${o.collected}`),
      '',
      'الدفعات المتأخرة',
      'المستأجر,العقار,الوحدة,المبلغ,تاريخ الاستحقاق',
      ...stats.overdueList.map(o => `${o.tenantName},${o.propertyName},${o.unitNum},${o.amount},${o.dueDate}`),
    ].join('\n');

    if (Platform.OS === 'web') {
      const blob = new Blob([lines], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial_report_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      await Share.share({ message: lines, title: 'تقرير مالي' });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="التقارير المالية" rightAction={{ icon: 'share-outline', onPress: handleExport }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Period Selector */}
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

        {/* Tab Row — flex on desktop, each tab equal */}
        <View style={[styles.tabRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {([
            { key: 'overview', label: 'نظرة عامة' },
            { key: 'owners',   label: 'الملاك' },
            { key: 'overdue',  label: 'المتأخرات' },
          ] as { key: typeof activeTab; label: string }[]).map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, activeTab === t.key && { backgroundColor: colors.primary }]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[styles.tabText, { color: activeTab === t.key ? '#FFF' : colors.textSecondary }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* KPI Row — 4 cols desktop, 2 cols mobile */}
        <View style={[styles.kpiGrid, isDesktop && styles.kpiGridDesktop]}>
          {[
            { label: 'الإيرادات المتوقعة', amount: stats.totalRevenue, color: colors.primary, icon: 'trending-up-outline' },
            { label: 'المحصّلة', amount: stats.collected, color: colors.success, icon: 'checkmark-circle-outline' },
            { label: 'المتأخرة', amount: stats.overdue, color: colors.danger, icon: 'alert-circle-outline' },
            { label: 'نسبة التحصيل', text: `${stats.collectionRate}%`, color: colors.secondary, icon: 'pie-chart-outline' },
          ].map(kpi => (
            <View key={kpi.label} style={[styles.kpiCard, isDesktop && styles.kpiCardDesktop, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.kpiIcon, { backgroundColor: `${kpi.color}20` }]}>
                <Ionicons name={kpi.icon as any} size={18} color={kpi.color} />
              </View>
              {'amount' in kpi
                ? <CurrencyText amount={kpi.amount} style={[styles.kpiVal, { color: kpi.color }]} />
                : <Text style={[styles.kpiVal, { color: kpi.color }]}>{kpi.text}</Text>
              }
              <Text style={[styles.kpiLbl, { color: colors.textMuted }]}>{kpi.label}</Text>
            </View>
          ))}
        </View>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <View style={[isDesktop && styles.overviewDesktop]}>
            {/* Left column on desktop: collection rate + bar chart */}
            <View style={isDesktop ? styles.overviewLeft : undefined}>
              {/* Collection Rate Bar */}
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>نسبة التحصيل</Text>
                <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
                  <View style={[styles.progressFill, { width: `${stats.collectionRate}%` as any, backgroundColor: stats.collectionRate >= 80 ? colors.success : stats.collectionRate >= 50 ? colors.warning : colors.danger }]} />
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

            {/* Right column on desktop: property table */}
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
                        <CurrencyText amount={p.revenue} style={[styles.tdValue, { color: colors.success }]} />
                        <Text style={[styles.tdName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ── OWNERS TAB ── */}
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
                    <CurrencyText amount={o.revenue} style={[styles.ownerRevenue, { color: colors.primary }]} />
                    <CurrencyText amount={o.collected} style={[styles.ownerCollected, { color: colors.success }]} />
                    <Text style={[styles.ownerRate, { color: rate >= 80 ? colors.success : rate >= 50 ? colors.warning : colors.danger }]}>{rate}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── OVERDUE TAB ── */}
        {activeTab === 'overdue' && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.overdueSummary}>
              <Ionicons name="alert-circle-outline" size={24} color={colors.danger} />
              <CurrencyText amount={stats.overdue} style={[styles.overdueTotal, { color: colors.danger }]} />
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
                <CurrencyText amount={o.amount} style={[styles.overdueAmount, { color: colors.danger }]} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  periodRow: {
    flexDirection: 'row', margin: Theme.spacing.base,
    borderRadius: Theme.radius.lg, borderWidth: 1, padding: 4, gap: 4,
  },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: Theme.radius.md, alignItems: 'center' },
  periodText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Theme.spacing.base, gap: Theme.spacing.sm, marginBottom: 4 },
  kpiGridDesktop: { flexWrap: 'nowrap' },
  kpiCard: { width: '48%', flexGrow: 1, borderRadius: Theme.radius.lg, borderWidth: 1, padding: Theme.spacing.md, gap: 4, alignItems: 'flex-start' },
  kpiCardDesktop: { width: undefined, flex: 1 },
  kpiIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  kpiVal: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  kpiLbl: { fontSize: Theme.fontSize.xs, textAlign: 'right' },
  section: {
    marginHorizontal: Theme.spacing.base, marginBottom: Theme.spacing.sm,
    borderRadius: Theme.radius.lg, borderWidth: 1, padding: Theme.spacing.md,
  },
  sectionTitle: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, marginBottom: 12, textAlign: 'right' },
  progressBg: { height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 6 },
  progressLabel: { fontSize: Theme.fontSize.sm, textAlign: 'right' },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 130 },
  barItem: { flex: 1, alignItems: 'center', gap: 3 },
  barWrap: { height: BAR_MAX_H, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  bar: { width: '80%', borderRadius: 4, minHeight: 4 },
  barValue: { fontSize: 9, textAlign: 'center' },
  barLabel: { fontSize: 9, textAlign: 'center' },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 8, borderBottomWidth: 1 },
  thName: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  thLabel: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  tdName: { fontSize: Theme.fontSize.base, flex: 1, textAlign: 'right' },
  tdValue: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  noData: { textAlign: 'center', paddingVertical: 16 },

  // Desktop overview 2-column layout
  overviewDesktop: { flexDirection: 'row', alignItems: 'flex-start', gap: 0 },
  overviewLeft:    { flex: 2 },
  overviewRight:   { flex: 1 },

  tabRow: {
    flexDirection: 'row', marginHorizontal: Theme.spacing.base, marginBottom: 4,
    borderRadius: Theme.radius.lg, borderWidth: 1, padding: 4, gap: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: Theme.radius.md, alignItems: 'center' },
  tabText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },

  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  ownerAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  ownerAvatarText: { fontSize: 16, fontWeight: '700' },
  ownerInfo: { flex: 1, gap: 3 },
  ownerName: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  ownerSub: { fontSize: Theme.fontSize.xs, textAlign: 'right' },
  miniProgress: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 2 },
  miniProgressFill: { height: '100%', borderRadius: 3 },
  ownerAmounts: { alignItems: 'flex-end', gap: 2 },
  ownerRevenue: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  ownerCollected: { fontSize: Theme.fontSize.xs },
  ownerRate: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },

  overdueSummary: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, marginBottom: 4 },
  overdueTotal: { fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold },
  overdueSub: { fontSize: Theme.fontSize.sm },
  noOverdue: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  overdueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  overdueInfo: { flex: 1, gap: 2 },
  overdueTenant: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  overdueLocation: { fontSize: Theme.fontSize.xs, textAlign: 'right' },
  overdueDate: { fontSize: Theme.fontSize.xs, textAlign: 'right' },
  overdueAmount: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
});
