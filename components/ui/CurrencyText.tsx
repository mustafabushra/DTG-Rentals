import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RiyalSymbol } from './RiyalSymbol';
import { useAppTheme } from '../../hooks/useAppTheme';

interface Props {
  amount: number | string;
  style?: object;
  color?: string;
  size?: number;
}

export function CurrencyText({ amount, style, color, size = 14 }: Props) {
  const { colors } = useAppTheme();
  const resolvedColor = color ?? colors.text;
  const safeAmount = amount == null || isNaN(amount as number) ? 0 : amount;
  const formatted = typeof safeAmount === 'number'
    ? safeAmount.toLocaleString('en-US')
    : safeAmount;

  return (
    <View style={styles.row}>
      <Text style={[styles.text, { color: resolvedColor, fontSize: size }, style]}>{formatted} </Text>
      <RiyalSymbol size={size} color={resolvedColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { fontWeight: '600' },
});
