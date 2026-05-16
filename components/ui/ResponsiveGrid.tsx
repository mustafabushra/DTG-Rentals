/**
 * ResponsiveGrid — wraps cards in a 2-column flex-wrap on wide screens,
 * and a normal single column on mobile. Drop-in replacement for mapping cards.
 */
import React from 'react';
import { View } from 'react-native';
import { useScreenSize } from '../../hooks/useScreenSize';
import { Theme } from '../../constants/Theme';

interface Props {
  children: React.ReactNode;
  cols?: 2 | 3;
  gap?: number;
  paddingH?: number;
}

export function ResponsiveGrid({ children, cols = 2, gap = Theme.spacing.sm, paddingH = Theme.spacing.base }: Props) {
  const { isWide, cols3 } = useScreenSize();

  if (!isWide) return <>{children}</>;

  const effectiveCols = cols === 3 && cols3 ? 3 : 2;
  const pct = effectiveCols === 3 ? '32%' : '48%';

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, paddingHorizontal: paddingH }}>
      {React.Children.map(children, child =>
        child == null ? null : (
          <View style={{ width: pct, flexGrow: 1 }}>{child}</View>
        )
      )}
    </View>
  );
}
