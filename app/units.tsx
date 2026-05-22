import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { ResponsiveGrid } from '../components/ui/ResponsiveGrid';
import { router } from 'expo-router';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { SearchBar } from '../components/ui/SearchBar';
import { UnitCard } from '../components/ui/UnitCard';
import { EmptyState } from '../components/ui/EmptyState';
import { AppHeader } from '../components/ui/AppHeader';
import { FilterBar, UNIT_FILTERS } from '../components/ui/FilterBar';
import { ConfirmModal, AlertModal } from '../components/ui/Modal';
import { ListSkeleton } from '../components/ui/Skeleton';
import { useDelete } from '../hooks/useDelete';
import { UnitStatus } from '../data/mockData';
import { useAppTheme } from '../hooks/useAppTheme';
import { countryLabel } from '../utils/currency';

type Filter = 'all' | UnitStatus;

export default function UnitsScreen() {
  const { colors } = useAppTheme();
  const { units, properties, dataLoading } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [filterCountry, setFilterCountry] = useState('');
  const { pending, pendingMode, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete } = useDelete();

  const unitCurrency = (u: typeof units[0]) =>
    properties.find(p => p.id === u.propertyId)?.currency ?? 'SAR';

  const countryOptions = useMemo(() => {
    const codes = Array.from(new Set(units.map(unitCurrency)));
    if (codes.length < 2) return [];
    return [
      { label: 'كل الدول', value: '' },
      ...codes.map(code => ({ label: countryLabel(code), value: code })),
    ];
  }, [units, properties]);

  const filtered = useMemo(() => {
    return units.filter(u => {
      if (filterCountry && unitCurrency(u) !== filterCountry) return false;
      const matchSearch = !search || (u.number ?? '').includes(search);
      const matchFilter = filter === 'all' || u.status === filter;
      return matchSearch && matchFilter;
    });
  }, [units, properties, search, filter, filterCountry]);

  const counts = useMemo(() => ({
    rented:      units.filter(u => u.status === 'rented').length,
    vacant:      units.filter(u => u.status === 'vacant').length,
    maintenance: units.filter(u => u.status === 'maintenance').length,
    reserved:    units.filter(u => u.status === 'reserved').length,
  }), [units]);

  if (dataLoading) return <ListSkeleton count={5} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={`الوحدات (${units.length})`} rightAction={{ icon: 'add', onPress: () => router.push('/add-unit') }} />

      <SearchBar value={search} onChangeText={setSearch} placeholder="ابحث برقم الوحدة..." />

      <FilterBar options={UNIT_FILTERS} value={filter} onChange={v => setFilter(v as Filter)} />

      {countryOptions.length > 0 && (
        <FilterBar options={countryOptions} value={filterCountry} onChange={setFilterCountry} />
      )}

      {/* Stats */}
      <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.stat}><Text style={[styles.sv, { color: colors.success }]}>{counts.rented}</Text><Text style={[styles.sl, { color: colors.textMuted }]}>مؤجرة</Text></View>
        <View style={[styles.sd, { backgroundColor: colors.border }]} />
        <View style={styles.stat}><Text style={[styles.sv, { color: colors.secondary }]}>{counts.vacant}</Text><Text style={[styles.sl, { color: colors.textMuted }]}>شاغرة</Text></View>
        <View style={[styles.sd, { backgroundColor: colors.border }]} />
        <View style={styles.stat}><Text style={[styles.sv, { color: colors.warning }]}>{counts.maintenance}</Text><Text style={[styles.sl, { color: colors.textMuted }]}>صيانة</Text></View>
        <View style={[styles.sd, { backgroundColor: colors.border }]} />
        <View style={styles.stat}><Text style={[styles.sv, { color: colors.primary }]}>{counts.reserved}</Text><Text style={[styles.sl, { color: colors.textMuted }]}>محجوزة</Text></View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {filtered.length === 0 ? (
          <EmptyState icon="home-outline" title="لا توجد وحدات" actionLabel="إضافة وحدة" onAction={() => router.push('/add-unit')} />
        ) : (
          <ResponsiveGrid>{filtered.map(u => (
            <UnitCard
              key={u.id}
              unit={u}
              onDelete={() => requestDelete({ id: u.id, entityType: 'unit', label: `وحدة ${u.number}` })}
            />
          ))}</ResponsiveGrid>
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
  statsRow: {
    flexDirection: 'row', marginHorizontal: Theme.spacing.base,
    borderRadius: Theme.radius.md, borderWidth: 1, padding: Theme.spacing.md, marginBottom: 8,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  sv: { fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold },
  sl: { fontSize: Theme.fontSize.xs },
  sd: { width: 1, marginVertical: 4 },
});
