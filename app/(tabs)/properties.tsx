import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, LayoutAnimation, UIManager } from 'react-native';
import { useScreenSize } from '../../hooks/useScreenSize';
import { useSidebar } from '../../context/SidebarContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { PropertyCard } from '../../components/ui/PropertyCard';
import { UnitCard } from '../../components/ui/UnitCard';
import { SearchBar } from '../../components/ui/SearchBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import { CollapsibleSection } from '../../components/ui/CollapsibleSection';
import { ConfirmModal, AlertModal } from '../../components/ui/Modal';
import { useDelete } from '../../hooks/useDelete';
import { trackScreen } from '../../lib/analytics';
import { useAppTheme } from '../../hooks/useAppTheme';
import { FilterPanel, DEFAULT_FILTERS } from '../../components/features/FilterPanel';
import type { ActiveFilters } from '../../components/features/FilterPanel';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function PropertiesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { properties, units, propertyPhotos, cities, canWrite, canDelete, dataLoading, externalOwnedUnits } = useApp();
  const { isSmallPhone, hPad } = useScreenSize();

  useEffect(() => { trackScreen('Properties'); }, []);

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilters>(DEFAULT_FILTERS);
  const [filterPanelVisible, setFilterPanelVisible] = useState(false);
  const [groupByCity, setGroupByCity] = useState(false);
  const { pending, pendingMode, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete } = useDelete();
  const { isWide, cols3, isDesktop } = useScreenSize();
  const { toggle: toggleSidebar } = useSidebar();

  const activeChipCount = useMemo(() => {
    let count = 0;
    if (activeFilter.types.length > 0) count += activeFilter.types.length;
    if (activeFilter.cities.length > 0) count += activeFilter.cities.length;
    if (activeFilter.statuses.length > 0) count += activeFilter.statuses.length;
    if (activeFilter.priceRange.min > 0 || activeFilter.priceRange.max < 999999) count += 1;
    if (activeFilter.bedrooms > 0) count += 1;
    if (activeFilter.area > 0) count += 1;
    if (activeFilter.sort !== DEFAULT_FILTERS.sort) count += 1;
    return count;
  }, [activeFilter]);

  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
      const matchSearch = !search || (p.name ?? '').includes(search) || (p.location ?? '').includes(search);
      if (!matchSearch) return false;
      if (activeFilter.types.length > 0 && !activeFilter.types.includes(p.type)) return false;
      if (activeFilter.cities.length > 0 && !activeFilter.cities.includes(p.cityId ?? '')) return false;
      if (activeFilter.statuses.length > 0) {
        const propUnits = units.filter(u => u.propertyId === p.id);
        const hasRented = propUnits.some(u => u.status === 'rented');
        const hasVacant = propUnits.some(u => u.status === 'vacant');
        const matchRented = activeFilter.statuses.includes('rented') && hasRented;
        const matchVacant = activeFilter.statuses.includes('vacant') && hasVacant;
        if (!matchRented && !matchVacant) return false;
      }
      if (activeFilter.priceRange.min > 0 || activeFilter.priceRange.max < 999999) {
        const propUnits2 = units.filter(u => u.propertyId === p.id);
        const minRent = propUnits2.reduce((min, u) => Math.min(min, u.monthlyRent || 0), Infinity);
        const maxRent = propUnits2.reduce((max, u) => Math.max(max, u.monthlyRent || 0), 0);
        if (maxRent < activeFilter.priceRange.min || (minRent > activeFilter.priceRange.max && minRent !== Infinity)) return false;
      }
      if (activeFilter.bedrooms > 0) {
        const propUnits3 = units.filter(u => u.propertyId === p.id);
        const maxBed = propUnits3.reduce((max, u) => Math.max(max, (u as any).bedrooms || 0), 0);
        if (maxBed < activeFilter.bedrooms) return false;
      }
      if (activeFilter.area > 0) {
        const propUnits4 = units.filter(u => u.propertyId === p.id);
        const maxArea = propUnits4.reduce((max, u) => Math.max(max, (u as any).area || 0), 0);
        if (maxArea < activeFilter.area) return false;
      }
      return true;
    }).sort((a, b) => {
      switch (activeFilter.sort) {
        case 'name': return a.name.localeCompare(b.name);
        case 'oldest': return (a.createdAt || '').localeCompare(b.createdAt || '');
        case 'revenue': {
          const aRent = units.filter(u => u.propertyId === a.id).reduce((s, u) => s + (u.monthlyRent || 0), 0);
          const bRent = units.filter(u => u.propertyId === b.id).reduce((s, u) => s + (u.monthlyRent || 0), 0);
          return bRent - aRent;
        }
        case 'units': {
          const aCnt = units.filter(u => u.propertyId === a.id).length;
          const bCnt = units.filter(u => u.propertyId === b.id).length;
          return bCnt - aCnt;
        }
        default: return (b.createdAt || '').localeCompare(a.createdAt || '');
      }
    });
  }, [properties, search, activeFilter, units]);

  const getUnitStats = (p: typeof properties[0]) => {
    const propUnits = units.filter(u => u.propertyId === p.id);
    return { rented: propUnits.filter(u => u.status === 'rented').length, vacant: propUnits.filter(u => u.status === 'vacant').length, total: propUnits.length };
  };

  const total = properties.length;
  const totalUnits = units.length;
  const rentedUnits = units.filter(u => u.status === 'rented').length;
  const vacantUnits = units.filter(u => u.status === 'vacant').length;
  const overallOccupancy = totalUnits > 0 ? Math.round((rentedUnits / totalUnits) * 100) : 0;

  if (dataLoading) return <ListSkeleton count={5} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (isSmallPhone ? 6 : 8), paddingHorizontal: hPad, backgroundColor: colors.primary }]}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {Platform.OS === 'web' && !isDesktop && (
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={toggleSidebar}>
                <Ionicons name="menu-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            {canWrite && (
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={() => router.push('/bulk-import-properties')}>
                <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            {canWrite && (
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={() => router.push('/add-property')}>
                <Ionicons name="add" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.headerTitle}>العقارات</Text>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <TouchableOpacity style={[styles.groupToggle, { backgroundColor: groupByCity ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)' }]}
              onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setGroupByCity(prev => !prev); }}>
              <Ionicons name={groupByCity ? 'list-outline' : 'folder-open-outline'} size={18} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{total}</Text>
            </View>
          </View>
        </View>
      </View>

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="ابحث بالاسم أو الموقع..."
        onFilterPress={() => setFilterPanelVisible(true)}
      />

      {activeChipCount > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsBar} contentContainerStyle={styles.chipsBarContent}>
          {activeFilter.types.map(t => (
            <TouchableOpacity key={`type_${t}`} style={[styles.chip, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}
              onPress={() => setActiveFilter(prev => ({ ...prev, types: prev.types.filter(x => x !== t) }))}>
              <Text style={[styles.chipLabel, { color: colors.primary }]}>{t === 'apartment' ? 'شقة' : t === 'villa' ? 'فيلا' : t === 'building' ? 'مبنى' : t === 'tower' ? 'برج' : t === 'office' ? 'مكتب' : t === 'shop' ? 'محل' : t === 'land' ? 'أرض' : t}</Text>
              <Ionicons name="close-circle" size={14} color={colors.primary} />
            </TouchableOpacity>
          ))}
          {activeFilter.cities.map(c => {
            const city = cities.find(ct => ct.id === c);
            return (
              <TouchableOpacity key={`city_${c}`} style={[styles.chip, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}
                onPress={() => setActiveFilter(prev => ({ ...prev, cities: prev.cities.filter(x => x !== c) }))}>
                <Text style={[styles.chipLabel, { color: colors.primary }]}>{city?.displayName || city?.name || c}</Text>
                <Ionicons name="close-circle" size={14} color={colors.primary} />
              </TouchableOpacity>
            );
          })}
          {activeFilter.statuses.map(s => (
            <TouchableOpacity key={`status_${s}`} style={[styles.chip, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}
              onPress={() => setActiveFilter(prev => ({ ...prev, statuses: prev.statuses.filter(x => x !== s) }))}>
              <Text style={[styles.chipLabel, { color: colors.primary }]}>{s === 'rented' ? 'مؤجر' : 'شاغر'}</Text>
              <Ionicons name="close-circle" size={14} color={colors.primary} />
            </TouchableOpacity>
          ))}
          {(activeFilter.priceRange.min > 0 || activeFilter.priceRange.max < 999999) && (
            <TouchableOpacity style={[styles.chip, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}
              onPress={() => setActiveFilter(prev => ({ ...prev, priceRange: { min: 0, max: 999999 } }))}>
              <Text style={[styles.chipLabel, { color: colors.primary }]}>السعر: {activeFilter.priceRange.min.toLocaleString('ar-SA')} - {activeFilter.priceRange.max.toLocaleString('ar-SA')}</Text>
              <Ionicons name="close-circle" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}
          {activeChipCount > 1 && (
            <TouchableOpacity style={[styles.chip, { backgroundColor: colors.danger + '20', borderColor: colors.danger + '40' }]}
              onPress={() => setActiveFilter(DEFAULT_FILTERS)}>
              <Ionicons name="close-outline" size={14} color={colors.danger} />
              <Text style={[styles.chipLabel, { color: colors.danger }]}>مسح الكل</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      <FilterPanel visible={filterPanelVisible} onClose={() => setFilterPanelVisible(false)} filters={activeFilter} onChange={setActiveFilter} />

      <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.stat}><Text style={[styles.statVal, { color: colors.text }]}>{total}</Text><Text style={[styles.statLbl, { color: colors.textMuted }]}>عقار</Text></View>
        <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
        <View style={styles.stat}><Text style={[styles.statVal, { color: colors.success }]}>{rentedUnits}</Text><Text style={[styles.statLbl, { color: colors.textMuted }]}>مؤجرة</Text></View>
        <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
        <View style={styles.stat}><Text style={[styles.statVal, { color: colors.warning }]}>{vacantUnits}</Text><Text style={[styles.statLbl, { color: colors.textMuted }]}>شاغرة</Text></View>
        <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
        <View style={styles.stat}><Text style={[styles.statVal, { color: overallOccupancy >= 80 ? colors.success : overallOccupancy >= 50 ? colors.warning : colors.danger }]}>{overallOccupancy}%</Text><Text style={[styles.statLbl, { color: colors.textMuted }]}>إشغال</Text></View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[{ paddingVertical: Theme.spacing.sm, paddingBottom: 32 }, isWide && { paddingHorizontal: Theme.spacing.base }]}>
        {filteredProperties.length === 0 ? (
          <EmptyState icon="business-outline" title="لا توجد عقارات"
            subtitle={search || activeChipCount > 0 ? 'لم يتم العثور على نتائج تطابق الفلاتر المحددة' : 'ابدأ بإضافة عقارك الأول'}
            actionLabel={search || activeChipCount > 0 ? 'إعادة ضبط الفلاتر' : (canWrite ? 'إضافة عقار' : undefined)}
            onAction={search || activeChipCount > 0 ? () => { setSearch(''); setActiveFilter(DEFAULT_FILTERS); } : (canWrite ? () => router.push('/add-property') : undefined)}
          />
        ) : groupByCity && filteredProperties.length > 0 ? (
          // ── Hierarchical Grouped View: City → Properties ──
          (() => {
            const cityMap = new Map<string, typeof filteredProperties>();
            const noCityKey = '__no_city__';
            filteredProperties.forEach(p => {
              const cId = p.cityId || noCityKey;
              if (!cityMap.has(cId)) cityMap.set(cId, []);
              cityMap.get(cId)!.push(p);
            });
            const knownCityIds = new Set(cities.map(c => c.id));
            const cityGroups: { cityId: string; cityName: string; region?: string; properties: typeof filteredProperties }[] = [];
            const unknownGroups: typeof cityGroups = [];
            cityMap.forEach((props, cId) => {
              if (cId === noCityKey) {
                unknownGroups.push({ cityId: '', cityName: 'بدون مدينة', properties: props });
              } else if (knownCityIds.has(cId)) {
                const city = cities.find(c => c.id === cId)!;
                cityGroups.push({ cityId: cId, cityName: city.displayName || city.name, region: city.region, properties: props });
              } else {
                unknownGroups.push({ cityId: cId, cityName: cId, properties: props });
              }
            });
            cityGroups.sort((a, b) => a.cityName.localeCompare(b.cityName));
            const allGroups = [...cityGroups, ...unknownGroups];

            return (
              <View style={{ paddingHorizontal: Theme.spacing.base, paddingBottom: 32 }}>
                {allGroups.map(group => {
                  const rentedInGroup = group.properties.reduce((sum, p) => sum + units.filter(u => u.propertyId === p.id && u.status === 'rented').length, 0);
                  const totalUnitsInGroup = group.properties.reduce((sum, p) => sum + units.filter(u => u.propertyId === p.id).length, 0);
                  return (
                    <CollapsibleSection
                      key={group.cityId || group.cityName}
                      title={group.cityName}
                      subtitle={group.region}
                      icon="location-outline"
                      count={group.properties.length}
                      headerColor={group.cityId ? colors.primary + '10' : colors.textMuted + '15'}
                      defaultExpanded={true}
                      rightAction={
                        <View style={[styles.groupStatBadge, { backgroundColor: totalUnitsInGroup > 0 ? colors.success + '30' : colors.textMuted + '20' }]}>
                          <Text style={{ color: totalUnitsInGroup > 0 ? colors.success : colors.textMuted, fontSize: 11, fontWeight: '600' }}>
                            {rentedInGroup}/{totalUnitsInGroup}
                          </Text>
                        </View>
                      }
                    >
                      {group.properties.map(p => {
                        const unitId = (p as any)._unitId as string | undefined;
                        if (unitId) {
                          const exUnit = externalOwnedUnits.find(u => u.id === unitId);
                          if (!exUnit) return null;
                          return <UnitCard key={p.id} unit={exUnit} propertyName={exUnit.parentPropertyName} />;
                        }
                        const stats = getUnitStats(p);
                        return <PropertyCard key={p.id} property={{ ...p, totalUnits: stats.total }} photos={propertyPhotos[p.id] ?? []} rentedCount={stats.rented} vacantCount={stats.vacant}
                          onDelete={canDelete ? () => requestDelete({ id: p.id, entityType: 'property', label: p.name }) : undefined} />;
                      })}
                    </CollapsibleSection>
                  );
                })}
              </View>
            );
          })()
        ) : isWide && !groupByCity ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Theme.spacing.sm }}>
            {filteredProperties.map(p => {
              const unitId = (p as any)._unitId as string | undefined;
              if (unitId) {
                const exUnit = externalOwnedUnits.find(u => u.id === unitId);
                if (!exUnit) return null;
                return <View key={p.id} style={{ width: cols3 ? '32%' : '48%', flexGrow: 1 }}><UnitCard unit={exUnit} propertyName={exUnit.parentPropertyName} /></View>;
              }
              const stats = getUnitStats(p);
              return <View key={p.id} style={{ width: cols3 ? '32%' : '48%', flexGrow: 1 }}><PropertyCard property={{ ...p, totalUnits: stats.total }} photos={propertyPhotos[p.id] ?? []} rentedCount={stats.rented} vacantCount={stats.vacant}
                onDelete={canDelete ? () => requestDelete({ id: p.id, entityType: 'property', label: p.name }) : undefined} /></View>;
            })}
          </View>
        ) : !groupByCity && (
          filteredProperties.map(p => {
            const unitId = (p as any)._unitId as string | undefined;
            if (unitId) {
              const exUnit = externalOwnedUnits.find(u => u.id === unitId);
              if (!exUnit) return null;
              return <UnitCard key={p.id} unit={exUnit} propertyName={exUnit.parentPropertyName} />;
            }
            const stats = getUnitStats(p);
            return <PropertyCard key={p.id} property={{ ...p, totalUnits: stats.total }} photos={propertyPhotos[p.id] ?? []} rentedCount={stats.rented} vacantCount={stats.vacant}
              onDelete={canDelete ? () => requestDelete({ id: p.id, entityType: 'property', label: p.name }) : undefined} />;
          })
        )}
      </ScrollView>

      <ConfirmModal visible={!!pending} onClose={cancelDelete} onConfirm={confirmDelete} title="تأكيد الحذف"
        message={`هل أنت متأكد أنك تريد حذف "${pending?.label}"؟ سيتم حذف جميع الوحدات والعقود المرتبطة. لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="تأكيد الحذف" variant="danger" />
      <AlertModal visible={!!blocked} onClose={clearBlocked} title="لا يمكن الحذف" message={blocked ?? ''} variant="warning" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  headerTitle: { color: '#FFFFFF', fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold },
  addBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  countBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: Theme.radius.full },
  countText: { color: '#FFFFFF', fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },
  statsRow: { flexDirection: 'row', marginHorizontal: Theme.spacing.base, borderRadius: Theme.radius.md, borderWidth: 1, padding: Theme.spacing.md, marginBottom: 8 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold },
  statLbl: { fontSize: Theme.fontSize.xs },
  statDiv: { width: 1, marginVertical: 4 },
  chipsBar: { maxHeight: 40, flexGrow: 0 },
  chipsBarContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipLabel: { fontSize: 12, fontWeight: '600' },
  groupToggle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  groupStatBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
});