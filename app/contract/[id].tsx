import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, TextInput, Modal as RNModal, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
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
import { formatDate } from '../../data/mockData';
import { CurrencyText } from '../../components/ui/CurrencyText';
import { isAdminRole } from '../../utils/roleUtils';
import { useAppTheme } from '../../hooks/useAppTheme';
import { CURRENCIES, getCurrency } from '../../utils/currency';

const statusColors: Record<string, string> = {
  active:     '#27AE60',
  expired:    '#718096',
  cancelled:  '#E74C3C',
  terminated: '#C0392B',
  pending:    '#F39C12',
};

const statusBg: Record<string, string> = {
  active:     '#E8F8F0',
  expired:    '#F0F4F8',
  cancelled:  '#FDEDEC',
  terminated: '#FDEDEC',
  pending:    '#FEF9E7',
};

export default function ContractDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const { contracts, payments, tenants, units, properties, currentUser, terminateContract, updateContract, canWrite, canDelete } = useApp();

  // ── Terminate modal state ──────────────────────────────────────────────────
  const [showConfirm,       setShowConfirm]       = useState(false);
  const [showSend,          setShowSend]          = useState(false);
  const [reason,            setReason]            = useState('');
  const [termResult,        setTermResult]        = useState<{ tenantName: string; tenantPhone: string; tenantEmail: string; terminationDate: string; reason: string } | null>(null);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  const isAdmin = isAdminRole(currentUser.role);
  const { pending, pendingMode, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete } = useDelete();

  const contract = contracts.find(c => c.id === id);
  const contractPayments = payments.filter(p => p.contractId === id);
  const tenant = contract ? tenants.find(t => t.id === contract.tenantId) ?? null : null;
  const unit = contract ? units.find(u => u.id === contract.unitId) ?? null : null;
  const property = unit ? properties.find(p => p.id === unit.propertyId) ?? null : null;

  const stats = useMemo(() => {
    if (!contract) return null;
    const paid = contractPayments.filter(p => p.status === 'paid');
    const pending = contractPayments.filter(p => p.status === 'pending');
    const overdue = contractPayments.filter(p => p.status === 'overdue');
    const paidAmount = paid.reduce((s, p) => s + p.amount, 0);
    const remaining = contract.annualValue - paidAmount;
    const startDate = new Date(contract.startDate);
    const endDate = new Date(contract.endDate);
    const months = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    return { paid: paid.length, pending: pending.length, overdue: overdue.length, paidAmount, remaining, months };
  }, [contract, contractPayments]);

  if (!contract || !stats) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="العقد" />
        <EmptyState icon="document-text-outline" title="العقد غير موجود" />
      </View>
    );
  }

  const methodLabels: Record<string, string> = { transfer: 'تحويل', cash: 'نقد', check: 'شيك' };
  const statusLabel: Record<string, string> = { active: 'نشط', expired: 'منتهي', cancelled: 'ملغي', terminated: 'منتهي بقرار إداري', pending: 'قيد الانتظار' };

  // ── Terminate handlers ────────────────────────────────────────────────────

  const handleConfirmTerminate = () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    const result = terminateContract(id!, trimmed);
    setTermResult({ ...result, reason: trimmed });
    setShowConfirm(false);
    setReason('');
    setShowSend(true);
  };

  const buildMessage = (result: NonNullable<typeof termResult>) => {
    const propertyLine = property ? `العقار: ${property.name}` : '';
    const unitLine     = unit     ? `الوحدة: ${unit.number}`   : '';
    return (
      `السيد/ة ${result.tenantName}،\n\n` +
      `نُحيطكم علماً بأنه تم إنهاء عقد الإيجار الخاص بكم بتاريخ ${result.terminationDate}.\n\n` +
      `تفاصيل العقد:\n` +
      `${propertyLine}\n${unitLine}\n` +
      `تاريخ البدء: ${formatDate(contract!.startDate)}\n` +
      `تاريخ الإنهاء: ${result.terminationDate}\n` +
      `السبب: ${result.reason}\n\n` +
      `شكراً لتعاملكم معنا.\nإدارة العقارات`
    );
  };

  const sendWhatsApp = (result: NonNullable<typeof termResult>) => {
    const phone = result.tenantPhone.replace(/^0/, '966');
    const msg   = buildMessage(result);
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`).catch(() => {
      Linking.openURL(`whatsapp://send?phone=${phone}&text=${encodeURIComponent(msg)}`);
    });
  };

  const sendEmail = (result: NonNullable<typeof termResult>) => {
    const subject = encodeURIComponent('إشعار إنهاء عقد الإيجار');
    const body    = encodeURIComponent(buildMessage(result));
    Linking.openURL(`mailto:${result.tenantEmail}?subject=${subject}&body=${body}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={contract.contractNumber}
        rightText={canWrite ? { label: 'تعديل', onPress: () => router.push(`/edit-contract/${id}`) } : undefined}
      />

      {/* ── Confirmation modal ──────────────────────────────────────────── */}
      <RNModal visible={showConfirm} transparent animationType="fade" onRequestClose={() => { Keyboard.dismiss(); setShowConfirm(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={Keyboard.dismiss} />
          <View style={[styles.dialog, { backgroundColor: colors.card }]}>
            {/* Icon */}
            <View style={[styles.dialogIcon, { backgroundColor: '#FDEDEC' }]}>
              <Ionicons name="warning-outline" size={32} color="#C0392B" />
            </View>
            <Text style={[styles.dialogTitle, { color: colors.text }]}>إنهاء العقد</Text>
            <Text style={[styles.dialogSub, { color: colors.textSecondary }]}>
              سيتم إنهاء العقد فوراً وإشعار المستأجر. هذا الإجراء لا يمكن التراجع عنه.
            </Text>
            {/* Reason input */}
            <Text style={[styles.reasonLabel, { color: colors.textSecondary }]}>سبب الإنهاء *</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="أدخل سبب إنهاء العقد…"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
              style={[styles.reasonInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            />
            {/* Buttons */}
            <View style={styles.dialogBtns}>
              <TouchableOpacity
                style={[styles.dialogBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => { setShowConfirm(false); setReason(''); }}
              >
                <Text style={[styles.dialogBtnText, { color: colors.text }]}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogBtn, { backgroundColor: reason.trim() ? '#C0392B' : colors.border }]}
                onPress={handleConfirmTerminate}
                disabled={!reason.trim()}
              >
                <Ionicons name="checkmark-outline" size={16} color="#FFF" />
                <Text style={[styles.dialogBtnText, { color: '#FFF' }]}>تأكيد الإنهاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </RNModal>

      {/* ── Send notification modal ──────────────────────────────────────── */}
      <RNModal visible={showSend} transparent animationType="fade" onRequestClose={() => setShowSend(false)}>
        <View style={styles.overlay}>
          <View style={[styles.dialog, { backgroundColor: colors.card }]}>
            <View style={[styles.dialogIcon, { backgroundColor: '#E8F8F0' }]}>
              <Ionicons name="checkmark-circle-outline" size={32} color="#27AE60" />
            </View>
            <Text style={[styles.dialogTitle, { color: colors.text }]}>تم إنهاء العقد</Text>
            <Text style={[styles.dialogSub, { color: colors.textSecondary }]}>
              أرسل إشعاراً للمستأجر {termResult?.tenantName} عبر:
            </Text>
            {/* WhatsApp */}
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: '#25D366' }]}
              onPress={() => termResult && sendWhatsApp(termResult)}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
              <Text style={styles.sendBtnText}>إرسال عبر واتساب</Text>
            </TouchableOpacity>
            {/* Email */}
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.primary }]}
              onPress={() => termResult && sendEmail(termResult)}
            >
              <Ionicons name="mail-outline" size={20} color="#FFF" />
              <Text style={styles.sendBtnText}>إرسال عبر البريد</Text>
            </TouchableOpacity>
            {/* Skip */}
            <TouchableOpacity onPress={() => setShowSend(false)} style={styles.skipBtn}>
              <Text style={[styles.skipText, { color: colors.textMuted }]}>تخطّي</Text>
            </TouchableOpacity>
          </View>
        </View>
      </RNModal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Status Banner */}
        <View style={[styles.banner, { backgroundColor: statusBg[contract.status] ?? '#F0F4F8' }]}>
          <StatusBadge status={contract.status} />
          <Text style={[styles.bannerText, { color: statusColors[contract.status] ?? '#718096' }]}>
            العقد {statusLabel[contract.status] ?? contract.status}
          </Text>
          <Text style={[styles.bannerSub, { color: statusColors[contract.status] ?? '#718096' }]}>
            {formatDate(contract.startDate)} — {formatDate(contract.endDate)}
          </Text>
          {/* Action buttons row */}
          {(isAdmin || canWrite) && (contract.status === 'active' || contract.status === 'pending') && (() => {
            const btnColor = statusColors[contract.status] ?? '#27AE60';
            return (
              <View style={styles.bannerActions}>
                {/* Currency button */}
                {canWrite && (
                  <TouchableOpacity
                    style={[styles.currencyBtn, { borderColor: btnColor, backgroundColor: `${btnColor}18` }]}
                    onPress={() => setShowCurrencyModal(true)}
                  >
                    <Ionicons name="swap-horizontal-outline" size={15} color={btnColor} />
                    <Text style={[styles.currencyBtnText, { color: btnColor }]}>
                      {getCurrency(contract.currency).code}
                    </Text>
                  </TouchableOpacity>
                )}
                {/* Terminate button — admin only, active contracts only */}
                {isAdmin && contract.status === 'active' && (
                  <TouchableOpacity
                    style={styles.terminateBtn}
                    onPress={() => setShowConfirm(true)}
                  >
                    <Ionicons name="close-circle-outline" size={16} color="#FFF" />
                    <Text style={styles.terminateBtnText}>إنهاء العقد</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}
          {/* Termination info badge */}
          {contract.status === 'terminated' && contract.cancelledAt && (
            <View style={styles.terminatedBadge}>
              <Ionicons name="alert-circle-outline" size={13} color="#C0392B" />
              <Text style={[styles.terminatedBadgeText, { color: '#C0392B' }]}>
                أُنهي بتاريخ {contract.cancelledAt.split('T')[0]}
              </Text>
            </View>
          )}
        </View>

        {/* Parties Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>أطراف العقد</Text>
          <TouchableOpacity style={styles.partyRow} onPress={() => tenant && router.push(`/tenant/${tenant.id}`)}>
            <Ionicons name="chevron-back-outline" size={16} color={colors.textMuted} />
            <View style={styles.partyInfo}>
              <Text style={[styles.partyName, { color: colors.text }]}>{tenant?.name || '—'}</Text>
              <Text style={[styles.partyLabel, { color: colors.textMuted }]}>المستأجر</Text>
            </View>
            <View style={[styles.partyIcon, { backgroundColor: colors.accent }]}>
              <Ionicons name="person-outline" size={20} color={colors.primary} />
            </View>
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.partyRow} onPress={() => unit && router.push(`/unit/${unit.id}`)}>
            <Ionicons name="chevron-back-outline" size={16} color={colors.textMuted} />
            <View style={styles.partyInfo}>
              <Text style={[styles.partyName, { color: colors.text }]}>
                {property?.name} — وحدة {unit?.number}
              </Text>
              <Text style={[styles.partyLabel, { color: colors.textMuted }]}>الوحدة المؤجرة</Text>
            </View>
            <View style={[styles.partyIcon, { backgroundColor: colors.accentSecondary }]}>
              <Ionicons name="home-outline" size={20} color={colors.secondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* KPI Row */}
        <View style={[styles.kpiRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: 'القيمة السنوية', amount: contract.annualValue, color: colors.primary },
            { label: 'المدة', text: `${stats.months} شهر`, color: colors.text },
            { label: 'الأقساط المدفوعة', text: `${stats.paid}/${contract.installmentsCount}`, color: colors.success },
            { label: 'المتبقي', amount: stats.remaining, color: stats.remaining > 0 ? colors.warning : colors.success },
          ].map((kpi, i) => (
            <React.Fragment key={kpi.label}>
              {i > 0 && <View style={[styles.div, { backgroundColor: colors.border }]} />}
              <View style={styles.kpi}>
                {'amount' in kpi
                  ? <CurrencyText amount={kpi.amount} style={[styles.kpiVal, { color: kpi.color }]} />
                  : <Text style={[styles.kpiVal, { color: kpi.color }]} numberOfLines={1}>{kpi.text}</Text>
                }
                <Text style={[styles.kpiLbl, { color: colors.textMuted }]}>{kpi.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Payment Schedule */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <TouchableOpacity onPress={() => router.push('/record-payment')}>
              <Text style={[styles.cardAction, { color: colors.secondary }]}>تسجيل دفعة</Text>
            </TouchableOpacity>
            <Text style={[styles.cardTitle, { color: colors.text }]}>جدول الأقساط</Text>
          </View>
          {contractPayments.map((p, i) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.installmentRow, i < contractPayments.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={() => router.push(`/payment/${p.id}`)}
            >
              <View style={styles.installmentRight}>
                <StatusBadge status={p.status} size="sm" />
                <View>
                  <CurrencyText amount={p.amount} style={[styles.installmentAmount, { color: colors.text }]} />
                  <Text style={[styles.installmentDate, { color: colors.textMuted }]}>
                    {p.paidDate ? `مدفوع: ${formatDate(p.paidDate)}` : `استحقاق: ${formatDate(p.dueDate)}`}
                  </Text>
                </View>
              </View>
              <View style={styles.installmentLeft}>
                <View style={[styles.installmentNum, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.installmentNumText, { color: colors.primary }]}>{p.installmentNumber}</Text>
                </View>
                {p.method && <Text style={[styles.installmentMethod, { color: colors.textMuted }]}>{methodLabels[p.method]}</Text>}
              </View>
            </TouchableOpacity>
          ))}
          {contractPayments.length === 0 && (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>لا توجد أقساط مسجلة</Text>
          )}
        </View>

        {/* Notes */}
        {contract.notes && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>ملاحظات</Text>
            <Text style={[styles.notes, { color: colors.textSecondary }]}>{contract.notes}</Text>
          </View>
        )}

        {/* Attachments */}
        <View style={styles.card}>
          <AttachmentPanel entityType="contract" entityId={id!} />
        </View>

        {canDelete && (
          <DeleteButton
            variant="full"
            label="حذف العقد"
            onPress={() => requestDelete({
              id: id!,
              entityType: 'contract',
              label: contract.contractNumber,
              onSuccess: () => router.back(),
            })}
          />
        )}
      </ScrollView>

      {/* ── Currency picker modal ── */}
      <RNModal visible={showCurrencyModal} transparent animationType="slide" onRequestClose={() => setShowCurrencyModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowCurrencyModal(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.currencySheet, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>تغيير عملة العقد</Text>
              <View style={{ width: 22 }} />
            </View>
            {/* Currency list */}
            <ScrollView>
              {CURRENCIES.map((c, i) => {
                const selected = (contract.currency ?? 'SAR') === c.code;
                return (
                  <TouchableOpacity
                    key={c.code}
                    style={[
                      styles.currencyOption,
                      { borderBottomColor: colors.border },
                      i < CURRENCIES.length - 1 && { borderBottomWidth: 1 },
                      selected && { backgroundColor: `${colors.primary}08` },
                    ]}
                    onPress={() => {
                      updateContract(id!, { currency: c.code });
                      setShowCurrencyModal(false);
                    }}
                  >
                    <View style={[styles.currencyCodeBadge, {
                      backgroundColor: selected ? `${colors.primary}18` : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    }]}>
                      <Text style={[styles.currencyCodeText, { color: selected ? colors.primary : colors.textMuted }]}>
                        {c.symbol}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.currencyOptionLabel, { color: selected ? colors.primary : colors.text }]}>{c.label}</Text>
                      <Text style={[styles.currencyOptionCode, { color: colors.textMuted }]}>{c.code}</Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </RNModal>

      <ConfirmModal
        visible={!!pending}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title={pendingMode === 'archive' ? 'أرشفة العقد' : 'تأكيد الحذف'}
        message={
          pendingMode === 'archive'
            ? `يحتوي عقد "${contract.contractNumber}" على دفعات مسددة ولا يمكن حذفه.\nسيتم إلغاؤه وأرشفته مع الاحتفاظ بسجل الدفعات.`
            : `هل أنت متأكد أنك تريد حذف عقد "${contract.contractNumber}"؟ لا يمكن التراجع عن هذا الإجراء.`
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
  banner: { margin: Theme.spacing.base, borderRadius: Theme.radius.lg, padding: Theme.spacing.lg, alignItems: 'flex-start', gap: 6 },
  bannerText: { fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  bannerSub: { fontSize: Theme.fontSize.md, textAlign: 'right' },
  card: { margin: Theme.spacing.base, marginTop: 0, marginBottom: Theme.spacing.sm, borderRadius: Theme.radius.lg, borderWidth: 1, padding: Theme.spacing.md, gap: 0 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  cardAction: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  partyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  partyIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  partyInfo: { flex: 1 },
  partyName: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  partyLabel: { fontSize: Theme.fontSize.sm, textAlign: 'right' },
  divider: { height: 1 },
  kpiRow: {
    marginHorizontal: Theme.spacing.base,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  kpi: { flex: 1, alignItems: 'center', gap: 2 },
  kpiVal: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold, textAlign: 'center' },
  kpiLbl: { fontSize: 10, textAlign: 'center' },
  div: { width: 1, marginVertical: 4 },
  installmentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, gap: 8 },
  installmentRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  installmentLeft: { alignItems: 'flex-start', gap: 4 },
  installmentNum: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  installmentNumText: { fontSize: Theme.fontSize.sm, fontWeight: '700' },
  installmentAmount: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  installmentDate: { fontSize: Theme.fontSize.xs },
  installmentMethod: { fontSize: Theme.fontSize.xs },
  emptyText: { textAlign: 'center', padding: 16, fontSize: Theme.fontSize.md },
  notes: { fontSize: Theme.fontSize.md, lineHeight: 22, paddingTop: 4, textAlign: 'right' },

  bannerActions: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },

  currencyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, minHeight: 44,
    borderRadius: Theme.radius.full, borderWidth: 1.5,
  },
  currencyBtnText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },

  // Currency sheet modal
  currencySheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: Theme.radius.xl, borderTopRightRadius: Theme.radius.xl,
    maxHeight: '80%', paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md, paddingVertical: 16, borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },
  currencyOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Theme.spacing.md, paddingVertical: 14,
  },
  currencyCodeBadge: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1,
  },
  currencyCodeText:   { fontSize: Theme.fontSize.base, fontWeight: '700' },
  currencyOptionLabel:{ fontSize: Theme.fontSize.base, fontWeight: '600', textAlign: 'right' },
  currencyOptionCode: { fontSize: Theme.fontSize.xs, marginTop: 1, textAlign: 'right' },

  // Terminate button (inside banner)
  terminateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 4,
    paddingHorizontal: 16, paddingVertical: 12,
    minHeight: 44,
    borderRadius: Theme.radius.full,
    backgroundColor: '#C0392B',
  },
  terminateBtnText: { color: '#FFF', fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },

  terminatedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Theme.radius.full,
    backgroundColor: 'rgba(192,57,43,0.1)',
  },
  terminatedBadgeText: { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.semibold },

  // Modals
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 20,
  },
  dialog: {
    width: '100%', borderRadius: Theme.radius.xl,
    padding: 24, alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12,
    elevation: 8,
  },
  dialogIcon: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  dialogTitle: { fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold, textAlign: 'center' },
  dialogSub:   { fontSize: Theme.fontSize.md, textAlign: 'center', lineHeight: 22, opacity: 0.8 },

  reasonLabel: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold, alignSelf: 'stretch', textAlign: 'right' },
  reasonInput: {
    alignSelf: 'stretch', borderWidth: 1.5, borderRadius: Theme.radius.lg,
    padding: 12, fontSize: Theme.fontSize.md,
    minHeight: 80, textAlignVertical: 'top',
  },

  dialogBtns: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 4 },
  dialogBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: Theme.radius.lg, borderWidth: 1,
  },
  dialogBtnText: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold },

  // Send modal buttons
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, alignSelf: 'stretch', paddingVertical: 14,
    borderRadius: Theme.radius.lg,
  },
  sendBtnText: { color: '#FFF', fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  skipBtn:     { paddingVertical: 6 },
  skipText:    { fontSize: Theme.fontSize.sm },
});
