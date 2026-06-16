import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ResponsiveGrid } from '../components/ui/ResponsiveGrid';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { SearchBar } from '../components/ui/SearchBar';
import { EmptyState } from '../components/ui/EmptyState';
import { AppHeader } from '../components/ui/AppHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { FilterBar } from '../components/ui/FilterBar';
import { DeleteButton } from '../components/ui/DeleteButton';
import { ConfirmModal, AlertModal } from '../components/ui/Modal';
import { ListSkeleton } from '../components/ui/Skeleton';
import { useDelete } from '../hooks/useDelete';
import { useAppTheme } from '../hooks/useAppTheme';

type Filter = 'all' | 'active' | 'former';

export default function TenantsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { tenants, contracts, payments, dataLoading, secondaryLoading } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const { pending, pendingMode, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete } = useDelete();

  const activeTenantIds = useMemo(() =>
    new Set(contracts.filter(c => c.status === 'active').map(c => c.tenantId)),
  [contracts]);

  // مستأجر له عقد واحد على الأقل (منتهي أو نشط)
  const tenantWithContractIds = useMemo(() =>
    new Set(contracts.map(c => c.tenantId)),
  [contracts]);

  // بيانات سريعة لكل مستأجر: عدد العقود + الدفعات المتأخرة/المعلقة
  const tenantStats = useMemo(() => {
    const map: Record<string, { contractCount: number; overdueCount: number; pendingCount: number }> = {};
    tenants.forEach(t => {
      const tContracts = contracts.filter(c => c.tenantId === t.id);
      const tContractIds = tContracts.map(c => c.id);
      const tPayments = payments.filter(p => tContractIds.includes(p.contractId));
      map[t.id] = {
        contractCount: tContracts.length,
        overdueCount:  tPayments.filter(p => p.status === 'overdue').length,
        pendingCount:  tPayments.filter(p => p.status === 'pending').length,
      };
    });
    return map;
  }, [tenants, contracts, payments]);

  const filtered = useMemo(() => {
    return tenants.filter(t => {
      const matchSearch = !search || (t.name ?? '').includes(search) || (t.phone ?? '').includes(search);
      // سابق فقط إذا كان له عقود سابقة وليس لديه عقد نشط حالياً
      const isFormer = tenantWithContractIds.has(t.id) && !activeTenantIds.has(t.id);
      const matchFilter = filter === 'all' || (filter === 'active' && !isFormer) || (filter === 'former' && isFormer);
      return matchSearch && matchFilter;
    });
  }, [tenants, search, filter, activeTenantIds, tenantWithContractIds]);

  const filterOptions = [
    { label: 'الكل', value: 'all' },
    { label: 'نشط', value: 'active' },
    { label: 'سابق', value: 'former' },
  ];

  if (dataLoading || secondaryLoading) return <ListSkeleton count={5} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={`المستأجرون (${tenants.length})`}
        rightAction={{ icon: 'add', onPress: () => router.push('/add-tenant') }}
      />

      <SearchBar value={search} onChangeText={setSearch} placeholder="ابحث بالاسم أو الهاتف..." />

      <FilterBar options={filterOptions} value={filter} onChange={v => setFilter(v as Filter)} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {filtered.length === 0 ? (
          <EmptyState icon="people-outline" title="لا يوجد مستأجرون" subtitle={search ? 'لا توجد نتائج' : 'ابدأ بإضافة مستأجر'} actionLabel="إضافة مستأجر" onAction={() => router.push('/add-tenant')} />
        ) : (
          <ResponsiveGrid>{filtered.map(tenant => {
            const isActive = activeTenantIds.has(tenant.id);
            const initials = (tenant.name ?? '؟').split(' ').slice(0, 2).map((n: string) => n[0] ?? '').join('');
            const stats = tenantStats[tenant.id] ?? { contractCount: 0, overdueCount: 0, pendingCount: 0 };
            return (
              <TouchableOpacity
                key={tenant.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/tenant/${tenant.id}`)}
                activeOpacity={0.85}
              >
                <View style={[styles.avatar, { backgroundColor: isActive ? colors.secondary : colors.textMuted }]}>
                  <Text style={styles.initials}>{initials}</Text>
                </View>
                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <StatusBadge status={activeTenantIds.has(tenant.id) ? 'active' : tenantWithContractIds.has(tenant.id) ? 'former' : 'active'} size="sm" />
                    <Text style={[styles.name, { color: colors.text }]} numberOfLines={2} ellipsizeMode="tail">{tenant.name}</Text>
                  </View>
                  <View style={styles.row}>
                    <Ionicons name="call-outline" size={13} color={colors.textSecondary} />
                    <Text style={[styles.sub, { color: colors.textSecondary }]}>{tenant.phone}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <View style={styles.row}>
                      <Ionicons name="document-text-outline" size={13} color={colors.primary} />
                      <Text style={[styles.sub, { color: colors.primary }]}>
                        {stats.contractCount} {stats.contractCount === 1 ? 'عقد' : 'عقود'}
                      </Text>
                    </View>
                    {stats.overdueCount > 0 && (
                      <View style={[styles.badge, { backgroundColor: colors.danger + '18' }]}>
                        <Ionicons name="alert-circle-outline" size={12} color={colors.danger} />
                        <Text style={[styles.badgeText, { color: colors.danger }]}>
                          {stats.overdueCount} متأخرة
                        </Text>
                      </View>
                    )}
                    {stats.overdueCount === 0 && stats.pendingCount > 0 && (
                      <View style={[styles.badge, { backgroundColor: colors.warning + '18' }]}>
                        <Ionicons name="time-outline" size={12} color={colors.warning} />
                        <Text style={[styles.badgeText, { color: colors.warning }]}>
                          {stats.pendingCount} معلقة
                        </Text>
                      </View>
                    )}
                    {stats.contractCount > 0 && stats.overdueCount === 0 && stats.pendingCount === 0 && (
                      <View style={[styles.badge, { backgroundColor: colors.success + '18' }]}>
                        <Ionicons name="checkmark-circle-outline" size={12} color={colors.success} />
                        <Text style={[styles.badgeText, { color: colors.success }]}>مسدد</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.cardTrailing}>
                  <DeleteButton variant="icon" onPress={() => requestDelete({ id: tenant.id, entityType: 'tenant', label: tenant.name })} />
                  <Ionicons name="chevron-forward-outline" size={18} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            );
          })}</ResponsiveGrid>
        )}
      </ScrollView>

      <ConfirmModal
        visible={!!pending}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="تأكيد الحذف"
        message={`هل أنت متأكد أنك تريد حذف "${pending?.label}"؟ سيتم إلغاء جميع العقود المرتبطة. لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="تأكيد الحذف"
        variant="danger"
      />
      <AlertModal
        visible={!!blocked}
        onClose={clearBlocked}
        title="لا يمكن الحذف"
        message={blocked ?? ''}
        variant="warning"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    flexDirection: 'row', alignItems: 'center', padding: Theme.spacing.md,
    borderRadius: Theme.radius.lg, borderWidth: 1,
    marginHorizontal: Theme.spacing.base, marginBottom: Theme.spacing.sm, gap: 12,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  initials: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, flex: 1, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sub: { fontSize: Theme.fontSize.sm, textAlign: 'right' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardTrailing: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
