import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { AppHeader } from '../components/ui/AppHeader';
import { FormInput } from '../components/forms/FormInput';
import { useApp } from '../context/AppProvider';
import { FormContainer } from '../components/ui/FormContainer';
import { useAppTheme } from '../hooks/useAppTheme';

export default function ContactUsScreen() {
  const { colors } = useAppTheme();
  const { currentUser } = useApp();
  const [form, setForm] = useState({ name: currentUser.name || '', email: currentUser.email || '', subject: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const set = (key: string) => (val: string) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  const handleSend = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'الاسم مطلوب';
    if (!form.email.includes('@')) e.email = 'البريد الإلكتروني غير صحيح';
    if (!form.subject.trim()) e.subject = 'الموضوع مطلوب';
    if (form.message.trim().length < 10) e.message = 'الرسالة يجب أن تكون 10 أحرف على الأقل';
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSent(true);
  };

  const contactChannels = [
    { icon: 'mail-outline', label: 'البريد الإلكتروني', value: 'support@dtgrentals.com', color: '#2E86C1', url: 'mailto:support@dtgrentals.com' },
    { icon: 'call-outline', label: 'الهاتف', value: '920 000 000', color: '#27AE60', url: 'tel:920000000' },
    { icon: 'time-outline', label: 'أوقات العمل', value: 'الأحد – الخميس، 9ص – 5م', color: '#F39C12', url: null },
  ];

  if (sent) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="اتصل بنا" />
        <View style={styles.successContainer}>
          <View style={[styles.successIcon, { backgroundColor: `${colors.success}20` }]}>
            <Ionicons name="checkmark-circle" size={72} color={colors.success} />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>تم إرسال رسالتك!</Text>
          <Text style={[styles.successSub, { color: colors.textSecondary }]}>
            سنتواصل معك خلال 24 ساعة على بريدك الإلكتروني
          </Text>
          <TouchableOpacity
            style={[styles.newMsgBtn, { backgroundColor: colors.primary }]}
            onPress={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }); }}
          >
            <Text style={styles.newMsgText}>إرسال رسالة جديدة</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="اتصل بنا" />

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Contact Channels */}
        <View style={[styles.channelsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.channelsTitle, { color: colors.text }]}>طرق التواصل</Text>
          {contactChannels.map((ch, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.channelRow, { borderBottomColor: colors.border, borderBottomWidth: i < contactChannels.length - 1 ? 1 : 0 }]}
              onPress={() => ch.url && Linking.openURL(ch.url).catch(() => Alert.alert('خطأ', 'تعذّر فتح الرابط'))}
              disabled={!ch.url}
              activeOpacity={ch.url ? 0.7 : 1}
            >
              <Text style={[styles.channelValue, { color: ch.url ? colors.primary : colors.textSecondary }]}>{ch.value}</Text>
              <View style={styles.channelLeft}>
                <View style={[styles.channelIcon, { backgroundColor: `${ch.color}15` }]}>
                  <Ionicons name={ch.icon as any} size={18} color={ch.color} />
                </View>
                <Text style={[styles.channelLabel, { color: colors.text }]}>{ch.label}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.formTitle, { color: colors.text }]}>أو أرسل لنا رسالة</Text>

        {/* Form */}
        <FormInput label="الاسم الكامل" value={form.name} onChangeText={set('name')} required icon="person-outline" error={errors.name} />
        <FormInput label="البريد الإلكتروني" value={form.email} onChangeText={set('email')} keyboardType="email-address" required icon="mail-outline" error={errors.email} autoCapitalize="none" />
        <FormInput label="الموضوع" value={form.subject} onChangeText={set('subject')} required icon="chatbox-outline" error={errors.subject} />
        <FormInput label="الرسالة" value={form.message} onChangeText={set('message')} required icon="create-outline" error={errors.message} multiline numberOfLines={5} />

        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.primary }]}
          onPress={handleSend}
        >
          <Ionicons name="send-outline" size={18} color="#FFF" />
          <Text style={styles.sendBtnText}>إرسال الرسالة</Text>
        </TouchableOpacity>
      </ScrollView></FormContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Theme.spacing.base, gap: Theme.spacing.lg, paddingBottom: 48 },
  channelsCard: { borderRadius: Theme.radius.lg, borderWidth: 1, overflow: 'hidden' },
  channelsTitle: { fontSize: Theme.fontSize.base, fontWeight: '700', padding: Theme.spacing.md, paddingBottom: Theme.spacing.sm },
  channelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Theme.spacing.md },
  channelLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  channelIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  channelLabel: { fontSize: Theme.fontSize.base },
  channelValue: { fontSize: Theme.fontSize.sm },
  divider: { height: 1 },
  formTitle: { fontSize: Theme.fontSize.lg, fontWeight: '700' },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Theme.radius.lg, paddingVertical: 16, marginTop: 4 },
  sendBtnText: { color: '#FFF', fontSize: Theme.fontSize.lg, fontWeight: '700' },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Theme.spacing.xxxl, gap: 16 },
  successIcon: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center' },
  successTitle: { fontSize: Theme.fontSize.huge, fontWeight: '700', textAlign: 'center' },
  successSub: { fontSize: Theme.fontSize.base, textAlign: 'center', lineHeight: 24 },
  newMsgBtn: { marginTop: 8, paddingHorizontal: 32, paddingVertical: 14, borderRadius: Theme.radius.lg },
  newMsgText: { color: '#FFF', fontSize: Theme.fontSize.base, fontWeight: '700' },
});
