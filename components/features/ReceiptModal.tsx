/**
 * ReceiptModal — Payment receipt display with print/share options.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Share } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { lightColors, darkColors, spacing, fontSize, fontWeight, radius } from '../../constants/DesignTokens';
import { Modal } from '../ui/Modal';
import { CurrencyText } from '../ui/CurrencyText';
import { Button } from '../ui/Button';
import { PaymentService } from '../../domain/services/PaymentService';
import type { Receipt } from '../../domain/models';
import { useAppTheme } from '../../hooks/useAppTheme';

interface ReceiptModalProps {
  visible:  boolean;
  onClose:  () => void;
  receipt:  Receipt | null;
}

export function ReceiptModal({ visible, onClose, receipt }: ReceiptModalProps) {
  const { colors } = useAppTheme();

  if (!receipt) return null;

  const handleShare = async () => {
    const text = [
      `إيصال دفع — ${receipt.receiptNumber}`,
      `─────────────────────────`,
      `المستأجر: ${receipt.tenantName}`,
      `الجوال:   ${receipt.tenantPhone}`,
      `العقار:   ${receipt.propertyName}`,
      `الوحدة:   ${receipt.unitNumber}`,
      `القسط:    ${receipt.installmentNumber}`,
      `المبلغ:   ${receipt.amount.toLocaleString('en-US')} ر.س`,
      `طريقة الدفع: ${PaymentService.methodLabel(receipt.paymentMethod)}`,
      receipt.referenceNumber ? `رقم المرجع: ${receipt.referenceNumber}` : '',
      `تاريخ الإصدار: ${receipt.issuedDate}`,
      `صادر عن: ${receipt.issuedBy}`,
    ].filter(Boolean).join('\n');

    await Share.share({ message: text });
  };

  const Row = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: highlight ? colors.primary : colors.text, fontWeight: highlight ? fontWeight.bold : fontWeight.regular }]}>
        {value}
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="إيصال الدفع"
      size="lg"
      footer={
        <View style={styles.footer}>
          <Button label="مشاركة" onPress={handleShare} variant="outline" icon="share-outline" fullWidth />
          <Button label="إغلاق"  onPress={onClose}     variant="primary"  fullWidth />
        </View>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Receipt Header */}
        <View style={[styles.receiptHeader, { backgroundColor: colors.primary }]}>
          <Text style={styles.receiptTitle}>إيصال دفع إيجار</Text>
          <Text style={styles.receiptNum}>{receipt.receiptNumber}</Text>
          <Text style={styles.receiptDate}>{receipt.issuedDate}</Text>
        </View>

        {/* Body */}
        <View style={[styles.body, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row label="المستأجر"     value={receipt.tenantName} />
          <Row label="رقم الجوال"   value={receipt.tenantPhone} />
          <Row label="العقار"        value={receipt.propertyName} />
          <Row label="رقم الوحدة"   value={receipt.unitNumber} />
          <Row label="رقم القسط"    value={`${receipt.installmentNumber}`} />
          <Row label="طريقة الدفع"  value={PaymentService.methodLabel(receipt.paymentMethod)} />
          {receipt.referenceNumber && (
            <Row label="رقم المرجع" value={receipt.referenceNumber} />
          )}
          {receipt.notes && (
            <Row label="ملاحظات" value={receipt.notes} />
          )}

          {/* Amount Highlight */}
          <View style={[styles.amountBox, { backgroundColor: colors.successSubtle, borderColor: colors.success + '40' }]}>
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>المبلغ المدفوع</Text>
            <CurrencyText amount={receipt.amount} color={colors.success} size={22} />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.receiptFooter}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            صادر بواسطة: {receipt.issuedBy}
          </Text>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  receiptHeader: {
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[1],
    borderRadius: radius.xl,
    marginBottom: spacing[4],
  },
  receiptTitle: { color: '#FFF', fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  receiptNum:   { color: 'rgba(255,255,255,0.9)', fontSize: fontSize.base, fontWeight: fontWeight.medium },
  receiptDate:  { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.sm },
  body: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  label:  { fontSize: fontSize.sm, flex: 1, textAlign: 'right' },
  value:  { fontSize: fontSize.base, textAlign: 'right' },
  amountBox: {
    alignItems: 'center',
    paddingVertical: spacing[5],
    borderTopWidth: 2,
    gap: spacing[1],
    borderColor: 'transparent',
  },
  amountLabel: { fontSize: fontSize.sm },
  amountValue: { fontSize: fontSize['3xl'], fontWeight: fontWeight.extrabold },
  receiptFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingBottom: spacing[4],
  },
  footerText: { fontSize: fontSize.sm },
  footer: { flexDirection: 'row', gap: spacing[3] },
});
