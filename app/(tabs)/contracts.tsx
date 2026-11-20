import { AppHeader } from '../../components/ui/AppHeader';
import React, { useState, useMemo, useEffect } from 'react';
import { HubTabs } from '../../components/navigation/HubTabs';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useScreenSize } from '../../hooks/useScreenSize';
import { useSidebar } from '../../context/SidebarContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { ContractCard } from '../../components/ui/ContractCard';
import { SearchBar } from '../../components/ui/SearchBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import { FilterBar, CONTRACT_FILTERS } from '../../components/ui/FilterBar';
import { ConfirmModal, AlertModal } from '../../components/ui/Modal';
import { useDelete } from '../../hooks/useDelete';
import { ContractStatus } from '../../data/mockData';
import { trackScreen } from '../../lib/analytics';
import { useAppTheme } from '../../hooks/useAppTheme';

type FilterStatus = 'all' | ContractStatus;

export default function ContractsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { contracts, tenants, units, properties, canWrite, canDelete, dataLoading } = useApp();
  const { isSmallPhone: cSmallPhone, hPad: cHPad } = useScreenSize();

  useEffect(() => { trackScreen('Contracts'); }, []);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const { pending, pendingMode, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete } = useDelete();
  const { isWide, isDesktop } = useScreenSize();
  const { toggle: toggleSidebar } = useSidebar();

  // البحث باسم المستأجر أو رقم الوحدة أو اسم العقار أو رقم العقد
  const haystack = (c: typeof contracts[0]) => {
    const t = tenants.find(x => x.id === c.tenantId);
    const u = units.find(x => x.id === c.unitId);
    const p = u ? properties.find(x => x.id === u.propertyId) : undefined;
    return [c.contractNumber, t?.name, u?.number, p?.name].filter(Boolean).join(' ').toLowerCase();
  };
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = { all: contracts.length };
    for (const c of contracts) m[c.status] = (m[c.status] ?? 0) + 1;
    return m;
  }, [contracts]);
  const filterOptions = useMemo(() => [
    { value: 'all', label: `الكل ${contracts.length}` },
    ...[['active', 'ساري'], ['expired', 'منتهي'], ['terminated', 'أُنهي'], ['cancelled', 'ملغي'], ['pending', 'معلّق']]
      .filter(([v]) => statusCounts[v])
      .map(([v, l]) => ({ value: v, label: `${l} ${statusCounts[v]}` })),
  ], [statusCounts, contracts.length]);

  const filteredContracts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = contracts.filter(c => (!q || haystack(c).includes(q)) && (activeFilter === 'all' || c.status === activeFilter));
    // الساري أولاً بالأقرب انتهاءً، ثم البقية بالأحدث
    return list.sort((a, b) => {
      const aa = a.status === 'active' ? 0 : 1, bb = b.status === 'active' ? 0 : 1;
      if (aa !== bb) return aa - bb;
      return aa === 0 ? a.endDate.localeCompare(b.endDate) : b.endDate.localeCompare(a.endDate);
    });
  }, [contracts, tenants, units, properties, search, activeFilter]);

  if (dataLoading) return <ListSkeleton count={5} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <AppHeader title="العقود والمستأجرون" showBack={false} actions={[
        canWrite && { icon: 'camera-outline', label: 'قراءة عقد من صورة', onPress: () => router.push('/scan-contract') },
        canWrite && { icon: 'add', label: 'إضافة عقد', primary: true, onPress: () => router.push('/add-contract') },
      ].filter(Boolean) as any} />
      <HubTabs hub="contracts" />

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="ابحث باسم المستأجر أو الوحدة أو رقم العقد..."
      />

      <FilterBar options={filterOptions} value={activeFilter} onChange={v => setActiveFilter(v as FilterStatus)} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { paddingVertical: Theme.spacing.sm, paddingBottom: 32 },
          isWide && { paddingHorizontal: Theme.spacing.base },
        ]}
      >
        {filteredContracts.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title="لا توجد عقود"
            subtitle={search ? 'لم يتم العثور على نتائج' : 'ابدأ بإضافة عقد جديد'}
            actionLabel={canWrite ? 'إضافة عقد' : undefined}
            onAction={canWrite ? () => router.push('/add-contract') : undefined}
          />
        ) : isWide ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Theme.spacing.sm }}>
            {filteredContracts.map(c => (
              <View key={c.id} style={{ width: '48%', flexGrow: 1 }}>
                <ContractCard contract={c} style={{ marginHorizontal: 0, marginBottom: 0 }} />
              </View>
            ))}
          </View>
        ) : (
          filteredContracts.map(c => (
            <ContractCard
              key={c.id}
              contract={c}
            />
          ))
        )}
      </ScrollView>

      <ConfirmModal
        visible={!!pending}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title={pendingMode === 'archive' ? 'أرشفة العقد' : 'تأكيد الحذف'}
        message={
          pendingMode === 'archive'
            ? `يحتوي عقد "${pending?.label}" على دفعات مسددة ولا يمكن حذفه.\nسيتم إلغاؤه وأرشفته مع الاحتفاظ بسجل الدفعات.`
            : `هل أنت متأكد أنك تريد حذف عقد "${pending?.label}"؟ لا يمكن التراجع عن هذا الإجراء.`
        }
        confirmLabel={pendingMode === 'archive' ? 'أرشفة العقد' : 'تأكيد الحذف'}
        variant={pendingMode === 'archive' ? 'warning' : 'danger'}
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
    fontSize: 18,
    fontWeight: '600',
  },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: Theme.radius.full,
  },
  countText: { color: '#FFFFFF', fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },
});
