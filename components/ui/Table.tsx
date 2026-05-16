import React from 'react';
import { View, Text, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { lightColors, darkColors, spacing, fontSize, fontWeight } from '../../constants/DesignTokens';
import { useAppTheme } from '../../hooks/useAppTheme';

export interface TableColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  width?: number | string;
  align?: 'right' | 'center' | 'left';
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface TableProps<T extends Record<string, unknown>> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyText?: string;
  style?: ViewStyle;
  headerStyle?: ViewStyle;
  rowStyle?: ViewStyle;
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  emptyText = 'لا توجد بيانات',
  style,
  headerStyle,
  rowStyle,
}: TableProps<T>) {
  const { colors } = useAppTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={[styles.container, style]}>
        {/* Header */}
        <View style={[styles.row, styles.headerRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }, headerStyle]}>
          {columns.map(col => (
            <Text
              key={col.key}
              style={[
                styles.headerCell,
                { color: colors.textSecondary, width: col.width as any },
                col.align && { textAlign: col.align },
              ]}
            >
              {col.label}
            </Text>
          ))}
        </View>

        {/* Rows */}
        {data.length === 0 ? (
          <View style={[styles.emptyRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{emptyText}</Text>
          </View>
        ) : (
          data.map((row, i) => (
            <View
              key={keyExtractor(row)}
              style={[
                styles.row,
                styles.dataRow,
                {
                  backgroundColor: i % 2 === 0 ? colors.card : colors.surface,
                  borderBottomColor: colors.border,
                },
                rowStyle,
              ]}
            >
              {columns.map(col => {
                const value = row[col.key];
                return (
                  <View
                    key={col.key}
                    style={[styles.cell, { width: col.width as any }]}
                  >
                    {col.render ? (
                      col.render(value, row)
                    ) : (
                      <Text
                        style={[
                          styles.cellText,
                          { color: colors.text },
                          col.align && { textAlign: col.align },
                        ]}
                      >
                        {String(value ?? '—')}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { minWidth: '100%' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerRow: {
    borderBottomWidth: 2,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  dataRow: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
  },
  headerCell: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    flex: 1,
    paddingHorizontal: spacing[2],
    textAlign: 'right',
  },
  cell: {
    flex: 1,
    paddingHorizontal: spacing[2],
  },
  cellText: {
    fontSize: fontSize.sm,
    textAlign: 'right',
  },
  emptyRow: {
    paddingVertical: spacing[8],
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  emptyText: {
    fontSize: fontSize.base,
  },
});
