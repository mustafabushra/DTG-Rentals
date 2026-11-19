import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppTheme } from '../../hooks/useAppTheme';
import { Theme } from '../../constants/Theme';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

/** نافذة تأكيد تطلب سبباً مكتوباً — للإلغاء الذي يبقى أثره في السجل. */
export function ReasonModal({ visible, title, message, confirmLabel = 'تأكيد الإلغاء', busy, error, onClose, onConfirm }: Props) {
  const { colors } = useAppTheme();
  const [reason, setReason] = useState('');
  useEffect(() => { if (visible) setReason(''); }, [visible]);
  const valid = reason.trim().length >= 3;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.box, { backgroundColor: colors.card, borderColor: colors.borderStrong }]}>
          <View style={styles.head}>
            <View style={[styles.icon, { backgroundColor: colors.dangerSubtle }]}>
              <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          </View>
          {!!message && <Text style={[styles.msg, { color: colors.textSecondary }]}>{message}</Text>}
          <Text style={[styles.label, { color: colors.text }]}>سبب الإلغاء <Text style={{ color: colors.danger }}>*</Text></Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="اكتب السبب — يظهر في السند وسجل الإجراءات"
            placeholderTextColor={colors.textMuted}
            multiline
            style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
          />
          {!!error && <Text style={[styles.err, { color: colors.danger }]}>{error}</Text>}
          <View style={styles.actions}>
            <TouchableOpacity
              disabled={!valid || busy}
              onPress={() => onConfirm(reason.trim())}
              style={[styles.btn, { backgroundColor: colors.danger, opacity: !valid || busy ? 0.4 : 1 }]}
            >
              <Text style={[styles.btnText, { color: '#FFFFFF' }]}>{busy ? 'جارٍ التنفيذ...' : confirmLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={[styles.btn, { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.card }]}>
              <Text style={[styles.btnText, { color: colors.text }]}>تراجع</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  box: { width: '100%', maxWidth: 440, borderRadius: Theme.radius.xl, borderWidth: 1, padding: 20, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'right' },
  msg: { fontSize: 14, lineHeight: 22, textAlign: 'right' },
  label: { fontSize: 14, fontWeight: '500', textAlign: 'right', marginTop: 4 },
  input: { minHeight: 80, borderWidth: 1, borderRadius: Theme.radius.sm, padding: 10, fontSize: 15, textAlign: 'right', textAlignVertical: 'top' },
  err: { fontSize: 13, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btn: { flex: 1, minHeight: 44, borderRadius: Theme.radius.sm, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '500' },
});
