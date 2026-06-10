import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { KPICard } from '../../components/ui/KPICard';
import { ListSkeleton, StatSkeleton } from '../../components/ui/Skeleton';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatCurrency, formatDate } from '../../data/mockData';
import { useScreenSize } from '../../hooks/useScreenSize';
import { useSidebar } from '../../context/SidebarContext';
import { trackScreen } from '../../lib/analytics';
import { useAppTheme } from '../../hooks/useAppTheme';
import { SmartAlert, buildSmartAlert } from '../../components/dashboard/SmartAlert';
import { CollectionProgress } from '../../components/dashboard/CollectionProgress';
import { RevenueComparison } from '../../components/dashboard/RevenueComparison';
import { TenantStats } from '../../components/dashboard/TenantStats';
import { ExpiringContracts } from '../../components/dashboard/ExpiringContracts';
import { DuePayments } from '../../components/dashboard/DuePayments';
import { VacantUnits } from '../../components/dashboard/VacantUnits';
import { RevenueChart } from '../../components/dashboard/RevenueChart';

const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                       'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

const TL_CFG = {
  payment:         { color: '#2E86C1', icon: 'cash-outline',            label: 'دفعة',         bg: '#EBF5FB' },
  contract_expiry: { color: '#E74C3C', icon: 'document-text-outline',   label: 'انتهاء عقد',   bg: '#FDEDEC' },
  file_expiry:     { color: '#8E44AD', icon: 'document-attach-outline', label: 'انتهاء مرفق',  bg: '#F5EEF8' },
  maintenance:     { color: '#F39C12', icon: 'construct-outline',       label: 'صيانة',        bg: '#FEF9E7' },
  manual:          { color: '#27AE60', icon: 'calendar-outline',        label: 'حدث',          bg: '#E8F8F0' },
} as const;

function tlUrgencyColor(days: number): string {
  if (days < 0)  return '#E74C3C';
  if (days <= 3) return '#E74C3C';
  if (days <= 7) return '#F39C12';
  if (days <= 14) return '#8E44AD';
  return '#2E86C1';
}

function tlUrgencyLabel(days: number): string {
  if (days < 0)  return `متأخر ${Math.abs(days)}ي`;
  if (days === 0) return 'اليوم';
  if (days === 1) return 'غداً';
  return `${days} يوم`;
}

function formatTlDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${ARABIC_MONTHS[Number(m) - 1]}`;
}

function daysFromNow(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

// ─── Occupancy helpers ────────────────────────────────────────────────────────

function occupancyColor(rate: number, colors: Record<string, string>): string {
  if (rate >= 80) return colors.success  ?? '#27AE60';
  if (rate >= 50) return colors.warning  ?? '#F39C12';
  return colors.danger ?? '#E74C3C';
}

interface OccupancyBarProps {
  rate:   number;
  color:  string;
  height?: number;
  colors: Record<string, string>;
}
function OccupancyBar({ rate, color, height = 8, colors }: OccupancyBarProps) {
  return (
    <View style={[barStyles.track, { height, backgroundColor: colors.border }]}>
      <View style={[barStyles.fill, { width: `${rate}%`, backgroundColor: color, height }]} />
    </View>
  );
}
const barStyles = StyleSheet.create({
  track: { borderRadius: 99, overflow: 'hidden', width: '100%' },
  fill:  { borderRadius: 99 },
});

const { width } = Dimensions.get('window');

// Defined outside component — colors injected at render time via a factory
// writeOnly: true = يحتاج صلاحية كتابة (مخفي للـ viewer)
const makeQuickActions = (colors: Record<string, string>) => [
  {
    icon: 'add-circle-outline', label: 'إضافة عقار',
    color: colors.primary,   iconBg: colors.primarySubtle,
    tileBg: colors.card,     borderColor: colors.primarySubtle,
    route: '/add-property',  writeOnly: true,
  },
  {
    icon: 'person-add-outline', label: 'إضافة مستأجر',
    color: colors.warning,   iconBg: colors.warningSubtle,
    tileBg: colors.card,     borderColor: colors.warningSubtle,
    route: '/add-tenant',    writeOnly: true,
  },
  {
    icon: 'cash-outline', label: 'تسجيل دفعة',
    color: colors.success,   iconBg: colors.successSubtle,
    tileBg: colors.card,     borderColor: colors.successSubtle,
    route: '/record-payment', writeOnly: true,
  },
  {
    icon: 'construct-outline', label: 'طلب صيانة',
    color: colors.danger,    iconBg: colors.dangerSubtle,
    tileBg: colors.card,     borderColor: colors.dangerSubtle,
    route: '/add-maintenance', writeOnly: true,
  },
  {
    icon: 'calendar-outline', label: 'التقويم',
    color: colors.secondary, iconBg: `${colors.secondary}22`,
    tileBg: colors.card,     borderColor: `${colors.secondary}33`,
    route: '/calendar',      writeOnly: false,
  },
  {
    icon: 'receipt-outline', label: 'سجل العمليات',
    color: colors.textSecondary, iconBg: colors.surface,
    tileBg: colors.card,         borderColor: colors.border,
    route: '/audit-log',     writeOnly: false,
  },
];

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { kpis, payments, contracts, maintenance, auditLogs, currentUser,
          owners, units, properties, tenants, calendarEvents, attachments, dataLoading, canWrite, refreshData } = useApp();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  useEffect(() => { trackScreen('Dashboard'); }, []);

  // ── Occupancy calculations ─────────────────────────────────────────────────

  const occupancy = useMemo(() => {
    // Overall
    const total   = units.length;
    const rented  = units.filter(u => u.status === 'rented').length;
    const vacant  = units.filter(u => u.status === 'vacant').length;
    const overall = total > 0 ? Math.round((rented / total) * 100) : 0;

    // Per-owner: unit.ownerId takes priority; fallback = property.ownerId
    const byOwner = owners.map(owner => {
      const ownerUnits = units.filter(unit => {
        if ((unit as any).ownerId) return (unit as any).ownerId === owner.id;
        const prop = properties.find(p => p.id === unit.propertyId);
        return prop?.ownerId === owner.id;
      });
      const oRented  = ownerUnits.filter(u => u.status === 'rented').length;
      const oTotal   = ownerUnits.length;
      const oVacant  = ownerUnits.filter(u => u.status === 'vacant').length;
      const oMaint   = ownerUnits.filter(u => u.status === 'maintenance').length;
      const oRate    = oTotal > 0 ? Math.round((oRented / oTotal) * 100) : 0;
      // Count distinct properties this owner has units in
      const propIds  = new Set(ownerUnits.map(u => u.propertyId));
      return { owner, total: oTotal, rented: oRented, vacant: oVacant, maintenance: oMaint, rate: oRate, propCount: propIds.size };
    }).filter(o => o.total > 0).sort((a, b) => b.rate - a.rate);

    return { total, rented, vacant, overall, byOwner };
  }, [owners, units, properties]);

  const alerts = useMemo(() => {
    const overduePayments = payments.filter(p => p.status === 'overdue');
    const expiringContracts = contracts.filter(c => {
      if (c.status !== 'active') return false;
      const end = new Date(c.endDate);
      const now = new Date();
      const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 90 && diff > 0;
    });
    return { overduePayments, expiringContracts };
  }, [payments, contracts]);

  // ── Upcoming timeline (next 60 days) ──────────────────────────────────────
  const upcomingTimeline = useMemo(() => {
    const isOwner = currentUser?.role === 'owner' || currentUser?.role === 'مالك';

    // Find owner record matching current user (by id or name)
    const ownerRecord = isOwner
      ? owners.find(o => o.id === currentUser?.id || o.name === currentUser?.name)
      : null;

    // IDs of properties/contracts relevant to this owner
    const ownerPropIds = ownerRecord
      ? new Set(properties.filter(p => p.ownerId === ownerRecord.id).map(p => p.id))
      : null;
    const ownerContractIds = ownerPropIds
      ? new Set(contracts.filter(c => {
          const u = units.find(u => u.id === c.unitId);
          return u ? ownerPropIds!.has(u.propertyId) : false;
        }).map(c => c.id))
      : null;
    const ownerPaymentIds = ownerContractIds
      ? new Set(payments.filter(p => ownerContractIds!.has(p.contractId ?? '')).map(p => p.id))
      : null;

    type TlEvent = { id: string; title: string; date: string; type: keyof typeof TL_CFG; entityType: string; entityId: string; notes?: string; subtitle?: string; overdue?: boolean };
    const events: TlEvent[] = [];

    // 1. Manual calendar events
    calendarEvents.forEach(e => {
      events.push({ id: e.id, title: e.title, date: e.date, type: e.type as keyof typeof TL_CFG, entityType: e.entityType ?? 'manual', entityId: e.entityId ?? e.id, notes: e.notes });
    });

    // 2. Active contract expiry
    contracts
      .filter(c => c.status === 'active' && (!ownerContractIds || ownerContractIds.has(c.id)))
      .forEach(c => {
        const unit     = units.find(u => u.id === c.unitId);
        const property = unit ? properties.find(p => p.id === unit.propertyId) : null;
        const tenant   = tenants.find(t => t.id === c.tenantId);
        const location = [property?.name, unit ? `وحدة ${unit.number}` : null].filter(Boolean).join(' — ');
        events.push({
          id: `dyn_ce_${c.id}`,
          title: tenant?.name ?? c.contractNumber ?? c.id,
          date: c.endDate,
          type: 'contract_expiry',
          entityType: 'contract',
          entityId: c.id,
          subtitle: location || c.contractNumber,
          notes: `${c.annualValue?.toLocaleString('en-US') ?? '—'} ﷼ سنوياً`,
        });
      });

    // 3. Pending / overdue payments
    payments
      .filter(p => (p.status === 'pending' || p.status === 'overdue') && (!ownerPaymentIds || ownerPaymentIds.has(p.id)))
      .forEach(p => {
        const contract = contracts.find(c => c.id === p.contractId);
        const unit     = contract ? units.find(u => u.id === contract.unitId) : null;
        const property = unit ? properties.find(pr => pr.id === unit.propertyId) : null;
        const tenant   = contract ? tenants.find(t => t.id === contract.tenantId) : null;
        const location = [property?.name, unit ? `وحدة ${unit.number}` : null].filter(Boolean).join(' — ');
        events.push({
          id: `dyn_pe_${p.id}`,
          title: tenant?.name ?? `دفعة ${(p.amount ?? 0).toLocaleString('en-US')} ﷼`,
          date: p.dueDate ?? '',
          type: 'payment',
          entityType: 'payment',
          entityId: p.id,
          subtitle: location || contract?.contractNumber,
          notes: `${(p.amount ?? 0).toLocaleString('en-US')} ﷼`,
          overdue: p.status === 'overdue',
        });
      });

    // 4. Open maintenance
    maintenance
      .filter(m => m.openedAt && m.status !== 'completed' && m.status !== 'cancelled')
      .filter(m => {
        if (!ownerPropIds) return true;
        const unit = units.find(u => u.id === m.unitId);
        return unit ? ownerPropIds.has(unit.propertyId) : false;
      })
      .forEach(m => {
        events.push({ id: `dyn_me_${m.id}`, title: `صيانة: ${m.title}`, date: m.openedAt.split('T')[0], type: 'maintenance', entityType: 'maintenance', entityId: m.id });
      });

    // 5. Attachment expiry
    attachments.filter(a => a.expiryDate).forEach(a => {
      events.push({ id: `dyn_fe_${a.id}`, title: `انتهاء: ${a.name}`, date: a.expiryDate!, type: 'file_expiry', entityType: 'attachment', entityId: a.id });
    });

    // Deduplicate, filter next 60 days (include overdue too — up to -30)
    const seen = new Set<string>();
    return events
      .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; })
      .filter(e => { const d = daysFromNow(e.date); return d >= -30 && d <= 60; })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 12);
  }, [calendarEvents, contracts, payments, maintenance, attachments, currentUser, owners, properties, units]);

  const recentActivity = [...auditLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5);
  const QUICK_ACTIONS  = makeQuickActions(colors).filter(a => canWrite || !a.writeOnly);
  const { isWide, cols3, isDesktop, isMobile, isSmallPhone, hPad } = useScreenSize();
  const { toggle: toggleSidebar } = useSidebar();

  // ── Dynamic rented-units trend (new active contracts this month) ───────────
  const rentedTrend = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const newThisMonth = contracts.filter(c => c.status === 'active' && c.createdAt?.startsWith(thisMonth)).length;
    if (newThisMonth === 0) return undefined;
    return `+${newThisMonth} هذا الشهر`;
  }, [contracts]);

  // ── Dashboard data calculations ───────────────────────────────────────────

  // 1. Collection progress — this month's paid vs total due
  const collectionData = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthPayments = payments.filter(p => p.dueDate?.startsWith(thisMonth));
    const collected = monthPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
    const totalDue  = monthPayments.reduce((s, p) => s + p.amount, 0);
    return { collected, totalDue };
  }, [payments]);

  // 2. Expiring contracts (≤30 days)
  const expiringContracts = useMemo(() => {
    const today = new Date();
    return contracts
      .filter(c => c.status === 'active')
      .map(c => {
        const end = new Date(c.endDate);
        const daysLeft = Math.ceil((end.getTime() - today.getTime()) / 86400000);
        const unit     = units.find(u => u.id === c.unitId);
        const tenant   = tenants.find(t => t.id === c.tenantId);
        return { id: c.id, contractNumber: c.contractNumber, unitNumber: unit?.number ?? '—', tenantName: tenant?.name ?? '—', endDate: c.endDate, daysLeft };
      })
      .filter(c => c.daysLeft >= 0 && c.daysLeft <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [contracts, units, tenants]);

  // 3. Due payments — today & this week
  const duePaymentsData = useMemo(() => {
    const today   = new Date().toISOString().split('T')[0];
    const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const pending = payments.filter(p => p.status === 'pending' || p.status === 'overdue');
    const buildRow = (p: typeof payments[0]) => {
      const contract = contracts.find(c => c.id === p.contractId);
      const unit     = contract ? units.find(u => u.id === contract.unitId) : null;
      const tenant   = contract ? tenants.find(t => t.id === contract.tenantId) : null;
      return {
        id: p.id, tenantName: tenant?.name ?? '—', unitNumber: unit?.number ?? '—',
        amount: p.amount, dueDate: p.dueDate, status: p.status as 'pending' | 'overdue',
        currency: contract ? undefined : undefined,
      };
    };
    const todayP = pending.filter(p => p.dueDate <= today).map(buildRow);
    const weekP  = pending.filter(p => p.dueDate > today && p.dueDate <= in7days).map(buildRow);
    return { today: todayP, week: weekP };
  }, [payments, contracts, units, tenants]);

  // 4. Revenue comparison — this month vs last month
  const revenueComparison = useMemo(() => {
    const now   = new Date();
    const thisM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastM = `${prevM.getFullYear()}-${String(prevM.getMonth() + 1).padStart(2, '0')}`;
    const sum = (month: string) =>
      payments.filter(p => p.status === 'paid' && p.paidDate?.startsWith(month)).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return { currentMonth: sum(thisM), lastMonth: sum(lastM) };
  }, [payments]);

  // 5. Vacant units with days vacant
  const vacantUnitsData = useMemo(() => {
    const vacant = units.filter(u => u.status === 'vacant' || u.status === 'maintenance');
    return vacant.map(u => {
      const prop = properties.find(p => p.id === u.propertyId);
      // Estimate vacant since: find last contract end date for this unit
      const lastContract = contracts
        .filter(c => c.unitId === u.id && c.status !== 'active')
        .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
      const vacantDays = lastContract
        ? Math.max(0, Math.ceil((Date.now() - new Date(lastContract.endDate).getTime()) / 86400000))
        : undefined;
      return { id: u.id, number: u.number, floor: u.floor, propertyName: prop?.name, vacantDays, status: u.status as 'vacant' | 'maintenance' };
    });
  }, [units, properties, contracts]);

  // 6. Tenant stats
  const tenantStats = useMemo(() => {
    const activeContractIds = new Set(contracts.filter(c => c.status === 'active').map(c => c.tenantId));
    const activeTenants = tenants.filter(t => activeContractIds.has(t.id)).length;

    // Avg tenancy in months from all contracts
    const durations = contracts
      .filter(c => c.startDate && c.endDate)
      .map(c => {
        const start = new Date(c.startDate);
        const end   = new Date(c.endDate);
        return Math.round((end.getTime() - start.getTime()) / (30 * 86400000));
      });
    const avgMonths = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    // Top payer by total paid amount
    const paidByTenant = new Map<string, number>();
    payments.filter(p => p.status === 'paid').forEach(p => {
      const c = contracts.find(con => con.id === p.contractId);
      if (c?.tenantId) paidByTenant.set(c.tenantId, (paidByTenant.get(c.tenantId) ?? 0) + p.amount);
    });
    let topTenant: { name: string; totalPaid: number; id: string } | undefined;
    paidByTenant.forEach((amt, tid) => {
      if (!topTenant || amt > topTenant.totalPaid) {
        const t = tenants.find(t => t.id === tid);
        if (t) topTenant = { name: t.name, totalPaid: amt, id: tid };
      }
    });

    return { activeTenants, avgTenancyMonths: avgMonths, topTenant };
  }, [tenants, contracts, payments]);

  // 7. 6-month revenue chart data
  const chartData = useMemo(() => {
    const months: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const revenue = payments
        .filter(p => p.status === 'paid' && p.paidDate?.startsWith(key))
        .reduce((s, p) => s + (Number(p.amount) || 0), 0);
      months.push({ month: key, revenue });
    }
    return months;
  }, [payments]);

  // 8. Smart alert
  const smartAlert = useMemo(() => {
    const vacantSinceDays: Record<string, number> = {};
    vacantUnitsData.forEach(u => { if (u.vacantDays !== undefined) vacantSinceDays[u.id] = u.vacantDays; });
    return buildSmartAlert({
      expiringContracts,
      overduePayments: kpis.overduePayments,
      collectionRate: kpis.collectionRate,
      vacantUnits: vacantUnitsData,
      vacantSinceDays,
    });
  }, [expiringContracts, kpis, vacantUnitsData]);

  const visibleAlert = smartAlert && !dismissedAlerts.has(smartAlert.id) ? smartAlert : null;

  if (dataLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 }}>
          {[0,1,2,3].map(i => <StatSkeleton key={i} />)}
        </View>
        <ListSkeleton count={3} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (isSmallPhone ? 6 : 8), paddingHorizontal: hPad, backgroundColor: '#021C36' }]}>
        <View style={styles.headerRow}>
          {Platform.OS === 'web' && !isDesktop ? (
            <TouchableOpacity style={styles.headerBtn} onPress={toggleSidebar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="menu-outline" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.push('/settings')} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={[styles.avatarCircle, isSmallPhone && { width: 32, height: 32, borderRadius: 16 }]}>
                <Text style={[styles.avatarText, isSmallPhone && { fontSize: Theme.fontSize.sm }]}>{currentUser?.name?.[0] ?? '؟'}</Text>
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.headerCenter}>
            {!isSmallPhone && (
              <Text style={styles.welcomeText} numberOfLines={1}>مرحباً، {currentUser?.name?.split(' ')[0] ?? ''}</Text>
            )}
            <Text style={[styles.appName, (isMobile || isSmallPhone) && { fontSize: Theme.fontSize.base }]}>DTG Rentals</Text>
          </View>

          <TouchableOpacity onPress={refreshData} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} disabled={dataLoading}>
            <Ionicons name="refresh-outline" size={isSmallPhone ? 20 : 22} color={dataLoading ? 'rgba(255,255,255,0.4)' : '#FFFFFF'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="notifications-outline" size={isSmallPhone ? 22 : 24} color="#FFFFFF" />
            {kpis.overduePayments > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{kpis.overduePayments}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {/* KPI Cards */}
        <View style={[styles.kpiGrid, isWide && styles.kpiGridWide, {
          padding: hPad,
          gap: isSmallPhone ? 8 : 12,
          rowGap: isSmallPhone ? 12 : 12,
        }]}>
          {isWide ? (
            <View style={[styles.kpiRow, { gap: 16 }]}>
              <KPICard label="إجمالي العقارات" value={kpis.totalProperties} icon="business-outline" color={colors.primary} />
              <KPICard label="الوحدات المؤجرة" value={kpis.rentedUnits} icon="home" color={colors.success} trend={rentedTrend ? 'up' : undefined} trendValue={rentedTrend} />
              <KPICard label="الإيرادات الشهرية" value={formatCurrency(kpis.monthlyRevenue)} icon="cash-outline" color="#8E44AD" />
              <KPICard label="طلبات مفتوحة" value={kpis.openMaintenanceRequests} icon="construct-outline" color={colors.warning} />
            </View>
          ) : (
            <>
              <View style={[styles.kpiRow, { gap: isSmallPhone ? 8 : 12 }]}>
                <KPICard label="إجمالي العقارات" value={kpis.totalProperties} icon="business-outline" color={colors.primary} />
                <KPICard label="الوحدات المؤجرة" value={kpis.rentedUnits} icon="home" color={colors.success} trend={rentedTrend ? 'up' : undefined} trendValue={rentedTrend} />
              </View>
              <View style={[styles.kpiRow, { gap: isSmallPhone ? 8 : 12 }]}>
                <KPICard label="الإيرادات الشهرية" value={formatCurrency(kpis.monthlyRevenue)} icon="cash-outline" color="#8E44AD" />
                <KPICard label="طلبات مفتوحة" value={kpis.openMaintenanceRequests} icon="construct-outline" color={colors.warning} />
              </View>
            </>
          )}
        </View>

        {/* ── Smart Alert ── */}
        {visibleAlert && (
          <View style={[styles.sectionPad, { marginTop: isSmallPhone ? 16 : 24 }]}>
            <SmartAlert alert={visibleAlert} onDismiss={id => setDismissedAlerts(prev => new Set([...prev, id]))} />
          </View>
        )}

        {/* ── Collection Progress ── */}
        <View style={[styles.sectionPad, { marginTop: isSmallPhone ? 16 : 24 }]}>
          <Text style={[styles.secLabel, { color: colors.textMuted }]}>التحصيل</Text>
          <CollectionProgress collected={collectionData.collected} totalDue={collectionData.totalDue} />
        </View>

        {/* ── Revenue Comparison + Tenant Stats ── */}
        <View style={[styles.sectionPad, { marginTop: isSmallPhone ? 16 : 24 }]}>
          <Text style={[styles.secLabel, { color: colors.textMuted }]}>المالية والمستأجرون</Text>
          {isWide ? (
            <View style={styles.rowPair}>
              <RevenueComparison currentMonth={revenueComparison.currentMonth} lastMonth={revenueComparison.lastMonth} />
              <View style={{ width: 16 }} />
              <TenantStats activeTenants={tenantStats.activeTenants} avgTenancyMonths={tenantStats.avgTenancyMonths} topTenant={tenantStats.topTenant} />
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              <RevenueComparison currentMonth={revenueComparison.currentMonth} lastMonth={revenueComparison.lastMonth} />
              <TenantStats activeTenants={tenantStats.activeTenants} avgTenancyMonths={tenantStats.avgTenancyMonths} topTenant={tenantStats.topTenant} />
            </View>
          )}
        </View>

        {/* ── Occupancy Section ── */}
        <View style={styles.sectionPad}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>نسبة الإشغال</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/properties' as any)}>
              <Text style={[styles.seeAll, { color: colors.secondary }]}>تفاصيل</Text>
            </TouchableOpacity>
          </View>

          {/* Overall card */}
          <View style={[styles.occOverallCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.occOverallTop}>
              {/* Circular rate display */}
              <View style={[styles.occRingWrap, { borderColor: occupancyColor(occupancy.overall, colors) + '30' }]}>
                <Text style={[styles.occRingPct, { color: occupancyColor(occupancy.overall, colors) }]}>
                  {occupancy.overall}%
                </Text>
                <Text style={[styles.occRingLabel, { color: colors.textMuted }]}>إشغال</Text>
              </View>

              {/* Stats */}
              <View style={styles.occOverallStats}>
                <Text style={[styles.occOverallTitle, { color: colors.text }]}>الإشغال العام</Text>
                <OccupancyBar rate={occupancy.overall} color={occupancyColor(occupancy.overall, colors)} height={10} colors={colors} />
                <View style={styles.occStatRow}>
                  <View style={styles.occStatItem}>
                    <View style={[styles.occDot, { backgroundColor: colors.success }]} />
                    <Text style={[styles.occStatVal, { color: colors.success }]}>{occupancy.rented}</Text>
                    <Text style={[styles.occStatLbl, { color: colors.textMuted }]}>مؤجرة</Text>
                  </View>
                  <View style={styles.occStatItem}>
                    <View style={[styles.occDot, { backgroundColor: colors.warning }]} />
                    <Text style={[styles.occStatVal, { color: colors.warning }]}>{occupancy.vacant}</Text>
                    <Text style={[styles.occStatLbl, { color: colors.textMuted }]}>شاغرة</Text>
                  </View>
                  <View style={styles.occStatItem}>
                    <View style={[styles.occDot, { backgroundColor: colors.textMuted }]} />
                    <Text style={[styles.occStatVal, { color: colors.text }]}>{occupancy.total}</Text>
                    <Text style={[styles.occStatLbl, { color: colors.textMuted }]}>إجمالي</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Per-owner breakdown */}
          {occupancy.byOwner.length > 0 && (
            <View style={[styles.occOwnersCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.occOwnersTitle, { color: colors.text }]}>الإشغال حسب المالك</Text>
              {occupancy.byOwner.map((item, idx) => {
                const color = occupancyColor(item.rate, colors);
                const isLast = idx === occupancy.byOwner.length - 1;
                return (
                  <TouchableOpacity
                    key={item.owner.id}
                    onPress={() => router.push(`/owner/${item.owner.id}` as any)}
                    activeOpacity={0.75}
                    style={[styles.occOwnerRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  >
                    {/* Avatar */}
                    <View style={[styles.occOwnerAvatar, { backgroundColor: color + '20' }]}>
                      <Text style={[styles.occOwnerAvatarText, { color }]}>
                        {(item.owner.name ?? '؟').trim()[0] ?? '؟'}
                      </Text>
                    </View>

                    {/* Info */}
                    <View style={styles.occOwnerInfo}>
                      <View style={styles.occOwnerTopRow}>
                        <Text style={[styles.occOwnerRate, { color }]}>{item.rate}%</Text>
                        <Text style={[styles.occOwnerName, { color: colors.text }]} numberOfLines={1}>
                          {item.owner.name}
                        </Text>
                      </View>
                      <OccupancyBar rate={item.rate} color={color} height={6} colors={colors} />
                      <View style={styles.occOwnerMeta}>
                        <Text style={[styles.occOwnerMetaText, { color: colors.textMuted }]}>
                          {item.propCount} {item.propCount === 1 ? 'عقار' : 'عقارات'}
                        </Text>
                        <Text style={[styles.occOwnerMetaText, { color: colors.textMuted }]}>·</Text>
                        <Text style={[styles.occOwnerMetaText, { color: colors.success }]}>
                          {item.rented} مؤجرة
                        </Text>
                        <Text style={[styles.occOwnerMetaText, { color: colors.textMuted }]}>·</Text>
                        <Text style={[styles.occOwnerMetaText, { color: colors.warning }]}>
                          {item.vacant} شاغرة
                        </Text>
                        <Text style={[styles.occOwnerMetaText, { color: colors.textMuted }]}>
                          / {item.total}
                        </Text>
                      </View>
                    </View>

                    <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Expiring Contracts + Due Payments ── */}
        {(expiringContracts.length > 0 || duePaymentsData.today.length > 0 || duePaymentsData.week.length > 0) && (
          <View style={[styles.sectionPad, { marginTop: isSmallPhone ? 16 : 24 }]}>
            <Text style={[styles.secLabel, { color: colors.textMuted }]}>العقود والدفعات</Text>
            {isWide ? (
              <View style={styles.rowPair}>
                {expiringContracts.length > 0 && <ExpiringContracts contracts={expiringContracts} />}
                {expiringContracts.length > 0 && <View style={{ width: 16 }} />}
                <DuePayments todayPayments={duePaymentsData.today} weekPayments={duePaymentsData.week} />
              </View>
            ) : (
              <View style={{ gap: 16 }}>
                {expiringContracts.length > 0 && <ExpiringContracts contracts={expiringContracts} />}
                <DuePayments todayPayments={duePaymentsData.today} weekPayments={duePaymentsData.week} />
              </View>
            )}
          </View>
        )}

        {/* ── Vacant Units ── */}
        <View style={[styles.sectionPad, { marginTop: isSmallPhone ? 16 : 24 }]}>
          <Text style={[styles.secLabel, { color: colors.textMuted }]}>الوحدات الشاغرة</Text>
          <VacantUnits units={vacantUnitsData} />
        </View>

        {/* ── Revenue Chart 6-month ── */}
        {chartData.some(d => d.revenue > 0) && (
          <View style={[styles.sectionPad, { marginTop: isSmallPhone ? 16 : 24 }]}>
            <Text style={[styles.secLabel, { color: colors.textMuted }]}>اتجاه الإيرادات</Text>
            <RevenueChart data={chartData} />
          </View>
        )}

        {/* Quick Actions */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>إجراءات سريعة</Text>
          <View style={[
            styles.actionsGrid,
            isWide && styles.actionsGridWide,
            isMobile && styles.actionsGridMobile,
          ]}>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={[
                  styles.actionBtn,
                  isWide && styles.actionBtnWide,
                  isMobile && styles.actionBtnMobile,
                  { backgroundColor: action.tileBg, borderColor: action.borderColor },
                ]}
                onPress={() => router.push(action.route as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: action.iconBg }]}>
                  <Ionicons name={action.icon as any} size={24} color={action.color} />
                </View>
                <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Upcoming Timeline ───────────────────────────────────────────── */}
        {upcomingTimeline.length > 0 && (
          <View style={styles.sectionPad}>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>المواعيد القادمة</Text>
              <TouchableOpacity onPress={() => router.push('/calendar' as any)}>
                <Text style={[styles.seeAll, { color: colors.secondary }]}>عرض التقويم</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.tlCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {upcomingTimeline.map((ev, idx) => {
                const cfg  = TL_CFG[ev.type] ?? TL_CFG.manual;
                const days = daysFromNow(ev.date);
                const uc   = tlUrgencyColor(days);
                const ul   = tlUrgencyLabel(days);
                const isLast = idx === upcomingTimeline.length - 1;

                const navigate = () => {
                  if (ev.entityType === 'contract')    router.push(`/contract/${ev.entityId}` as any);
                  else if (ev.entityType === 'payment') router.push(`/payment/${ev.entityId}` as any);
                  else if (ev.entityType === 'maintenance') router.push(`/maintenance/${ev.entityId}` as any);
                };

                return (
                  <TouchableOpacity
                    key={ev.id}
                    onPress={navigate}
                    activeOpacity={0.8}
                    style={[styles.tlRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  >
                    {/* Timeline dot + line */}
                    <View style={styles.tlDotCol}>
                      <View style={[styles.tlDot, { backgroundColor: cfg.color }]} />
                      {!isLast && <View style={[styles.tlConnector, { backgroundColor: colors.border }]} />}
                    </View>

                    {/* Date column */}
                    <View style={styles.tlDateCol}>
                      <Text style={[styles.tlDate, { color: days < 0 ? '#E74C3C' : days === 0 ? colors.primary : colors.text }]}>
                        {formatTlDate(ev.date)}
                      </Text>
                      <Text style={[styles.tlYear, { color: colors.textMuted }]}>
                        {ev.date.split('-')[0]}
                      </Text>
                    </View>

                    {/* Event info */}
                    <View style={styles.tlInfo}>
                      <View style={styles.tlInfoTop}>
                        <View style={[styles.tlTypeBadge, { backgroundColor: cfg.bg }]}>
                          <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
                          <Text style={[styles.tlTypeText, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                        {(ev as any).overdue && (
                          <View style={[styles.tlTypeBadge, { backgroundColor: '#FDEDEC', marginRight: 4 }]}>
                            <Ionicons name="warning-outline" size={11} color="#E74C3C" />
                            <Text style={[styles.tlTypeText, { color: '#E74C3C' }]}>متأخرة</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.tlTitle, { color: colors.text }]} numberOfLines={1}>{ev.title}</Text>
                      {(ev as any).subtitle ? (
                        <View style={styles.tlSubRow}>
                          <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                          <Text style={[styles.tlNotes, { color: colors.textMuted }]} numberOfLines={1}>{(ev as any).subtitle}</Text>
                        </View>
                      ) : null}
                      {ev.notes ? <Text style={[styles.tlNotes, { color: colors.textSecondary }]} numberOfLines={1}>{ev.notes}</Text> : null}
                    </View>

                    {/* Urgency badge */}
                    <View style={[styles.tlUrgency, { backgroundColor: uc + '18', borderColor: uc + '40' }]}>
                      <Text style={[styles.tlUrgencyText, { color: uc }]}>{ul}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Alerts */}
        {(alerts.overduePayments.length > 0 || alerts.expiringContracts.length > 0) && (
          <View style={styles.sectionPad}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>التنبيهات</Text>
            {alerts.overduePayments.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.alertCard, { backgroundColor: '#FDEDEC', borderColor: colors.danger }]}
                onPress={() => router.push(`/payment/${p.id}`)}
              >
                <View style={styles.alertContent}>
                  <Text style={[styles.alertTitle, { color: colors.danger }]}>دفعة متأخرة — {p.receiptNumber}</Text>
                  <Text style={[styles.alertSub, { color: colors.danger }]}>
                    {formatCurrency(p.amount)} — استحقاق: {formatDate(p.dueDate)}
                  </Text>
                </View>
                <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
              </TouchableOpacity>
            ))}
            {alerts.expiringContracts.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.alertCard, { backgroundColor: '#FEF9E7', borderColor: colors.warning }]}
                onPress={() => router.push(`/contract/${c.id}`)}
              >
                <View style={styles.alertContent}>
                  <Text style={[styles.alertTitle, { color: colors.warning }]}>عقد قارب على الانتهاء — {c.contractNumber}</Text>
                  <Text style={[styles.alertSub, { color: colors.warning }]}>تاريخ الانتهاء: {formatDate(c.endDate)}</Text>
                </View>
                <Ionicons name="time-outline" size={22} color={colors.warning} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Stats Row */}
        <View style={styles.sectionPad}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>ملخص مالي</Text>
          <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }, isMobile && styles.statsCardMobile]}>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: colors.success }]}>{kpis.activeContracts}</Text>
              <Text style={[styles.statLbl, { color: colors.textSecondary }]}>عقد نشط</Text>
            </View>
            {!isMobile && <View style={[styles.statDivider, { backgroundColor: colors.border }]} />}
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: colors.warning }]}>{kpis.pendingPayments}</Text>
              <Text style={[styles.statLbl, { color: colors.textSecondary }]}>دفعة معلقة</Text>
            </View>
            {!isMobile && <View style={[styles.statDivider, { backgroundColor: colors.border }]} />}
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: colors.danger }]}>{kpis.overduePayments}</Text>
              <Text style={[styles.statLbl, { color: colors.textSecondary }]}>دفعة متأخرة</Text>
            </View>
            {!isMobile && <View style={[styles.statDivider, { backgroundColor: colors.border }]} />}
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: colors.primary }]}>{kpis.collectionRate}%</Text>
              <Text style={[styles.statLbl, { color: colors.textSecondary }]}>نسبة التحصيل</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.sectionPad}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>آخر العمليات</Text>
            <TouchableOpacity onPress={() => router.push('/audit-log')}>
              <Text style={[styles.seeAll, { color: colors.secondary }]}>عرض الكل</Text>
            </TouchableOpacity>
          </View>
          {recentActivity.map(log => (
            <View key={log.id} style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.logDot, { backgroundColor: log.action === 'add' ? colors.success : log.action === 'edit' ? colors.warning : colors.danger }]} />
              <View style={styles.logContent}>
                <Text style={[styles.logTitle, { color: colors.text }]} numberOfLines={1}>{log.details}</Text>
                <Text style={[styles.logTime, { color: colors.textMuted }]}>
                  {log.userName} · {new Date(log.timestamp).toLocaleDateString('ar-SA')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  headerBtn: { padding: 6, position: 'relative', minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { alignItems: 'center', gap: 2 },
  welcomeText: { color: 'rgba(255,255,255,0.85)', fontSize: Theme.fontSize.sm, textAlign: 'center' },
  appName: { color: '#FFFFFF', fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold, textAlign: 'center' },
  notifBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#E74C3C', borderRadius: 8, width: 16, height: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  notifBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  avatarCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#C3AF76',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#021C36', fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  kpiGrid: { padding: Theme.spacing.base, gap: Theme.spacing.sm },
  kpiGridWide: { },
  kpiRow: { flexDirection: 'row', gap: Theme.spacing.sm },
  section: {
    marginHorizontal: Theme.spacing.base,
    marginTop: Theme.spacing.sm,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    padding: Theme.spacing.md,
  },
  sectionTitle: {
    fontSize: Theme.fontSize.base,
    fontWeight: Theme.fontWeight.bold,
    marginBottom: Theme.spacing.md,
    textAlign: 'right',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  actionsGridWide: {
    flexWrap: 'nowrap',
  },
  actionsGridMobile: {
    flexWrap: 'wrap',
  },
  actionBtn: {
    width: '30%',
    flexGrow: 1,
    maxWidth: '32%',
    aspectRatio: 1,
    borderRadius: Theme.radius.xl,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  actionBtnWide: {
    width: undefined,
    maxWidth: undefined,
    flex: 1,
    aspectRatio: 0.9,
  },
  actionBtnMobile: {
    width: '47%',
    maxWidth: '48%',
    aspectRatio: 1.1,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: Theme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: Theme.fontSize.xs,
    fontWeight: Theme.fontWeight.semibold,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  sectionPad: {
    paddingHorizontal: Theme.spacing.base,
    marginTop: Theme.spacing.xl,
  },
  rowPair: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flexWrap: 'nowrap',
  },
  sectionHeading: {
    fontSize: Theme.fontSize.lg,
    fontWeight: Theme.fontWeight.bold,
    marginBottom: Theme.spacing.sm,
    textAlign: 'right',
  },
  secLabel: {
    fontSize: Theme.fontSize.xs,
    fontWeight: Theme.fontWeight.semibold,
    textAlign: 'right',
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    marginBottom: Theme.spacing.sm,
    gap: 12,
  },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  alertSub: { fontSize: Theme.fontSize.sm, marginTop: 2, textAlign: 'right' },
  statsCard: {
    flexDirection: 'row',
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    padding: Theme.spacing.md,
  },
  statsCardMobile: {
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statVal: { fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold },
  statLbl: { fontSize: Theme.fontSize.xs, textAlign: 'center' },
  statDivider: { width: 1, marginVertical: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.sm },
  seeAll: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.medium },

  // ── Occupancy styles ──
  occOverallCard: {
    borderRadius: Theme.radius.xl, borderWidth: 1,
    padding: Theme.spacing.md, marginBottom: Theme.spacing.sm,
  },
  occOverallTop:  { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md },
  occRingWrap: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 3,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  occRingPct:   { fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold },
  occRingLabel: { fontSize: Theme.fontSize.xs, marginTop: -2 },
  occOverallStats: { flex: 1, gap: 8 },
  occOverallTitle: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  occStatRow:  { flexDirection: 'row', gap: 12, marginTop: 2 },
  occStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  occDot:      { width: 7, height: 7, borderRadius: 4 },
  occStatVal:  { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  occStatLbl:  { fontSize: Theme.fontSize.xs },

  occOwnersCard: {
    borderRadius: Theme.radius.xl, borderWidth: 1,
    overflow: 'hidden',
  },
  occOwnersTitle: {
    fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold,
    padding: Theme.spacing.md, paddingBottom: Theme.spacing.sm,
    textAlign: 'right',
  },
  occOwnerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Theme.spacing.md, paddingVertical: 12, gap: 10,
  },
  occOwnerAvatar: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  occOwnerAvatarText: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  occOwnerInfo:   { flex: 1, gap: 5 },
  occOwnerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  occOwnerName:   { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold, flex: 1 },
  occOwnerRate:   { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, marginStart: 6 },
  occOwnerMeta:   { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  occOwnerMetaText: { fontSize: Theme.fontSize.xs },
  // ── Timeline styles ──
  tlCard: {
    borderRadius: Theme.radius.xl, borderWidth: 1, overflow: 'hidden',
  },
  tlRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: Theme.spacing.md, paddingVertical: 12, gap: 10,
  },
  tlDotCol: { alignItems: 'center', width: 14, paddingTop: 4 },
  tlDot:    { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  tlConnector: { width: 1, flex: 1, marginTop: 4, minHeight: 20 },
  tlDateCol: { width: 54, alignItems: 'flex-end', gap: 1, paddingTop: 2 },
  tlDate:    { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  tlYear:    { fontSize: 10, textAlign: 'right' },
  tlInfo:    { flex: 1, gap: 3 },
  tlInfoTop: { flexDirection: 'row', alignItems: 'center' },
  tlTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 },
  tlTypeText:  { fontSize: 10, fontWeight: Theme.fontWeight.bold },
  tlTitle:  { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  tlNotes:  { fontSize: Theme.fontSize.xs, textAlign: 'right' },
  tlSubRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  tlUrgency: { borderWidth: 1, borderRadius: Theme.radius.lg, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 2 },
  tlUrgencyText: { fontSize: 10, fontWeight: Theme.fontWeight.bold },

  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    marginBottom: Theme.spacing.sm,
    gap: 12,
  },
  logDot: { width: 10, height: 10, borderRadius: 5, marginStart: 4 },
  logContent: { flex: 1 },
  logTitle: { fontSize: Theme.fontSize.md, textAlign: 'right' },
  logTime: { fontSize: Theme.fontSize.sm, marginTop: 2, textAlign: 'right' },
});
