import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { AppHeader } from '../../components/ui/AppHeader';
import { DeleteButton } from '../../components/ui/DeleteButton';
import { ConfirmModal, AlertModal } from '../../components/ui/Modal';
import { useDelete } from '../../hooks/useDelete';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { UnitCard } from '../../components/ui/UnitCard';
import { ResponsiveGrid } from '../../components/ui/ResponsiveGrid';
import { EmptyState } from '../../components/ui/EmptyState';
import { AttachmentPanel } from '../../components/features/AttachmentPanel';
import { PhotoGallery } from '../../components/features/PhotoGallery';
import { formatCurrency, getPropertyTypeLabel } from '../../data/mockData';
import { useAppTheme } from '../../hooks/useAppTheme';

type Tab = 'units' | 'maintenance' | 'docs';

export default function PropertyDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { colors } = useAppTheme();
  const { properties, owners, units, maintenance, contracts, payments,
          propertyPhotos, addPropertyPhoto, removePropertyPhoto, setPropertyMainPhoto,
          canWrite, canDelete } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('units');
  const { pending, pendingMode, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete } = useDelete();

  const property = properties.find(p => p.id === id);
  const photos   = id ? (propertyPhotos[id] ?? []) : [];

  const handleAddPhoto    = useCallback((uri: string)     => { if (id) addPropertyPhoto(id, uri); },    [id, addPropertyPhoto]);
  const handleRemovePhoto = useCallback((photoId: string) => { if (id) removePropertyPhoto(id, photoId); }, [id, removePropertyPhoto]);
  const handleSetMain     = useCallback((photoId: string) => { if (id) setPropertyMainPhoto(id, photoId); }, [id, setPropertyMainPhoto]);
  const owner = property ? owners.find(o => o.id === property.ownerId) ?? null : null;
  const propUnits = units.filter(u => u.propertyId === id);
  const propMaintenance = maintenance.filter(m => m.propertyId === id);
  const isSingleUnit = (property?.unitStructure ?? 'multi') === 'single';

  const rentedCount = propUnits.filter(u => u.status === 'rented').length;
  const vacantCount = propUnits.filter(u => u.status === 'vacant').length;
  const monthlyRevenue = useMemo(() => {
    const activeContractIds = contracts.filter(c => c.status === 'active').map(c => c.id);
    const rentedUnits = propUnits.filter(u => u.currentContractId && activeContractIds.includes(u.currentContractId));
    return rentedUnits.reduce((sum, u) => sum + u.monthlyRent, 0);
  }, [propUnits, contracts]);

  if (!property) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="العقار" />
        <EmptyState icon="business-outline" title="العقار غير موجود" />
      </View>
    );
  }

  const typeIcon: Record<string, string> = { apartment: 'business-outline', villa: 'home-outline', building: 'layers-outline', tower: 'telescope-outline', office: 'briefcase-outline', shop: 'storefront-outline' };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={property.name}
        rightText={canWrite ? { label: 'تعديل', onPress: () => router.push(`/edit-property/${id}`) } : undefined}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* ── Photo Gallery ── */}
        <PhotoGallery
          entityType="property"
          entityId={id ?? ''}
          photos={photos}
          onAdd={handleAddPhoto}
          onRemove={handleRemovePhoto}
          onSetMain={handleSetMain}
        />

        {/* ── Property Info Card ── */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.infoTitleRow}>
            <StatusBadge status={property.status} />
            <Text style={[styles.infoTitle, { color: colors.text }]}>{property.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.infoSub, { color: colors.textSecondary }]}>{property.location}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="layers-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.infoSub, { color: colors.textSecondary }]}>{property.floors} طوابق · {getPropertyTypeLabel(property.type)}</Text>
          </View>
          {owner && (
            <TouchableOpacity style={styles.infoRow} onPress={() => router.push(`/owner/${owner.id}`)}>
              <Ionicons name="person-outline" size={14} color={colors.primary} />
              <Text style={[styles.infoSub, { color: colors.primary }]}>{owner.name}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* KPI Row */}
        <View style={[styles.kpiRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: 'إجمالي الوحدات', value: propUnits.length, color: colors.text },
            { label: 'مؤجرة', value: rentedCount, color: colors.success },
            { label: 'شاغرة', value: vacantCount, color: colors.secondary },
            { label: 'الإيراد الشهري', value: formatCurrency(monthlyRevenue), color: '#8E44AD' },
          ].map((kpi, i) => (
            <React.Fragment key={kpi.label}>
              {i > 0 && <View style={[styles.kpiDiv, { backgroundColor: colors.border }]} />}
              <View style={styles.kpi}>
                <Text style={[styles.kpiVal, { color: kpi.color }]}>{kpi.value}</Text>
                <Text style={[styles.kpiLbl, { color: colors.textMuted }]}>{kpi.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Description */}
        {property.description && (
          <View style={[styles.descCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.descTitle, { color: colors.text }]}>الوصف</Text>
            <Text style={[styles.descText, { color: colors.textSecondary }]}>{property.description}</Text>
          </View>
        )}

        {/* Tabs */}
        <View style={[styles.tabsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { key: 'units', label: `الوحدات (${propUnits.length})` },
            { key: 'maintenance', label: `الصيانة (${propMaintenance.length})` },
            { key: 'docs', label: 'الوثائق' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && { borderBottomWidth: 2, borderBottomColor: colors.primary }]}
              onPress={() => setActiveTab(tab.key as Tab)}
            >
              <Text style={[styles.tabText, { color: activeTab === tab.key ? colors.primary : colors.textSecondary }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'units' && (
          <View style={{ marginTop: 8 }}>
            {propUnits.length === 0 ? (
              <EmptyState icon="home-outline" title="لا توجد وحدات" actionLabel={canWrite && !isSingleUnit ? 'إضافة وحدة' : undefined} onAction={canWrite && !isSingleUnit ? () => router.push('/add-unit') : undefined} />
            ) : (
              <ResponsiveGrid>{propUnits.map(u => <UnitCard key={u.id} unit={u} />)}</ResponsiveGrid>
            )}
          </View>
        )}

        {activeTab === 'maintenance' && (
          <View style={{ marginTop: 8 }}>
            {propMaintenance.length === 0 ? (
              <EmptyState icon="construct-outline" title="لا توجد طلبات صيانة" actionLabel={canWrite ? 'فتح طلب' : undefined} onAction={canWrite ? () => router.push('/add-maintenance') : undefined} />
            ) : (
              propMaintenance.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.maintCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push(`/maintenance/${m.id}`)}
                  activeOpacity={0.85}
                >
                  <View style={styles.maintRow}>
                    <StatusBadge status={m.status} size="sm" />
                    <Text style={[styles.maintTitle, { color: colors.text }]}>{m.title}</Text>
                  </View>
                  <View style={styles.maintRow}>
                    <StatusBadge status={m.priority} size="sm" />
                    <Text style={[styles.maintSub, { color: colors.textSecondary }]} numberOfLines={1}>{m.description}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {activeTab === 'docs' && (
          <View style={{ paddingHorizontal: Theme.spacing.base, paddingTop: Theme.spacing.sm }}>
            <AttachmentPanel entityType="property" entityId={id!} />
          </View>
        )}

        {canDelete && (
          <DeleteButton
            variant="full"
            label="حذف العقار"
            onPress={() => requestDelete({
              id: id!,
              entityType: 'property',
              label: property.name,
              onSuccess: () => router.back(),
            })}
          />
        )}
      </ScrollView>

      {/* FAB — إضافة وحدة، مخفي للعقارات الفردية وللـ viewer */}
      {canWrite && !isSingleUnit && <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/add-unit')}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>}

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
  infoCard: {
    margin: Theme.spacing.base, marginTop: Theme.spacing.sm,
    borderRadius: Theme.radius.lg,
    borderWidth: 1, padding: Theme.spacing.md, gap: 6,
  },
  infoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  infoTitle:    { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold, flex: 1, textAlign: 'right' },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoSub:      { fontSize: Theme.fontSize.sm },
  heroCard: {
    margin: Theme.spacing.base,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    padding: Theme.spacing.md,
    flexDirection: 'row',
    gap: 12,
  },
  heroIcon: {
    width: 80, height: 80, borderRadius: Theme.radius.lg,
    justifyContent: 'center', alignItems: 'center',
  },
  heroInfo: { flex: 1, gap: 5 },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  heroTitle: { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold, flex: 1 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroSub: { fontSize: Theme.fontSize.sm },
  kpiRow: {
    marginHorizontal: Theme.spacing.base,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    padding: Theme.spacing.md,
  },
  kpi: { flex: 1, alignItems: 'center', gap: 2 },
  kpiVal: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  kpiLbl: { fontSize: Theme.fontSize.xs, textAlign: 'center' },
  kpiDiv: { width: 1, marginVertical: 4 },
  descCard: {
    margin: Theme.spacing.base,
    marginTop: 12,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    padding: Theme.spacing.md,
    gap: 6,
  },
  descTitle: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  descText: { fontSize: Theme.fontSize.md, lineHeight: 22, textAlign: 'right' },
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: Theme.spacing.base,
    marginTop: 12,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  maintCard: {
    marginHorizontal: Theme.spacing.base,
    marginBottom: Theme.spacing.sm,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    padding: Theme.spacing.md,
    gap: 6,
  },
  maintRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  maintTitle: { flex: 1, fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold },
  maintSub: { flex: 1, fontSize: Theme.fontSize.sm },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    ...Theme.shadow.lg,
  },
});
