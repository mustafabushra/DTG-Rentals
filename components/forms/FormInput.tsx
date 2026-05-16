/**
 * FormInput — Thin wrapper around the unified Input component.
 * Keeps backward compatibility for all existing screens.
 */
import React from 'react';
import { TextInputProps, ViewStyle } from 'react-native';
import { Input } from '../ui/Input';
import Ionicons from '@expo/vector-icons/Ionicons';

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
  required?: boolean;
  icon?: string;
  isPassword?: boolean;
  containerStyle?: ViewStyle;
  multiline?: boolean;
  numberOfLines?: number;
}

export function FormInput({
  label,
  error,
  required,
  icon,
  isPassword,
  containerStyle,
  multiline,
  numberOfLines,
  ...props
}: FormInputProps) {
  return (
    <Input
      label={label}
      error={error}
      required={required}
      icon={icon as keyof typeof Ionicons.glyphMap | undefined}
      isPassword={isPassword}
      containerStyle={containerStyle}
      multiline={multiline}
      numberOfLines={numberOfLines}
      {...props}
    />
  );
}
