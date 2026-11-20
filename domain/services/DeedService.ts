/**
 * DeedService — منطق سند الملكية (دوال صرفة).
 *
 * - تطبيع قراءة السند الخام (من النموذج أو الإدخال اليدوي): أرقام عربية، فواصل،
 *   تواريخ بصيغ مختلفة.
 * - حساب حصص الملاك: من المساحة إن وُجدت، وإلا من النسبة المكتوبة.
 * - مطابقة أسماء الملاك في السند مع سجلات الملاك في النظام.
 */
import type { DeedOwner, TitleDeed } from '../models';

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** "١٬٥٥٧٫٩٧" أو "1,557.97" أو "109/90" (فاصلة عشرية مكتوبة شَرطة) → 1557.97 */
export function parseNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.trim();
  if (!s) return null;
  s = s.replace(/[٠-٩]/g, d => String(AR_DIGITS.indexOf(d)))
       .replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d)))
       .replace(/٫/g, '.').replace(/[٬,\s]/g, '');
  // بعض المخططات تكتب الكسر بشَرطة: 109/90 = 109.90
  if (/^\d+\/\d{1,2}$/.test(s)) s = s.replace('/', '.');
  s = s.replace(/[^\d.\-]/g, '');
  if (!s || s === '.' || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "19/11/2026" أو "2026-11-19" أو "19-11-2026" → "2026-11-19" (ميلادي فقط) */
export function parseDeedDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/[٠-٩]/g, d => String(AR_DIGITS.indexOf(d)));
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return iso(+m[3], +m[2], +m[1]);
  return null;
}
function iso(y: number, mo: number, d: number): string | null {
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * يحسب النسبة المئوية لكل مالك.
 * الأولوية للمساحة (هكذا تكتب دائرة الأراضي الحصص): نسبة = مساحة المالك ÷ مجموع المساحات.
 * إن لم تُذكر المساحات تُستخدم النسب المكتوبة كما هي.
 */
export function computeShares(owners: DeedOwner[]): DeedOwner[] {
  const areas = owners.map(o => (o.shareArea && o.shareArea > 0 ? o.shareArea : 0));
  const areaSum = areas.reduce((a, b) => a + b, 0);
  if (areaSum > 0 && areas.every(a => a > 0)) {
    return owners.map((o, i) => ({ ...o, sharePercent: round2((areas[i] / areaSum) * 100) }));
  }
  return owners.map(o => ({ ...o, sharePercent: round2(o.sharePercent || 0) }));
}

export function sharesTotal(owners: DeedOwner[]): number {
  return round2(owners.reduce((s, o) => s + (o.sharePercent || 0), 0));
}

/** يعرض النسبة بكسر مألوف إن كانت قريبة منه (ثلث، سدس، نصف...). */
export function shareLabel(percent: number): string {
  const fractions: [number, string][] = [
    [100, 'كامل الملكية'], [50, 'النصف'], [100 / 3, 'الثلث'], [200 / 3, 'الثلثان'],
    [25, 'الربع'], [75, 'ثلاثة أرباع'], [20, 'الخمس'], [100 / 6, 'السدس'], [12.5, 'الثمن'],
  ];
  const hit = fractions.find(([v]) => Math.abs(v - percent) < 0.06);
  const pct = `${(Math.round(percent * 100) / 100).toLocaleString('en-US')}%`;
  return hit ? `${hit[1]} (${pct})` : pct;
}

/** تطبيع الأسماء للمقارنة: بلا تشكيل ولا همزات مختلفة ولا "بن/بنت/ابن". */
export function normalizeName(s: string): string {
  return s
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .toLowerCase()
    .split(/\s+/)
    // \b لا يعمل مع الحروف العربية في JS ⇒ نُسقط "بن/بنت/ابن" ككلمات كاملة
    .filter(w => w && !['بن', 'بنت', 'ابن'].includes(w))
    .join(' ');
}

/**
 * يطابق اسم المالك في السند مع سجل في النظام: الاسم الأول والعائلة كلاهما موجودان.
 * يُرجع المعرّف فقط إن كانت المطابقة واحدة بلا التباس.
 */
export function matchOwner(deedName: string, owners: { id: string; name: string }[]): string | null {
  const parts = normalizeName(deedName).split(' ').filter(Boolean);
  if (parts.length === 0) return null;
  const first = parts[0];
  const last = parts[parts.length - 1];
  const hits = owners.filter(o => {
    const n = normalizeName(o.name);
    return n.includes(first) && (parts.length === 1 || n.includes(last));
  });
  return hits.length === 1 ? hits[0].id : null;
}

/** قراءة خام (كل الحقول نصوص) — شكل ما يرجعه قارئ السند. */
export interface RawDeed {
  issuer?: string | null; certificateNo?: string | null; issueDate?: string | null;
  mortgageStatus?: string | null; propertyType?: string | null; community?: string | null;
  plotNo?: string | null; municipalityNo?: string | null; buildingNo?: string | null;
  buildingName?: string | null; propertyNo?: string | null; floorNo?: string | null;
  parking?: string | null; suiteArea?: string | null; balconyArea?: string | null;
  commonArea?: string | null; totalArea?: string | null; totalAreaSqFt?: string | null;
  transferNote?: string | null;
  owners?: { name?: string | null; ownerNumber?: string | null; shareArea?: string | null; sharePercent?: string | null }[] | null;
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** "غير مرهونة / Not mortgaged" → false، "مرهونة" → true، غير ذلك null */
export function parseMortgage(v: unknown): boolean | null {
  const s = str(v);
  if (!s) return null;
  if (/غير\s*مرهون|not\s*mortgag|no\s*mortgage|unmortgag/i.test(s)) return false;
  if (/مرهون|mortgag/i.test(s)) return true;
  return null;
}

/** يحوّل قراءة خام إلى سند مطبَّع، مع مطابقة الملاك وحساب الحصص. */
export function normalizeDeed(raw: RawDeed, systemOwners: { id: string; name: string }[] = []): TitleDeed {
  const owners: DeedOwner[] = (raw.owners ?? [])
    .filter(o => str(o?.name))
    .map(o => ({
      name: str(o.name)!,
      ownerNumber: str(o.ownerNumber),
      shareArea: parseNumber(o.shareArea),
      sharePercent: parseNumber(o.sharePercent) ?? 0,
      ownerId: matchOwner(str(o.name)!, systemOwners),
    }));
  return {
    issuer: str(raw.issuer),
    certificateNo: str(raw.certificateNo),
    issueDate: parseDeedDate(raw.issueDate),
    mortgaged: parseMortgage(raw.mortgageStatus),
    propertyType: str(raw.propertyType),
    community: str(raw.community),
    plotNo: str(raw.plotNo),
    municipalityNo: str(raw.municipalityNo),
    buildingNo: str(raw.buildingNo),
    buildingName: str(raw.buildingName),
    propertyNo: str(raw.propertyNo),
    floorNo: str(raw.floorNo),
    parking: str(raw.parking),
    suiteArea: parseNumber(raw.suiteArea),
    balconyArea: parseNumber(raw.balconyArea),
    commonArea: parseNumber(raw.commonArea),
    totalArea: parseNumber(raw.totalArea),
    totalAreaSqFt: parseNumber(raw.totalAreaSqFt),
    transferNote: str(raw.transferNote),
    owners: computeShares(owners),
  };
}

/** مشاكل تمنع الحفظ أو تستحق التنبيه. */
export function validateDeed(d: TitleDeed): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (d.owners.length === 0) errors.push('أضف مالكاً واحداً على الأقل.');
  if (d.owners.some(o => !o.name.trim())) errors.push('اكتب اسم كل مالك.');
  const total = sharesTotal(d.owners);
  if (d.owners.length > 0 && Math.abs(total - 100) > 0.1) {
    errors.push(`مجموع الحصص ${total}% — يجب أن يساوي 100%.`);
  }
  if (d.suiteArea && d.balconyArea && d.totalArea
      && Math.abs(d.suiteArea + d.balconyArea - d.totalArea) > 0.5) {
    warnings.push('المساحة الداخلية + البلكونة لا تساوي المساحة الكلية — راجع الأرقام.');
  }
  const shareAreaSum = d.owners.reduce((s, o) => s + (o.shareArea ?? 0), 0);
  if (d.totalArea && shareAreaSum > 0 && Math.abs(shareAreaSum - d.totalArea) > 0.5) {
    warnings.push('مجموع مساحات الملاك لا يساوي المساحة الكلية للعقار — راجع الأرقام.');
  }
  return { errors, warnings };
}

/** Firestore يدمج الحقول المتداخلة: الحقل المحذوف يجب أن يُكتب null صراحةً لا أن يُحذف. */
export function deedForStorage(d: TitleDeed): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) out[k] = v === undefined ? null : v;
  out.owners = d.owners.map(o => ({
    name: o.name, ownerNumber: o.ownerNumber ?? null, shareArea: o.shareArea ?? null,
    sharePercent: o.sharePercent, ownerId: o.ownerId ?? null,
  }));
  return out;
}
