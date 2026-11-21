/**
 * نوافذ الشيكات: شيك لقسط واحد، أو شيكات عقد كامل دفعة وحدة (مع معاينة قبل الحفظ).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal } from '../ui/Modal';
import { FormInput } from '../forms/FormInput';
import { FormDatePicker } from '../forms/FormDatePicker';
import { CurrencyText } from '../ui/CurrencyText';
import { useAppTheme } from '../../hooks/useAppTheme';
import { ChequeService, type Cheque } from '../../domain/services/ChequeService';
import { formatDate } from '../../data/mockData';

const today = () => new Date().toISOString().split('T')[0];

function Footer({ onCancel, onSave, saveLabel, disabled }: { onCancel: () => void; onSave: () => void; saveLabel: string; disabled?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <TouchableOpacity onPress={onSave} disabled={disabled}
        style={[styles.btn, { flex: 2, backgroundColor: disabled ? colors.border : colors.primary }]}>
        <Text style={[styles.btnText, { color: colors.textInverse }]}>{saveLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancel} style={[styles.btn, { flex: 1, borderWidth: 1, borderColor: colors.border }]}>
        <Text style={[styles.btnText, { color: colors.text }]}>إلغاء</Text>
      </TouchableOpacity>
    </View>
  );
}

/** شيك لقسط واحد (إضافة أو تعديل) */
export function ChequeSheet({ visible, onClose, onSave, initial, dueDate, amount, currency }: {
  visible: boolean; onClose: () => void; onSave: (c: Cheque) => void;
  initial?: Cheque; dueDate: string; amount: number; currency?: string;
}) {
  const { colors } = useAppTheme();
  const [number, setNumber] = useState('');
  const [bank, setBank] = useState('');
  const [date, setDate] = useState(dueDate);
  useEffect(() => {
    if (!visible) return;
    setNumber(initial?.number ?? ''); setBank(initial?.bank ?? ''); setDate(initial?.date ?? dueDate);
  }, [visible]);
  const ok = number.trim().length > 0 && !!date;
  return (
    <Modal visible={visible} onClose={onClose} title={initial ? 'تعديل الشيك' : 'استلمت شيك لهذا القسط'} scrollable
      footer={<Footer onCancel={onClose} saveLabel="حفظ الشيك" disabled={!ok}
        onSave={() => onSave({ ...(initial ?? { status: 'held', receivedAt: today() }), number: number.trim(), bank: bank.trim() || undefined, date } as Cheque)} />}>
      <View style={[styles.amountBox, { backgroundColor: colors.surface }]}>
        <Text style={[styles.muted, { color: colors.textMuted }]}>مبلغ القسط</Text>
        <CurrencyText amount={amount} currency={currency} size={20} color={colors.text} />
      </View>
      <FormInput label="رقم الشيك" value={number} onChangeText={setNumber} placeholder="مثال: 000981" icon="barcode-outline" required />
      <FormInput label="البنك (اختياري)" value={bank} onChangeText={setBank} placeholder="مثال: الإمارات دبي الوطني" icon="business-outline" />
      <FormDatePicker label="تاريخ الشيك" value={date} onChange={setDate} required />
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        القسط ما ينحسب مدفوع إلا لما تسجّل إن الشيك انصرف. بنذكّرك قبل موعد إيداعه.
      </Text>
    </Modal>
  );
}

/** شيكات العقد كله: تكتب أول رقم والبنك، والباقي يتعبّى تلقائي */
export function ContractChequesSheet({ visible, onClose, onSave, installments, currency }: {
  visible: boolean; onClose: () => void; onSave: (plan: { paymentId: string; cheque: Cheque }[]) => void;
  installments: { id: string; dueDate: string; amount: number; installmentNumber?: number }[]; currency?: string;
}) {
  const { colors } = useAppTheme();
  const [first, setFirst] = useState('');
  const [bank, setBank] = useState('');
  useEffect(() => { if (visible) { setFirst(''); setBank(''); } }, [visible]);
  const plan = useMemo(
    () => first.trim() ? ChequeService.planForContract(installments, first.trim(), bank.trim(), today()) : [],
    [first, bank, installments],
  );
  const byId = new Map(installments.map(i => [i.id, i]));
  return (
    <Modal visible={visible} onClose={onClose} title="تسجيل شيكات العقد" size="lg" scrollable
      footer={<Footer onCancel={onClose} disabled={plan.length === 0}
        saveLabel={plan.length ? `حفظ ${plan.length} شيك` : 'حفظ'} onSave={() => onSave(plan)} />}>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        اكتب رقم أول شيك والبنك، ونعبّي باقي الشيكات بأرقام متسلسلة وبتواريخ الأقساط. راجعها تحت قبل الحفظ.
      </Text>
      <FormInput label="رقم أول شيك" value={first} onChangeText={setFirst} placeholder="مثال: 000981" icon="barcode-outline" required />
      <FormInput label="البنك (اختياري)" value={bank} onChangeText={setBank} placeholder="مثال: الإمارات دبي الوطني" icon="business-outline" />
      {plan.length > 0 && (
        <View style={[styles.preview, { borderColor: colors.border }]}>
          {plan.map((p, i) => {
            const inst = byId.get(p.paymentId)!;
            return (
              <View key={p.paymentId} style={[styles.pRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Ionicons name="card-outline" size={16} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pNum, { color: colors.text }]}>شيك {p.cheque.number}</Text>
                  <Text style={[styles.muted, { color: colors.textMuted }]}>
                    القسط {inst.installmentNumber ?? i + 1} · تاريخه {formatDate(p.cheque.date)}
                  </Text>
                </View>
                <CurrencyText amount={inst.amount} currency={currency} size={14} color={colors.text} />
              </View>
            );
          })}
        </View>
      )}
      {installments.length === 0 && (
        <Text style={[styles.hint, { color: colors.textMuted }]}>كل أقساط هذا العقد مدفوعة أو عليها شيكات.</Text>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  btn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
  amountBox: { borderRadius: 12, padding: 12, gap: 4, alignItems: 'flex-end' },
  muted: { fontSize: 12, textAlign: 'right' },
  hint: { fontSize: 13, lineHeight: 20, textAlign: 'right' },
  preview: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  pRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  pNum: { fontSize: 14, fontWeight: '600', textAlign: 'right' },
});
