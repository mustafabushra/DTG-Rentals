import { describe, it, expect } from 'vitest';
import { validateBackup, attemptRepair, buildDiff } from './backupValidator';

/**
 * هذا الحارس يقف بين ملفٍ معطوب واستعادةٍ تُقلّم كل سجل غائب عن الملف.
 * فكل حالة هنا تمثّل ملفاً واقعياً: مقطوعاً، أو بفواصل زائدة، أو مكتوباً
 * بأقواس ذكية من محرّر نصوص.
 */
const COLS = ['owners', 'properties', 'units', 'tenants', 'contracts', 'payments', 'maintenance'] as const;

const file = (data: Partial<Record<string, unknown[]>>, opts: { summary?: Record<string, number> | null } = {}) => {
  const full = Object.fromEntries(COLS.map(c => [c, data[c] ?? []]));
  const summary = opts.summary === undefined
    ? Object.fromEntries(COLS.map(c => [c, (data[c] ?? []).length]))
    : opts.summary;
  return JSON.stringify({
    exportedAt: '2026-10-07T00:00:00.000Z',
    version: '1.0',
    ...(summary ? { summary } : {}),
    data: full,
  });
};

describe('فحص السلامة: الملف الناقص يُرفض لا يُحذَّر منه', () => {
  it('عدد مقروء أقل من المُعلَن ⇒ خطأ', () => {
    const raw = JSON.stringify({
      exportedAt: '2026-10-07', version: '1.0',
      summary: { contracts: 500 },
      data: Object.fromEntries(COLS.map(c => [c, c === 'contracts' ? [{ id: 'c1' }] : []])),
    });
    const r = validateBackup(raw);
    expect(r.status).toBe('error');
    expect(r.errors.join(' ')).toContain('ناقص أو معطوب');
    expect(r.errors.join(' ')).toContain('المُعلَن 500');
  });

  it('ملف مقطوع ثم مُصلَح بموازنة الأقواس لا يمرّ', () => {
    // ملف صُدِّر بعقدين ثم انقطع بعد الأول
    const truncated = '{"exportedAt":"2026-10-07","version":"1.0","summary":{"contracts":2},'
      + '"data":{"contracts":[{"id":"c1"}';
    // ملاحطة موثّقة: attemptRepair يُلحق المجعّدة قبل المربّعة، فالناتج من ملف
    // مقطوع غالباً غير صالح فيُرفض كتنسيق معطوب. وهذا مطلوب: إصلاحه ليُنتج
    // JSON صالحاً سيمرّر ملفات ناقصة إلى مرحلة أخطر. المهمّ أنه **لا يمرّ**.
    const r = validateBackup(truncated);
    expect(r.status).toBe('error');
    expect(r.parsed).toBeNull();
  });

  it('الأعداد المطابقة تمرّ', () => {
    const r = validateBackup(file({ contracts: [{ id: 'c1' }, { id: 'c2' }] }));
    expect(r.status).not.toBe('error');
    expect(r.counts.contracts).toBe(2);
  });

  it('زيادة غير معلَنة تُرفض أيضاً — دليل تلاعب أو دمج خاطئ', () => {
    const raw = JSON.stringify({
      exportedAt: '2026-10-07', version: '1.0',
      summary: { contracts: 1 },
      data: Object.fromEntries(COLS.map(c => [c, c === 'contracts' ? [{ id: 'a' }, { id: 'b' }] : []])),
    });
    expect(validateBackup(raw).status).toBe('error');
  });

  it('ملف بلا summary يُحذَّر منه ولا يُرفض — نسخ قديمة', () => {
    const r = validateBackup(file({ contracts: [{ id: 'c1' }] }, { summary: null }));
    expect(r.status).toBe('warning');
    expect(r.warnings.join(' ')).toContain('بلا summary');
  });

  it('حقل غير رقمي في summary يُتجاوَز لا يُفسد الفحص', () => {
    const raw = JSON.stringify({
      exportedAt: '2026-10-07', version: '1.0',
      summary: { contracts: 'كثير' },
      data: Object.fromEntries(COLS.map(c => [c, c === 'contracts' ? [{ id: 'a' }] : []])),
    });
    expect(validateBackup(raw).status).not.toBe('error');
  });
});

describe('الإصلاح التلقائي', () => {
  it('يزيل BOM', () => {
    const { text, fixes } = attemptRepair('﻿{"a":1}');
    expect(text.charCodeAt(0)).not.toBe(0xFEFF);
    expect(fixes.join(' ')).toContain('BOM');
  });

  it('يحوّل الأقواس الذكية', () => {
    const { fixes } = attemptRepair('{“a”:1}');
    expect(fixes.join(' ')).toContain('الذكية');
  });

  it('يحذف الفواصل الزائدة', () => {
    const { text } = attemptRepair('{"a":[1,2,],}');
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it('يحيط المفاتيح غير المحاطة', () => {
    const { text } = attemptRepair('{a:1,b:2}');
    expect(JSON.parse(text)).toEqual({ a: 1, b: 2 });
  });

  it('يُلحق أقواساً ناقصة لكن بترتيب لا يُنقذ ملفاً مقطوعاً', () => {
    const { text, fixes } = attemptRepair('{"data":{"contracts":[{"id":"c1"}');
    expect(fixes.join(' ')).toMatch(/مفقود/);
    // يُلحق } قبل ] فيُنتج ترتيباً خاطئاً. موثّق هنا لأنّ النتيجة مرغوبة:
    // الملف المقطوع يُرفض بدل أن يُستعاد منه ناقصاً.
    expect(() => JSON.parse(text)).toThrow();
  });

  it('ملفاً سليماً لا يُغيّره', () => {
    const clean = '{"a":1}';
    const { text, fixes } = attemptRepair(clean);
    expect(text).toBe(clean);
    expect(fixes).toEqual([]);
  });
});

describe('الرفض قبل أي شيء', () => {
  it('محتوى فارغ', () => {
    expect(validateBackup('   ').status).toBe('error');
  });
  it('نصّ ليس JSON إطلاقاً', () => {
    expect(validateBackup('هذا ليس ملف نسخة').status).toBe('error');
  });
  it('مصفوفة في المستوى الأعلى', () => {
    expect(validateBackup('[1,2,3]').status).toBe('error');
  });
  it('حقل data مفقود ولا مجموعات', () => {
    expect(validateBackup('{"version":"1.0"}').status).toBe('error');
  });
  it('مجموعة ليست مصفوفة', () => {
    const raw = JSON.stringify({ version: '1.0', summary: {}, data: { ...Object.fromEntries(COLS.map(c => [c, []])), contracts: 'نص' } });
    expect(validateBackup(raw).status).toBe('error');
  });
});

describe('النسخة من نوع data مباشر', () => {
  it('تُقبَل ويُعاد تشكيلها', () => {
    const raw = JSON.stringify(Object.fromEntries(COLS.map(c => [c, c === 'contracts' ? [{ id: 'c1' }] : []])));
    const r = validateBackup(raw);
    expect(r.status).not.toBe('error');
    expect(r.parsed?.data.contracts).toHaveLength(1);
    expect(r.warnings.join(' ')).toContain('data مباشر');
  });
});

describe('السجل بلا معرّف يُعلَن عنه', () => {
  it('يُحتسب في التحذيرات', () => {
    const raw = JSON.stringify({
      exportedAt: '2026-10-07', version: '1.0',
      summary: { contracts: 2 },
      data: Object.fromEntries(COLS.map(c => [c, c === 'contracts' ? [{ id: 'c1' }, { name: 'بلا معرّف' }] : []])),
    });
    const r = validateBackup(raw);
    expect(r.warnings.join(' ')).toContain('بدون معرّف');
  });
});

describe('الفرق المعروض قبل الموافقة', () => {
  it('يحسب الوارد والحالي لكل مجموعة', () => {
    const current = { contracts: [{ id: 'a' }], payments: [] } as any;
    const incoming = {
      exportedAt: '', version: '1.0', summary: {},
      data: { owners: [], properties: [], units: [], tenants: [], contracts: [{ id: 'a' }, { id: 'b' }], payments: [], maintenance: [] },
    } as any;
    const diff = buildDiff(current, incoming);
    const contracts = diff.find(d => d.col === 'contracts');
    expect(contracts).toBeTruthy();
    expect(contracts!.incoming).toBe(2);
  });
});
