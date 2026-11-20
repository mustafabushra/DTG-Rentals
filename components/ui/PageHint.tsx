/**
 * سطر واحد تحت عنوان الصفحة يقول بكلام بسيط: إيش في الصفحة وإيش تقدر تسوي فيها.
 */
import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';

export function PageHint({ text }: { text: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.text, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2, width: '100%', maxWidth: 1200, alignSelf: 'center' },
  text: { fontSize: 13, lineHeight: 20, textAlign: 'right' },
});
