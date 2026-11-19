/** فترات التصفية المشتركة بين شاشات المصاريف والسندات والتقارير. */
export type PeriodKey = 'month' | 'last_month' | 'year' | 'all';

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: 'month',      label: 'هذا الشهر' },
  { value: 'last_month', label: 'الشهر الماضي' },
  { value: 'year',       label: 'هذه السنة' },
  { value: 'all',        label: 'الكل' },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function periodRange(key: PeriodKey, now = new Date()): { from?: string; to?: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case 'month':      return { from: iso(new Date(y, m, 1)),     to: iso(new Date(y, m + 1, 0)) };
    case 'last_month': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case 'year':       return { from: `${y}-01-01`,                to: `${y}-12-31` };
    default:           return {};
  }
}
