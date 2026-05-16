import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert, Clipboard } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { AppHeader } from '../../components/ui/AppHeader';
import { DeleteButton } from '../../components/ui/DeleteButton';
import { ConfirmModal, AlertModal } from '../../components/ui/Modal';
import { useDelete } from '../../hooks/useDelete';
import { ContractCard } from '../../components/ui/ContractCard';
import { PaymentCard } from '../../components/ui/PaymentCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { AttachmentPanel } from '../../components/features/AttachmentPanel';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDate } from '../../data/mockData';
import { useAppTheme } from '../../hooks/useAppTheme';

type Tab = 'contracts' | 'payments' | 'docs';

export default function TenantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const { tenants, contracts, payments, canWrite, canDelete } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('contracts');
  const { pending, pendingMode, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete } = useDelete();

  const tenant = tenants.find(t => t.id === id);
  const tenantContracts = contracts.filter(c => c.tenantId === id);
  const tenantContractIds = tenantContracts.map(c => c.id);
  const tenantPayments = payments.filter(p => tenantContractIds.includes(p.contractId));

  if (!tenant) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="المستأجر" />
        <EmptyState icon="person-outline" title="المستأجر غير موجود" />
      </View>
    );
  }

  const initials = (tenant.name ?? '؟').split(' ').slice(0, 2).map(n => n[0] ?? '').join('');
  const activeContract = tenantContracts.find(c => c.status === 'active');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="تفاصيل المستأجر"
        rightText={canWrite ? { label: 'تعديل', onPress: () => router.push(`/edit-tenant/${id}`) } : undefined}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Profile */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{tenant.name}</Text>
          <Text style={[styles.nationality, { color: colors.textSecondary }]}>{tenant.nationality}</Text>
          {activeContract && <StatusBadge status="active" />}

          <View style={[styles.contactRow, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => tenant.phone && Linking.openURL(`tel:${tenant.phone}`).catch(() => Alert.alert('خطأ', 'تعذّر فتح تطبيق الهاتف'))}
              disabled={!tenant.phone}
            >
              <Ionicons name="call-outline" size={16} color={colors.success} />
              <Text style={[styles.contactValue, { color: colors.text }]}>{tenant.phone || '—'}</Text>
              <Text style={[styles.contactLabel, { color: colors.textMuted }]}>الهاتف</Text>
            </TouchableOpacity>
            <View style={[styles.contactDiv, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => tenant.email && Linking.openURL(`mailto:${tenant.email}`).catch(() => Alert.alert('خطأ', 'تعذّر فتح تطبيق البريد'))}
              onLongPress={() => { if (tenant.email) { Clipboard.setString(tenant.email); Alert.alert('تم النسخ', tenant.email); } }}
              disabled={!tenant.email}
            >
              <Ionicons name="mail-outline" size={16} color={colors.secondary} />
              <Text style={[styles.contactValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{tenant.email || '—'}</Text>
              <Text style={[styles.contactLabel, { color: colors.textMuted }]}>البريد</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* KPI */}
        <View style={[styles.kpiRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: 'العقود', value: tenantContracts.length, color: colors.primary },
            { label: 'الدفعات', value: tenantPayments.length, color: colors.success },
            { label: 'رقم الهوية', value: tenant.nationalId, color: colors.text },
            { label: 'تاريخ الانضمام', value: formatDate(tenant.createdAt), color: colors.textSecondary },
          ].map((kpi, i) => (
            <React.Fragment key={kpi.label}>
              {i > 0 && <View style={[styles.div, { backgroundColor: colors.border }]} />}
              <View style={styles.kpi}>
                <Text style={[styles.kpiVal, { color: kpi.color }]} numberOfLines={1}>{kpi.value}</Text>
                <Text style={[styles.kpiLbl, { color: colors.textMuted }]}>{kpi.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Tabs */}
        <View style={[styles.tabsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { key: 'contracts', label: `العقود (${tenantContracts.length})` },
            { key: 'payments', label: `الدفعات (${tenantPayments.length})` },
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

        <View style={{ marginTop: 8 }}>
          {activeTab === 'contracts' && (
            tenantContracts.length === 0
              ? <EmptyState icon="document-text-outline" title="لا توجد عقود" />
              : tenantContracts.map(c => <ContractCard key={c.id} contract={c} />)
          )}
          {activeTab === 'payments' && (
            tenantPayments.length === 0
              ? <EmptyState icon="cash-outline" title="لا توجد دفعات" />
              : tenantPayments.map(p => <PaymentCard key={p.id} payment={p} />)
          )}
          {activeTab === 'docs' && (
            <View style={{ paddingHorizontal: Theme.spacing.base, paddingTop: Theme.spacing.sm }}>
              <AttachmentPanel entityType="tenant" entityId={id!} />
            </View>
          )}
        </View>

        {canDelete && (
          <DeleteButton
            variant="full"
            label="حذف المستأجر"
            onPress={() => requestDelete({
              id: id!,
              entityType: 'tenant',
              label: tenant.name,
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
        message={`هل أنت متأكد أنك تريد حذف "${tenant.name}"؟ سيتم إلغاء جميع العقود المرتبطة. لا يمكن التراجع عن هذا الإجراء.`}
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
  avatar: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  initials: { color: '#FFF', fontSize: 24, fontWeight: '700' },
  name: { fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold, textAlign: 'center' },
  nationality: { fontSize: Theme.fontSize.md, textAlign: 'center' },
  contactRow: { flexDirection: 'row', width: '100%', marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  contactItem: { flex: 1, alignItems: 'center', gap: 3 },
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
  kpiVal: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold, textAlign: 'center' },
  kpiLbl: { fontSize: 10, textAlign: 'center' },
  div: { width: 1, marginVertical: 4 },
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
});
