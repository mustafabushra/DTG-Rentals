/**
 * النسخة الاحتياطية الكاملة (الإصدار 2.0).
 *
 * قبل: النسخة كانت تاخذ الملاك والعقارات والوحدات والمستأجرين والعقود والدفعات والصيانة
 * (+ المصاريف والسندات للأرشفة بس)، فالمرفقات والملفات الكبيرة وطلبات الصرف والحجوزات
 * والتقويم والمدن والصور والإعدادات كانت تضيع لو احتجنا استعادة.
 *
 * الحين التصدير يقرأ من قاعدة البيانات مباشرة (مو من الشاشة) كل المجموعات، والاستعادة:
 *  - الأساسية: تستبدل (تكتب الموجود في النسخة، وتحذف اللي مو فيها) — بالمنطق القديم المختبر.
 *  - الإضافية: تكتب فوق (upsert) بدون حذف.
 *  - المصاريف والسندات: تضيف الناقص بس — السند ما ينحذف ولا يتعدّل.
 *  - عدّاد السندات: ياخذ الأكبر، عشان ما يتكرر رقم سند.
 *  - الإعدادات: النظام والمالية. سرّ المساعد (مفتاح Gemini) ما يطلع في الملف أبداً.
 */
import { getAll, getOne, setOne } from './firestoreService';

export const BACKUP_VERSION = '2.0';

export const CORE_COLS = ['owners', 'properties', 'units', 'tenants', 'contracts', 'payments', 'maintenance'] as const;
export const UPSERT_COLS = ['bookings', 'calendarEvents', 'cities', 'attachments', 'fileChunks', 'photos', 'paymentRequests'] as const;
export const APPEND_ONLY_COLS = ['expenses', 'vouchers'] as const;
export const SETTINGS_DOCS = ['system', 'finance'] as const;

export const COL_LABELS: Record<string, string> = {
  owners: 'الملاك', properties: 'العقارات', units: 'الوحدات', tenants: 'المستأجرون',
  contracts: 'العقود', payments: 'الدفعات', maintenance: 'الصيانة', bookings: 'الحجوزات',
  calendarEvents: 'مواعيد التقويم', cities: 'المدن', attachments: 'المرفقات',
  fileChunks: 'أجزاء الملفات الكبيرة', photos: 'الصور', paymentRequests: 'طلبات الصرف',
  expenses: 'المصاريف', vouchers: 'السندات',
};

export interface FullBackup {
  exportedAt: string;
  version: string;
  summary: Record<string, number>;
  data: Record<string, any[]>;
  settings?: Record<string, any>;
  counters?: Record<string, any>;
}

/** يقرأ كل شي من قاعدة البيانات ويبني ملف النسخة */
export async function buildFullBackup(org: string): Promise<FullBackup> {
  const cols = [...CORE_COLS, ...UPSERT_COLS, ...APPEND_ONLY_COLS];
  const results = await Promise.all(cols.map(c => getAll(org, c).catch(() => null)));
  const failed = cols.filter((_, i) => results[i] === null);
  if (failed.length) {
    // نسخة ناقصة أخطر من عدم وجود نسخة: نوقف ونقول وش اللي ما انقرى
    throw new Error(`ما قدرنا نقرأ: ${failed.map(c => COL_LABELS[c] ?? c).join('، ')}. تأكد من الاتصال وجرّب مرة ثانية.`);
  }
  const data: Record<string, any[]> = {};
  cols.forEach((c, i) => { data[c] = results[i] as any[]; });

  const settings: Record<string, any> = {};
  for (const id of SETTINGS_DOCS) {
    const d = await getOne(org, 'settings', id).catch(() => null);
    if (d) settings[id] = d;
  }
  const counters = await getOne(org, 'counters', 'vouchers').catch(() => null);

  return {
    exportedAt: new Date().toISOString(),
    version: BACKUP_VERSION,
    summary: Object.fromEntries(cols.map(c => [c, data[c].length])),
    data,
    settings,
    counters: counters ? { vouchers: counters } : undefined,
  };
}

/** يستعيد كل شي غير المجموعات الأساسية (اللي يستعيدها importBackup بالاستبدال) */
export async function restoreExtras(org: string, b: Partial<FullBackup>): Promise<{ written: number; errors: string[] }> {
  const errors: string[] = [];
  let written = 0;
  const put = (col: string, id: string, doc: any) =>
    setOne(org, col, id, doc).then(() => { written++; }).catch(e => { errors.push(`${COL_LABELS[col] ?? col}/${id}: ${e?.message ?? e}`); });

  // إضافية: كتابة فوق بدون حذف
  for (const col of UPSERT_COLS) {
    const rows = (b.data?.[col] ?? []).filter((r: any) => r?.id);
    // على دفعات صغيرة: الملفات الكبيرة تاخذ وقت
    for (let i = 0; i < rows.length; i += 20) {
      await Promise.all(rows.slice(i, i + 20).map((r: any) => put(col, String(r.id), r)));
    }
  }

  // المصاريف والسندات: الناقص بس
  for (const col of APPEND_ONLY_COLS) {
    const rows = (b.data?.[col] ?? []).filter((r: any) => r?.id);
    if (!rows.length) continue;
    const existing = new Set((await getAll(org, col).catch(() => [])).map((r: any) => String(r.id)));
    await Promise.all(rows.filter((r: any) => !existing.has(String(r.id))).map((r: any) => put(col, String(r.id), r)));
  }

  // عدّاد السندات: الأكبر من الاثنين لكل نوع
  const bc = b.counters?.vouchers;
  if (bc && typeof bc === 'object') {
    const cur = (await getOne(org, 'counters', 'vouchers').catch(() => null)) as any;
    const merged: Record<string, any> = { ...(cur ?? {}) };
    for (const [k, v] of Object.entries(bc)) {
      if (k === 'id') continue;
      if (typeof v === 'number') merged[k] = Math.max(v, typeof cur?.[k] === 'number' ? cur[k] : 0);
    }
    delete merged.id;
    await put('counters', 'vouchers', merged);
  }

  // الإعدادات (بدون سرّ المساعد)
  for (const id of SETTINGS_DOCS) {
    const s = b.settings?.[id];
    if (s && typeof s === 'object') { const { id: _, ...rest } = s; await put('settings', id, rest); }
  }
  return { written, errors };
}

/** ملخص للعرض: كل مجموعة وعددها */
export function backupContents(b: Partial<FullBackup>): { col: string; label: string; count: number }[] {
  const d = b.data ?? {};
  return Object.keys(COL_LABELS)
    .filter(c => Array.isArray(d[c]))
    .map(c => ({ col: c, label: COL_LABELS[c], count: d[c].length }));
}
