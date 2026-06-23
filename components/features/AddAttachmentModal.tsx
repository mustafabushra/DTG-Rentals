import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { FormInput } from '../forms/FormInput';
import { useApp } from '../../context/AppProvider';
import { FileService } from '../../domain/services/FileService';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../hooks/useAppTheme';
import type { FileCategory } from '../../domain/models';

type EntityType =
  | 'property'
  | 'unit'
  | 'contract'
  | 'payment'
  | 'maintenance'
  | 'owner';

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
  onSave: () => void;
}) {

  const { colors } = useAppTheme();

  const {
    properties,
    units,
    contracts,
    payments,
    maintenance,
    owners,
    addAttachment
  } = useApp();

  const [step, setStep] = useState(1);
  const [entityType, setEntityType] = useState<EntityType | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: 'other' as FileCategory,
    expiryDate: '',
    notes: ''
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep(1);
    setEntityType(null);
    setEntityId(null);
    setSelectedFile(null);
    setFormData({
      name: '',
      category: 'other',
      expiryDate: '',
      notes: ''
    });
    setSearchQuery('');
  };

  const entityLabels: Record<EntityType, { label: string; data: any[] }> = {
    property: { label: 'عقار', data: properties },
    unit: { label: 'وحدة', data: units },
    contract: { label: 'عقد', data: contracts },
    payment: { label: 'دفعة', data: payments },
    maintenance: { label: 'صيانة', data: maintenance },
    owner: { label: 'مالك', data: owners }
  };

  const filteredEntities = useMemo(() => {
    if (!entityType) return [];

    const data = entityLabels[entityType].data;

    if (!searchQuery) return data;

    return data.filter(e => {
      const name =
        (e.name ||
          e.number ||
          e.contractNumber ||
          e.receiptNumber ||
          '')
          .toLowerCase();

      return name.includes(searchQuery.toLowerCase());
    });
  }, [entityType, searchQuery]);

  const pickFile = async (type: 'image' | 'document') => {
    try {
      let result;

      if (type === 'image') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!perm.granted) {
          Alert.alert('تنبيه', 'يُرجى السماح بالوصول إلى الصور');
          return;
        }

        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.7
        });
      } else {
        result = await DocumentPicker.getDocumentAsync({
          type: '*/*',          // أي نوع (PDF/Word/Excel/نص/صور) — الحجم محروس في FileService.validate
          copyToCacheDirectory: true,
        });
      }

      // ✅ FIX compatibility (expo changed API)
      if ((result as any).canceled) return;

      const asset =
        (result as any).assets?.[0] || (result as any).uri ? result : null;

      if (!asset) return;

      const fileData: SelectedFile = {
        name: (asset as any).name || `file_${Date.now()}`,
        uri: (asset as any).uri,
        mimeType: (asset as any).mimeType || 'application/octet-stream',
        size: (asset as any).size || 0
      };

      const validationError = FileService.validate(fileData);

      if (validationError) {
        Alert.alert('ملف غير مدعوم', validationError);
        return;
      }

      setSelectedFile(fileData);
      setStep(4);

    } catch (e) {
      console.error(e);
      Alert.alert('خطأ', 'حدث خطأ أثناء اختيار الملف');
    }
  };

  const handleSave = async () => {
    if (!entityId || !selectedFile || !formData.name) {
      Alert.alert('بيانات ناقصة');
      return;
    }

    setSaving(true);
    try {
      await addAttachment({
        entityType: entityType!,
        entityId: entityId!,
        name: formData.name,
        uri: selectedFile.uri,
        mimeType: selectedFile.mimeType,
        size: selectedFile.size,
        category: formData.category,
        expiryDate: formData.expiryDate,
        notes: formData.notes
      });

      onSave();
      onClose();
      reset();
    } catch (e) {
      console.error('Save attachment failed:', e);
      Alert.alert('خطأ في الحفظ', 'تعذر حفظ المرفق، يرجى المحاولة مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>اختر النوع</Text>
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
            <Text style={[styles.pillText, entityType === key && styles.pillTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>اختر {entityLabels[entityType!].label}</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="ابحث..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      <FlatList
        data={filteredEntities}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.entityItem, entityId === item.id && styles.entityItemActive]}
            onPress={() => {
              setEntityId(item.id);
              setStep(3);
            }}
          >
            <Text style={[styles.entityText, entityId === item.id && styles.entityTextActive]}>
              {item.name || item.number || item.contractNumber || item.receiptNumber || item.id}
            </Text>
          </TouchableOpacity>
        )}
        style={{ maxHeight: 300 }}
      />
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>اختر الملف</Text>
      <View style={styles.uploadButtons}>
        <TouchableOpacity style={styles.uploadBtn} onPress={() => pickFile('image')}>
          <Ionicons name="image-outline" size={32} color={colors.primary} />
          <Text style={styles.uploadBtnText}>صورة</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadBtn} onPress={() => pickFile('document')}>
          <Ionicons name="document-text-outline" size={32} color={colors.primary} />
          <Text style={styles.uploadBtnText}>ملف PDF / Word</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>بيانات المرفق</Text>
      <FormInput
        label="اسم الوثيقة"
        value={formData.name}
        onChangeText={v => setFormData(prev => ({ ...prev, name: v }))}
        placeholder="مثلاً: صورة الهوية، عقد الإيجار..."
      />
      <View style={styles.fieldLabelBox}>
        <Text style={styles.fieldLabel}>التصنيف</Text>
      </View>
      <View style={styles.pillGrid}>
        {(['contract', 'id', 'property', 'payment', 'maintenance', 'other'] as FileCategory[]).map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.pill, formData.category === cat && styles.pillActive]}
            onPress={() => setFormData(prev => ({ ...prev, category: cat }))}
          >
            <Text style={[styles.pillText, formData.category === cat && styles.pillTextActive]}>
              {FileService.categoryLabel(cat)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FormInput
        label="تاريخ الانتهاء (اختياري)"
        value={formData.expiryDate}
        onChangeText={v => setFormData(prev => ({ ...prev, expiryDate: v }))}
        placeholder="YYYY-MM-DD"
      />
      <FormInput
        label="ملاحظات"
        value={formData.notes}
        onChangeText={v => setFormData(prev => ({ ...prev, notes: v }))}
        placeholder="أضف أي ملاحظات إضافية هنا..."
        multiline
      />
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>مراجعة</Text>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>النوع:</Text>
          <Text style={styles.summaryValue}>{entityLabels[entityType!].label}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>الاسم:</Text>
          <Text style={styles.summaryValue}>{formData.name}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>الملف:</Text>
          <Text style={styles.summaryValue}>{selectedFile?.name}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>الحجم:</Text>
          <Text style={styles.summaryValue}>{FileService.formatSize(selectedFile?.size || 0)}</Text>
        </View>
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
            <Button label="السابق" variant="ghost" onPress={() => setStep(s => s - 1)} />
          )}

          {step < 5 ? (
            <Button
              label="التالي"
              onPress={() => {
                if (step === 4) setStep(5);
                else setStep(s => s + 1);
              }}
              disabled={
                (step === 2 && !entityId) ||
                (step === 3 && !selectedFile) ||
                (step === 4 && !formData.name)
              }
            />
          ) : (
            <Button
              label={saving ? "جاري الحفظ..." : "حفظ"}
              onPress={handleSave}
              disabled={saving}
            />
          )}
        </View>
      }
    >
      <View style={styles.content}>
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
  content: { padding: 16 },
  stepContainer: { gap: 16 },
  stepTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 8 },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0', borderColor: '#ddd' },
  pillActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  pillText: { color: '#666', fontSize: 14 },
  pillTextActive: { color: '#fff', fontWeight: 'bold' },
  searchInput: { backgroundColor: '#f5f5f5', padding: 12, borderRadius: 8, textAlign: 'right', borderColor: '#eee' },
  entityItem: { padding: 14, borderRadius: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  entityItemActive: { backgroundColor: '#3b82f610', borderColor: '#3b82f6' },
  entityText: { textAlign: 'right', color: '#333' },
  entityTextActive: { color: '#3b82f6', fontWeight: 'bold' },
  uploadButtons: { flexDirection: 'row', gap: 16, justifyContent: 'center', paddingVertical: 20 },
  uploadBtn: { flex: 1, alignItems: 'center', gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#e9ecef', borderStyle: 'dashed' },
  uploadBtnText: { fontSize: 14, color: '#495057', fontWeight: '500' },
  fieldLabelBox: { alignItems: 'flex-end', marginBottom: -8 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#444' },
  summaryCard: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 16, gap: 12 },
  summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: '#666', fontSize: 14 },
  summaryValue: { color: '#333', fontWeight: '600', fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderTopWidth: 1, borderTopColor: '#eee' }
});