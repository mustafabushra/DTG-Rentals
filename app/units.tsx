import React, { useState, useMemo } from 'react';
import { HubTabs } from '../components/navigation/HubTabs';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { SearchBar } from '../components/ui/SearchBar';
import { UnitRow } from '../components/units/UnitRow';
import { FilterPanel } from '../components/ui/FilterPanel';
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
  const { units, properties, tenants, contracts, dataLoading, canWrite } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [filterCountry, setFilterCountry] = useState('');
  const { pending, pendingMode, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete } = useDelete();

  const unitCurrency = (u: typeof units[0]) =>
    u.currency ?? properties.find(p => p.id === u.propertyId)?.currency ?? 'SAR';

  const countryOptions = useMemo(() => {
    const codes = Array.from(new Set(units.map(unitCurrency)));
    if (codes.length < 2) return [];
    return [
      { label: 'كل الدول', value: '' },
      ...codes.map(code => ({ label: countryLabel(code), value: code })),
    ];
  }, [units, properties]);

  const tenantName = (u: typeof units[0]) => {
    const tid = u.currentTenantId ?? contracts.find(c => c.unitId === u.id && c.status === 'active')?.tenantId;
    return tid ? tenants.find(t => t.id === tid)?.name : undefined;
  };

  const filtered = useMemo(() => {
    const q = search.trim();
    return units.filter(u => {
      if (filterCountry && unitCurrency(u) !== filterCountry) return false;
      const matchSearch = !q || (u.number ?? '').includes(q) || (tenantName(u) ?? '').includes(q);
      const matchFilter = filter === 'all' || u.status === filter;
      return matchSearch && matchFilter;
    });
  }, [units, properties, search, filter, filterCountry, tenants, contracts]);

  // تجميع حسب العقار: اسم العقار مرة واحدة بدل تكراره على كل وحدة
  const groups = useMemo(() => {
    const m = new Map<string, { id: string; name: string; units: typeof units }>();
    for (const u of filtered) {
      const g = m.get(u.propertyId) ?? { id: u.propertyId, name: properties.find(p => p.id === u.propertyId)?.name ?? 'عقار', units: [] as typeof units };
      g.units.push(u); m.set(u.propertyId, g);
    }
    for (const g of m.values()) g.units.sort((a, b) => String(a.number).localeCompare(String(b.number), 'en', { numeric: true }));
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [filtered, properties]);

  const counts = useMemo(() => ({
    rented:      units.filter(u => u.status === 'rented').length,
    vacant:      units.filter(u => u.status === 'vacant').length,
    maintenance: units.filter(u => u.status === 'maintenance').length,
    reserved:    units.filter(u => u.status === 'reserved').length,
  }), [units]);

  if (dataLoading) return <ListSkeleton count={5} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="العقارات" showBack={false} rightAction={canWrite ? { icon: 'add', onPress: () => router.push('/add-unit'), label: 'إضافة وحدة' } : undefined} />
      <HubTabs hub="properties" />

      <SearchBar value={search} onChangeText={setSearch} placeholder="ابحث برقم الوحدة أو اسم المستأجر..." />

      <FilterBar
        options={UNIT_FILTERS.map(o => ({ ...o, label: o.value === 'all' ? `الكل ${units.length}` : `${o.label} ${(counts as any)[o.value] ?? 0}` }))}
        value={filter}
        onChange={v => setFilter(v as Filter)}
      />
      {countryOptions.length > 0 && (
        <FilterPanel activeCount={filterCountry ? 1 : 0}>
          <FilterBar options={countryOptions} value={filterCountry} onChange={setFilterCountry} />
        </FilterPanel>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {groups.length === 0 ? (
          <EmptyState icon="home-outline" title="لا توجد وحدات" actionLabel="إضافة وحدة" onAction={() => router.push('/add-unit')} />
        ) : groups.map(g => (
          <View key={g.id} style={{ gap: 6 }}>
            <View style={styles.groupHead}>
              <Text style={[styles.groupName, { color: colors.text }]} numberOfLines={1}>{g.name}</Text>
              <Text style={[styles.groupCount, { color: colors.textMuted }]}>{g.units.length} {g.units.length === 1 ? 'وحدة' : 'وحدات'}</Text>
            </View>
            <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {g.units.map((u, i) => (
                <UnitRow key={u.id} unit={u} first={i === 0} currency={unitCurrency(u)} tenantName={tenantName(u)} />
              ))}
            </View>
          </View>
        ))}
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
  list: { padding: 16, paddingTop: 8, paddingBottom: 40, gap: 18, width: '100%', maxWidth: 900, alignSelf: 'center' },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 4 },
  groupName: { flex: 1, fontSize: 15, fontWeight: '600', textAlign: 'right' },
  groupCount: { fontSize: 12 },
  group: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
});
