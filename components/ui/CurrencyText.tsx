import React from 'react';
import { View, Text, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { RiyalSymbol } from './RiyalSymbol';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useApp } from '../../context/AppProvider';
import { getCurrency } from '../../utils/currency';

interface Props {
  amount: number | string;
  style?: StyleProp<TextStyle>;
  color?: string;
  size?: number;
  /** عملة صريحة — تتجاوز إعداد النظام (مثلاً من العقد أو العقار) */
  currency?: string;
}

export function CurrencyText({ amount, style, color, size = 14, currency }: Props) {
  const { colors } = useAppTheme();
  const { systemSettings } = useApp();

  // الأولوية: currency prop → إعداد النظام → SAR
  const resolvedCurrency = currency ?? systemSettings?.currency ?? 'SAR';
  const meta = getCurrency(resolvedCurrency);

  const safeAmount = typeof amount === 'number' && !isNaN(amount)
    ? amount
    : typeof amount === 'string' ? amount : 0;
  const formatted = typeof safeAmount === 'number'
    ? Math.round(safeAmount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : safeAmount;

  const flatStyle = StyleSheet.flatten(style ?? {}) as any;
  const resolvedColor: string = flatStyle?.color ?? color ?? colors.text;

  return (
    <View style={styles.row}>
      <Text style={[styles.text, { color: resolvedColor, fontSize: size }, style]}>
        {formatted}{' '}
      </Text>
      {meta.useSVG
        ? <RiyalSymbol size={size * 0.85} color={resolvedColor} />
        : <Text style={[styles.text, { color: resolvedColor, fontSize: size * 0.9 }]}>{meta.symbol}</Text>
      }
    </View>
  );
}

const styles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center' },
  text: { fontWeight: '600' },
});
