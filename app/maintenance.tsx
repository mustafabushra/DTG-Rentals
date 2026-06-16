import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ResponsiveGrid } from '../components/ui/ResponsiveGrid';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { SearchBar } from '../components/ui/SearchBar';
import { EmptyState } from '../components/ui/EmptyState';
import { AppHeader } from '../components/ui/AppHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { FilterBar, MAINTENANCE_FILTERS } from '../components/ui/FilterBar';
import { DeleteButton } from '../components/ui/DeleteButton';
import { ConfirmModal, AlertModal } from '../components/ui/Modal';
import { ListSkeleton } from '../components/ui/Skeleton';
import { useDelete } from '../hooks/useDelete';
import { formatCurrency, MaintenancePriority, MaintenanceStatus } from '../data/mockData';
import { useAppTheme } from '../hooks/useAppTheme';

type StatusFilter = 'all' | MaintenanceStatus;
type PriorityFilter = 'all' | MaintenancePriority;

export default function MaintenanceScreen() {
  const { colors } = useAppTheme();
  const { maintenance, properties, units, dataLoading, secondaryLoading } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const { pending, pendingMode, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete } = useDelete();

  const filtered = useMemo(() => {
    return maintenance.filter(m => {
      const matchSearch = !search || (m.title ?? '').includes(search);
      const matchStatus = statusFilter === 'all' || m.status === statusFilter;
      const matchPriority = priorityFilter === 'all' || m.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [maintenance, search, statusFilter, priorityFilter]);

  const counts = useMemo(() => ({
    new: maintenance.filter(m => m.status === 'new').length,
    in_progress: maintenance.filter(m => m.status === 'in_progress').length,
    completed: maintenance.filter(m => m.status === 'completed').length,
  }), [maintenance]);

  if (dataLoading || secondaryLoading) return <ListSkeleton count={5} />;

  const statusOptions = MAINTENANCE_FILTERS;

  const priorityOptions = [
    { label: 'الكل', value: 'all' },
    { label: 'عالية', value: 'high' },
    { label: 'متوسطة', value: 'medium' },
    { label: 'منخفضة', value: 'low' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="الصيانة" rightAction={{ icon: 'add', onPress: () => router.push('/add-maintenance') }} />

      <SearchBar value={search} onChangeText={setSearch} placeholder="ابحث في الطلبات..." />

      <FilterBar options={statusOptions} value={statusFilter} onChange={v => setStatusFilter(v as StatusFilter)} />
      <FilterBar options={priorityOptions} value={priorityFilter} onChange={v => setPriorityFilter(v as PriorityFilter)} />

      {/* Stats */}
      <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.stat}><Text style={[styles.sv, { color: colors.secondary }]}>{counts.new}</Text><Text style={[styles.sl, { color: colors.textMuted }]}>جديد</Text></View>
        <View style={[styles.sd, { backgroundColor: colors.border }]} />
        <View style={styles.stat}><Text style={[styles.sv, { color: colors.warning }]}>{counts.in_progress}</Text><Text style={[styles.sl, { color: colors.textMuted }]}>جاري</Text></View>
        <View style={[styles.sd, { backgroundColor: colors.border }]} />
        <View style={styles.stat}><Text style={[styles.sv, { color: colors.success }]}>{counts.completed}</Text><Text style={[styles.sl, { color: colors.textMuted }]}>مكتمل</Text></View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {filtered.length === 0 ? (
          <EmptyState icon="construct-outline" title="لا توجد طلبات صيانة" actionLabel="فتح طلب" onAction={() => router.push('/add-maintenance')} />
        ) : (
          <ResponsiveGrid>{filtered.map(m => {
            const property = properties.find(p => p.id === m.propertyId);
            const unit = units.find(u => u.id === m.unitId);
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/maintenance/${m.id}`)}
                activeOpacity={0.85}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.badges}>
                    <StatusBadge status={m.status} size="sm" />
                    <StatusBadge status={m.priority} size="sm" />
                  </View>
                  <Text style={[styles.title, { color: colors.text }]}>{m.title}</Text>
                  <DeleteButton variant="icon" onPress={() => requestDelete({ id: m.id, entityType: 'maintenance', label: m.title })} />
                </View>
                <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={2}>{m.description}</Text>
                <View style={styles.cardFooter}>
                  <View style={styles.footerLeft}>
                    <Text style={[styles.date, { color: colors.textMuted }]}>{m.openedAt}</Text>
                    {m.cost !== undefined && (
                      <Text style={[styles.cost, { color: colors.success }]}>{formatCurrency(m.cost)}</Text>
                    )}
                  </View>
                  <View style={styles.location}>
                    <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                    <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
                      {property?.name} — وحدة {unit?.number}
                    </Text>
                  </View>
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
        message={`هل أنت متأكد أنك تريد حذف "${pending?.label}"؟ لا يمكن التراجع عن هذا الإجراء.`}
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
  statsRow: {
    flexDirection: 'row', marginHorizontal: Theme.spacing.base,
    borderRadius: Theme.radius.md, borderWidth: 1, padding: Theme.spacing.md, marginBottom: 8,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  sv: { fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold },
  sl: { fontSize: Theme.fontSize.xs },
  sd: { width: 1, marginVertical: 4 },
  card: {
    marginHorizontal: Theme.spacing.base, marginBottom: Theme.spacing.sm,
    borderRadius: Theme.radius.lg, borderWidth: 1, padding: Theme.spacing.md, gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badges: { flexDirection: 'row', gap: 4 },
  title: { flex: 1, fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  desc: { fontSize: Theme.fontSize.sm, lineHeight: 20, textAlign: 'right' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  date: { fontSize: Theme.fontSize.xs, textAlign: 'right' },
  cost: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  location: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: { fontSize: Theme.fontSize.xs, textAlign: 'right' },
});
