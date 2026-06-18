import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../constants/Theme';
import { useAppTheme } from '../hooks/useAppTheme';
import { useApp } from '../context/AppProvider';
import { City } from '../domain/models';

export default function CitiesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { cities, addCity, updateCity, deleteCity, properties, updateAllPropertiesWithCities } = useApp();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [region, setRegion] = useState('');

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setName('');
    setDisplayName('');
    setRegion('');
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال اسم المدينة');
      return;
    }

    const cityData: City = {
      id: editingId ?? `city_${Date.now()}`,
      name: name.trim(),
      displayName: displayName.trim() || name.trim(),
      region: region.trim() || undefined,
      createdAt: editingId ? (cities.find(c => c.id === editingId)?.createdAt ?? new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (editingId) {
      updateCity(editingId, cityData);
      Alert.alert('تم التحديث', `تم تعديل بيانات المدينة: ${cityData.displayName}`);
    } else {
      addCity(cityData);
      Alert.alert('تمت الإضافة', `تم إضافة مدينة جديدة: ${cityData.displayName}`);
    }
    resetForm();
  };

  const handleEdit = (city: City) => {
    setEditingId(city.id);
    setName(city.name);
    setDisplayName(city.displayName || city.name);
    setRegion(city.region || '');
    setShowForm(true);
  };

  const handleDelete = (city: City) => {
    const propCount = properties.filter(p => (p as any).cityId === city.id).length;
    Alert.alert(
      'تأكيد الحذف',
      `هل تريد حذف "${city.displayName || city.name}"؟\n${propCount > 0 ? `يوجد ${propCount} عقار مرتبط بهذه المدينة - سيتم تحريرها` : 'لا توجد عقارات مرتبطة'}`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: () => {
            deleteCity(city.id);
            Alert.alert('تم الحذف', `تم حذف المدينة: ${city.displayName || city.name}`);
          },
        },
      ]
    );
  };

  const propertyCount = (cityId: string) => {
    return properties.filter(p => (p as any).cityId === cityId).length;
  };

  const handleUpdateAllProperties = async () => {
    Alert.alert(
      'تحديث جميع العقارات',
      'سيتم تحديث جميع العقارات وإضافة cityId بناءً على اسم المدينة في حقل الموقع. هل تريد المتابعة؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تحديث',
          onPress: async () => {
            try {
              const result = await updateAllPropertiesWithCities();
              Alert.alert(
                'تم التحديث',
                `تم تحديث ${result.updated} عقار\nتم تخطي ${result.skipped} عقار (لديه cityId بالفعل)`
              );
            } catch (error) {
              Alert.alert('خطأ', 'حدث خطأ أثناء التحديث');
              console.error(error);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إدارة المدن</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={handleUpdateAllProperties} style={styles.headerBtn}>
            <Ionicons name="refresh-outline" size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); }}>
            <Ionicons name="add-circle-outline" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Add/Edit Form */}
        {showForm && (
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.text }]}>
              {editingId ? 'تعديل مدينة' : 'إضافة مدينة جديدة'}
            </Text>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>اسم المدينة (موحد)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={name}
                onChangeText={setName}
                placeholder="مثال: الرياض"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>الاسم المعروض</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="مثال: الرياض (الاسم الأكثر شيوعاً)"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>المنطقة</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={region}
                onChangeText={setRegion}
                placeholder="مثال: الرياض، مكة، إلخ"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={resetForm}>
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
                <Text style={styles.saveBtnText}>حفظ</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Cities List */}
        {cities.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>لا توجد مدن مضافة</Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
              أضف مدينة للبدء في تنظيم العقارات حسب الموقع
            </Text>
          </View>
        ) : (
          <View style={styles.citiesList}>
            {cities.map(city => {
              const count = propertyCount(city.id);
              return (
                <View
                  key={city.id}
                  style={[styles.cityCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.cityInfo}>
                    <View style={styles.cityHeader}>
                      <Text style={[styles.cityName, { color: colors.text }]}>
                        {city.displayName || city.name}
                      </Text>
                      {city.region && (
                        <View style={[styles.regionBadge, { backgroundColor: colors.primarySubtle }]}>
                          <Text style={[styles.regionText, { color: colors.primary }]}>
                            {city.region}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.cityMeta, { color: colors.textMuted }]}>
                      {count} {count === 1 ? 'عقار' : 'عقارات'}
                    </Text>
                  </View>

                  <View style={styles.cityActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.primarySubtle }]}
                      onPress={() => handleEdit(city)}
                    >
                      <Ionicons name="pencil-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.dangerSubtle }]}
                      onPress={() => handleDelete(city)}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    paddingHorizontal: Theme.spacing.base,
  },
  headerBtn: {
    padding: 6,
    position: 'relative',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { color: '#FFF', fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },
  content: { padding: Theme.spacing.base, gap: Theme.spacing.md, paddingBottom: 20 },

  // Form
  formCard: {
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    padding: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  formTitle: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  formGroup: { gap: 6 },
  label: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.medium, textAlign: 'right' },
  input: {
    borderWidth: 1,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    fontSize: Theme.fontSize.base,
    textAlign: 'right',
  },
  formActions: { flexDirection: 'row', gap: Theme.spacing.sm, marginTop: Theme.spacing.sm },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.medium },
  saveBtn: {
    flex: 1,
    borderRadius: Theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.semibold },
  emptySubtext: { fontSize: Theme.fontSize.sm, textAlign: 'center', paddingHorizontal: 40 },

  // Cities List
  citiesList: { gap: Theme.spacing.sm },
  cityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    padding: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  cityInfo: { flex: 1, gap: 4 },
  cityHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cityName: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  regionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Theme.radius.full,
  },
  regionText: { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.medium },
  cityMeta: { fontSize: Theme.fontSize.sm, textAlign: 'right' },
  cityActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: Theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
});