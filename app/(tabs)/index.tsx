import React, { useMemo, useEffect, useState, useRef } from 'react';
import { UpcomingEvents } from '../../components/dashboard/UpcomingEvents';
import { OwnerTimeline } from '../../components/owners/OwnerTimeline';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Platform, Animated, RefreshControl } from 'react-native';
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
import { CityStats } from '../../components/dashboard/CityStats';
import { DashboardHero } from '../../components/dashboard/DashboardHero';
import { useSmartNotifications } from '../../hooks/useSmartNotifications';
import { useRequests } from '../../context/RequestsProvider';
import { AttentionList, type AttentionItem } from '../../components/dashboard/AttentionList';

const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                       'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function getTlCfg(colors: any) {
  return {
    payment:         { color: colors.secondary ?? '#1570EF', icon: 'cash-outline',            label: 'دفعة',         bg: colors.primarySubtle },
    contract_expiry: { color: colors.danger,                 icon: 'document-text-outline',   label: 'انتهاء عقد',   bg: colors.dangerSubtle },
    file_expiry:     { color: colors.purple,                 icon: 'document-attach-outline', label: 'انتهاء مرفق',  bg: colors.purpleSubtle },
    maintenance:     { color: colors.warning,                icon: 'construct-outline',       label: 'صيانة',        bg: colors.warningSubtle },
    manual:          { color: colors.success,                icon: 'calendar-outline',        label: 'حدث',          bg: colors.successSubtle },
  };
}

function tlUrgencyColor(days: number, colors: any): string {
  if (days <= 3)  return colors.danger;
  if (days <= 7)  return colors.warning;
  if (days <= 14) return colors.purple;
  return colors.secondary ?? '#1570EF';
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
  if (rate >= 80) return colors.success  ?? '#079455';
  if (rate >= 50) return colors.warning  ?? '#DC6803';
  return colors.danger ?? '#D92D20';
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

const OWNER_LINKS = [
  { icon: 'stats-chart-outline', label: 'الدخل والمصاريف', route: '/owner-statement' },
  { icon: 'business-outline', label: 'عقاراتي', route: '/(tabs)/properties' },
  { icon: 'git-commit-outline', label: 'الخط الزمني', route: '/owner-timeline' },
  { icon: 'folder-open-outline', label: 'المستندات', route: '/attachments' },
];

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { urgentCount } = useSmartNotifications();
  const { pendingCount: pendingRequests, canApprove } = useRequests();
  const { kpis, payments, contracts, maintenance, auditLogs, currentUser,
          owners, units, properties, tenants, calendarEvents, attachments, dataLoading, canWrite, refreshData, isOwner, previewing, previewOwnerId } = useApp();
  const ownerMode = isOwner || previewing;
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const spinAnim = useRef(new Animated.Value(0)).current;

  const handleRefresh = () => {
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 800, useNativeDriver: true })
    ).start();
    refreshData();
  };

  useEffect(() => {
    if (!dataLoading) {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  }, [dataLoading]);

  const spinInterpolate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

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
    const ownerId = currentUser?.ownerId;

    // استخدام ownerId مباشرةً بدل البحث بالاسم (الأكثر دقةً وأماناً)
    const ownerPropIds = isOwner && ownerId
      ? new Set(properties.filter(p => p.ownerId === ownerId && !p.id.startsWith('uasprop_')).map(p => p.id))
      : null;
    const ownerContractIds = ownerPropIds
      ? new Set(contracts.filter(c => {
          const u = units.find(u => u.id === c.unitId);
          if (!u) return false;
          return ownerPropIds!.has(u.propertyId) || u.ownerId === ownerId;
        }).map(c => c.id))
      : null;
    const ownerPaymentIds = ownerContractIds
      ? new Set(payments.filter(p => ownerContractIds!.has(p.contractId ?? '')).map(p => p.id))
      : null;

    type TlEvent = { id: string; title: string; date: string; type: keyof ReturnType<typeof getTlCfg>; entityType: string; entityId: string; notes?: string; subtitle?: string; overdue?: boolean };
    const events: TlEvent[] = [];

    // 1. Manual calendar events
    calendarEvents.forEach(e => {
      events.push({ id: e.id, title: e.title, date: e.date, type: e.type as keyof ReturnType<typeof getTlCfg>, entityType: e.entityType ?? 'manual', entityId: e.entityId ?? e.id, notes: e.notes });
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
  const QUICK_ACTIONS  = makeQuickActions(colors).filter(a => (canWrite || !a.writeOnly) && !['/calendar', '/audit-log', '/action-log'].includes(a.route));
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

  // ── City Stats — rented properties by city ───────────────────────────────
  const cityStats = useMemo(() => {
    const byCity: Record<string, number> = kpis.rentedByCity ?? {};
    const unitsByCity: Record<string, number> = kpis.rentedUnitsByCity ?? {};
    const totalUnitsByCity: Record<string, number> = kpis.totalUnitsByCity ?? {};
    const vals = Object.values(byCity);
    const totalRented = vals.reduce((s: number, v: number) => s + v, 0);
    return Object.entries(byCity)
      .map(([city, rentedProperties]) => {
        const rentedUnits = unitsByCity[city] ?? 0;
        const totalUnits = totalUnitsByCity[city] ?? 0;
        const vacantUnits = Math.max(0, totalUnits - rentedUnits);
        return {
          city,
          rentedProperties,
          rentedUnits,
          totalUnits,
          vacantUnits,
          percentage: totalRented > 0 ? Math.round((rentedProperties / totalRented) * 100) : 0,
        };
      })
      .sort((a, b) => b.rentedProperties - a.rentedProperties);
  }, [kpis.rentedByCity, kpis.rentedUnitsByCity, kpis.totalUnitsByCity]);

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

  // ── يحتاج انتباهك: بنود تتطلب إجراءً، مرتبة بالأولوية ─────────────────────
  const attentionItems = useMemo((): AttentionItem[] => {
    const items: AttentionItem[] = [];
    const overdue = payments.filter(p => p.status === 'overdue');
    if (overdue.length) {
      const oldest = overdue.reduce((a, b) => (a.dueDate < b.dueDate ? a : b));
      items.push({
        key: 'overdue', tone: 'danger', icon: 'alert-circle-outline',
        title: `${overdue.length} ${overdue.length === 1 ? 'دفعة متأخرة' : 'دفعات متأخرة'}`,
        detail: `أقدمها مستحقة منذ ${formatDate(oldest.dueDate)}`,
        amount: overdue.reduce((s, p) => s + (p.amount || 0), 0),
        route: '/collections',
      });
    }
    const dueToday = duePaymentsData.today.filter(p => p.status === 'pending');
    if (dueToday.length) {
      items.push({
        key: 'due', tone: 'warning', icon: 'time-outline',
        title: `${dueToday.length} ${dueToday.length === 1 ? 'دفعة مستحقة اليوم' : 'دفعات مستحقة اليوم'}`,
        detail: dueToday.slice(0, 2).map(p => p.tenantName).join('، '),
        amount: dueToday.reduce((s, p) => s + (p.amount || 0), 0),
        route: '/payments',
      });
    }
    if (canApprove && pendingRequests > 0) {
      items.push({
        key: 'requests', tone: 'warning', icon: 'hand-left-outline',
        title: `${pendingRequests} ${pendingRequests === 1 ? 'طلب صرف ينتظر موافقتك' : 'طلبات صرف تنتظر موافقتك'}`,
        detail: 'وافق أو ارفض بضغطة',
        count: pendingRequests,
        route: '/requests',
      });
    }
    const todayIso = new Date().toISOString().split('T')[0];
    const staleActive = contracts.filter(c => c.status === 'active' && !c.closedAt && c.endDate < todayIso);
    if (staleActive.length) {
      items.push({
        key: 'stale', tone: 'danger', icon: 'document-text-outline',
        title: `${staleActive.length} ${staleActive.length === 1 ? 'عقد انتهى وما تجدّد' : 'عقود انتهت وما تجدّدت'}`,
        detail: 'جدّدها أو سجّل خروج المستأجر عشان تصح الأرقام',
        count: staleActive.length,
        route: '/renewals',
      });
    }
    if (expiringContracts.length) {
      const first = expiringContracts[0];
      items.push({
        key: 'expiring', tone: 'warning', icon: 'document-text-outline',
        title: `${expiringContracts.length} ${expiringContracts.length === 1 ? 'عقد ينتهي' : 'عقود تنتهي'} خلال 30 يوماً`,
        detail: `أقربها: ${first.tenantName}، بعد ${first.daysLeft} ${first.daysLeft === 1 ? 'يوم' : 'يوماً'}`,
        count: expiringContracts.length,
        route: '/renewals',
      });
    }
    const urgent = maintenance.filter(m => (m.priority === 'urgent' || m.priority === 'high') && (m.status === 'new' || m.status === 'in_progress'));
    if (urgent.length) {
      items.push({
        key: 'maint', tone: 'danger', icon: 'construct-outline',
        title: `${urgent.length} ${urgent.length === 1 ? 'طلب صيانة عاجل' : 'طلبات صيانة عاجلة'}`,
        detail: urgent[0].title,
        count: urgent.length,
        route: '/maintenance',
      });
    }
    const longVacant = vacantUnitsData.filter(u => u.status === 'vacant' && (u.vacantDays ?? 0) >= 60);
    if (longVacant.length) {
      items.push({
        key: 'vacant', tone: 'info', icon: 'home-outline',
        title: `${longVacant.length} ${longVacant.length === 1 ? 'وحدة شاغرة' : 'وحدات شاغرة'} منذ أكثر من شهرين`,
        detail: longVacant.slice(0, 2).map(u => `${u.propertyName ?? ''} ${u.number}`).join('، '),
        count: longVacant.length,
        route: '/units',
      });
    }
    const today = new Date().toISOString().split('T')[0];
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const docs = attachments.filter(a => a.expiryDate && a.expiryDate <= in30);
    if (docs.length) {
      const expired = docs.filter(a => a.expiryDate! < today).length;
      items.push({
        key: 'docs', tone: expired ? 'danger' : 'info', icon: 'folder-open-outline',
        title: `${docs.length} ${docs.length === 1 ? 'وثيقة' : 'وثائق'} ${expired ? 'منتهية أو تنتهي قريباً' : 'تنتهي خلال 30 يوماً'}`,
        detail: docs.slice(0, 2).map(a => a.name).join('، '),
        count: docs.length,
        route: '/attachments',
      });
    }
    return items;
  }, [payments, contracts, pendingRequests, canApprove, duePaymentsData, expiringContracts, maintenance, vacantUnitsData, attachments]);

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={
          <RefreshControl refreshing={dataLoading} onRefresh={handleRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        }
      >
        <DashboardHero
          firstName={currentUser?.name?.split(' ')[0] ?? ''}
          topInset={insets.top}
          notifCount={urgentCount}
          onMenu={undefined}
          stats={{
            properties: kpis.totalProperties,
            rented: kpis.rentedUnits,
            totalUnits: units.length,
            monthlyRevenue: kpis.monthlyRevenue,
            openMaintenance: kpis.openMaintenanceRequests,
          }}
          collection={collectionData}
        />

        {/* ── يحتاج انتباهك + إجراءات سريعة ── */}
        {!ownerMode && (
        <View style={[styles.sectionPad, { marginTop: 20 }, isWide && styles.rowPair]}>
          <View style={isWide ? { flex: 3 } : undefined}>
            <AttentionList items={attentionItems} />
          </View>
          {isWide && <View style={{ width: 16 }} />}
          <View style={[isWide ? { flex: 2 } : { marginTop: 16 }]}>
            <View style={[styles.qaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.qaTitle, { color: colors.text }]}>إجراءات سريعة</Text>
              <View style={styles.qaGrid}>
                {QUICK_ACTIONS.map(action => (
                  <TouchableOpacity
                    key={action.label}
                    style={[styles.qaBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={() => router.push(action.route as any)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={action.icon as any} size={20} color={colors.primary} />
                    <Text style={[styles.qaLabel, { color: colors.text }]} numberOfLines={1}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        )}
        {ownerMode && (
          <View style={[styles.sectionPad, { marginTop: 20 }]}>
            <View style={[styles.qaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.qaGrid}>
                {OWNER_LINKS.map(action => (
                  <TouchableOpacity
                    key={action.label}
                    style={[styles.qaBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={() => router.push(action.route as any)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={action.icon as any} size={20} color={colors.primary} />
                    <Text style={[styles.qaLabel, { color: colors.text }]} numberOfLines={1}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ marginTop: 16 }}>
              <OwnerTimeline ownerId={(previewing ? previewOwnerId : currentUser?.ownerId) ?? undefined} limit={8} title="آخر الأحداث" showAll="/owner-timeline" />
            </View>
          </View>
        )}

        {/* ── Holiday-Home revenue breakdown (only when nightly units exist) ── */}
        {kpis.holidayUnitsCount > 0 && (
          <View style={[styles.sectionPad, { marginTop: isSmallPhone ? 8 : 12 }]}>
            <View style={[styles.hhCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.hhHeader}>
                <Ionicons name="moon-outline" size={16} color={colors.purple} />
                <Text style={[styles.hhTitle, { color: colors.text }]}>تفصيل الإيراد الشهري</Text>
                <View style={[styles.hhBadge, { backgroundColor: colors.purple + '22' }]}>
                  <Text style={[styles.hhBadgeText, { color: colors.purple }]}>إشغال {kpis.holidayOccupancyRate}%</Text>
                </View>
              </View>
              <View style={styles.hhSplitRow}>
                <View style={styles.hhSplitItem}>
                  <Text style={[styles.hhSplitLabel, { color: colors.textMuted }]}>عقود طويلة</Text>
                  <Text style={[styles.hhSplitVal, { color: colors.text }]}>{formatCurrency(kpis.leaseMonthlyRevenue)} ﷼</Text>
                </View>
                <View style={[styles.hhDivider, { backgroundColor: colors.border }]} />
                <View style={styles.hhSplitItem}>
                  <Text style={[styles.hhSplitLabel, { color: colors.textMuted }]}>حجوزات يومية</Text>
                  <Text style={[styles.hhSplitVal, { color: colors.purple }]}>{formatCurrency(kpis.holidayMonthlyRevenue)} ﷼</Text>
                </View>
              </View>
              <Text style={[styles.hhHint, { color: colors.textMuted }]}>
                إيراد الحجوزات يُحتسب فقط لليالي المشغولة فعلياً هذا الشهر ({kpis.holidayUnitsCount} وحدة مصيف)
              </Text>
            </View>
          </View>
        )}

        {/* ── الأحداث القادمة (شهرين): إيجارات، عقود، مستندات، مواعيد ── */}
        <View style={[styles.sectionPad, { marginTop: isSmallPhone ? 16 : 24 }]}>
          <View>
            <UpcomingEvents days={60} />
          </View>
        </View>

        {/* الرسوم والإشغال والتفاصيل انتقلت إلى "التقارير" — الرئيسية لما يحتاج إجراء فقط */}
        <View style={[styles.sectionPad, { marginTop: 24, alignItems: 'center' }]}>
          <TouchableOpacity onPress={() => router.push((ownerMode ? '/owner-statement' : '/financial-reports') as any)} style={[styles.reportsLink, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Ionicons name="bar-chart-outline" size={16} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>{ownerMode ? 'الدخل والمصاريف بالتفصيل' : 'الإيرادات والإشغال في التقارير'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  reportsLink: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, height: 42 },
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
  welcomeText: { fontSize: Theme.fontSize.sm, textAlign: 'center' },
  appName: { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.semibold, textAlign: 'center' },
  notifBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#D92D20', borderRadius: 8, width: 16, height: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  notifBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  avatarCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
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
  qaCard: { borderWidth: 1, borderRadius: 14, padding: 16 },
  qaTitle: { fontSize: 16, fontWeight: '600', textAlign: 'right', marginBottom: 12 },
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qaBtn: { flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 46 },
  qaLabel: { fontSize: 14, fontWeight: '500', flexShrink: 1 },
  sectionPad: {
    paddingHorizontal: Theme.spacing.base,
    marginTop: Theme.spacing.xl,
  },
  hhCard: { borderRadius: Theme.radius.lg, borderWidth: 1, padding: Theme.spacing.md, gap: 12 },
  hhHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hhTitle: { flex: 1, fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  hhBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Theme.radius.full },
  hhBadgeText: { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.bold },
  hhSplitRow: { flexDirection: 'row', alignItems: 'center' },
  hhSplitItem: { flex: 1, alignItems: 'center', gap: 3 },
  hhSplitLabel: { fontSize: Theme.fontSize.xs },
  hhSplitVal: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold },
  hhDivider: { width: 1, height: 32 },
  hhHint: { fontSize: Theme.fontSize.xs, textAlign: 'center', lineHeight: 16 },
  rowPair: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flexWrap: 'nowrap',
  },
  sectionHeading: { fontSize: 16, fontWeight: '600', textAlign: 'right', marginBottom: 12 },
  secLabel: { fontSize: 16, fontWeight: '600', textAlign: 'right', marginBottom: 12 },
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
