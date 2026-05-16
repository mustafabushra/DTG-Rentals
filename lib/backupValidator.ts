/**
 * Backup validation + auto-repair engine.
 * Works on raw strings before JSON.parse so we can recover malformed files.
 */

export interface BackupPayload {
  exportedAt: string;
  version:    string;
  summary:    Record<string, number>;
  data: {
    owners:      any[];
    properties:  any[];
    units:       any[];
    tenants:     any[];
    contracts:   any[];
    payments:    any[];
    maintenance: any[];
  };
}

export type ValidationStatus = 'valid' | 'warning' | 'error' | 'idle';

export interface ValidationResult {
  status:   ValidationStatus;
  parsed:   BackupPayload | null;
  errors:   string[];
  warnings: string[];
  repaired: boolean;
  counts:   Record<string, number>;
}

const REQUIRED_COLLECTIONS = [
  'owners', 'properties', 'units', 'tenants', 'contracts', 'payments', 'maintenance',
] as const;

// ── Auto-repair: fix common JSON corruption ───────────────────────────────────
export function attemptRepair(raw: string): { text: string; fixes: string[] } {
  const fixes: string[] = [];
  let text = raw;

  // Strip UTF-8 BOM
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
    fixes.push('إزالة BOM character');
  }

  // Normalize smart/curly quotes to straight quotes
  const before = text;
  text = text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
  if (text !== before) fixes.push('تحويل الأقواس الذكية إلى أقواس عادية');

  // Remove trailing commas before ] or }
  const noTrailing = text.replace(/,\s*([\]}])/g, '$1');
  if (noTrailing !== text) {
    text = noTrailing;
    fixes.push('إصلاح الفواصل الزائدة');
  }

  // Fix unquoted keys (simple cases): word: → "word":
  const fixedKeys = text.replace(/([{,]\s*)([a-zA-Z_]\w*)(\s*:)/g, '$1"$2"$3');
  if (fixedKeys !== text) {
    text = fixedKeys;
    fixes.push('إصلاح مفاتيح JSON غير محاطة بأقواس');
  }

  // Balance brackets — count and append missing
  const opens  = (text.match(/\{/g) ?? []).length;
  const closes = (text.match(/\}/g) ?? []).length;
  if (opens > closes) {
    text += '}'.repeat(opens - closes);
    fixes.push(`إضافة ${opens - closes} قوس إغلاق مفقود`);
  }
  const arrOpens  = (text.match(/\[/g) ?? []).length;
  const arrCloses = (text.match(/\]/g) ?? []).length;
  if (arrOpens > arrCloses) {
    text += ']'.repeat(arrOpens - arrCloses);
    fixes.push(`إضافة ${arrOpens - arrCloses} قوس مصفوفة مفقود`);
  }

  return { text, fixes };
}

// ── Schema validation ─────────────────────────────────────────────────────────
export function validateBackup(raw: string): ValidationResult {
  const result: ValidationResult = {
    status:   'error',
    parsed:   null,
    errors:   [],
    warnings: [],
    repaired: false,
    counts:   {},
  };

  if (!raw.trim()) {
    result.errors.push('لا يوجد محتوى للتحقق منه');
    return result;
  }

  // Step 1: try direct parse
  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch (e1) {
    // Step 2: attempt repair
    const { text: repaired, fixes } = attemptRepair(raw);
    try {
      parsed = JSON.parse(repaired);
      result.repaired = true;
      result.warnings.push(`تم إصلاح المشاكل التالية تلقائياً: ${fixes.join('، ')}`);
    } catch {
      result.errors.push('تعذّر قراءة ملف JSON — التنسيق خاطئ تماماً');
      result.errors.push(`تفاصيل الخطأ: ${(e1 as Error).message}`);
      return result;
    }
  }

  // Step 3: top-level structure
  if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
    result.errors.push('الملف لا يحتوي على كائن JSON صالح في المستوى الأعلى');
    return result;
  }

  // Version
  if (!parsed.version) {
    result.warnings.push('حقل version غير موجود — سيتم المتابعة');
  } else if (parsed.version !== '1.0') {
    result.warnings.push(`إصدار الملف: ${parsed.version} — قد تكون هناك اختلافات طفيفة في البنية`);
  }

  // exportedAt
  if (!parsed.exportedAt) {
    result.warnings.push('تاريخ التصدير غير موجود');
  }

  // data object
  if (!parsed.data || typeof parsed.data !== 'object') {
    // Maybe the backup IS the data object directly (user pasted data node)
    const keys = Object.keys(parsed);
    const hasCollections = REQUIRED_COLLECTIONS.some(c => Array.isArray(parsed[c]));
    if (hasCollections) {
      parsed = { exportedAt: new Date().toISOString(), version: '1.0', summary: {}, data: parsed };
      result.warnings.push('تم التعرف على نسخة من نوع "data مباشر" — تم تعديل الهيكل تلقائياً');
    } else {
      result.errors.push('حقل "data" مفقود أو غير صالح');
      return result;
    }
  }

  // Validate each collection
  const missingCols: string[] = [];
  const emptyCols:   string[] = [];

  for (const col of REQUIRED_COLLECTIONS) {
    const arr = parsed.data[col];
    if (arr === undefined || arr === null) {
      missingCols.push(col);
      parsed.data[col] = []; // graceful: default to empty
    } else if (!Array.isArray(arr)) {
      result.errors.push(`حقل "${col}" يجب أن يكون مصفوفة — القيمة الحالية: ${typeof arr}`);
    } else {
      result.counts[col] = arr.length;
      if (arr.length === 0) emptyCols.push(col);
      // Spot-check: items should have id
      const missingId = arr.filter((item: any) => !item?.id).length;
      if (missingId > 0) {
        result.warnings.push(`${col}: ${missingId} سجل بدون معرّف id — سيتم تجاوزها`);
      }
    }
  }

  if (missingCols.length > 0) {
    result.warnings.push(`حقول مفقودة (ستُعامَل كفارغة): ${missingCols.join('، ')}`);
  }
  if (emptyCols.length === REQUIRED_COLLECTIONS.length) {
    result.warnings.push('جميع المجموعات فارغة — هل هذا النسخ الاحتياطي الصحيح؟');
  }

  const totalRecords = Object.values(result.counts).reduce((a, b) => a + b, 0);
  if (totalRecords === 0) {
    result.warnings.push('الملف صالح لكن لا يحتوي على أي بيانات');
  }

  result.parsed = parsed as BackupPayload;
  result.status = result.errors.length > 0 ? 'error'
    : result.warnings.length > 0           ? 'warning'
    : 'valid';

  return result;
}

// ── Diff: current vs incoming ─────────────────────────────────────────────────
export interface DiffSummary {
  col:     string;
  label:   string;
  current: number;
  incoming: number;
  delta:   number;
}

const LABELS: Record<string, string> = {
  owners:      'الملاك',
  properties:  'العقارات',
  units:       'الوحدات',
  tenants:     'المستأجرون',
  contracts:   'العقود',
  payments:    'الدفعات',
  maintenance: 'الصيانة',
};

export function buildDiff(
  current:  Record<string, any[]>,
  incoming: BackupPayload,
): DiffSummary[] {
  return REQUIRED_COLLECTIONS.map(col => {
    const cur = current[col]?.length ?? 0;
    const inc = incoming.data[col]?.length ?? 0;
    return { col, label: LABELS[col] ?? col, current: cur, incoming: inc, delta: inc - cur };
  });
}
