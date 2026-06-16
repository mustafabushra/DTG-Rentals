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
import { FileService } from '../domain/services/FileService';
import { FileViewer } from '../components/features/FileViewer';
import { AddAttachmentModal } from '../components/features/AddAttachmentModal';
import type { Attachment } from '../domain/models';

type CategoryFilter = 'all' | string;

export default function AttachmentsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { attachments, dataLoading, secondaryLoading, deleteAttachment } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const { pending, pendingMode, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete } = useDelete();

  const categories = useMemo(() => {
    const cats = new Set<string>();
    attachments.forEach(a => {
      if (a.category) cats.add(a.category);
    });
    return Array.from(cats);
  }, [attachments]);

  const filterOptions = [
    { label: 'الكل', value: 'all' },
    ...categories.map(cat => ({
      label: FileService.categoryLabel(cat),
      value: cat
    }))
  ];

  const entityLabels: Record<string, string> = {
    property: 'عقار',
    unit: 'وحدة',
    contract: 'عقد',
    payment: 'دفعة',
    maintenance: 'صيانة',
    owner: 'مالك',
  };

  const filtered = useMemo(() => {
    return attachments.filter(a => {
      const matchSearch = !search ||
        (a.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (a.notes ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (entityLabels[a.entityType] ?? a.entityType).includes(search);

      const matchFilter = filter === 'all' || a.category === filter;
      return matchSearch && matchFilter;
    });
  }, [attachments, search, filter]);

  if (dataLoading || secondaryLoading) return <ListSkeleton count={5} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={`المرفقات (${attachments.length})`}
      />

      <SearchBar value={search} onChangeText={setSearch} placeholder="ابحث عن وثيقة، ملاحظة أو نوع..." />

      <FilterBar options={filterOptions} value={filter} onChange={v => setFilter(v as CategoryFilter)} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="document-outline"
            title="لا توجد مرفقات"
            subtitle={search ? 'لا توجد نتائج تطابق بحثك' : 'لا توجد ملفات مرفوعة حالياً'}
          />
        ) : (
          <ResponsiveGrid>{filtered.map(att => {
            const icon = FileService.typeIcon(att.type);
            const categoryLabel = att.category ? FileService.categoryLabel(att.category) : 'عام';

            return (
              <TouchableOpacity
                key={att.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setSelectedAttachment(att)}
                activeOpacity={0.85}
              >
                <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name={icon} size={24} color={colors.primary} />
                </View>
                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">{att.name}</Text>
                    <StatusBadge status={att.expiryStatus === 'expired' ? 'danger' : att.expiryStatus === 'expiring_soon' ? 'warning' : 'active'} size="sm" />
                  </View>
                  <View style={styles.row}>
                    <Ionicons name="folder-outline" size={13} color={colors.textSecondary} />
                    <Text style={[styles.sub, { color: colors.textSecondary }]}>{categoryLabel}</Text>
                    <Text style={[styles.separator, { color: colors.border }]}> • </Text>
                    <Ionicons name="link-outline" size={13} color={colors.textSecondary} />
                    <Text style={[styles.sub, { color: colors.textSecondary }]}>{entityLabels[att.entityType] ?? att.entityType}</Text>
                  </View>
                  {att.size && (
                    <View style={styles.row}>
                      <Ionicons name="scale-outline" size={13} color={colors.textSecondary} />
                      <Text style={[styles.sub, { color: colors.textSecondary }]}>{FileService.formatSize(att.size)}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardTrailing}>
                  <DeleteButton variant="icon" onPress={() => requestDelete({ id: att.id, entityType: 'attachment', label: att.name })} />
                  <Ionicons name="chevron-forward-outline" size={18} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            );
          })}</ResponsiveGrid>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => setIsAdding(true)}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      <FileViewer
        attachment={selectedAttachment}
        onClose={() => setSelectedAttachment(null)}
      />

      <AddAttachmentModal
        visible={isAdding}
        onClose={() => setIsAdding(false)}
        onSave={() => {
          // Refreshing the list is handled by useApp state updates
        }}
      />

      <ConfirmModal
        visible={!!pending}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="تأكيد الحذف"
        message={`هل أنت متأكد أنك تريد حذف الوثيقة "${pending?.label}"؟ لا يمكن التراجع عن هذا الإجراء.`}
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
  iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, flex: 1, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sub: { fontSize: Theme.fontSize.sm, textAlign: 'right' },
  separator: { fontSize: Theme.fontSize.sm, textAlign: 'right' },
  cardTrailing: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});
