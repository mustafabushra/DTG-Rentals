import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { AppHeader } from '../../components/ui/AppHeader';
import { DeleteButton } from '../../components/ui/DeleteButton';
import { ConfirmModal, AlertModal } from '../../components/ui/Modal';
import { useDelete } from '../../hooks/useDelete';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { AttachmentPanel } from '../../components/features/AttachmentPanel';
import { PhotoGallery } from '../../components/features/PhotoGallery';
import { formatCurrency, getUnitTypeLabel } from '../../data/mockData';
import { CurrencyText } from '../../components/ui/CurrencyText';
import { useAppTheme } from '../../hooks/useAppTheme';

export default function UnitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const {
    units, tenants, properties, maintenance, contracts,
    unitPhotos: allUnitPhotos, addUnitPhoto, removeUnitPhoto, setUnitMainPhoto,
    canWrite, canDelete,
  } = useApp();
  const { pending, pendingMode, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete } = useDelete();

  const unit     = units.find(u => u.id === id);
  const property = unit ? properties.find(p => p.id === unit.propertyId) ?? null : null;
  const tenant   = unit?.currentTenantId ? tenants.find(t => t.id === unit.currentTenantId) ?? null : null;
  const unitMaintenance = maintenance.filter(m => m.unitId === id);
  const unitContract = unit?.currentContractId ? contracts.find(c => c.id === unit.currentContractId) : null;
  const effectiveCurrency = unitContract?.currency ?? property?.currency ?? undefined;
  const unitPhotos = id ? (allUnitPhotos[id] ?? []) : [];

  if (!unit) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="الوحدة" />
        <EmptyState icon="home-outline" title="الوحدة غير موجودة" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={`وحدة ${unit.number}`}
        rightText={canWrite ? { label: 'تعديل', onPress: () => router.push(`/edit-unit/${id}`) } : undefined}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* ── Photo Gallery ── */}
        <PhotoGallery
          entityType="unit"
          entityId={id!}
          photos={unitPhotos}
          editable={canWrite}
          onAdd={uri => id && addUnitPhoto(id, uri)}
          onRemove={photoId => id && removeUnitPhoto(id, photoId)}
          onSetMain={photoId => id && setUnitMainPhoto(id, photoId)}
        />

        {/* Status & Title */}
        <View style={styles.titleRow}>
          <StatusBadge status={unit.status} />
          <Text style={[styles.unitTitle, { color: colors.text }]}>وحدة {unit.number}</Text>
        </View>
        {property && (
          <TouchableOpacity style={styles.propRow} onPress={() => router.push(`/property/${property.id}`)}>
            <Ionicons name="chevron-back-outline" size={14} color={colors.secondary} />
            <Text style={[styles.propName, { color: colors.secondary }]}>{property.name}</Text>
          </TouchableOpacity>
        )}

        {/* KPI Row */}
        <View style={[styles.kpiRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {([
            { label: 'المساحة',       value: `${unit.area} م²`,                   color: colors.text      },
            { label: 'الإيجار الشهري', value: '__currency__',                       color: colors.success   },
            { label: 'الطابق',        value: (unit.floor ?? 0).toString(),          color: colors.secondary },
            { label: 'النوع',         value: getUnitTypeLabel(unit.type) ?? '—',    color: colors.text      },
          ] as { label: string; value: string; color: string }[]).map((kpi, i) => (
            <React.Fragment key={kpi.label}>
              {i > 0 && <View style={[styles.div, { backgroundColor: colors.border }]} />}
              <View style={styles.kpi}>
                {kpi.value === '__currency__'
                  ? <CurrencyText amount={unit.monthlyRent ?? 0} currency={effectiveCurrency} style={[styles.kpiVal, { color: kpi.color }]} />
                  : <Text style={[styles.kpiVal, { color: kpi.color }]} numberOfLines={1} adjustsFontSizeToFit>{kpi.value}</Text>
                }
                <Text style={[styles.kpiLbl, { color: colors.textMuted }]}>{kpi.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Description */}
        {unit.description && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>الوصف</Text>
            <Text style={[styles.desc, { color: colors.textSecondary }]}>{unit.description}</Text>
          </View>
        )}

        {/* Features */}
        {(unit.features ?? []).length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>المميزات</Text>
            <View style={styles.featuresWrap}>
              {(unit.features ?? []).map(feature => (
                <View key={feature} style={[styles.featureChip, { backgroundColor: colors.accent, borderColor: colors.border }]}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
                  <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Current Tenant */}
        {tenant && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>المستأجر الحالي</Text>
            <TouchableOpacity style={styles.tenantRow} onPress={() => router.push(`/tenant/${tenant.id}`)}>
              <Ionicons name="chevron-back-outline" size={16} color={colors.textMuted} />
              <View style={styles.tenantInfo}>
                <Text style={[styles.tenantName, { color: colors.text }]}>{tenant.name}</Text>
                <TouchableOpacity onPress={e => { e.stopPropagation(); tenant.phone && Linking.openURL(`tel:${tenant.phone}`); }}>
                  <Text style={[styles.tenantPhone, { color: colors.primary }]}>{tenant.phone}</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.tenantAvatar, { backgroundColor: colors.secondary }]}>
                <Text style={styles.tenantInitials}>{(tenant.name ?? '؟')[0]}</Text>
              </View>
            </TouchableOpacity>
            {unitContract && (
              <TouchableOpacity
                style={[styles.contractLink, { borderTopColor: colors.border }]}
                onPress={() => router.push(`/contract/${unitContract.id}`)}
              >
                <Ionicons name="chevron-back-outline" size={14} color={colors.secondary} />
                <Text style={[styles.contractLinkText, { color: colors.secondary }]}>
                  عقد {unitContract.contractNumber}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Maintenance History */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>سجل الصيانة ({unitMaintenance.length})</Text>
            {canWrite && (
              <TouchableOpacity onPress={() => router.push('/add-maintenance')}>
                <Text style={[styles.cardAction, { color: colors.secondary }]}>طلب صيانة</Text>
              </TouchableOpacity>
            )}
          </View>
          {unitMaintenance.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>لا توجد طلبات صيانة</Text>
          ) : (
            unitMaintenance.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[styles.maintRow, { borderBottomColor: colors.border }]}
                onPress={() => router.push(`/maintenance/${m.id}`)}
              >
                <Ionicons name="chevron-back-outline" size={14} color={colors.textMuted} />
                <View style={styles.maintInfo}>
                  <Text style={[styles.maintTitle, { color: colors.text }]}>{m.title}</Text>
                  <Text style={[styles.maintDate, { color: colors.textMuted }]}>{m.openedAt}</Text>
                </View>
                <StatusBadge status={m.status} size="sm" />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Attachments */}
        <View style={styles.card}>
          <AttachmentPanel entityType="unit" entityId={id!} />
        </View>

        {canDelete && (
          <DeleteButton
            variant="full"
            label="حذف الوحدة"
            onPress={() => requestDelete({
              id: id!,
              entityType: 'unit',
              label: `وحدة ${unit.number}`,
              onSuccess: () => router.back(),
            })}
          />
        )}
      </ScrollView>

      <ConfirmModal
        visible={!!pending}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="تأكيد الحذف"
        message={`هل أنت متأكد أنك تريد حذف "وحدة ${unit.number}"؟ سيتم إلغاء جميع العقود المرتبطة. لا يمكن التراجع عن هذا الإجراء.`}
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
  imagePlaceholder: {
    height: 180, justifyContent: 'center', alignItems: 'center', gap: 8,
    marginHorizontal: Theme.spacing.base, marginTop: Theme.spacing.base,
    borderRadius: Theme.radius.lg,
  },
  imageText: { fontSize: Theme.fontSize.md },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Theme.spacing.base, marginTop: 12,
  },
  unitTitle: { fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold },
  propRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Theme.spacing.base, marginTop: 4,
  },
  propName: { fontSize: Theme.fontSize.md },
  kpiRow: {
    marginHorizontal: Theme.spacing.base, marginTop: 12,
    borderRadius: Theme.radius.lg, borderWidth: 1,
    flexDirection: 'row', padding: Theme.spacing.md,
  },
  kpi: { flex: 1, alignItems: 'center', gap: 2 },
  kpiVal: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold, textAlign: 'center' },
  kpiLbl: { fontSize: 10, textAlign: 'center' },
  div: { width: 1, marginVertical: 4 },
  card: {
    marginHorizontal: Theme.spacing.base, marginTop: Theme.spacing.sm,
    borderRadius: Theme.radius.lg, borderWidth: 1,
    padding: Theme.spacing.md,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  cardAction: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  desc: { fontSize: Theme.fontSize.md, lineHeight: 22, marginTop: 4, textAlign: 'right' },
  featuresWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  featureChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Theme.radius.full, borderWidth: 1 },
  featureText: { fontSize: Theme.fontSize.sm },
  tenantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  tenantAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  tenantInitials: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  tenantInfo: { flex: 1 },
  tenantName: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  tenantPhone: { fontSize: Theme.fontSize.sm, textAlign: 'right' },
  contractLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  contractLinkText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.medium },
  maintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1 },
  maintInfo: { flex: 1 },
  maintTitle: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.medium, textAlign: 'right' },
  maintDate: { fontSize: Theme.fontSize.xs, textAlign: 'right' },
  emptyText: { textAlign: 'center', padding: 12, fontSize: Theme.fontSize.md },
});
