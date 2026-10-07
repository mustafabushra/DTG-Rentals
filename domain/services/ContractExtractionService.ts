/**
 * ContractExtractionService — تطبيع ومطابقة بيانات عقد مقروء من صورة.
 *
 * دور هذه الوحدة: تحويل ما يُرجعه النموذج البصري (نص حرّ غير موثوق) إلى مسوّدة
 * عقد **مقترحة** مع بيان ما يحتاج انتباه المستخدم. لا تكتب شيئاً ولا تثق بما
 * يصلها: كل حقل يُطبَّع، ويُتحقَّق منه، ويُعرَض للمراجعة البشرية قبل الحفظ.
 *
 * السبب: هذه بيانات مالية. خطأ في قراءة رقم (65,000 تُقرأ 650,000) يولّد جدول
 * أقساط خاطئاً بالكامل. فالقراءة الآلية **تقترح ولا تكتب**.
 *
 * دوال نقية — بلا شبكة ولا React.
 */

// ── ما يُرجعه النموذج: كل شيء اختياري وغير موثوق ────────────────────────────
export interface RawExtraction {
  contractNumber?:    string | null;
  tenantName?:        string | null;
  tenantNationalId?:  string | null;
  tenantPhone?:       string | null;
  propertyName?:      string | null;
  unitNumber?:        string | null;
  startDate?:         string | null;
  endDate?:           string | null;
  annualValue?:       string | number | null;
  installmentsCount?: string | number | null;
  currency?:          string | null;
  /** ثقة النموذج في القراءة كاملةً (0–1) إن وفّرها. */
  confidence?:        number | null;
}

export type IssueLevel = 'blocking' | 'warning';

export interface FieldIssue {
  field:   string;
  level:   IssueLevel;
  message: string;
}

export interface ContractDraft {
  contractNumber?:    string;
  tenantId?:          string;
  tenantName?:        string;
  tenantNationalId?:  string;
  tenantPhone?:       string;
  unitId?:            string;
  propertyName?:      string;
  unitNumber?:        string;
  startDate?:         string;
  endDate?:           string;
  annualValue?:       number;
  installmentsCount?: number;
  currency?:          string;
}

export interface ExtractionResult {
  draft:  ContractDraft;
  issues: FieldIssue[];
  /** مرشّحو المطابقة ليختار المستخدم عند الالتباس. */
  tenantCandidates: { id: string; name: string }[];
  unitCandidates:   { id: string; label: string }[];
}

export interface TenantRef { id: string; name: string; nationalId?: string; phone?: string }
export interface UnitRef   { id: string; number: string; propertyId: string }
export interface PropertyRef { id: string; name: string }

// ── تطبيع النص العربي ───────────────────────────────────────────────────────

const ARABIC_DIGITS   = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_DIGITS  = '۰۱۲۳۴۵۶۷۸۹';

/** يحوّل الأرقام العربية/الفارسية إلى لاتينية — العقود تستخدمها كثيراً. */
export function toLatinDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, ch => {
    const a = ARABIC_DIGITS.indexOf(ch);
    if (a >= 0) return String(a);
    return String(EASTERN_DIGITS.indexOf(ch));
  });
}

/**
 * تطبيع نص عربي للمطابقة: إزالة التشكيل والتطويل، وتوحيد الألف والياء والتاء
 * المربوطة، وضغط المسافات. ضروري لأن «أسامه» و«اسامة» اسم واحد.
 */
export function normalizeArabic(input?: string | null): string {
  if (!input) return '';
  return toLatinDigits(String(input))
    .replace(/[ً-ْـ]/g, '')   // تشكيل + تطويل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ── تطبيع الحقول ────────────────────────────────────────────────────────────

/** يستخرج رقماً من نص مثل «65,000 ريال» أو «٦٥٠٠٠». */
export function parseAmount(input?: string | number | null): number | null {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  const cleaned = toLatinDigits(String(input)).replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const AR_MONTHS = [
  'يناير','فبراير','مارس','ابريل','مايو','يونيو',
  'يوليو','اغسطس','سبتمبر','اكتوبر','نوفمبر','ديسمبر',
];

function pad(n: number): string { return String(n).padStart(2, '0'); }

function validGregorian(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** سنة هجرية محتملة — تُعلَّم للمراجعة ولا تُحوَّل تلقائياً. */
export function looksHijri(year: number): boolean {
  return year >= 1300 && year <= 1500;
}

/**
 * يحوّل تاريخاً بصيغ متعددة إلى 'YYYY-MM-DD'.
 * يرجع null إن تعذّر — ولا يخمّن.
 */
export function parseDate(input?: string | null): { iso: string | null; hijri: boolean } {
  if (!input) return { iso: null, hijri: false };
  const s = toLatinDigits(String(input)).trim();

  // yyyy-mm-dd أو yyyy/mm/dd
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    if (looksHijri(y)) return { iso: null, hijri: true };
    return { iso: validGregorian(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null, hijri: false };
  }

  // dd-mm-yyyy أو dd/mm/yyyy
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) {
    const [d, mo, y] = [+m[1], +m[2], +m[3]];
    if (looksHijri(y)) return { iso: null, hijri: true };
    return { iso: validGregorian(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null, hijri: false };
  }

  // «1 يناير 2026»
  m = normalizeArabic(s).match(/^(\d{1,2})\s+([^\s\d]+)\s+(\d{4})$/);
  if (m) {
    const d  = +m[1];
    const mo = AR_MONTHS.indexOf(normalizeArabic(m[2])) + 1;
    const y  = +m[3];
    if (looksHijri(y)) return { iso: null, hijri: true };
    if (mo > 0 && validGregorian(y, mo, d)) return { iso: `${y}-${pad(mo)}-${pad(d)}`, hijri: false };
  }

  return { iso: null, hijri: false };
}

const CURRENCY_HINTS: Record<string, string> = {
  'ريال': 'SAR', 'ر.س': 'SAR', 'sar': 'SAR', 'sr': 'SAR',
  'درهم': 'AED', 'aed': 'AED',
  'جنيه': 'EGP', 'egp': 'EGP',
  'دينار': 'KWD', 'kwd': 'KWD',
  'دولار': 'USD', 'usd': 'USD',
};

/** يستنتج رمز العملة من نص حرّ، أو null إن لم يتبيّن. */
export function parseCurrency(input?: string | null): string | null {
  if (!input) return null;
  const n = normalizeArabic(input);
  for (const [hint, code] of Object.entries(CURRENCY_HINTS)) {
    if (n.includes(normalizeArabic(hint))) return code;
  }
  const upper = String(input).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(upper) ? upper : null;
}

// ── مطابقة الكيانات ────────────────────────────────────────────────────────

/**
 * يطابق اسم مستأجر مقروء مع المستأجرين الموجودين.
 * يُقدّم الهوية الوطنية على الاسم لأنها فاصلة، ثم المطابقة التامة بعد التطبيع،
 * ثم الاحتواء الجزئي. يرجع المرشّحين ليختار المستخدم — لا يختار عنه.
 */
export function matchTenants(raw: RawExtraction, tenants: TenantRef[]): TenantRef[] {
  const id = toLatinDigits(String(raw.tenantNationalId ?? '')).replace(/\D/g, '');
  if (id.length >= 8) {
    const byId = tenants.filter(t => toLatinDigits(String(t.nationalId ?? '')).replace(/\D/g, '') === id);
    if (byId.length) return byId;
  }

  const name = normalizeArabic(raw.tenantName);
  if (!name) return [];

  const exact = tenants.filter(t => normalizeArabic(t.name) === name);
  if (exact.length) return exact;

  // احتواء في أي اتجاه — يغطي «أسامة الزهراني» مقابل «د. أسامة الزهراني»
  const partial = tenants.filter(t => {
    const tn = normalizeArabic(t.name);
    return tn.includes(name) || name.includes(tn);
  });
  if (partial.length) return partial;

  // تشارك كلمتين على الأقل (الاسم الأول + اسم العائلة)
  const words = new Set(name.split(' ').filter(w => w.length > 2));
  return tenants.filter(t => {
    const tw = normalizeArabic(t.name).split(' ').filter(w => w.length > 2);
    return tw.filter(w => words.has(w)).length >= 2;
  });
}

/** يطابق الوحدة برقمها، ويضيّق بالعقار إن ذُكر اسمه. */
export function matchUnits(
  raw: RawExtraction,
  units: UnitRef[],
  properties: PropertyRef[],
): { id: string; label: string }[] {
  const num = normalizeArabic(raw.unitNumber);
  if (!num) return [];

  const propName = normalizeArabic(raw.propertyName);
  const propIds = propName
    ? new Set(properties
        .filter(p => {
          const pn = normalizeArabic(p.name);
          return pn === propName || pn.includes(propName) || propName.includes(pn);
        })
        .map(p => p.id))
    : null;

  const byNumber = units.filter(u => normalizeArabic(u.number) === num);
  const scoped = propIds ? byNumber.filter(u => propIds.has(u.propertyId)) : byNumber;
  const chosen = scoped.length ? scoped : byNumber;

  return chosen.map(u => ({
    id: u.id,
    label: `${properties.find(p => p.id === u.propertyId)?.name ?? 'عقار'} — وحدة ${u.number}`,
  }));
}

// ── البناء والتحقق ─────────────────────────────────────────────────────────

/**
 * يبني مسوّدة العقد من القراءة الخام، ويُرجع معها كل ما يحتاج انتباهاً.
 * `blocking` يمنع الحفظ حتى يصلّحه المستخدم؛ `warning` ينبّه ولا يمنع.
 */
export function buildDraft(
  raw: RawExtraction,
  ctx: { tenants: TenantRef[]; units: UnitRef[]; properties: PropertyRef[] },
): ExtractionResult {
  const issues: FieldIssue[] = [];
  const draft: ContractDraft = {};

  if (raw.contractNumber) draft.contractNumber = String(raw.contractNumber).trim();
  if (raw.tenantName)     draft.tenantName     = String(raw.tenantName).trim();
  if (raw.tenantNationalId) draft.tenantNationalId = toLatinDigits(String(raw.tenantNationalId)).replace(/\D/g, '');
  if (raw.tenantPhone)    draft.tenantPhone    = toLatinDigits(String(raw.tenantPhone)).replace(/[^\d+]/g, '');
  if (raw.propertyName)   draft.propertyName   = String(raw.propertyName).trim();
  if (raw.unitNumber)     draft.unitNumber     = String(raw.unitNumber).trim();

  // ── التواريخ ──
  const s = parseDate(raw.startDate);
  const e = parseDate(raw.endDate);
  if (s.hijri || e.hijri) {
    issues.push({ field: 'dates', level: 'blocking',
      message: 'التواريخ تبدو هجرية. أدخلها ميلادية — لا يُحوّلها النظام تلقائياً تجنّباً للخطأ.' });
  }
  if (s.iso) draft.startDate = s.iso; else if (raw.startDate && !s.hijri) {
    issues.push({ field: 'startDate', level: 'blocking', message: 'تاريخ البداية غير مقروء. أدخله يدوياً.' });
  }
  if (e.iso) draft.endDate = e.iso; else if (raw.endDate && !e.hijri) {
    issues.push({ field: 'endDate', level: 'blocking', message: 'تاريخ النهاية غير مقروء. أدخله يدوياً.' });
  }
  if (!raw.startDate) issues.push({ field: 'startDate', level: 'blocking', message: 'لم يُقرأ تاريخ البداية.' });
  if (!raw.endDate)   issues.push({ field: 'endDate',   level: 'blocking', message: 'لم يُقرأ تاريخ النهاية.' });
  if (draft.startDate && draft.endDate && draft.endDate <= draft.startDate) {
    issues.push({ field: 'endDate', level: 'blocking', message: 'تاريخ النهاية ليس بعد البداية — راجع القراءة.' });
  }

  // ── المال ──
  const value = parseAmount(raw.annualValue);
  if (value === null) {
    issues.push({ field: 'annualValue', level: 'blocking', message: 'لم تُقرأ القيمة السنوية. أدخلها يدوياً.' });
  } else if (value <= 0) {
    issues.push({ field: 'annualValue', level: 'blocking', message: 'القيمة السنوية المقروءة غير منطقية.' });
  } else {
    draft.annualValue = Math.round(value);
    // تحقق إنساني: رقم خارج النطاق المعتاد غالباً خطأ قراءة (صفر زائد أو ناقص)
    if (value < 1000 || value > 10_000_000) {
      issues.push({ field: 'annualValue', level: 'warning',
        message: `القيمة المقروءة (${Math.round(value).toLocaleString('en-US')}) خارج النطاق المعتاد — تأكّد من عدد الأصفار.` });
    }
  }

  const count = parseAmount(raw.installmentsCount);
  if (count !== null && Number.isInteger(count) && count >= 1 && count <= 24) {
    draft.installmentsCount = count;
  } else {
    issues.push({ field: 'installmentsCount', level: 'warning',
      message: 'لم يُقرأ عدد الأقساط بثقة — اختره يدوياً.' });
  }

  const currency = parseCurrency(raw.currency);
  if (currency) draft.currency = currency;

  // ── مطابقة الكيانات ──
  const tenantMatches = matchTenants(raw, ctx.tenants);
  if (tenantMatches.length === 1) {
    draft.tenantId = tenantMatches[0].id;
  } else if (tenantMatches.length > 1) {
    issues.push({ field: 'tenantId', level: 'blocking',
      message: `${tenantMatches.length} مستأجرين يطابقون الاسم المقروء — اختر الصحيح.` });
  } else {
    issues.push({ field: 'tenantId', level: 'blocking',
      message: raw.tenantName
        ? `لا مستأجر مسجَّل باسم «${String(raw.tenantName).trim()}» — اختر مستأجراً أو أضِفه أولاً.`
        : 'لم يُقرأ اسم المستأجر — اختره يدوياً.' });
  }

  const unitMatches = matchUnits(raw, ctx.units, ctx.properties);
  if (unitMatches.length === 1) {
    draft.unitId = unitMatches[0].id;
  } else if (unitMatches.length > 1) {
    issues.push({ field: 'unitId', level: 'blocking',
      message: `${unitMatches.length} وحدات تحمل الرقم المقروء — اختر الصحيحة.` });
  } else {
    issues.push({ field: 'unitId', level: 'blocking',
      message: raw.unitNumber
        ? `لا وحدة مسجَّلة بالرقم «${String(raw.unitNumber).trim()}» — اخترها يدوياً.`
        : 'لم يُقرأ رقم الوحدة — اخترها يدوياً.' });
  }

  if (typeof raw.confidence === 'number' && raw.confidence < 0.6) {
    issues.push({ field: 'overall', level: 'warning',
      message: 'ثقة القراءة منخفضة — راجع كل الحقول بعناية قبل الحفظ.' });
  }

  return {
    draft,
    issues,
    tenantCandidates: tenantMatches.map(t => ({ id: t.id, name: t.name })),
    unitCandidates:   unitMatches,
  };
}

/** هل المسوّدة جاهزة للحفظ؟ أي حقل blocking يمنع. */
export function isReadyToSave(result: ExtractionResult): boolean {
  return !result.issues.some(i => i.level === 'blocking');
}

export const ContractExtractionService = {
  toLatinDigits, normalizeArabic, parseAmount, parseDate, parseCurrency,
  looksHijri, matchTenants, matchUnits, buildDraft, isReadyToSave,
};
