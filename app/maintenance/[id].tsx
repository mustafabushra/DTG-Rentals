import React from 'react';
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
import { EmptyState } from '../../components/ui/EmptyState';
import { AttachmentPanel } from '../../components/features/AttachmentPanel';
import { formatCurrency, formatDate } from '../../data/mockData';
import { useAppTheme } from '../../hooks/useAppTheme';

const STEPS = [
  { key: 'new', label: 'جديد', icon: 'flag-outline' },
  { key: 'in_progress', label: 'قيد التنفيذ', icon: 'construct-outline' },
  { key: 'completed', label: 'مكتمل', icon: 'checkmark-circle-outline' },
];

export default function MaintenanceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const { maintenance, properties, units, updateMaintenance, canWrite, canDelete } = useApp();
  const { pending, pendingMode, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete } = useDelete();

  const item = maintenance.find(m => m.id === id);
  const property = item ? properties.find(p => p.id === item.propertyId) ?? null : null;
  const unit = item ? units.find(u => u.id === item.unitId) ?? null : null;

  if (!item) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="الصيانة" />
        <EmptyState icon="construct-outline" title="الطلب غير موجود" />
      </View>
    );
  }

  const currentStepIdx = STEPS.findIndex(s => s.key === item.status);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="تفاصيل الصيانة" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Status Stepper */}
        <View style={[styles.stepperCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>حالة الطلب</Text>
          <View style={styles.stepper}>
            {STEPS.map((step, idx) => {
              const isActive = idx === currentStepIdx;
              const isDone = idx < currentStepIdx;
              const stepColor = isDone || isActive ? colors.primary : colors.textMuted;
              return (
                <React.Fragment key={step.key}>
                  <View style={styles.stepItem}>
                    <View style={[styles.stepCircle, { backgroundColor: isDone || isActive ? colors.primary : colors.border }]}>
                      <Ionicons name={step.icon as any} size={16} color={isDone || isActive ? '#FFF' : colors.textMuted} />
                    </View>
                    <Text style={[styles.stepLabel, { color: stepColor, fontWeight: isActive ? '700' : '400' }]}>
                      {step.label}
                    </Text>
                  </View>
                  {idx < STEPS.length - 1 && (
                    <View style={[styles.stepLine, { backgroundColor: idx < currentStepIdx ? colors.primary : colors.border }]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>

          {/* Advance Status — فقط للحالات المعروفة وغير المنتهية */}
          {canWrite && currentStepIdx >= 0 && item.status !== 'completed' && item.status !== 'cancelled' && (
            <TouchableOpacity
              style={[styles.advanceBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                const nextIdx = currentStepIdx + 1;
                if (nextIdx < STEPS.length) {
                  const updates: any = { status: STEPS[nextIdx].key as any };
                  if (STEPS[nextIdx].key === 'in_progress') updates.assignedAt = new Date().toISOString().split('T')[0];
                  if (STEPS[nextIdx].key === 'completed') updates.closedAt = new Date().toISOString().split('T')[0];
                  updateMaintenance(id, updates);
                }
              }}
            >
              <Text style={styles.advanceBtnText}>
                {item.status === 'new' ? 'بدء التنفيذ' : 'إغلاق الطلب'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Details */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.headerRow}>
            <StatusBadge status={item.priority} />
            <Text style={[styles.mainTitle, { color: colors.text }]}>{item.title}</Text>
          </View>
          <Text style={[styles.desc, { color: colors.textSecondary }]}>{item.description}</Text>
        </View>

        {/* Property & Unit */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>الموقع</Text>
          <TouchableOpacity style={styles.locationRow} onPress={() => property && router.push(`/property/${property.id}`)}>
            <Ionicons name="chevron-back-outline" size={14} color={colors.secondary} />
            <View style={[styles.locationIcon, { backgroundColor: colors.accent }]}>
              <Ionicons name="business-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.locationInfo}>
              <Text style={[styles.locationName, { color: colors.text }]}>{property?.name}</Text>
              <Text style={[styles.locationSub, { color: colors.textMuted }]}>العقار</Text>
            </View>
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.locationRow} onPress={() => unit && router.push(`/unit/${unit.id}`)}>
            <Ionicons name="chevron-back-outline" size={14} color={colors.secondary} />
            <View style={[styles.locationIcon, { backgroundColor: colors.accentSecondary }]}>
              <Ionicons name="home-outline" size={18} color={colors.secondary} />
            </View>
            <View style={styles.locationInfo}>
              <Text style={[styles.locationName, { color: colors.text }]}>وحدة {unit?.number}</Text>
              <Text style={[styles.locationSub, { color: colors.textMuted }]}>الوحدة</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Technician */}
        {item.technicianName && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>الفني المعين</Text>
            <View style={styles.techRow}>
              <View style={[styles.techAvatar, { backgroundColor: colors.warning + '30' }]}>
                <Ionicons name="person-outline" size={22} color={colors.warning} />
              </View>
              <View style={styles.techInfo}>
                <Text style={[styles.techName, { color: colors.text }]}>{item.technicianName}</Text>
                {item.cost !== undefined && (
                  <Text style={[styles.techCost, { color: colors.success }]}>التكلفة: {formatCurrency(item.cost)}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Timeline */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>التسلسل الزمني</Text>
          {[
            { label: 'تاريخ الفتح', date: item.openedAt, icon: 'flag-outline', color: colors.primary },
            item.assignedAt && { label: 'تاريخ التعيين', date: item.assignedAt, icon: 'person-add-outline', color: colors.warning },
            item.closedAt && { label: 'تاريخ الإغلاق', date: item.closedAt, icon: 'checkmark-circle-outline', color: colors.success },
          ].filter(Boolean).map((event: any, i) => (
            <View key={event.label} style={styles.timelineRow}>
              <View style={[styles.timelineLine, { backgroundColor: i > 0 ? colors.border : 'transparent' }]} />
              <View style={[styles.timelineDot, { backgroundColor: event.color }]}>
                <Ionicons name={event.icon} size={14} color="#FFF" />
              </View>
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineLabel, { color: colors.text }]}>{event.label}</Text>
                <Text style={[styles.timelineDate, { color: colors.textSecondary }]}>{formatDate(event.date)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Reported By */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.reportedRow}>
            <Text style={[styles.reportedName, { color: colors.text }]}>{item.reportedBy}</Text>
            <Text style={[styles.reportedLabel, { color: colors.textMuted }]}>أُبلغ من قِبل</Text>
          </View>
        </View>

        {/* Attachments */}
        <View style={styles.card}>
          <AttachmentPanel entityType="maintenance" entityId={id!} />
        </View>

        {canDelete && (
          <DeleteButton
            variant="full"
            label="حذف طلب الصيانة"
            onPress={() => requestDelete({
              id: id!,
              entityType: 'maintenance',
              label: item.title,
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
        message={`هل أنت متأكد أنك تريد حذف "${item.title}"؟ لا يمكن التراجع عن هذا الإجراء.`}
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
  stepperCard: {
    margin: Theme.spacing.base, borderRadius: Theme.radius.lg, borderWidth: 1,
    padding: Theme.spacing.md, gap: 16,
  },
  cardTitle: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0 },
  stepItem: { alignItems: 'center', gap: 4, width: 80 },
  stepCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  stepLabel: { fontSize: 11, textAlign: 'center' },
  stepLine: { flex: 1, height: 2, marginBottom: 20, marginHorizontal: -8 },
  advanceBtn: {
    borderRadius: Theme.radius.md, padding: Theme.spacing.md, alignItems: 'center',
  },
  advanceBtnText: { color: '#FFF', fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  card: {
    marginHorizontal: Theme.spacing.base, marginBottom: Theme.spacing.sm,
    borderRadius: Theme.radius.lg, borderWidth: 1, padding: Theme.spacing.md, gap: 8,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mainTitle: { flex: 1, fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  desc: { fontSize: Theme.fontSize.md, lineHeight: 22, textAlign: 'right' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  locationIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  locationInfo: { flex: 1 },
  locationName: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  locationSub: { fontSize: Theme.fontSize.sm, textAlign: 'right' },
  divider: { height: 1, marginVertical: 4 },
  techRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  techAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  techInfo: { flex: 1 },
  techName: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  techCost: { fontSize: Theme.fontSize.md, textAlign: 'right' },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  timelineLine: { position: 'absolute', top: 0, right: 17, width: 2, height: '100%' },
  timelineDot: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  timelineContent: { flex: 1 },
  timelineLabel: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  timelineDate: { fontSize: Theme.fontSize.sm, textAlign: 'right' },
  reportedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reportedLabel: { fontSize: Theme.fontSize.md },
  reportedName: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold },
});
