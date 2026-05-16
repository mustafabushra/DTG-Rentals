export type CurrencyCode = 'SAR' | 'AED' | 'EGP' | 'USD' | 'EUR' | 'GBP' | 'KWD' | 'QAR' | 'BHD' | 'OMR';

export interface CurrencyMeta {
  code:   CurrencyCode;
  label:  string;
  symbol: string;       // نص
  useSVG: boolean;      // true = يستخدم RiyalSymbol SVG بدل النص
}

export const CURRENCIES: CurrencyMeta[] = [
  { code: 'SAR', label: 'ريال سعودي',      symbol: '﷼',   useSVG: true  },
  { code: 'AED', label: 'درهم إماراتي',    symbol: 'د.إ', useSVG: false },
  { code: 'EGP', label: 'جنيه مصري',       symbol: 'ج.م', useSVG: false },
  { code: 'USD', label: 'دولار أمريكي',    symbol: '$',   useSVG: false },
  { code: 'EUR', label: 'يورو',             symbol: '€',   useSVG: false },
  { code: 'GBP', label: 'جنيه إسترليني',   symbol: '£',   useSVG: false },
  { code: 'KWD', label: 'دينار كويتي',     symbol: 'د.ك', useSVG: false },
  { code: 'QAR', label: 'ريال قطري',       symbol: 'ر.ق', useSVG: false },
  { code: 'BHD', label: 'دينار بحريني',    symbol: 'د.ب', useSVG: false },
  { code: 'OMR', label: 'ريال عُماني',     symbol: 'ر.ع', useSVG: false },
];

export const CURRENCY_MAP = Object.fromEntries(
  CURRENCIES.map(c => [c.code, c])
) as Record<CurrencyCode, CurrencyMeta>;

export function getCurrency(code?: string | null): CurrencyMeta {
  return CURRENCY_MAP[(code ?? 'SAR') as CurrencyCode] ?? CURRENCY_MAP['SAR'];
}

export function formatAmount(amount: number | null | undefined, currency?: string | null): string {
  if (amount == null || isNaN(amount)) return '0';
  const rounded = Math.round(amount);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const meta = getCurrency(currency);
  return meta.useSVG ? formatted : `${formatted} ${meta.symbol}`;
}

/** خيارات الـ FormSelect */
export const CURRENCY_OPTIONS = CURRENCIES.map(c => ({
  value: c.code,
  label: `${c.label} (${c.symbol})`,
}));
