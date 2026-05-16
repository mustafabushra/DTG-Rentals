import React from 'react';
import {
  Modal as RNModal, View, Text, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { lightColors, darkColors, spacing, fontSize, fontWeight, radius, shadow, zIndex } from '../../constants/DesignTokens';
import { useAppTheme } from '../../hooks/useAppTheme';

export type ModalSize = 'sm' | 'md' | 'lg' | 'full';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: ModalSize;
  scrollable?: boolean;
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;
}

export function Modal({
  visible,
  onClose,
  title,
  children,
  size = 'md',
  scrollable = false,
  footer,
  closeOnBackdrop = true,
}: ModalProps) {
  const { colors } = useAppTheme();
  const insets  = useSafeAreaInsets();

  const maxHeightMap: Record<ModalSize, number> = {
    sm:   400,
    md:   600,
    lg:   750,
    full: 9999,
  };

  const Content = scrollable ? ScrollView : View;

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Backdrop */}
        {closeOnBackdrop && (
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        )}

        {/* Sheet */}
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              maxHeight: maxHeightMap[size],
              paddingBottom: insets.bottom + spacing[4],
              ...shadow.lg,
            },
          ]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          {title && (
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              <View style={styles.closePlaceholder} />
            </View>
          )}

          {/* Body */}
          <Content
            style={styles.body}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={scrollable ? { padding: spacing[4], gap: spacing[4] } : undefined}
          >
            {scrollable ? children : <View style={styles.bodyInner}>{children}</View>}
          </Content>

          {/* Footer */}
          {footer && (
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              {footer}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

export function ConfirmModal({
  visible, onClose, onConfirm,
  title, message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  variant = 'danger',
}: ConfirmModalProps) {
  const { colors } = useAppTheme();

  const variantColor: Record<string, string> = {
    danger:  colors.danger,
    warning: colors.warning,
    primary: colors.primary,
  };

  return (
    <Modal visible={visible} onClose={onClose} size="sm">
      <View style={styles.confirmBody}>
        <Text style={[styles.confirmTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.confirmMsg, { color: colors.textSecondary }]}>{message}</Text>
        <View style={styles.confirmBtns}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.confirmBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Text style={[styles.confirmBtnText, { color: colors.textSecondary }]}>{cancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { onConfirm(); onClose(); }}
            style={[styles.confirmBtn, { backgroundColor: variantColor[variant] }]}
          >
            <Text style={[styles.confirmBtnText, { color: '#FFF' }]}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Alert Modal (blocked / info) ────────────────────────────────────────────

interface AlertModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function AlertModal({
  visible, onClose,
  title, message,
  variant = 'warning',
}: AlertModalProps) {
  const { colors } = useAppTheme();

  const cfg = {
    danger:  { bg: '#FDEDEC', color: colors.danger,  icon: 'ban-outline' as const },
    warning: { bg: '#FEF9E7', color: colors.warning, icon: 'warning-outline' as const },
    info:    { bg: '#EBF5FB', color: colors.primary,  icon: 'information-circle-outline' as const },
  }[variant];

  return (
    <Modal visible={visible} onClose={onClose} size="sm">
      <View style={alertStyles.body}>
        <View style={[alertStyles.iconBox, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={32} color={cfg.color} />
        </View>
        <Text style={[alertStyles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[alertStyles.message, { color: colors.textSecondary }]}>{message}</Text>
        <TouchableOpacity
          onPress={onClose}
          style={[alertStyles.btn, { backgroundColor: cfg.color }]}
        >
          <Text style={alertStyles.btnText}>حسناً</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const alertStyles = StyleSheet.create({
  body:    { padding: spacing[4], gap: spacing[3], alignItems: 'center' },
  iconBox: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: spacing[1] },
  title:   { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  message: { fontSize: fontSize.base, textAlign: 'center', lineHeight: 24 },
  btn:     { alignSelf: 'stretch', paddingVertical: spacing[3], borderRadius: radius.lg, alignItems: 'center' },
  btnText: { color: '#FFF', fontSize: fontSize.base, fontWeight: fontWeight.bold },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: zIndex.modal,
  },
  sheet: {
    borderTopLeftRadius:  radius['2xl'],
    borderTopRightRadius: radius['2xl'],
  },
  handle: {
    width: 36, height: 4,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[1],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  title:           { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center', color: '#000' },
  closeBtn:        { padding: spacing[1] },
  closePlaceholder:{ width: 30 },
  body:            { flexShrink: 1 },
  bodyInner:       { padding: spacing[4], gap: spacing[4] },
  footer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: 1,
  },
  // Confirm
  confirmBody:  { padding: spacing[4], gap: spacing[4], alignItems: 'center' },
  confirmTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  confirmMsg:   { fontSize: fontSize.base, textAlign: 'center', lineHeight: 22 },
  confirmBtns:  { flexDirection: 'row', gap: spacing[3], width: '100%' },
  confirmBtn:   { flex: 1, paddingVertical: spacing[3], borderRadius: radius.lg, alignItems: 'center' },
  confirmBtnText: { fontSize: fontSize.base, fontWeight: fontWeight.bold },
});
