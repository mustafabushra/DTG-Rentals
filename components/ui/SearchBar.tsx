import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { lightColors, darkColors, spacing, fontSize, radius } from '../../constants/DesignTokens';
import { useAppTheme } from '../../hooks/useAppTheme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFilterPress?: () => void;
}

export function SearchBar({ value, onChangeText, placeholder = 'بحث...', onFilterPress }: SearchBarProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Ionicons name="search-outline" size={18} color={colors.textMuted} accessibilityElementsHidden />
      <TextInput
        style={[styles.input, { color: colors.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        clearButtonMode="while-editing"
        textAlign="right"
        accessibilityLabel={placeholder}
        accessibilityRole="search"
      />
      {onFilterPress && (
        <TouchableOpacity
          onPress={onFilterPress}
          style={styles.filterBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="تصفية النتائج"
        >
          <Ionicons name="options-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    height: 44,
    marginHorizontal: spacing[4],
    marginVertical: spacing[2],
    gap: spacing[2],
  },
  input: {
    flex: 1,
    minWidth: 0, // بدونه حقل الويب ياخذ عرضه الافتراضي ويطلع النص برا الصندوق
    width: '100%',
    fontSize: 14,
    paddingVertical: 0,
    ...({ outlineStyle: 'none' } as any),
  },
  filterBtn: {
    padding: spacing[1],
  },
});
