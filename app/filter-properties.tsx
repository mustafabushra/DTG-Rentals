import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useAppTheme } from '../hooks/useAppTheme';

export default function FilterPropertiesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sort, setSort] = useState<'newest' | 'revenue' | 'units'>('newest');

  const types = [
    { label: 'شقة', value: 'apartment', icon: 'business-outline' },
    { label: 'فيلا', value: 'villa', icon: 'home-outline' },
    { label: 'مكتب', value: 'office', icon: 'briefcase-outline' },
    { label: 'محل', value: 'shop', icon: 'storefront-outline' },
  ];

  const toggleType = (t: string) => {
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const sortOptions = [
    { label: 'الأحدث', value: 'newest' },
    { label: 'الأعلى إيراداً', value: 'revenue' },
    { label: 'الأكثر وحدات', value: 'units' },
  ];

  const handleApply = () => {
    router.back();
  };

  const handleReset = () => {
    setSelectedTypes([]);
    setStatus('all');
    setSort('newest');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={handleReset}>
          <Text style={styles.resetText}>إعادة ضبط</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تصفية العقارات</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Type Filter */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>نوع العقار</Text>
        <View style={styles.typeGrid}>
          {types.map(t => {
            const sel = selectedTypes.includes(t.value);
            return (
              <TouchableOpacity
                key={t.value}
                style={[styles.typeCard, { backgroundColor: sel ? colors.primary : colors.card, borderColor: sel ? colors.primary : colors.border }]}
                onPress={() => toggleType(t.value)}
              >
                <Ionicons name={t.icon as any} size={24} color={sel ? '#FFF' : colors.textSecondary} />
                <Text style={[styles.typeLabel, { color: sel ? '#FFF' : colors.text }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Status */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>الحالة</Text>
        <View style={[styles.radioGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: 'الكل', value: 'all' },
            { label: 'نشط', value: 'active' },
            { label: 'غير نشط', value: 'inactive' },
          ].map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.radioItem, { borderBottomColor: colors.border }]}
              onPress={() => setStatus(opt.value as any)}
            >
              <View style={[styles.radioCircle, { borderColor: colors.border }]}>
                {status === opt.value && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
              </View>
              <Text style={[styles.radioLabel, { color: colors.text }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sort */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>الترتيب</Text>
        <View style={[styles.radioGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {sortOptions.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.radioItem, { borderBottomColor: colors.border }]}
              onPress={() => setSort(opt.value as any)}
            >
              <View style={[styles.radioCircle, { borderColor: colors.border }]}>
                {sort === opt.value && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
              </View>
              <Text style={[styles.radioLabel, { color: colors.text }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Apply Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }]} onPress={handleApply}>
          <Text style={styles.applyText}>تطبيق الفلتر</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 14, paddingHorizontal: Theme.spacing.base,
  },
  headerTitle: { color: '#FFF', fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },
  resetText: { color: 'rgba(255,255,255,0.85)', fontSize: Theme.fontSize.md },
  content: { padding: Theme.spacing.base, gap: Theme.spacing.md, paddingBottom: 20 },
  sectionTitle: { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },
  typeGrid: { flexDirection: 'row', gap: Theme.spacing.sm },
  typeCard: { flex: 1, aspectRatio: 1, borderRadius: Theme.radius.lg, borderWidth: 1, justifyContent: 'center', alignItems: 'center', gap: 6 },
  typeLabel: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  radioGroup: { borderRadius: Theme.radius.lg, borderWidth: 1, overflow: 'hidden' },
  radioItem: { flexDirection: 'row', alignItems: 'center', padding: Theme.spacing.md, borderBottomWidth: 1, gap: 12 },
  radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  radioLabel: { fontSize: Theme.fontSize.base },
  footer: { padding: Theme.spacing.base, borderTopWidth: 1 },
  applyBtn: { borderRadius: Theme.radius.lg, paddingVertical: 16, alignItems: 'center' },
  applyText: { color: '#FFF', fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },
});
