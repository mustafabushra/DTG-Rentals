import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  FlatList,
  Alert
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

  // ✅ FIX: safe theme access
  const colors = Theme?.colors ?? {
    primary: '#3b82f6'
  };

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
          type: ['application/pdf', 'image/jpeg', 'image/png']
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

  const handleSave = () => {
    if (!entityId || !selectedFile || !formData.name) {
      Alert.alert('بيانات ناقصة');
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
      notes: formData.notes
    });

    onSave();
    onClose();
    reset();
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
            <Button title="السابق" variant="ghost" onPress={() => setStep(s => s - 1)} />
          )}

          {step < 5 ? (
            <Button
              title="التالي"
              onPress={() => setStep(s => s + 1)}
              disabled={step === 2 && !entityId || step === 3 && !selectedFile}
            />
          ) : (
            <Button title="حفظ" onPress={handleSave} />
          )}
        </View>
      }
    >
      <View style={styles.content}>
        {step === 1 && renderStep1()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },

  stepContainer: { gap: 16 },

  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'right'
  },

  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },

  pill: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#eee'
  },

  pillActive: {
    backgroundColor: '#3b82f6'
  },

  pillText: {
    color: '#333'
  },

  pillTextActive: {
    color: '#fff'
  },

  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 12
  }
});