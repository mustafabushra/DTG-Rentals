import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
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
import { FilterBar, PROPERTY_FILTERS } from '../../components/ui/FilterBar';
import { ConfirmModal, AlertModal } from '../../components/ui/Modal';
import { useDelete } from '../../hooks/useDelete';
import { PropertyType } from '../../data/mockData';
import { trackScreen } from '../../lib/analytics';
import { useAppTheme } from '../../hooks/useAppTheme';

type FilterType = 'all' | PropertyType;

export default function PropertiesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { properties, units, propertyPhotos, canWrite, canDelete, dataLoading, externalOwnedUnits, isOwner } = useApp();
  const { isSmallPhone, hPad } = useScreenSize();

  useEffect(() => { trackScreen('Properties'); }, []);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const { pending, pendingMode, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete } = useDelete();
  const { isWide, cols3, isDesktop } = useScreenSize();
  const { toggle: toggleSidebar } = useSidebar();

  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
      const matchSearch = !search || (p.name ?? '').includes(search) || (p.location ?? '').includes(search);
      const matchFilter = activeFilter === 'all' || p.type === activeFilter;
      return matchSearch && matchFilter;
    });
  }, [properties, search, activeFilter]);

  const getUnitStats = (p: typeof properties[0]) => {
    const propUnits = units.filter(u => u.propertyId === p.id);
    return {
      rented: propUnits.filter(u => u.status === 'rented').length,
      vacant: propUnits.filter(u => u.status === 'vacant').length,
      total: propUnits.length,
    };
  };

  const total = properties.length;
  const totalUnits = units.length;
  const rentedUnits = units.filter(u => u.status === 'rented').length;
  const vacantUnits = units.filter(u => u.status === 'vacant').length;
  const overallOccupancy = totalUnits > 0 ? Math.round((rentedUnits / totalUnits) * 100) : 0;

  if (dataLoading) return <ListSkeleton count={5} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (isSmallPhone ? 6 : 8), paddingHorizontal: hPad, backgroundColor: colors.primary }]}>
        <View style={styles.headerRow}>
          {/* Right in RTL: hamburger on mobile web, add button otherwise */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {Platform.OS === 'web' && !isDesktop && (
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={toggleSidebar}>
                <Ionicons name="menu-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            {canWrite && (
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                onPress={() => router.push('/bulk-import-properties')}
              >
                <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            {canWrite && (
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                onPress={() => router.push('/add-property')}
              >
                <Ionicons name="add" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.headerTitle}>العقارات</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{total}</Text>
          </View>
        </View>
      </View>

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="ابحث بالاسم أو الموقع..."
        onFilterPress={() => router.push('/filter-properties')}
      />

      <FilterBar options={PROPERTY_FILTERS} value={activeFilter} onChange={v => setActiveFilter(v as FilterType)} />

      {/* Stats Row */}
      <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.stat}>
          <Text style={[styles.statVal, { color: colors.text }]}>{total}</Text>
          <Text style={[styles.statLbl, { color: colors.textMuted }]}>عقار</Text>
        </View>
        <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statVal, { color: colors.success }]}>{rentedUnits}</Text>
          <Text style={[styles.statLbl, { color: colors.textMuted }]}>مؤجرة</Text>
        </View>
        <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statVal, { color: colors.warning }]}>{vacantUnits}</Text>
          <Text style={[styles.statLbl, { color: colors.textMuted }]}>شاغرة</Text>
        </View>
        <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statVal, { color: overallOccupancy >= 80 ? colors.success : overallOccupancy >= 50 ? colors.warning : colors.danger }]}>
            {overallOccupancy}%
          </Text>
          <Text style={[styles.statLbl, { color: colors.textMuted }]}>إشغال</Text>
        </View>
      </View>

      {/* List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { paddingVertical: Theme.spacing.sm, paddingBottom: 32 },
          isWide && { paddingHorizontal: Theme.spacing.base },
        ]}
      >
        {filteredProperties.length === 0 ? (
          <EmptyState
            icon="business-outline"
            title="لا توجد عقارات"
            subtitle={search ? 'لم يتم العثور على نتائج للبحث' : 'ابدأ بإضافة عقارك الأول'}
            actionLabel={canWrite ? 'إضافة عقار' : undefined}
            onAction={canWrite ? () => router.push('/add-property') : undefined}
          />
        ) : isWide ? (
          // Grid layout on wide screens
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Theme.spacing.sm }}>
            {filteredProperties.map(p => {
              const stats = getUnitStats(p);
              return (
                <View key={p.id} style={{ width: cols3 ? '32%' : '48%', flexGrow: 1 }}>
                  <PropertyCard
                    property={{ ...p, totalUnits: stats.total }}
                    photos={propertyPhotos[p.id] ?? []}
                    rentedCount={stats.rented}
                    vacantCount={stats.vacant}
                    onDelete={canDelete ? () => requestDelete({ id: p.id, entityType: 'property', label: p.name }) : undefined}
                  />
                </View>
              );
            })}
          </View>
        ) : (
          filteredProperties.map(p => {
            const stats = getUnitStats(p);
            return (
              <PropertyCard
                key={p.id}
                property={{ ...p, totalUnits: stats.total }}
                photos={propertyPhotos[p.id] ?? []}
                rentedCount={stats.rented}
                vacantCount={stats.vacant}
                onDelete={() => requestDelete({ id: p.id, entityType: 'property', label: p.name })}
              />
            );
          })
        )}

        {/* ── وحداتي في عقارات أخرى (للمالك فقط) ── */}
        {isOwner && externalOwnedUnits.length > 0 && (
          <View style={{ marginTop: 16, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: hPad, marginBottom: 10 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: 'rgba(142,68,173,0.12)', borderRadius: 20,
                paddingHorizontal: 12, paddingVertical: 5 }}>
                <Ionicons name="layers-outline" size={14} color="#8E44AD" />
                <Text style={{ color: '#8E44AD', fontSize: 13, fontWeight: '700' }}>
                  وحداتي في عقارات أخرى ({externalOwnedUnits.length})
                </Text>
              </View>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>
            {externalOwnedUnits.map(u => (
              <UnitCard key={u.id} unit={u} propertyName={u.parentPropertyName} />
            ))}
          </View>
        )}
      </ScrollView>

      <ConfirmModal
        visible={!!pending}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="تأكيد الحذف"
        message={`هل أنت متأكد أنك تريد حذف "${pending?.label}"؟ سيتم حذف جميع الوحدات والعقود المرتبطة. لا يمكن التراجع عن هذا الإجراء.`}
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
  header: {
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: Theme.fontSize.xl,
    fontWeight: Theme.fontWeight.bold,
  },
  addBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: Theme.radius.full,
  },
  countText: { color: '#FFFFFF', fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: Theme.spacing.base,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    padding: Theme.spacing.md,
    marginBottom: 8,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold },
  statLbl: { fontSize: Theme.fontSize.xs },
  statDiv: { width: 1, marginVertical: 4 },
});
