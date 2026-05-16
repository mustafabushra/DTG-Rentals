/**
 * CancelContractModal — Admin-only contract cancellation flow.
 * Requires confirmation + reason before cancelling.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { lightColors, darkColors, spacing, fontSize, fontWeight, radius } from '../../constants/DesignTokens';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { Contract } from '../../domain/models';
import { useAppTheme } from '../../hooks/useAppTheme';

const REASONS = [
  'طلب المستأجر إنهاء العقد',
  'مخالفة شروط العقد',
  'عدم دفع الإيجار',
  'بيع العقار',
  'إعادة تطوير العقار',
  'سبب آخر',
];

interface CancelContractModalProps {
  visible:    boolean;
  onClose:    () => void;
  contract:   Contract;
  onConfirm:  (reason: string) => void;
}

export function CancelContractModal({
  visible, onClose, contract, onConfirm,
}: CancelContractModalProps) {
  const { colors } = useAppTheme();
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason,   setCustomReason]   = useState('');
  const [confirmed,      setConfirmed]      = useState(false);

  const finalReason = selectedReason === 'سبب آخر' ? customReason : selectedReason;

  const handleCancel = () => {
    if (!finalReason.trim()) {
      Alert.alert('تنبيه', 'يرجى تحديد سبب الإلغاء');
      return;
    }
    onConfirm(finalReason);
    onClose();
    setSelectedReason('');
    setCustomReason('');
    setConfirmed(false);
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="إلغاء العقد"
      size="lg"
      scrollable
      footer={
        <View style={styles.footer}>
          <Button label="تراجع" onPress={onClose} variant="outline" fullWidth />
          <Button
            label="تأكيد الإلغاء"
            onPress={handleCancel}
            variant="danger"
            fullWidth
            disabled={!finalReason.trim()}
          />
        </View>
      }
    >
      {/* Warning Banner */}
      <View style={[styles.warning, { backgroundColor: colors.dangerSubtle, borderColor: colors.danger + '40' }]}>
        <Ionicons name="warning-outline" size={22} color={colors.danger} />
        <Text style={[styles.warningText, { color: colors.danger }]}>
          هذا الإجراء لا يمكن التراجع عنه. سيتم إلغاء العقد وتسجيل الحدث في سجل النظام.
        </Text>
      </View>

      {/* Contract Info */}
      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>رقم العقد</Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>{contract.id}</Text>
        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>تاريخ الانتهاء</Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>{contract.endDate}</Text>
      </View>

      {/* Reason Selection */}
      <Text style={[styles.sectionLabel, { color: colors.text }]}>سبب الإلغاء *</Text>
      {REASONS.map(r => (
        <View
          key={r}
          style={[
            styles.reasonRow,
            { borderColor: selectedReason === r ? colors.danger : colors.border },
          ]}
        >
          <View
            style={[
              styles.radio,
              { borderColor: selectedReason === r ? colors.danger : colors.border },
            ]}
          >
            {selectedReason === r && (
              <View style={[styles.radioDot, { backgroundColor: colors.danger }]} />
            )}
          </View>
          <Text
            style={[styles.reasonText, { color: colors.text }]}
            onPress={() => setSelectedReason(r)}
          >
            {r}
          </Text>
        </View>
      ))}

      {selectedReason === 'سبب آخر' && (
        <Input
          label="وصف السبب"
          value={customReason}
          onChangeText={setCustomReason}
          multiline
          numberOfLines={3}
          required
          placeholder="اكتب سبب الإلغاء..."
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  warning: {
    flexDirection: 'row',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  warningText: { flex: 1, fontSize: fontSize.sm, lineHeight: 20, textAlign: 'right' },
  infoCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[1],
  },
  infoLabel:   { fontSize: fontSize.xs, textAlign: 'right' },
  infoValue:   { fontSize: fontSize.base, fontWeight: fontWeight.semibold, marginBottom: spacing[2], textAlign: 'right' },
  sectionLabel:{ fontSize: fontSize.base, fontWeight: fontWeight.bold, textAlign: 'right' },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  radio: {
    width: 20, height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  reasonText: { flex: 1, fontSize: fontSize.base, textAlign: 'right' },
  footer: { flexDirection: 'row', gap: spacing[3] },
});
