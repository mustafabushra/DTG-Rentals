import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../hooks/useAppTheme';

interface Option {
  label: string;
  value: string;
}

interface FormSelectProps {
  label: string;
  value: string;
  options: Option[];
  onSelect: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

export function FormSelect({ label, value, options, onSelect, placeholder = 'اختر...', required, error }: FormSelectProps) {
  const [open, setOpen] = useState(false);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const selected = options.find(o => o.value === value);
  const hasError = !!error;

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.text }]}>
        {label}
        {required && <Text style={{ color: colors.danger }}> *</Text>}
      </Text>

      <TouchableOpacity
        style={[styles.selector, { backgroundColor: colors.inputBg, borderColor: hasError ? colors.danger : colors.inputBorder }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.selectedText, { color: selected ? colors.text : colors.textMuted }]}>
          {selected?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {hasError && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 8 }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{label}</Text>
          <FlatList
            data={options}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.option, { borderBottomColor: colors.border }, item.value === value && { backgroundColor: colors.accent }]}
                onPress={() => { onSelect(item.value); setOpen(false); }}
              >
                <Ionicons
                  name={item.value === value ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={item.value === value ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.optionText, { color: colors.text }, item.value === value && { color: colors.primary, fontWeight: '600' }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: {
    fontSize: Theme.fontSize.md,
    fontWeight: Theme.fontWeight.semibold,
    textAlign: 'right',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Theme.radius.md,
    borderWidth: 1.5,
    paddingHorizontal: Theme.spacing.md,
    height: 48,
    justifyContent: 'space-between',
  },
  selectedText: {
    fontSize: Theme.fontSize.base,
    flex: 1,
    marginStart: 8,
    textAlign: 'right',
  },
  error: {
    fontSize: Theme.fontSize.sm,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    maxHeight: '60%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: Theme.fontSize.lg,
    fontWeight: Theme.fontWeight.bold,
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.base,
    paddingBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    gap: 12,
  },
  optionText: {
    fontSize: Theme.fontSize.base,
    flex: 1,
    textAlign: 'right',
  },
});
