import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

export function RiyalSymbol({ size = 16, color = '#1B4F72' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M 30 10 L 30 55 L 10 75 L 20 75 L 38 57 L 38 10 Z"
        fill={color}
      />
      <Path
        d="M 62 10 L 62 45 L 10 88 L 22 88 L 70 48 L 70 10 Z"
        fill={color}
      />
      <Path
        d="M 10 42 L 55 42 L 55 50 L 10 50 Z"
        fill={color}
      />
      <Path
        d="M 10 58 L 50 58 L 50 66 L 10 66 Z"
        fill={color}
      />
    </Svg>
  );
}
