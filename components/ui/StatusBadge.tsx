/**
 * StatusBadge — Thin wrapper around the unified Badge component.
 * Kept for backward compatibility with all existing screens.
 */
import React from 'react';
import { Badge } from './Badge';
import type { ViewStyle } from 'react-native';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function StatusBadge({ status, size = 'md', style }: StatusBadgeProps) {
  return <Badge status={status} size={size} style={style} />;
}
