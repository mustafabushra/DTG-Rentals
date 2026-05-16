import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useScreenSize } from '../../hooks/useScreenSize';
import { useSidebar } from '../../context/SidebarContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { OwnerCard } from '../../components/ui/OwnerCard';
import { SearchBar } from '../../components/ui/SearchBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import { ConfirmModal, AlertModal } from '../../components/ui/Modal';
import { useDelete } from '../../hooks/useDelete';
import { trackScreen } from '../../lib/analytics';
import { useAppTheme } from '../../hooks/useAppTheme';

export default function OwnersScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { owners, canWrite, canDelete, dataLoading } = useApp();
  const { isSmallPhone: ownerSmallPhone, hPad: ownerHPad } = useScreenSize();

  useEffect(() => { trackScreen('Owners'); }, []);
  const [search, setSearch] = useState('');
  const { pending, pendingMode, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete } = useDelete();
  const { isWide, isDesktop } = useScreenSize();
  const { toggle: toggleSidebar } = useSidebar();

  const filteredOwners = useMemo(() => {
    if (!search) return owners;
    const q = search.toLowerCase();
    return owners.filter(o =>
      (o.name  ?? '').toLowerCase().includes(q) ||
      (o.phone ?? '').includes(q) ||
      (o.email ?? '').toLowerCase().includes(q)
    );
  }, [owners, search]);

  if (dataLoading) return <ListSkeleton count={5} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (ownerSmallPhone ? 6 : 8), paddingHorizontal: ownerHPad, backgroundColor: colors.primary }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerActions}>
            {Platform.OS === 'web' && !isDesktop && (
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={toggleSidebar}>
                <Ionicons name="menu-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            {canWrite && (
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                onPress={() => router.push('/add-owner')}
              >
                <Ionicons name="add" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.headerTitle}>الملاك</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{owners.length}</Text>
          </View>
        </View>
      </View>

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="ابحث بالاسم أو الهاتف..."
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { paddingVertical: Theme.spacing.sm, paddingBottom: 32 },
          isWide && { paddingHorizontal: Theme.spacing.base },
        ]}
      >
        {filteredOwners.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="لا يوجد ملاك"
            subtitle={search ? 'لم يتم العثور على نتائج' : 'ابدأ بإضافة مالك جديد'}
            actionLabel={canWrite ? 'إضافة مالك' : undefined}
            onAction={canWrite ? () => router.push('/add-owner') : undefined}
          />
        ) : isWide ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Theme.spacing.sm }}>
            {filteredOwners.map(o => (
              <View key={o.id} style={{ width: '48%', flexGrow: 1 }}>
                <OwnerCard owner={o} onDelete={canDelete ? () => requestDelete({ id: o.id, entityType: 'owner', label: o.name }) : undefined} />
              </View>
            ))}
          </View>
        ) : (
          filteredOwners.map(o => (
            <OwnerCard
              key={o.id}
              owner={o}
              onDelete={() => requestDelete({ id: o.id, entityType: 'owner', label: o.name })}
            />
          ))
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
