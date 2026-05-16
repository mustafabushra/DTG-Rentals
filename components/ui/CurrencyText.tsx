import React from 'react';
import { Text, StyleSheet, StyleProp, TextStyle } from 'react-native';

interface Props {
  amount: number | string;
  style?: StyleProp<TextStyle>;
  color?: string;
  size?: number;
}

export function CurrencyText({ amount, style, color, size = 14 }: Props) {
  const safeAmount = amount == null || isNaN(amount as number) ? 0 : amount;
  const formatted = typeof safeAmount === 'number'
    ? safeAmount.toLocaleString('en-US')
    : safeAmount;

  const colorStyle = color ? { color } : undefined;

  return (
    <Text style={[styles.text, { fontSize: size }, colorStyle, style]}>
      {formatted} ﷼
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontWeight: '600' },
});
