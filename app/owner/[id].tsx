import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { AppHeader } from '../../components/ui/AppHeader';
import { PropertyCard } from '../../components/ui/PropertyCard';
import { UnitCard } from '../../components/ui/UnitCard';
import { ContractCard } from '../../components/ui/ContractCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { AttachmentPanel } from '../../components/features/AttachmentPanel';
import { DeleteButton } from '../../components/ui/DeleteButton';
import { ConfirmModal, AlertModal } from '../../components/ui/Modal';
import { useDelete } from '../../hooks/useDelete';
import { formatCurrency } from '../../data/mockData';
import { useAppTheme } from '../../hooks/useAppTheme';

export default function OwnerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const { owners, properties, units, contracts, payments, canWrite, canDelete } = useApp();
  const { pending, pendingMode, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete } = useDelete();

  const owner = owners.find(o => o.id === id);
  const ownerProperties = properties.filter(p => p.ownerId === id);

  // الوحدات الخارجية: مُسندة لهذا المالك في عقارات غيره
  const externalUnits = units.filter(u => u.ownerId === id && !ownerProperties.some(p => p.id === u.propertyId));

  const stats = useMemo(() => {
    const propIds = ownerProperties.map(p => p.id);
    const directUnits = units.filter(u => propIds.includes(u.propertyId) && (!u.ownerId || u.ownerId === id));
    const ownerUnits = [...directUnits, ...externalUnits];
    const ownerUnitIds = new Set(ownerUnits.map(u => u.id));

    // Derive rented count from active contracts — unit.status may be stale
    const activeContracts = contracts.filter(c => ownerUnitIds.has(c.unitId) && c.status === 'active');
    const rentedUnits = activeContracts.length;
    const monthlyRevenue = activeContracts.reduce((sum, c) => sum + Math.round(c.annualValue / 12), 0);

    const allOwnerContractIds = new Set(
      contracts.filter(c => ownerUnitIds.has(c.unitId)).map(c => c.id)
    );
    const ownerPayments = payments.filter(p => allOwnerContractIds.has(p.contractId));
    const totalCollected = ownerPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = ownerPayments.filter(p => p.status === 'pending' || p.status === 'overdue').reduce((sum, p) => sum + p.amount, 0);

    console.log('[OWNER_STATS]', {
      ownerId: id,
      propIds,
      units: ownerUnits.map(u => ({ id: u.id, propertyId: u.propertyId, status: u.status })),
      activeContracts: activeContracts.map(c => ({ id: c.id, unitId: c.unitId, annualValue: c.annualValue })),
      rentedUnits,
      monthlyRevenue,
      totalCollected,
      pendingAmount,
    });

    return {
      totalUnits: ownerUnits.length,
      rentedUnits,
      monthlyRevenue,
      totalCollected,
      pendingAmount,
    };
  }, [ownerProperties, externalUnits, units, contracts, payments, id]);

  const ownerActiveContracts = useMemo(() => {
    const propIds = ownerProperties.map(p => p.id);
    const directUnitIds = new Set(
      units.filter(u => propIds.includes(u.propertyId) && (!u.ownerId || u.ownerId === id)).map(u => u.id)
    );
    const externalUnitIds = new Set(externalUnits.map(u => u.id));
    const allUnitIds = new Set([...directUnitIds, ...externalUnitIds]);
    return contracts.filter(c => allUnitIds.has(c.unitId) && c.status === 'active');
  }, [ownerProperties, externalUnits, units, contracts, id]);

  const getUnitStats = (propertyId: string) => {
    const propUnits = units.filter(u => u.propertyId === propertyId);
    return {
      total:  propUnits.length,
      rented: propUnits.filter(u => u.status === 'rented').length,
      vacant: propUnits.filter(u => u.status === 'vacant').length,
    };
  };

  if (!owner) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="المالك" />
        <EmptyState icon="person-outline" title="المالك غير موجود" />
      </View>
    );
  }

  const initials = (owner.name ?? '؟').split(' ').slice(0, 2).map(n => n[0] ?? '').join('');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="تفاصيل المالك"
        rightText={canWrite ? { label: 'تعديل', onPress: () => router.push(`/edit-owner/${id}`) } : undefined}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{owner.name}</Text>
          <Text style={[styles.role, { color: colors.textSecondary }]}>مالك عقاري</Text>

          <View style={[styles.contactRow, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => owner.phone && Linking.openURL(`tel:${owner.phone}`).catch(() => Alert.alert('خطأ', 'تعذّر فتح تطبيق الهاتف'))}
              disabled={!owner.phone}
            >
              <Text style={[styles.contactValue, { color: colors.text }]}>{owner.phone || '—'}</Text>
              <Text style={[styles.contactLabel, { color: colors.textMuted }]}>الهاتف</Text>
              <View style={[styles.contactIcon, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="call" size={18} color={colors.success} />
              </View>
            </TouchableOpacity>
            <View style={[styles.contactDiv, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => owner.email && Linking.openURL(`mailto:${owner.email}`).catch(() => Alert.alert('خطأ', 'تعذّر فتح تطبيق البريد'))}
              disabled={!owner.email}
            >
              <Text style={[styles.contactValue, { color: colors.text }]} numberOfLines={1}>{owner.email || '—'}</Text>
              <Text style={[styles.contactLabel, { color: colors.textMuted }]}>البريد</Text>
              <View style={[styles.contactIcon, { backgroundColor: colors.secondary + '20' }]}>
                <Ionicons name="mail" size={18} color={colors.secondary} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* KPI */}
        <View style={[styles.kpiRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: 'العقارات', value: ownerProperties.length, color: colors.primary },
            { label: 'الوحدات', value: stats.totalUnits, color: colors.secondary },
            { label: 'المؤجرة', value: stats.rentedUnits, color: colors.success },
            { label: 'الإشغال', value: stats.totalUnits > 0 ? `${Math.round((stats.rentedUnits / stats.totalUnits) * 100)}%` : '0%', color: '#8E44AD' },
          ].map((kpi, i) => (
            <React.Fragment key={kpi.label}>
              {i > 0 && <View style={[styles.div, { backgroundColor: colors.border }]} />}
              <View style={styles.kpi}>
                <Text style={[styles.kpiVal, { color: kpi.color }]}>{kpi.value}</Text>
                <Text style={[styles.kpiLbl, { color: colors.textMuted }]}>{kpi.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* ID Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>معلومات الهوية</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoValue, { color: colors.text }]}>{owner.nationalId}</Text>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>رقم الهوية الوطنية</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>{owner.iban}</Text>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>رقم IBAN</Text>
          </View>
        </View>

        {/* Financial Summary */}
        <View style={[styles.finCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>الملخص المالي</Text>
          <View style={styles.finRow}>
            <Text style={[styles.finVal, { color: colors.success }]}>{formatCurrency(stats.totalCollected)}</Text>
            <Text style={[styles.finLabel, { color: colors.textSecondary }]}>إجمالي المحصل</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.finRow}>
            <Text style={[styles.finVal, { color: colors.warning }]}>{formatCurrency(stats.pendingAmount)}</Text>
            <Text style={[styles.finLabel, { color: colors.textSecondary }]}>المتأخر والمعلق</Text>
          </View>
        </View>

        {/* Properties */}
        <View style={styles.sectionPad}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>العقارات ({ownerProperties.length})</Text>
          {ownerProperties.length === 0 ? (
            <EmptyState icon="business-outline" title="لا توجد عقارات" />
          ) : (
            ownerProperties.map(p => {
              const s = getUnitStats(p.id);
              return <PropertyCard key={p.id} property={{ ...p, totalUnits: s.total }} rentedCount={s.rented} vacantCount={s.vacant} />;
            })
          )}
        </View>

        {/* وحدات في عقارات أخرى */}
        {externalUnits.length > 0 && (
          <View style={styles.sectionPad}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Ionicons name="layers-outline" size={16} color="#8E44AD" />
              <Text style={[styles.sectionTitle, { color: '#8E44AD', marginBottom: 0 }]}>
                وحدات في عقارات أخرى ({externalUnits.length})
              </Text>
            </View>
            {externalUnits.map(u => (
              <UnitCard key={u.id} unit={u}
                propertyName={properties.find(p => p.id === u.propertyId)?.name} />
            ))}
          </View>
        )}

        {/* Active Contracts */}
        {ownerActiveContracts.length > 0 && (
          <View style={styles.sectionPad}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>العقود النشطة ({ownerActiveContracts.length})</Text>
            {ownerActiveContracts.map(c => (
              <ContractCard key={c.id} contract={c} />
            ))}
          </View>
        )}

        {/* Attachments */}
        <View style={styles.sectionPad}>
          <AttachmentPanel entityType="owner" entityId={id!} />
        </View>

        {/* Delete */}
        {canDelete && (
          <DeleteButton
            variant="full"
            label="حذف المالك"
            onPress={() => requestDelete({
              id: id!,
              entityType: 'owner',
              label: owner.name,
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
  profileCard: {
    margin: Theme.spacing.base,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    gap: 6,
  },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  initials: { color: '#FFF', fontSize: 28, fontWeight: '700' },
  name: { fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold, textAlign: 'center' },
  role: { fontSize: Theme.fontSize.md, textAlign: 'center' },
  contactRow: { flexDirection: 'row', width: '100%', marginTop: 12, paddingTop: 12, borderTopWidth: 1, gap: 0 },
  contactItem: { flex: 1, alignItems: 'center', gap: 3 },
  contactIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  contactValue: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  contactLabel: { fontSize: Theme.fontSize.xs },
  contactDiv: { width: 1, marginHorizontal: 8 },
  kpiRow: {
    marginHorizontal: Theme.spacing.base,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    padding: Theme.spacing.md,
  },
  kpi: { flex: 1, alignItems: 'center', gap: 2 },
  kpiVal: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  kpiLbl: { fontSize: 10, textAlign: 'center' },
  div: { width: 1, marginVertical: 4 },
  infoCard: {
    margin: Theme.spacing.base,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    padding: Theme.spacing.md,
    gap: 0,
  },
  infoTitle: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, marginBottom: 10, textAlign: 'right' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  infoLabel: { fontSize: Theme.fontSize.sm, textAlign: 'right' },
  infoValue: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold, flex: 1, marginStart: 12, textAlign: 'right' },
  divider: { height: 1 },
  finCard: {
    marginHorizontal: Theme.spacing.base,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    padding: Theme.spacing.md,
  },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  finLabel: { fontSize: Theme.fontSize.md, textAlign: 'right' },
  finVal: { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  sectionPad: { marginTop: 8 },
  sectionTitle: { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold, paddingHorizontal: Theme.spacing.base, paddingVertical: 8, textAlign: 'right' },
});
