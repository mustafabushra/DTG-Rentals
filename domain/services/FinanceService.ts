/**
 * FinanceService — منطق المصاريف والسندات (دوال صرفة بلا Firestore ولا React).
 *
 * - تفقيط المبالغ بالعربية حسب العملة (ريال/هللة، درهم/فلس، دينار/فلس ...).
 * - ترقيم السندات: ق-00001 للقبض، ص-00001 للصرف.
 * - تجميع صافي الدخل لكل عقار (المحصّل − المصاريف) بعملة العقار.
 */
import type { Expense, ExpenseScope, Voucher, VoucherType } from '../models';

// ─── التصنيفات الافتراضية ─────────────────────────────────────────────────────

export const DEFAULT_PROPERTY_CATEGORIES = [
  'صيانة', 'كهرباء', 'مياه', 'نظافة', 'حراسة', 'تأمين', 'رسوم حكومية', 'أخرى',
] as const;

export const DEFAULT_OFFICE_CATEGORIES = [
  'رواتب', 'إيجار المكتب', 'اتصالات وإنترنت', 'قرطاسية', 'اشتراكات', 'مواصلات', 'أخرى',
] as const;

/** يدمج التصنيفات الافتراضية مع ما أضافه المستخدم، بلا تكرار و"أخرى" دائماً في الآخر. */
export function mergeCategories(scope: ExpenseScope, custom: string[] = []): string[] {
  const base: readonly string[] = scope === 'office' ? DEFAULT_OFFICE_CATEGORIES : DEFAULT_PROPERTY_CATEGORIES;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of [...base.filter(c => c !== 'أخرى'), ...custom]) {
    const t = c.trim();
    if (!t || t === 'أخرى' || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  out.push('أخرى');
  return out;
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'نقداً',
  transfer: 'تحويل بنكي',
  bank_transfer: 'تحويل بنكي',
  check: 'شيك',
};

// ─── ترقيم السندات ────────────────────────────────────────────────────────────

export const VOUCHER_PREFIX: Record<VoucherType, string> = { receipt: 'ق', payment: 'ص' };
export const VOUCHER_LABEL:  Record<VoucherType, string> = { receipt: 'سند قبض', payment: 'سند صرف' };

export function formatVoucherNumber(type: VoucherType, seq: number): string {
  return `${VOUCHER_PREFIX[type]}-${String(seq).padStart(5, '0')}`;
}

/**
 * معرّف ثابت لسند مصدر معيّن (دفعة/مصروف) — يجعل الإصدار idempotent:
 * جهازان يصدران السند نفسه في اللحظة نفسها يكتبان المستند نفسه، والمعاملة
 * ترفض الثاني لأنه موجود. attempt يزيد فقط بعد إلغاء سند سابق للمصدر نفسه.
 */
export function voucherDocId(type: VoucherType, sourceId: string, attempt: number): string {
  const p = type === 'receipt' ? 'rv' : 'pv';
  return attempt <= 0 ? `${p}_${sourceId}` : `${p}_${sourceId}_${attempt}`;
}

/** عدد السندات السابقة لهذا المصدر — يحدد attempt للسند الجديد. */
export function nextAttempt(vouchers: Voucher[], type: VoucherType, sourceId: string): number {
  return vouchers.filter(v =>
    v.type === type && (type === 'receipt' ? v.paymentId === sourceId : v.expenseId === sourceId),
  ).length;
}

/** السند الساري (غير الملغي) لمصدر معيّن، إن وجد. */
export function activeVoucherFor(vouchers: Voucher[], type: VoucherType, sourceId: string): Voucher | undefined {
  return vouchers.find(v =>
    v.status === 'issued' && v.type === type
    && (type === 'receipt' ? v.paymentId === sourceId : v.expenseId === sourceId),
  );
}

// ─── تفقيط المبالغ ────────────────────────────────────────────────────────────

const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const TEENS = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر',
  'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة',
  'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

/** 1..999 */
function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(HUNDREDS[h]);
  if (r) {
    if (r < 10) parts.push(ONES[r]);
    else if (r < 20) parts.push(TEENS[r - 10]);
    else {
      const o = r % 10;
      const t = Math.floor(r / 10);
      parts.push(o ? `${ONES[o]} و${TENS[t]}` : TENS[t]);
    }
  }
  return parts.join(' و');
}

type Scale = { one: string; two: string; plural: string };
const SCALES: Scale[] = [
  { one: 'ألف',   two: 'ألفان',   plural: 'آلاف' },
  { one: 'مليون', two: 'مليونان', plural: 'ملايين' },
  { one: 'مليار', two: 'ملياران', plural: 'مليارات' },
];

function scaled(n: number, s: Scale): string {
  if (n === 1) return s.one;
  if (n === 2) return s.two;
  if (n >= 3 && n <= 10) return `${below1000(n)} ${s.plural}`;
  return `${below1000(n)} ${s.one}`;
}

/** عدد صحيح غير سالب إلى كلمات عربية (حتى 999 مليار). */
export function numberToArabicWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return 'صفر';
  const groups: number[] = [];
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    parts.push(i === 0 ? below1000(g) : scaled(g, SCALES[i - 1] ?? SCALES[SCALES.length - 1]));
  }
  return parts.join(' و');
}

type CurrencyWords = { unit: string; sub: string; subDivisor: number };
const CURRENCY_WORDS: Record<string, CurrencyWords> = {
  SAR: { unit: 'ريال سعودي',     sub: 'هللة',  subDivisor: 100 },
  AED: { unit: 'درهم إماراتي',   sub: 'فلس',   subDivisor: 100 },
  EGP: { unit: 'جنيه مصري',      sub: 'قرش',   subDivisor: 100 },
  USD: { unit: 'دولار أمريكي',   sub: 'سنت',   subDivisor: 100 },
  EUR: { unit: 'يورو',           sub: 'سنت',   subDivisor: 100 },
  GBP: { unit: 'جنيه إسترليني',  sub: 'بنس',   subDivisor: 100 },
  KWD: { unit: 'دينار كويتي',    sub: 'فلس',   subDivisor: 1000 },
  QAR: { unit: 'ريال قطري',      sub: 'درهم',  subDivisor: 100 },
  BHD: { unit: 'دينار بحريني',   sub: 'فلس',   subDivisor: 1000 },
  OMR: { unit: 'ريال عماني',     sub: 'بيسة',  subDivisor: 1000 },
};

/** "فقط خمسة آلاف ومائتان ريال سعودي وخمسون هللة لا غير" */
export function amountToArabicWords(amount: number, currency = 'SAR'): string {
  const cw = CURRENCY_WORDS[currency] ?? CURRENCY_WORDS.SAR;
  const safe = Math.abs(Number.isFinite(amount) ? amount : 0);
  const whole = Math.floor(safe);
  const fraction = Math.round((safe - whole) * cw.subDivisor);
  // التقريب قد يرفع الكسر إلى وحدة كاملة (مثل 9.999 دينار)
  const w = fraction >= cw.subDivisor ? whole + 1 : whole;
  const f = fraction >= cw.subDivisor ? 0 : fraction;
  let text = `فقط ${numberToArabicWords(w)} ${cw.unit}`;
  if (f > 0) text += ` و${numberToArabicWords(f)} ${cw.sub}`;
  return `${text} لا غير`;
}

// ─── صافي الدخل ──────────────────────────────────────────────────────────────

export interface IncomeSource {
  payments:   { id: string; contractId: string; amount: number; status: string; paidDate?: string; currency?: string }[];
  contracts:  { id: string; unitId: string; currency?: string }[];
  units:      { id: string; propertyId: string }[];
  properties: { id: string; name: string; currency?: string }[];
  expenses:   Expense[];
}

export interface PropertyNet {
  propertyId:   string;
  propertyName: string;
  currency:     string;
  income:       number;
  expenses:     number;
  net:          number;
}

/** هل التاريخ (YYYY-MM-DD) داخل الفترة؟ الحدود شاملة، والحد الفارغ مفتوح. */
export function inRange(date: string | undefined, from?: string, to?: string): boolean {
  if (!date) return false;
  const d = date.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

/**
 * الدخل المحصَّل (دفعات مدفوعة بتاريخ السداد) ناقص المصاريف السارية، لكل عقار.
 * المبالغ بعملة العقار نفسها — لا تحويل هنا؛ التحويل للريال يتم في طبقة العرض فقط.
 */
export function netByProperty(src: IncomeSource, from?: string, to?: string): PropertyNet[] {
  const unitProp = new Map(src.units.map(u => [u.id, u.propertyId]));
  const contractProp = new Map(src.contracts.map(c => [c.id, unitProp.get(c.unitId)]));
  const rows = new Map<string, PropertyNet>();
  const row = (pid: string) => {
    let r = rows.get(pid);
    if (!r) {
      const p = src.properties.find(x => x.id === pid);
      r = { propertyId: pid, propertyName: p?.name ?? '—', currency: p?.currency ?? 'SAR', income: 0, expenses: 0, net: 0 };
      rows.set(pid, r);
    }
    return r;
  };
  for (const pay of src.payments) {
    if (pay.status !== 'paid' || !inRange(pay.paidDate, from, to)) continue;
    const pid = contractProp.get(pay.contractId);
    if (!pid) continue;
    row(pid).income += pay.amount || 0;
  }
  for (const e of src.expenses) {
    if (e.status !== 'active' || e.scope !== 'property' || !e.propertyId) continue;
    if (!inRange(e.date, from, to)) continue;
    row(e.propertyId).expenses += e.amount || 0;
  }
  for (const r of rows.values()) r.net = r.income - r.expenses;
  return [...rows.values()].sort((a, b) => b.net - a.net);
}

/** مجموع المصاريف السارية لكل عملة (لا نجمع عملات مختلفة في رقم واحد). */
export function totalsByCurrency(expenses: Expense[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of expenses) {
    if (e.status !== 'active') continue;
    out[e.currency || 'SAR'] = (out[e.currency || 'SAR'] ?? 0) + (e.amount || 0);
  }
  return out;
}

/** مجموع المصاريف السارية لكل تصنيف — مرتبة تنازلياً. */
export function totalsByCategory(expenses: Expense[]): { category: string; amount: number; count: number }[] {
  const m = new Map<string, { category: string; amount: number; count: number }>();
  for (const e of expenses) {
    if (e.status !== 'active') continue;
    const r = m.get(e.category) ?? { category: e.category, amount: 0, count: 0 };
    r.amount += e.amount || 0;
    r.count += 1;
    m.set(e.category, r);
  }
  return [...m.values()].sort((a, b) => b.amount - a.amount);
}

// ─── التحقق من مصروف قبل الحفظ ───────────────────────────────────────────────

export function validateExpense(e: Partial<Expense>): Record<string, string> {
  const err: Record<string, string> = {};
  if (e.scope === 'property' && !e.propertyId) err.propertyId = 'اختر العقار';
  if (!e.category?.trim()) err.category = 'التصنيف مطلوب';
  if (!(typeof e.amount === 'number' && e.amount > 0 && Number.isFinite(e.amount))) err.amount = 'أدخل مبلغاً صحيحاً أكبر من صفر';
  if (!e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) err.date = 'التاريخ مطلوب';
  if (!e.currency) err.currency = 'العملة مطلوبة';
  return err;
}

/** هل غيّر التعديل شيئاً يظهر على سند الصرف؟ عندها يُلغى السند ويُصدر بديل. */
export function expenseVoucherFieldsChanged(before: Expense, after: Partial<Expense>): boolean {
  const keys: (keyof Expense)[] = ['amount', 'currency', 'date', 'vendor', 'category', 'paymentMethod', 'referenceNumber', 'propertyId', 'unitId'];
  return keys.some(k => k in after && (after as any)[k] !== (before as any)[k]);
}

export interface UnitNet { unitId: string; propertyId: string; income: number; expenses: number; net: number }

/**
 * صافي كل وحدة: المحصَّل من عقودها − مصاريفها المسجلة على الوحدة نفسها.
 * مصاريف العقار العامة (بلا وحدة) لا تُوزَّع هنا — تظهر في صافي العقار فقط.
 */
export function netByUnit(src: IncomeSource, from?: string, to?: string): Map<string, UnitNet> {
  const unitProp = new Map(src.units.map(u => [u.id, u.propertyId]));
  const contractUnit = new Map(src.contracts.map(c => [c.id, c.unitId]));
  const out = new Map<string, UnitNet>();
  const row = (uid: string) => {
    let r = out.get(uid);
    if (!r) { r = { unitId: uid, propertyId: unitProp.get(uid) ?? '', income: 0, expenses: 0, net: 0 }; out.set(uid, r); }
    return r;
  };
  for (const pay of src.payments) {
    if (pay.status !== 'paid' || !inRange(pay.paidDate, from, to)) continue;
    const uid = contractUnit.get(pay.contractId);
    if (uid) row(uid).income += pay.amount || 0;
  }
  for (const e of src.expenses) {
    if (e.status !== 'active' || e.scope !== 'property' || !e.unitId || !inRange(e.date, from, to)) continue;
    row(e.unitId).expenses += e.amount || 0;
  }
  for (const r of out.values()) r.net = r.income - r.expenses;
  return out;
}

/** حصة مالك من صافي الوحدة حسب نسبته في سند الملكية. */
export function ownerShareOf(net: number, percent: number): number {
  return Math.round(net * percent) / 100;
}
