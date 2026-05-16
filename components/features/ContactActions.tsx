/**
 * ContactActions — Call + Email quick action buttons.
 * Reusable across Owner, Tenant, and Contact Us screens.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { lightColors, darkColors, spacing, fontSize, fontWeight, radius } from '../../constants/DesignTokens';
import { useAppTheme } from '../../hooks/useAppTheme';

interface ContactActionsProps {
  phone?: string;
  email?: string;
  name?: string;
  size?: 'sm' | 'md';
}

export function ContactActions({ phone, email, name, size = 'md' }: ContactActionsProps) {
  const { colors } = useAppTheme();

  const handleCall = async () => {
    if (!phone) return;
    const url = `tel:${phone.replace(/\s/g, '')}`;
    const can = await Linking.canOpenURL(url);
    if (can) {
      await Linking.openURL(url);
    } else {
      Alert.alert('تعذر الاتصال', 'لا يمكن فتح تطبيق الهاتف على هذا الجهاز');
    }
  };

  const handleEmail = async () => {
    if (!email) return;
    const subject = name ? `تواصل مع ${name}` : 'تواصل';
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
    const can = await Linking.canOpenURL(url);
    if (can) {
      await Linking.openURL(url);
    } else {
      Alert.alert('تعذر الإرسال', 'لا يمكن فتح تطبيق البريد على هذا الجهاز');
    }
  };

  const isSmall = size === 'sm';

  return (
    <View style={styles.row}>
      {email && (
        <TouchableOpacity
          onPress={handleEmail}
          style={[
            styles.btn,
            isSmall ? styles.btnSm : styles.btnMd,
            { backgroundColor: colors.primarySubtle, borderColor: colors.primary + '30' },
          ]}
          activeOpacity={0.8}
        >
          <Ionicons name="mail-outline" size={isSmall ? 16 : 18} color={colors.primary} />
          {!isSmall && (
            <Text style={[styles.label, { color: colors.primary }]}>بريد إلكتروني</Text>
          )}
        </TouchableOpacity>
      )}
      {phone && (
        <TouchableOpacity
          onPress={handleCall}
          style={[
            styles.btn,
            isSmall ? styles.btnSm : styles.btnMd,
            { backgroundColor: colors.successSubtle, borderColor: colors.success + '30' },
          ]}
          activeOpacity={0.8}
        >
          <Ionicons name="call-outline" size={isSmall ? 16 : 18} color={colors.success} />
          {!isSmall && (
            <Text style={[styles.label, { color: colors.success }]}>اتصال</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing[1],
  },
  btnSm: { paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  btnMd: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], flex: 1, justifyContent: 'center' },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: 'right' },
});
