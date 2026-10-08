import { describe, it, expect } from 'vitest';
import { planRestore, wipesEverything } from './RestorePlanner';

/**
 * الاستعادة هي العملية الوحيدة في التطبيق القادرة على محو بيانات العمل كلها.
 * فالقرار «ما يُحذف» يُفحَص هنا حالةً حالة — لا يُترك لقراءة بصرية.
 */
const COLS = ['contracts', 'payments'] as const;

describe('ما يُكتب', () => {
  it('كل سجل بمعرّف صالح يُكتب', () => {
    const p = planRestore({
      cols: COLS,
      incoming: { contracts: [{ id: 'c1' }, { id: 'c2' }], payments: [{ id: 'p1' }] },
      existingIds: {},
    });
    expect(p.write.contracts).toHaveLength(2);
    expect(p.write.payments).toHaveLength(1);
    expect(p.counts.write).toBe(3);
  });

  it('المعرّف يُشذَّب من المسافات', () => {
    const p = planRestore({
      cols: ['contracts'], incoming: { contracts: [{ id: '  c1  ' }] },
      existingIds: { contracts: ['c1'] },
    });
    expect(p.write.contracts).toHaveLength(1);
    expect(p.prune.contracts).toEqual([]);   // طُوبِق فلا يُقلَّم
  });

  it('مجموعة غائبة عن الملف تُعالَج كفارغة لا كخطأ', () => {
    const p = planRestore({ cols: COLS, incoming: { contracts: [{ id: 'c1' }] }, existingIds: {} });
    expect(p.write.payments).toEqual([]);
    expect(p.invalid).toEqual([]);
  });
});

describe('السجل بلا معرّف لا يُهمَل صامتاً', () => {
  it('يُحتسب ولا يُكتب', () => {
    const p = planRestore({
      cols: ['contracts'],
      incoming: { contracts: [{ id: 'c1' }, {}, { id: '' }, { id: '   ' }, { id: 5 }, { id: null }] },
      existingIds: {},
    });
    expect(p.write.contracts).toHaveLength(1);
    expect(p.counts.invalid).toBe(5);
    expect(p.invalid).toEqual([{ col: 'contracts', count: 5 }]);
  });

  it('المعرّف الرقمي يُرفض — معرّفات Firestore نصوص', () => {
    const p = planRestore({ cols: ['contracts'], incoming: { contracts: [{ id: 123 }] }, existingIds: {} });
    expect(p.counts.write).toBe(0);
    expect(p.counts.invalid).toBe(1);
  });
});

describe('ما يُقلَّم — القرار الخطير', () => {
  it('الموجود في القاعدة والغائب عن النسخة فقط', () => {
    const p = planRestore({
      cols: ['contracts'],
      incoming:    { contracts: [{ id: 'keep1' }, { id: 'keep2' }] },
      existingIds: { contracts: ['keep1', 'keep2', 'gone1', 'gone2'] },
    });
    expect(p.prune.contracts.sort()).toEqual(['gone1', 'gone2']);
  });

  it('ما في النسخة لا يُقلَّم أبداً — يُكتب فوقه', () => {
    const p = planRestore({
      cols: ['contracts'],
      incoming:    { contracts: [{ id: 'c1' }] },
      existingIds: { contracts: ['c1'] },
    });
    expect(p.prune.contracts).toEqual([]);
    expect(p.write.contracts).toHaveLength(1);
  });

  it('قاعدة فارغة ⇒ لا تقليم مهما كانت النسخة', () => {
    const p = planRestore({
      cols: COLS,
      incoming: { contracts: [{ id: 'c1' }], payments: [{ id: 'p1' }] },
      existingIds: {},
    });
    expect(p.counts.prune).toBe(0);
  });

  it('سجل بلا معرّف في النسخة لا يُنجي سجلاً من التقليم ولا يحذف غيره', () => {
    const p = planRestore({
      cols: ['contracts'],
      incoming:    { contracts: [{}, { id: 'c1' }] },
      existingIds: { contracts: ['c1', 'c2'] },
    });
    expect(p.prune.contracts).toEqual(['c2']);
    expect(p.counts.invalid).toBe(1);
  });

  it('التقليم محصور بمجموعته — لا تسرُّب بين المجموعات', () => {
    const p = planRestore({
      cols: COLS,
      incoming:    { contracts: [{ id: 'x' }], payments: [] },
      existingIds: { contracts: ['x'], payments: ['x'] },
    });
    expect(p.prune.contracts).toEqual([]);
    expect(p.prune.payments).toEqual(['x']);   // 'x' في العقود لا يُنجي 'x' في الدفعات
  });
});

describe('المحو الكامل بثوب استعادة يُكشَف', () => {
  it('ملف فارغ المحتوى مع قاعدة عامرة = محو كامل', () => {
    const p = planRestore({
      cols: COLS,
      incoming:    { contracts: [], payments: [] },
      existingIds: { contracts: ['c1', 'c2'], payments: ['p1'] },
    });
    expect(p.counts.write).toBe(0);
    expect(p.counts.prune).toBe(3);
    expect(wipesEverything(p)).toBe(true);
  });

  it('ملف فيه سجل واحد ليس محواً كاملاً', () => {
    const p = planRestore({
      cols: COLS,
      incoming:    { contracts: [{ id: 'c1' }], payments: [] },
      existingIds: { contracts: ['c1', 'c2'], payments: ['p1'] },
    });
    expect(wipesEverything(p)).toBe(false);
  });

  it('قاعدة فارغة وملف فارغ ليس محواً — لا شيء ليُمحى', () => {
    const p = planRestore({ cols: COLS, incoming: {}, existingIds: {} });
    expect(wipesEverything(p)).toBe(false);
  });
});

describe('المكرَّر داخل النسخة', () => {
  it('يُكتب كلٌّ منه والأخير يفوز — ولا يُحتسب خطأً', () => {
    const p = planRestore({
      cols: ['contracts'],
      incoming:    { contracts: [{ id: 'c1' }, { id: 'c1' }] },
      existingIds: { contracts: ['c1'] },
    });
    expect(p.write.contracts).toHaveLength(2);
    expect(p.counts.invalid).toBe(0);
    expect(p.prune.contracts).toEqual([]);
  });
});
