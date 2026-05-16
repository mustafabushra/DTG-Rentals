import React from 'react';
import { View, Text, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { RiyalSymbol } from './RiyalSymbol';
import { useAppTheme } from '../../hooks/useAppTheme';

interface Props {
  amount: number | string;
  style?: StyleProp<TextStyle>;
  color?: string;
  size?: number;
}

export function CurrencyText({ amount, style, color, size = 14 }: Props) {
  const { colors } = useAppTheme();
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : (typeof amount === 'string' ? amount : 0);
  const formatted = typeof safeAmount === 'number'
    ? Math.round(safeAmount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : safeAmount;

  // استخراج اللون من style إن وُجد، وإلا color prop، وإلا لون الثيم
  const flatStyle = StyleSheet.flatten(style ?? {}) as any;
  const resolvedColor: string = flatStyle?.color ?? color ?? colors.text;

  return (
    <View style={styles.row}>
      <Text style={[styles.text, { color: resolvedColor, fontSize: size }, style]}>
        {formatted}{' '}
      </Text>
      <RiyalSymbol size={size * 0.85} color={resolvedColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center' },
  text: { fontWeight: '600' },
});
