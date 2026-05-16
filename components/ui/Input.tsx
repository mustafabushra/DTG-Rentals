import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, TextInputProps, ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { lightColors, darkColors, spacing, fontSize, fontWeight, radius } from '../../constants/DesignTokens';
import { useAppTheme } from '../../hooks/useAppTheme';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  required?: boolean;
  isPassword?: boolean;
  containerStyle?: ViewStyle;
  multiline?: boolean;
  numberOfLines?: number;
}

export function Input({
  label,
  error,
  hint,
  icon,
  required,
  isPassword,
  containerStyle,
  multiline,
  numberOfLines = 4,
  ...props
}: InputProps) {
  const { colors } = useAppTheme();
  const [isFocused, setFocused] = useState(false);
  const [showPass, setShowPass]  = useState(false);
  const ref = useRef<TextInput>(null);

  const borderColor = error
    ? colors.danger
    : isFocused
    ? colors.inputFocus
    : colors.inputBorder;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
          {required && <Text style={[styles.required, { color: colors.danger }]}>*</Text>}
        </View>
      )}

      <TouchableOpacity
        activeOpacity={1}
        onPress={() => ref.current?.focus()}
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.inputBg,
            borderColor,
            borderWidth: isFocused ? 2 : 1,
          },
          multiline && styles.multilineWrapper,
          error && styles.errorWrapper,
        ]}
      >
        {/* Right icon */}
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={isFocused ? colors.inputFocus : colors.textMuted}
            style={styles.icon}
          />
        )}

        <TextInput
          ref={ref}
          style={[
            styles.input,
            { color: colors.text },
            multiline && styles.multilineInput,
          ]}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={isPassword && !showPass}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />

        {/* Password toggle */}
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.passBtn}>
            <Ionicons
              name={showPass ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {(error || hint) && (
        <Text
          style={[
            styles.helper,
            { color: error ? colors.danger : colors.textMuted },
          ]}
        >
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { gap: spacing[1] },
  labelRow:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label:          { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  required:       { fontSize: fontSize.base, lineHeight: 18 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
    minHeight: 48,
    gap: spacing[2],
  },
  multilineWrapper: { alignItems: 'flex-start', paddingVertical: spacing[3] },
  errorWrapper:     {},
  input: {
    flex: 1,
    fontSize: fontSize.base,
    paddingVertical: 0,
    textAlign: 'right',
  },
  multilineInput: { minHeight: 80, textAlignVertical: 'top' },
  icon:    {},
  passBtn: { padding: 4 },
  helper:  { fontSize: fontSize.sm, paddingHorizontal: spacing[1] },
});
