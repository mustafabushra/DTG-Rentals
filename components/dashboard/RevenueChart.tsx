import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../hooks/useAppTheme';

const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                       'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

export interface MonthRevenue {
  month: string; // 'YYYY-MM'
  revenue: number;
}

interface Props {
  data: MonthRevenue[];
  currency?: string;
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}م`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}ك`;
  return String(n);
}

const CHART_H    = 160;
const PAD_LEFT   = 40;
const PAD_RIGHT  = 16;
const PAD_TOP    = 16;
const PAD_BOTTOM = 32;

export function RevenueChart({ data, currency = 'ريال' }: Props) {
  const { colors } = useAppTheme();
  const { width: screenW } = useWindowDimensions();
  const [selected, setSelected] = useState<number | null>(null);

  if (!data || data.length < 2) return null;

  const chartW = Math.max(Math.min(screenW - 32, 800) - PAD_LEFT - PAD_RIGHT, 10);
  const totalH  = CHART_H + PAD_TOP + PAD_BOTTOM;

  const values  = data.map(d => (isFinite(d.revenue) ? d.revenue : 0));
  const minVal  = Math.min(...values);
  const maxVal  = Math.max(...values);
  const range   = maxVal - minVal || 1;

  const toX = (i: number) => PAD_LEFT + (i / Math.max(data.length - 1, 1)) * chartW;
  const toY = (v: number) => {
    const safe = isFinite(v) ? v : 0;
    return PAD_TOP + CHART_H - ((safe - minVal) / range) * CHART_H;
  };

  const points  = data.map((d, i) => `${toX(i)},${toY(d.revenue)}`).join(' ');
  const areaTop = data.map((d, i) => `${toX(i)},${toY(d.revenue)}`).join(' ');
  const areaPoints = `${toX(0)},${PAD_TOP + CHART_H} ${areaTop} ${toX(data.length - 1)},${PAD_TOP + CHART_H}`;

  const last  = values[values.length - 1];
  const first = values[0];
  const trendUp = last >= first;
  const trendPct = first > 0 ? Math.round(Math.abs((last - first) / first) * 100) : 0;
  const trendColor = trendUp ? '#27AE60' : '#E74C3C';

  // Y-axis grid: 4 lines
  const gridLines = [0, 0.33, 0.66, 1].map(r => ({
    y: PAD_TOP + CHART_H * (1 - r),
    label: fmt(minVal + range * r),
  }));

  const sel = selected !== null ? data[selected] : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.trendBadge, { backgroundColor: trendColor + '18' }]}>
          <Text style={[styles.trendTxt, { color: trendColor }]}>
            {trendUp ? '↑' : '↓'} {trendPct}%
          </Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>الإيرادات — آخر 6 أشهر</Text>
      </View>

      {/* Tooltip */}
      {sel && (
        <View style={[styles.tooltip, { backgroundColor: '#021C36' }]}>
          <Text style={styles.tooltipMonth}>
            {ARABIC_MONTHS[Number(sel.month.split('-')[1]) - 1]} {sel.month.split('-')[0]}
          </Text>
          <Text style={styles.tooltipAmt}>{sel.revenue.toLocaleString('en-US')} {currency}</Text>
        </View>
      )}

      {/* SVG Chart */}
      <Svg width={chartW + PAD_LEFT + PAD_RIGHT} height={totalH}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#C3AF76" stopOpacity="0.25" />
            <Stop offset="1" stopColor="#C3AF76" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {gridLines.map((g, i) => (
          <React.Fragment key={i}>
            <Line
              x1={PAD_LEFT} y1={g.y} x2={PAD_LEFT + chartW} y2={g.y}
              stroke={colors.border} strokeWidth={1} strokeDasharray="4,4"
            />
            <SvgText
              x={PAD_LEFT - 4} y={g.y + 4}
              fontSize={9} fill={colors.textMuted} textAnchor="end"
            >
              {g.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Area fill */}
        <Polygon points={areaPoints} fill="url(#areaGrad)" />

        {/* Line */}
        <Polyline points={points} fill="none" stroke="#C3AF76" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {/* Data points + labels */}
        {data.map((d, i) => {
          const x = toX(i);
          const y = toY(d.revenue);
          const mLabel = ARABIC_MONTHS[Number(d.month.split('-')[1]) - 1]?.slice(0, 3) ?? '';
          const isSel  = selected === i;
          return (
            <React.Fragment key={d.month}>
              {/* Month label */}
              <SvgText
                x={x} y={PAD_TOP + CHART_H + 18}
                fontSize={9} fill={colors.textMuted} textAnchor="middle"
              >
                {mLabel}
              </SvgText>
              {/* Circle — larger touch target via outer transparent circle */}
              <Circle cx={x} cy={y} r={14} fill="transparent" onPress={() => setSelected(selected === i ? null : i)} />
              <Circle
                cx={x} cy={y} r={isSel ? 6 : 4}
                fill={isSel ? '#C3AF76' : colors.card}
                stroke="#C3AF76" strokeWidth={isSel ? 3 : 2}
              />
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Theme.radius.xl, borderWidth: 1, padding: Theme.spacing.base, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:  { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  trendBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Theme.radius.full },
  trendTxt:   { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },
  tooltip: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: Theme.radius.md, paddingHorizontal: 12, paddingVertical: 8,
  },
  tooltipMonth: { color: 'rgba(255,255,255,0.7)', fontSize: Theme.fontSize.sm },
  tooltipAmt:   { color: '#FFF', fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold },
});
