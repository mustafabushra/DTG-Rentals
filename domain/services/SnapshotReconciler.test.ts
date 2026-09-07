import { describe, it, expect } from 'vitest';
import { reconcileSnapshot, isLocallyNewer, writeKey, pruneWrites } from './SnapshotReconciler';

const rec = (id: string, status = 'pending') => ({ id, status });

/**
 * اختبار انحدار للبق الحقيقي: دفعة أُكِّد استلامها كانت تعود "متأخرة" لأن لقطة
 * التحميل (أقدم من التأكيد) تستبدل الحالة المحلية ثم تُكتب إلى قاعدة البيانات.
 */
describe('السباق الذي أعاد الدفعات المؤكَّدة إلى المتأخرات', () => {
  const FETCH_STARTED = 1000;

  it('الدفعة المؤكَّدة أثناء الجلب تبقى مدفوعة', () => {
    const snapshot = [rec('p1', 'overdue'), rec('p2', 'pending'), rec('p3', 'paid')];
    const local    = [rec('p1', 'paid'),    rec('p2', 'pending'), rec('p3', 'paid')];
    const writes   = new Map([[writeKey('payments', 'p1'), 1200]]); // بعد بدء الجلب

    const merged = reconcileSnapshot('payments', snapshot, local, FETCH_STARTED, writes);

    expect(merged.find(p => p.id === 'p1')!.status).toBe('paid');
    expect(merged).toHaveLength(3);
  });

  it('تعديل أقدم من الجلب: قاعدة البيانات هي المرجع', () => {
    const writes = new Map([[writeKey('payments', 'p1'), 500]]);
    const merged = reconcileSnapshot('payments', [rec('p1', 'overdue')], [rec('p1', 'paid')], FETCH_STARTED, writes);
    expect(merged[0].status).toBe('overdue');
  });

  it('بلا تعديلات محلية: اللقطة تُطبَّق كما هي (سلوك ما قبل الإصلاح)', () => {
    const snapshot = [rec('p1', 'overdue'), rec('p2', 'paid')];
    expect(reconcileSnapshot('payments', snapshot, [rec('p1', 'pending')], FETCH_STARTED, new Map()))
      .toEqual(snapshot);
  });
});

describe('الحذف والإضافة أثناء الجلب', () => {
  it('المحذوف محلياً لا يعود من اللقطة', () => {
    const writes = new Map([[writeKey('payments', 'p2'), 1200]]);
    const merged = reconcileSnapshot('payments', [rec('p1'), rec('p2')], [rec('p1')], 1000, writes);
    expect(merged.map(r => r.id)).toEqual(['p1']);
  });

  it('المُضاف محلياً ولم يصل بعد لا يُفقد', () => {
    const writes = new Map([[writeKey('contracts', 'c9'), 1200]]);
    const merged = reconcileSnapshot('contracts', [rec('c1')], [rec('c1'), rec('c9')], 1000, writes);
    expect(merged.map(r => r.id)).toEqual(['c1', 'c9']);
  });

  it('الحذف من جهاز آخر ينعكس ولا يُحيى محلياً', () => {
    const merged = reconcileSnapshot('units', [rec('a')], [rec('a'), rec('b')], 1000, new Map());
    expect(merged.map(r => r.id)).toEqual(['a']);
  });
});

describe('حدود سجل الكتابات المحلية', () => {
  it('كتابة في نفس لحظة بدء الجلب تُرجَّح محلياً (قد لا تشملها اللقطة)', () => {
    const writes = new Map([[writeKey('payments', 'p1'), 1000]]);
    expect(isLocallyNewer(writes, 'payments', 'p1', 1000)).toBe(true);
  });

  it('كتابة على مجموعة أخرى لا تحمي سجلاً بنفس المعرّف', () => {
    const writes = new Map([[writeKey('bookings', 'p1'), 1200]]);
    expect(isLocallyNewer(writes, 'payments', 'p1', 1000)).toBe(false);
  });

  it('سجل بلا كتابة محلية غير محمي', () => {
    expect(isLocallyNewer(new Map(), 'payments', 'p1', 1000)).toBe(false);
  });

  it('التنظيف يحذف القديم فقط فلا ينمو السجل بلا حدود', () => {
    const writes = new Map([['payments/old', 1000], ['payments/new', 900_000]]);
    pruneWrites(writes, 600_000, 1_000_000);
    expect([...writes.keys()]).toEqual(['payments/new']);
  });
});

describe('التوفيق يعمل على كل المجموعات', () => {
  const cols = ['owners', 'properties', 'units', 'contracts', 'tenants',
                'maintenance', 'bookings', 'calendarEvents', 'attachments', 'auditLogs'];

  it.each(cols)('%s: اللقطة تُطبَّق كاملة بلا تعديلات محلية', col => {
    const snapshot = [rec('a'), rec('b')];
    expect(reconcileSnapshot(col, snapshot, [rec('a', 'مختلف')], 1000, new Map())).toEqual(snapshot);
  });
});
