import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, FlatList, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { FormInput } from '../forms/FormInput';
import { useApp } from '../../context/AppProvider';
import { FileService } from '../../domain/services/FileService';
import { Theme } from '../../constants/Theme';
import type { Attachment, FileCategory } from '../../domain/models';

type EntityType = 'property' | 'unit' | 'contract' | 'payment' | 'maintenance' | 'owner';

interface SelectedFile {
  name: string;
  uri: string;
  mimeType: string;
  size: number;
}

export function AddAttachmentModal({
  visible,
  onClose,
  onSave
}: {
  visible: boolean;
  onClose: () => void;
  onSave: () => void
}) {
  const { colors } = Theme; // Note: Theme should be handled via useAppTheme usually, but using a fallback for now
  const {
    properties, units, contracts, payments, maintenance, owners,
    addAttachment
  } = useApp();

  // --- State Management ---
  const [step, setStep] = useState(1);
  const [entityType, setEntityType] = useState<EntityType | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'other' as FileCategory,
    expiryDate: '',
    notes: '',
  });
  const [searchQuery, setSearchQuery] = useState('');

  const reset = () => {
    setStep(1);
    setEntityType(null);
    setEntityId(null);
    setSelectedFile(null);
    setFormData({ name: '', category: 'other', expiryDate: '', notes: '' });
    setSearchQuery('');
  };

  // --- Helpers ---
  const entityLabels: Record<EntityType, { label: string; data: any[] }> = {
    property:    { label: 'عقار', data: properties },
    unit:        { label: 'وحدة', data: units },
    contract:    { label: 'عقد', data: contracts },
    payment:     { label: 'دفعة', data: payments },
    maintenance: { label: 'صيانة', data: maintenance },
    owner:       { label: 'مالك', data: owners },
  };

  const filteredEntities = useMemo(() => {
    if (!entityType) return [];
    const data = entityLabels[entityType].data;
    if (!searchQuery) return data;
    return data.filter(e => {
      const name = (e.name || e.number || e.contractNumber || e.receiptNumber || ' la-name').toLowerCase();
      return name.includes(searchQuery.toLowerCase());
    });
  }, [entityType, searchQuery, properties, units, contracts, payments, maintenance, owners]);

  const pickFile = async (type: 'image' | 'document') => {
    try {
      let result;
      if (type === 'image') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('تنبيه', 'يُرجى السماح بالوصول إلى مكتبة الصور');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.7,
        });
      } else {
        result = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'image/jpeg', 'image/png'],
        });
      }

      if (result.cancelled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const fileData: SelectedFile = {
        name: asset.name || `file_${Date.now()}`,
        uri: asset.uri,
        mimeType: asset.mimeType || 'application/octet-stream',
        size: asset.size || 0,
      };

      const validationError = FileService.validate(fileData);
      if (validationError) {
        Alert.alert('ملف غير مدعوم', validationError);
        return;
      }

      setSelectedFile(fileData);
      setStep(4); // Move to details form after picking file
    } catch (e) {
      console.error('Pick file error:', e);
      Alert.alert('خطأ', 'حدث خطأ أثناء اختيار الملف');
    }
  };

  const handleSave = () => {
    if (!entityId || !selectedFile || !formData.name) {
      Alert.alert('بيانات ناقصة', 'يُرجى إكمال جميع الحقول المطلوبة');
      return;
    }

    addAttachment({
      entityType: entityType!,
      entityId: entityId!,
      name: formData.name,
      uri: selectedFile.uri,
      mimeType: selectedFile.mimeType,
      size: selectedFile.size,
      category: formData.category,
      expiryDate: formData.expiryDate,
      notes: formData.notes,
    });

    onSave();
    onClose();
    reset();
  };

  // --- UI Components per Step ---
  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>اختر نوع الكيان المرتبط</Text>
      <View style={styles.pillGrid}>
        {Object.entries(entityLabels).map(([key, { label }]) => (
          <TouchableOpacity
            key={key}
            style={[styles.pill, entityType === key && styles.pillActive]}
            onPress={() => {
              setEntityType(key as EntityType);
              setStep(2);
            }}
          >
            <Text style={[styles.pillText, entityType === key && styles.pillTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>اختر {entityLabels[entityType!].label}</Text>
      <FormInput
        placeholder="ابحث عن اسم أو رقم..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchBar}
      />
      <FlatList
        data={filteredEntities}
        keyExtractor={item => item.id}
        style={styles.entityList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.entityItem}
            onPress={() => {
              setEntityId(item.id);
              setStep(3);
            }}
          >
            <Text style={styles.entityName}>{item.name || item.number || item.contractNumber || item.receiptNumber || 'بدون اسم'}</Text>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>لا توجد نتائج مطابقة</Text>}
      />
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>اختر الملف</Text>
      <View style={styles.pickerContainer}>
        <TouchableOpacity style={styles.pickerButton} onPress={() => pickFile('image')}>
          <Ionicons name="image" size={24} color={Theme.colors.primary} />
          <Text style={styles.pickerButtonText}>صورة</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pickerButton} onPress={() => pickFile('document')}>
          <Ionicons name="document-text" size={24} color={Theme.colors.primary} />
          <Text style={styles.pickerButtonText}>وثيقة (PDF)</Text>
        </TouchableOpacity>
      </View>
      {selectedFile && (
        <View style={styles.fileBanner}>
          <View style={styles.bannerIconBox}>
            <Ionicons name={FileService.typeIcon(FileService.typeFromMime(selectedFile.mimeType))} size={24} color={Theme.colors.primary} />
          </View>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerName} numberOfLines={1}>{selectedFile.name}</Text>
            <Text style={styles.bannerSize}>{FileService.formatSize(selectedFile.size)}</Text>
          </View>
          <TouchableOpacity onPress={() => setSelectedFile(null)}>
            <Ionicons name="close-circle" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>تفاصيل المرفق</Text>
      <FormInput
        label="اسم الوثيقة *"
        value={formData.name}
        onChangeText={val => setFormData(prev => ({ ...prev, name: val }))}
      />
      <FormInput
        label="ملاحظات"
        value={formData.notes}
        onChangeText={val => setFormData(prev => ({ ...prev, notes: val }))}
        multiline
      />
      <Text style={styles.sectionLabel}>التصنيف</Text>
      <View style={styles.pillGrid}>
        {Object.entries(FileService.categoryLabel).filter(([k]) => k !== 'categoryLabel').map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.pill, formData.category === key && styles.pillActive]}
            onPress={() => setFormData(prev => ({ ...prev, category: key as FileCategory }))}
          >
            <Text style={[styles.pillText, formData.category === key && styles.pillTextActive]}>{label as string}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FormInput
        label="تاريخ انتهاء الصلاحية (اختياري)"
        value={formData.expiryDate}
        onChangeText={val => setFormData(prev => ({ ...prev, expiryDate: val }))}
        placeholder="YYYY-MM-DD"
      />
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>مراجعة البيانات</Text>
      <View style={styles.reviewCard}>
        <Text style={styles.reviewLabel}>الكيان:</Text>
        <Text style={styles.reviewValue}>{entityLabels[entityType!].label} → {filteredEntities.find(e => e.id === entityId)?.name || entityId}</Text>

        <Text style={styles.reviewLabel}>الملف:</Text>
        <Text style={styles.reviewValue}>{selectedFile?.name}</Text>

        <Text style={styles.reviewLabel}>الاسم:</Text>
        <Text style={styles.reviewValue}>{formData.name || 'غير محدد'}</Text>

        <Text style={styles.reviewLabel}>التصنيف:</Text>
        <Text style={styles.reviewValue}>{FileService.categoryLabel(formData.category)}</Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="إضافة مرفق"
      size="lg"
      scrollable
      footer={
        <View style={styles.footer}>
          {step > 1 && (
            <Button variant="ghost" title="السابق" onPress={() => setStep(s => s - 1)} />
          )}
          {step < 5 ? (
            <Button
              title="التالي"
              onPress={() => setStep(s => s + 1)}
              disabled={step === 2 && !entityId || step === 3 && !selectedFile}
            />
          ) : (
            <Button title="حفظ المرفق" onPress={handleSave} variant="primary" />
          )}
        </View>
      }
    >
      <View style={styles.content}>
        <View style={styles.stepIndicatorContainer}>
          {[1, 2, 3, 4, 5].map(i => (
            <View key={i} style={[styles.stepDot, step >= i && styles.stepDotActive]} />
          ))}
        </View>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { padding: Theme.spacing.md },
  stepContainer: { gap: 20 },
  stepTitle: { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold, textAlign: 'right', marginBottom: 10 },
  stepIndicatorContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#eee' },
  stepDotActive: { backgroundColor: Theme.colors.primary },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' },
  pill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd' },
  pillActive: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  pillText: { fontSize: Theme.fontSize.sm, color: '#666', textAlign: 'center' },
  pillTextActive: { color: '#fff' },
  searchBar: { marginBottom: 10 },
  entityList: { maxHeight: 300 },
  entityItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  entityName: { fontSize: Theme.fontSize.base, textAlign: 'right', color: '#333' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 20 },
  pickerContainer: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  pickerButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 12, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd' },
  pickerButtonText: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.medium },
  fileBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#d1d5db', marginTop: 20 },
  bannerIconBox: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  bannerInfo: { flex: 1, alignItems: 'flex-end' },
  bannerName: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  bannerSize: { fontSize: Theme.fontSize.sm, color: '#666', textAlign: 'right' },
  sectionLabel: { fontSize: Theme.fontSize.sm, fontWeight: 'bold', textAlign: 'right', color: '#666', marginTop: 10, marginBottom: 8 },
  footer: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  reviewCard: { padding: 16, borderRadius: 12, backgroundColor: '#f9f9f9', gap: 12, borderWidth: 1, borderColor: '#eee' },
  reviewLabel: { fontSize: Theme.fontSize.sm, color: '#666', textAlign: 'right' },
  reviewValue: { fontSize: Theme.fontSize.base, fontWeight: 'bold', textAlign: 'right', color: '#333', marginBottom: 8 },
});
