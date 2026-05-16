import React, { useState, useMemo, useEffect } from 'react';
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
  const { contracts, canWrite, canDelete, dataLoading } = useApp();
  const { isSmallPhone: cSmallPhone, hPad: cHPad } = useScreenSize();

  useEffect(() => { trackScreen('Contracts'); }, []);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const { pending, pendingMode, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete } = useDelete();
  const { isWide, isDesktop } = useScreenSize();
  const { toggle: toggleSidebar } = useSidebar();

  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      const matchSearch = !search || (c.contractNumber ?? '').includes(search);
      const matchFilter = activeFilter === 'all' || c.status === activeFilter;
      return matchSearch && matchFilter;
    });
  }, [contracts, search, activeFilter]);

  if (dataLoading) return <ListSkeleton count={5} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (cSmallPhone ? 6 : 8), paddingHorizontal: cHPad, backgroundColor: colors.primary }]}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {Platform.OS === 'web' && !isDesktop && (
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={toggleSidebar}>
                <Ionicons name="menu-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            {canWrite && (
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                onPress={() => router.push('/add-contract')}
              >
                <Ionicons name="add" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.headerTitle}>العقود</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{contracts.length}</Text>
          </View>
        </View>
      </View>

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="ابحث برقم العقد..."
      />

      <FilterBar options={CONTRACT_FILTERS} value={activeFilter} onChange={v => setActiveFilter(v as FilterStatus)} />

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
                <ContractCard
                  contract={c}
                  onDelete={canDelete ? () => requestDelete({ id: c.id, entityType: 'contract', label: c.contractNumber ?? c.id }) : undefined}
                />
              </View>
            ))}
          </View>
        ) : (
          filteredContracts.map(c => (
            <ContractCard
              key={c.id}
              contract={c}
              onDelete={() => requestDelete({ id: c.id, entityType: 'contract', label: c.contractNumber ?? c.id })}
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
    fontSize: Theme.fontSize.xl,
    fontWeight: Theme.fontWeight.bold,
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
