import React from 'react';
import { View, Text, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { RiyalSymbol } from './RiyalSymbol';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useApp } from '../../context/AppProvider';

interface Props {
  amount: number | string;
  style?: StyleProp<TextStyle>;
  color?: string;
  size?: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  AED: 'د.إ',
  USD: '$',
  EUR: '€',
  GBP: '£',
  KWD: 'د.ك',
  BHD: 'د.ب',
  QAR: 'ر.ق',
  OMR: 'ر.ع',
};

export function CurrencyText({ amount, style, color, size = 14 }: Props) {
  const { colors } = useAppTheme();
  const { systemSettings } = useApp();
  const currency = systemSettings?.currency ?? 'SAR';

  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : (typeof amount === 'string' ? amount : 0);
  const formatted = typeof safeAmount === 'number'
    ? Math.round(safeAmount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : safeAmount;

  const flatStyle = StyleSheet.flatten(style ?? {}) as any;
  const resolvedColor: string = flatStyle?.color ?? color ?? colors.text;

  // SAR → رمز SVG الرسمي، غيرها → نص
  const symbol = currency === 'SAR' ? null : (CURRENCY_SYMBOLS[currency] ?? currency);

  return (
    <View style={styles.row}>
      <Text style={[styles.text, { color: resolvedColor, fontSize: size }, style]}>
        {formatted}{' '}
      </Text>
      {symbol
        ? <Text style={[styles.text, { color: resolvedColor, fontSize: size * 0.9 }]}>{symbol}</Text>
        : <RiyalSymbol size={size * 0.85} color={resolvedColor} />
      }
    </View>
  );
}

const styles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center' },
  text: { fontWeight: '600' },
});
