import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { AppHeader } from '../../components/ui/AppHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { AttachmentPanel } from '../../components/features/AttachmentPanel';
import { ConfirmModal } from '../../components/ui/Modal';
import { formatCurrency, formatDate } from '../../data/mockData';
import { useAppTheme } from '../../hooks/useAppTheme';

const methodLabels: Record<string, string> = {
  transfer:      'تحويل بنكي',
  bank_transfer: 'تحويل بنكي',
  cash:          'نقداً',
  check:         'شيك',
  online:        'دفع إلكتروني',
};
const methodIcons: Record<string, string> = {
  transfer:      'swap-horizontal-outline',
  bank_transfer: 'swap-horizontal-outline',
  cash:          'cash-outline',
  check:         'document-outline',
  online:        'card-outline',
};

// ─── PDF receipt HTML ──────────────────────────────────────────────────────────
function buildReceiptHTML(p: {
  receiptNumber: string;
  tenantName: string;
  tenantPhone?: string;
  tenantNationalId?: string;
  propertyName: string;
  unitNumber: string;
  contractNumber: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  paidDate: string;
  dueDate: string;
  method: string;
  referenceNumber?: string;
  notes?: string;
  logoUrl: string;
}) {
  const amountFormatted = formatCurrency(p.amount);
  const paidDateFmt     = formatDate(p.paidDate);
  const dueDateFmt      = formatDate(p.dueDate);
  const methodLabel     = methodLabels[p.method] ?? p.method;
  const now             = new Date().toLocaleString('ar-SA');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>إيصال ${p.receiptNumber}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Cairo',Arial,sans-serif;background:#f0f2f5;display:flex;justify-content:center;padding:20px;color:#1a1a2e}
  .page{width:210mm;min-height:148mm;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12)}
  /* header */
  .header{background:linear-gradient(135deg,#021C36 0%,#0a3d6b 100%);padding:28px 36px;display:flex;align-items:center;justify-content:space-between}
  .logo-wrap{display:flex;align-items:center;gap:14px}
  .logo{height:54px;width:auto;object-fit:contain;filter:brightness(0) invert(1)}
  .company-name{color:#C3AF76;font-size:22px;font-weight:800;line-height:1.2}
  .company-sub{color:rgba(255,255,255,.65);font-size:11px;margin-top:2px}
  .receipt-badge{background:rgba(195,175,118,.15);border:1.5px solid #C3AF76;border-radius:10px;padding:10px 20px;text-align:center}
  .receipt-label{color:#C3AF76;font-size:11px;font-weight:600;letter-spacing:1px}
  .receipt-num{color:#fff;font-size:16px;font-weight:800;margin-top:3px;direction:ltr}
  /* amount banner */
  .amount-banner{background:#f8fffe;border-bottom:1px solid #e8f5e9;padding:20px 36px;display:flex;align-items:center;justify-content:space-between}
  .amount-val{font-size:38px;font-weight:800;color:#1a7c3e}
  .amount-label{font-size:12px;color:#666;margin-bottom:4px}
  .status-pill{display:inline-flex;align-items:center;gap:6px;background:#e8f5e9;border:1px solid #a5d6a7;border-radius:20px;padding:6px 16px;font-size:13px;font-weight:700;color:#1a7c3e}
  .status-dot{width:8px;height:8px;background:#27ae60;border-radius:50%}
  /* body */
  .body{padding:24px 36px;display:grid;grid-template-columns:1fr 1fr;gap:0}
  .section{padding:12px 0}
  .section-title{font-size:11px;font-weight:700;color:#C3AF76;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;border-bottom:1px solid #f0f0f0;padding-bottom:6px}
  .row{display:flex;align-items:flex-start;gap:10px;margin-bottom:8px}
  .row-label{font-size:12px;color:#888;min-width:110px;flex-shrink:0}
  .row-val{font-size:13px;font-weight:600;color:#222;flex:1}
  .divider{width:1px;background:#f0f0f0;margin:0 20px}
  /* installment */
  .installment-bar{margin:0 36px 20px;background:#f5f5f5;border-radius:8px;overflow:hidden;height:8px}
  .installment-fill{background:linear-gradient(90deg,#C3AF76,#021C36);height:8px;border-radius:8px}
  .installment-label{margin:0 36px 8px;display:flex;justify-content:space-between;font-size:11px;color:#888}
  /* footer */
  .footer{background:#f8f9fa;border-top:1px solid #eee;padding:14px 36px;display:flex;align-items:center;justify-content:space-between}
  .footer-note{font-size:10px;color:#aaa}
  .seal{display:flex;align-items:center;gap:8px;background:#021C36;border-radius:8px;padding:6px 14px}
  .seal-text{color:#C3AF76;font-size:11px;font-weight:700}
  /* notes */
  .notes-box{margin:0 36px 16px;background:#fffbf0;border:1px solid #f0e68c;border-radius:8px;padding:12px 16px;font-size:12px;color:#555}
  @media print{
    body{background:#fff;padding:0}
    .page{box-shadow:none;border-radius:0;width:100%}
  }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="logo-wrap">
      <img class="logo" src="${p.logoUrl}" alt="شعار الشركة" onerror="this.style.display='none'"/>
      <div>
        <div class="company-name">DTG للعقارات</div>
        <div class="company-sub">نظام إدارة العقارات المتكامل</div>
      </div>
    </div>
    <div class="receipt-badge">
      <div class="receipt-label">إيصال استلام</div>
      <div class="receipt-num">${p.receiptNumber}</div>
    </div>
  </div>

  <!-- Amount banner -->
  <div class="amount-banner">
    <div>
      <div class="amount-label">المبلغ المستلم</div>
      <div class="amount-val">${amountFormatted}</div>
    </div>
    <div>
      <div class="status-pill">
        <span class="status-dot"></span>
        تم الاستلام
      </div>
      <div style="font-size:11px;color:#888;margin-top:6px;text-align:center">${paidDateFmt}</div>
    </div>
  </div>

  <!-- Installment progress -->
  <div style="padding-top:16px">
    <div class="installment-label">
      <span>القسط ${p.installmentNumber} من ${p.totalInstallments}</span>
      <span>${Math.round((p.installmentNumber / p.totalInstallments) * 100)}%</span>
    </div>
    <div class="installment-bar">
      <div class="installment-fill" style="width:${Math.round((p.installmentNumber / p.totalInstallments) * 100)}%"></div>
    </div>
  </div>

  <!-- Body: two columns -->
  <div class="body">
    <!-- Left: tenant info -->
    <div class="section">
      <div class="section-title">بيانات المستأجر</div>
      <div class="row"><span class="row-label">الاسم</span><span class="row-val">${p.tenantName}</span></div>
      ${p.tenantPhone    ? `<div class="row"><span class="row-label">الهاتف</span><span class="row-val" style="direction:ltr">${p.tenantPhone}</span></div>` : ''}
      ${p.tenantNationalId ? `<div class="row"><span class="row-label">رقم الهوية</span><span class="row-val">${p.tenantNationalId}</span></div>` : ''}
    </div>
    <div class="divider"></div>
    <!-- Right: payment details -->
    <div class="section" style="padding-right:0;padding-left:0">
      <div class="section-title">تفاصيل الدفعة</div>
      <div class="row"><span class="row-label">العقار</span><span class="row-val">${p.propertyName}</span></div>
      <div class="row"><span class="row-label">رقم الوحدة</span><span class="row-val">${p.unitNumber}</span></div>
      <div class="row"><span class="row-label">رقم العقد</span><span class="row-val">${p.contractNumber}</span></div>
      <div class="row"><span class="row-label">تاريخ الاستحقاق</span><span class="row-val">${dueDateFmt}</span></div>
      <div class="row"><span class="row-label">طريقة الدفع</span><span class="row-val">${methodLabel}</span></div>
      ${p.referenceNumber ? `<div class="row"><span class="row-label">رقم المرجع</span><span class="row-val">${p.referenceNumber}</span></div>` : ''}
    </div>
  </div>

  ${p.notes ? `<div class="notes-box">📝 ملاحظات: ${p.notes}</div>` : ''}

  <!-- Footer -->
  <div class="footer">
    <div class="footer-note">تاريخ الإصدار: ${now}</div>
    <div class="seal">
      <span class="seal-text">✓ تم التحقق والاستلام</span>
    </div>
    <div class="footer-note">هذا الإيصال وثيقة رسمية</div>
  </div>
</div>
<script>window.onload=function(){window.print()}</script>
</body>
</html>`;
}

// ─── Print / download receipt ──────────────────────────────────────────────────
function printReceipt(html: string, receiptNumber: string) {
  if (Platform.OS === 'web') {
    const win = window.open('', '_blank', 'width=900,height=650');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  } else {
    Alert.alert('الإيصال', `رقم الإيصال: ${receiptNumber}\nمتاح للطباعة على الويب فقط.`);
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const {
    payments, contracts, tenants, units, properties,
    deletePayment, confirmPayment, cancelPayment, updatePayment,
    canWrite, canDelete, isAdmin,
  } = useApp();

  const [showConfirm, setShowConfirm]   = useState(false);
  const [showCancel,  setShowCancel]    = useState(false);
  const [showDelete,  setShowDelete]    = useState(false);

  const payment  = payments.find(p => p.id === id);
  const contract = payment  ? contracts.find(c => c.id === payment.contractId) ?? null  : null;
  const tenant   = contract ? tenants.find(t => t.id === contract.tenantId)    ?? null  : null;
  const unit     = contract ? units.find(u => u.id === contract.unitId)        ?? null  : null;
  const property = unit     ? properties.find(p => p.id === unit.propertyId)   ?? null  : null;

  if (!payment) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="الدفعة" />
        <EmptyState icon="cash-outline" title="الدفعة غير موجودة" />
      </View>
    );
  }

  const contractPayments  = payments.filter(p => p.contractId === payment.contractId);
  const totalInstallments = contract?.paymentCycles ?? contractPayments.length;
  const paidCount         = contractPayments.filter(p => p.status === 'paid').length;
  const paidTotal         = contractPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const remainingCount    = totalInstallments - paidCount;
  const method            = payment.method ?? payment.paymentMethod ?? '';

  const statusColorMap: Record<string, string> = {
    paid: colors.success, pending: colors.warning, overdue: colors.danger,
  };
  const amountColor = statusColorMap[payment.status] || colors.text;

  // ── Build and print PDF receipt ──────────────────────────────────────────────
  const handlePrintReceipt = () => {
    const logoUrl = Platform.OS === 'web'
      ? `${window.location.origin}/assets/images/sidebar-logo.png`
      : '';
    const html = buildReceiptHTML({
      receiptNumber:     payment.receiptNumber ?? `RCP-${id}`,
      tenantName:        tenant?.name          ?? '—',
      tenantPhone:       tenant?.phone,
      tenantNationalId:  tenant?.nationalId,
      propertyName:      property?.name        ?? '—',
      unitNumber:        unit?.number          ?? '—',
      contractNumber:    contract?.contractNumber ?? '—',
      installmentNumber: payment.installmentNumber ?? 1,
      totalInstallments,
      amount:            payment.amount,
      paidDate:          payment.paidDate       ?? payment.dueDate,
      dueDate:           payment.dueDate,
      method,
      referenceNumber:   payment.referenceNumber,
      notes:             payment.notes,
      logoUrl,
    });
    printReceipt(html, payment.receiptNumber ?? '');
  };

  // ── Confirm payment ──────────────────────────────────────────────────────────
  const handleConfirm = () => {
    confirmPayment(id!);
    setShowConfirm(false);
    setTimeout(() => {
      const updated = payments.find(p => p.id === id);
      const rn      = updated?.receiptNumber ?? `RCP-${Date.now()}`;
      const logoUrl = Platform.OS === 'web'
        ? `${window.location.origin}/assets/images/sidebar-logo.png`
        : '';
      const html = buildReceiptHTML({
        receiptNumber: rn, tenantName: tenant?.name ?? '—',
        tenantPhone: tenant?.phone, tenantNationalId: tenant?.nationalId,
        propertyName: property?.name ?? '—', unitNumber: unit?.number ?? '—',
        contractNumber: contract?.contractNumber ?? '—',
        installmentNumber: payment.installmentNumber ?? 1, totalInstallments,
        amount: payment.amount, paidDate: new Date().toISOString().split('T')[0],
        dueDate: payment.dueDate, method, referenceNumber: payment.referenceNumber,
        notes: payment.notes, logoUrl,
      });
      printReceipt(html, rn);
    }, 400);
  };

  // ── Detail rows ──────────────────────────────────────────────────────────────
  const detailRows = [
    { label: 'المستأجر',       value: tenant?.name,           icon: 'person-outline',        route: tenant   ? `/tenant/${tenant.id}`     : null },
    { label: 'هاتف المستأجر',  value: tenant?.phone,          icon: 'call-outline',            route: null },
    { label: 'الوحدة',          value: unit ? `${property?.name} — وحدة ${unit.number}` : null, icon: 'home-outline', route: unit ? `/unit/${unit.id}` : null },
    { label: 'العقد',           value: contract?.contractNumber, icon: 'document-text-outline', route: contract ? `/contract/${contract.id}` : null },
    { label: 'تاريخ الاستحقاق', value: formatDate(payment.dueDate),  icon: 'calendar-outline', route: null },
    payment.paidDate ? { label: 'تاريخ الدفع', value: formatDate(payment.paidDate), icon: 'checkmark-circle-outline', route: null } : null,
    method ? { label: 'طريقة الدفع', value: methodLabels[method] ?? method, icon: methodIcons[method] ?? 'card-outline', route: null } : null,
    payment.referenceNumber ? { label: 'رقم المرجع', value: payment.referenceNumber, icon: 'barcode-outline', route: null } : null,
  ].filter(Boolean) as { label: string; value: string | undefined; icon: string; route: string | null }[];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="تفاصيل الدفعة" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Receipt card ── */}
        <View style={[styles.receiptCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.qrBox, { backgroundColor: colors.accent }]}>
            <Ionicons name="receipt-outline" size={40} color={colors.primary} />
            <Text style={[styles.receiptNumber, { color: colors.textSecondary }]}>{payment.receiptNumber ?? '—'}</Text>
          </View>
          <Text style={[styles.amount, { color: amountColor }]}>{formatCurrency(payment.amount)}</Text>
          <StatusBadge status={payment.status} />
          <View style={[styles.installBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.installText, { color: colors.primary }]}>
              القسط {payment.installmentNumber} من {totalInstallments}
            </Text>
          </View>
        </View>

        {/* ── Payment progress ── */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>تقدم السداد</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressStat}>
              <Text style={[styles.progressVal, { color: colors.success }]}>{paidCount}</Text>
              <Text style={[styles.progressLbl, { color: colors.textMuted }]}>مدفوعة</Text>
            </View>
            <View style={[styles.progressDiv, { backgroundColor: colors.border }]} />
            <View style={styles.progressStat}>
              <Text style={[styles.progressVal, { color: colors.warning }]}>{remainingCount}</Text>
              <Text style={[styles.progressLbl, { color: colors.textMuted }]}>متبقية</Text>
            </View>
            <View style={[styles.progressDiv, { backgroundColor: colors.border }]} />
            <View style={styles.progressStat}>
              <Text style={[styles.progressVal, { color: colors.primary }]}>{formatCurrency(paidTotal)}</Text>
              <Text style={[styles.progressLbl, { color: colors.textMuted }]}>محصّل</Text>
            </View>
          </View>
          <View style={[styles.barTrack, { backgroundColor: colors.accent }]}>
            <View style={[
              styles.barFill,
              { backgroundColor: colors.success, width: `${totalInstallments > 0 ? (paidCount / totalInstallments) * 100 : 0}%` as any },
            ]} />
          </View>
          <Text style={[styles.barLabel, { color: colors.textMuted }]}>
            {totalInstallments > 0 ? Math.round((paidCount / totalInstallments) * 100) : 0}% من إجمالي العقد ({formatCurrency(contract?.annualValue ?? 0)})
          </Text>
        </View>

        {/* ── Details ── */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>تفاصيل الدفعة</Text>
          {detailRows.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.detailRow, i < detailRows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={() => item.route && router.push(item.route as any)}
              disabled={!item.route}
            >
              {item.route && <Ionicons name="chevron-back-outline" size={14} color={colors.textMuted} />}
              <View style={styles.detailContent}>
                <Text style={[styles.detailValue, { color: item.route ? colors.secondary : colors.text }]}>{item.value || '—'}</Text>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{item.label}</Text>
              </View>
              <View style={[styles.detailIcon, { backgroundColor: colors.accent }]}>
                <Ionicons name={item.icon as any} size={18} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Notes ── */}
        {payment.notes && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>ملاحظات</Text>
            <Text style={[styles.notes, { color: colors.textSecondary }]}>{payment.notes}</Text>
          </View>
        )}

        {/* ── Attachments ── */}
        <View style={styles.card}>
          <AttachmentPanel entityType="payment" entityId={id!} />
        </View>

        {/* ── Confirm (pending only) ── */}
        {payment.status === 'pending' && canWrite && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.success + '15', borderColor: colors.success }]}
            onPress={() => setShowConfirm(true)}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
            <Text style={[styles.actionBtnText, { color: colors.success }]}>تأكيد استلام الدفعة</Text>
          </TouchableOpacity>
        )}

        {/* ── Print / PDF receipt ── */}
        {payment.status === 'paid' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary + '12', borderColor: colors.primary }]}
            onPress={handlePrintReceipt}
          >
            <Ionicons name="print-outline" size={20} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>طباعة الإيصال PDF</Text>
          </TouchableOpacity>
        )}

        {/* ── Cancel confirmed payment (paid → pending) ── */}
        {payment.status === 'paid' && isAdmin && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#F39C1215', borderColor: '#F39C12' }]}
            onPress={() => setShowCancel(true)}
          >
            <Ionicons name="arrow-undo-outline" size={20} color="#F39C12" />
            <Text style={[styles.actionBtnText, { color: '#F39C12' }]}>إلغاء تأكيد الدفعة</Text>
          </TouchableOpacity>
        )}

        {/* ── Delete (pending only) ── */}
        {payment.status === 'pending' && canDelete && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.danger + '12', borderColor: colors.danger }]}
            onPress={() => setShowDelete(true)}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
            <Text style={[styles.actionBtnText, { color: colors.danger }]}>حذف الدفعة</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Modals ── */}
      <ConfirmModal
        visible={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        title="تأكيد استلام الدفعة"
        message={`هل تأكدت من استلام مبلغ ${formatCurrency(payment.amount)}؟ سيتم تسجيلها كمدفوعة وفتح الإيصال للطباعة.`}
        confirmLabel="تأكيد الاستلام"
        variant="warning"
      />
      <ConfirmModal
        visible={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => { cancelPayment(id!); setShowCancel(false); }}
        title="إلغاء تأكيد الدفعة"
        message="سيتم إرجاع الدفعة إلى حالة «معلقة» وحذف رقم الإيصال. هل تريد المتابعة؟"
        confirmLabel="نعم، إلغاء التأكيد"
        variant="danger"
      />
      <ConfirmModal
        visible={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => { deletePayment(id!); setShowDelete(false); router.back(); }}
        title="حذف الدفعة"
        message="هل أنت متأكد من حذف هذه الدفعة؟ لا يمكن التراجع."
        confirmLabel="حذف"
        variant="danger"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  receiptCard: {
    margin: Theme.spacing.base, borderRadius: Theme.radius.xl,
    borderWidth: 1, padding: Theme.spacing.xl, alignItems: 'center', gap: 12,
  },
  qrBox: {
    width: 100, height: 100, borderRadius: Theme.radius.lg,
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  receiptNumber: { fontSize: Theme.fontSize.xs },
  amount:        { fontSize: 40, fontWeight: '800' },
  installBadge:  { paddingHorizontal: 16, paddingVertical: 6, borderRadius: Theme.radius.full, marginTop: 4 },
  installText:   { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold },

  card: {
    marginHorizontal: Theme.spacing.base, marginBottom: Theme.spacing.sm,
    borderRadius: Theme.radius.lg, borderWidth: 1, padding: Theme.spacing.md,
  },
  cardTitle: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, marginBottom: 10, textAlign: 'right' },

  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  progressStat: { flex: 1, alignItems: 'center', gap: 3 },
  progressDiv:  { width: 1, height: 36, marginHorizontal: 4 },
  progressVal:  { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },
  progressLbl:  { fontSize: Theme.fontSize.xs, textAlign: 'center' },
  barTrack:     { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill:      { height: 8, borderRadius: 4 },
  barLabel:     { fontSize: Theme.fontSize.xs, textAlign: 'center', marginTop: 6 },

  detailRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  detailIcon:   { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  detailContent:{ flex: 1 },
  detailValue:  { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  detailLabel:  { fontSize: Theme.fontSize.sm, textAlign: 'right' },
  notes:        { fontSize: Theme.fontSize.md, lineHeight: 22, paddingTop: 4, textAlign: 'right' },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: Theme.spacing.base, marginBottom: Theme.spacing.sm,
    borderWidth: 1.5, borderRadius: Theme.radius.lg, paddingVertical: 14,
  },
  actionBtnText: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.semibold },
});
