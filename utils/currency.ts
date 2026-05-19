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

export const COUNTRY_LABELS: Partial<Record<CurrencyCode, string>> = {
  SAR: 'السعودية', AED: 'الإمارات', EGP: 'مصر',
  KWD: 'الكويت',  BHD: 'البحرين',  QAR: 'قطر',
  OMR: 'عُمان',   GBP: 'بريطانيا', USD: 'أمريكا', EUR: 'أوروبا',
};

export function countryLabel(code?: string | null): string {
  return COUNTRY_LABELS[(code ?? 'SAR') as CurrencyCode] ?? code ?? 'SAR';
}

/**
 * أسعار صرف تقريبية ثابتة إلى الريال السعودي
 * المصدر: أسعار الربط الرسمية + تقريب للعملات العائمة (مايو 2026)
 */
export const EXCHANGE_RATES_TO_SAR: Record<CurrencyCode, number> = {
  SAR: 1,
  AED: 1.021,   // درهم مرتبط بالدولار (3.6725) والريال (3.75)
  EGP: 0.074,   // جنيه مصري (تقريبي)
  USD: 3.75,    // ربط رسمي
  EUR: 4.12,    // تقريبي
  GBP: 4.82,    // تقريبي
  KWD: 12.22,   // دينار كويتي مرتبط
  QAR: 1.029,   // ريال قطري مرتبط بالدولار (3.64)
  BHD: 9.96,    // دينار بحريني مرتبط (0.376)
  OMR: 9.74,    // ريال عُماني مرتبط (0.385)
};

/** حوّل مبلغاً من أي عملة إلى ريال سعودي */
export function convertToSAR(amount: number, currency?: string | null): number {
  const rate = EXCHANGE_RATES_TO_SAR[(currency ?? 'SAR') as CurrencyCode] ?? 1;
  return amount * rate;
}

/** خيارات الـ FormSelect */
export const CURRENCY_OPTIONS = CURRENCIES.map(c => ({
  value: c.code,
  label: `${c.label} (${c.symbol})`,
}));

/** قائمة الدول مع عملتها — للاختيار في نماذج العقود */
export const COUNTRY_CURRENCY_OPTIONS = CURRENCIES.map(c => ({
  value: c.code,
  label: `${COUNTRY_LABELS[c.code] ?? c.label} — ${c.label} (${c.code})`,
}));

/**
 * Resolve effective currency for a payment:
 * payment.currency → contract.currency → property.currency → 'SAR'
 */
export function resolvePaymentCurrency(
  payment: { currency?: string; contractId?: string },
  contracts: { id: string; currency?: string; unitId?: string }[],
  units:     { id: string; propertyId?: string }[],
  properties:{ id: string; currency?: string }[],
): string {
  if (payment.currency) return payment.currency;
  const contract = contracts.find(c => c.id === payment.contractId);
  if (contract?.currency) return contract.currency;
  const unit = contract ? units.find(u => u.id === contract.unitId) : undefined;
  const prop = unit ? properties.find(p => p.id === unit.propertyId) : undefined;
  return prop?.currency ?? 'SAR';
}

/** كشف العملة تلقائياً من نص الموقع/العنوان */
export function detectCurrencyFromLocation(location?: string | null): CurrencyCode {
  if (!location) return 'SAR';
  const t = location.toLowerCase();

  if (/دبي|أبوظبي|ابوظبي|الشارقة|شارقة|عجمان|الفجيرة|رأس الخيمة|أم القيوين|إمارات|امارات|uae|dubai|abu dhabi|sharjah/.test(t)) return 'AED';
  if (/قاهرة|إسكندرية|اسكندرية|مصر|egypt|cairo|alexandria|الجيزة|جيزة|أسوان|اسوان/.test(t)) return 'EGP';
  if (/كويت|kuwait/.test(t)) return 'KWD';
  if (/بحرين|bahrain|المنامة|منامة/.test(t)) return 'BHD';
  if (/قطر|الدوحة|دوحة|qatar|doha/.test(t)) return 'QAR';
  if (/عُمان|عمان|مسقط|oman|muscat/.test(t)) return 'OMR';
  if (/لندن|london|uk|britain|بريطانيا/.test(t)) return 'GBP';
  if (/أمريكا|امريكا|نيويورك|usa|united states/.test(t)) return 'USD';
  if (/أوروبا|اوروبا|فرنسا|ألمانيا|europe|paris|berlin/.test(t)) return 'EUR';

  return 'SAR';
}
