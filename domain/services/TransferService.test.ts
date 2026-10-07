import { describe, it, expect } from 'vitest';
import { computeCredit, planTransfer, type TransferContract } from './TransferService';
import type { Payment } from '../../data/mockData';

const contract = (o: Partial<TransferContract> = {}): TransferContract => ({
  id: 'c1', contractNumber: 'CNT-2026-007992', tenantId: 't1', unitId: 'u-down',
  startDate: '2026-01-01', endDate: '2026-12-31',
  annualValue: 65000, installmentsCount: 1, ...o,
});
const pay = (o: Partial<Payment> = {}): Payment => ({
  id: 'p1', receiptNumber: 'R1', contractId: 'c1', amount: 65000,
  dueDate: '2026-01-01', status: 'paid', installmentNumber: 1, ...o,
});

const planArgs = (o: any = {}) => ({
  contract: contract(),
  payments: [pay()],
  transferDate: '2026-03-01',
  newUnitId: 'u-up',
  newAnnualValue: 100000,
  newInstallmentsCount: 4,
  newStartDate: '2026-03-01',
  newEndDate: '2027-02-28',
  ...o,
});

describe('حساب الرصيد بالأيام', () => {
  it('حالة د. أسامة: دفع 65,000 وانتقل بعد شهرين', () => {
    const b = computeCredit(contract(), [pay()], '2026-03-01')!;
    expect(b.termDays).toBe(365);
    expect(b.consumedDays).toBe(59);          // يناير 31 + فبراير 28
    expect(b.remainingDays).toBe(306);
    expect(b.consumedAmount).toBe(10507);     // 65000 × 59/365
    expect(b.credit).toBe(54493);             // المدفوع − المستهلك
  });

  it('النقل في اليوم الأول ⇒ الرصيد كامل المدفوع', () => {
    const b = computeCredit(contract(), [pay()], '2026-01-01')!;
    expect(b.consumedDays).toBe(0);
    expect(b.credit).toBe(65000);
  });

  it('النقل بعد انتهاء المدة ⇒ لا رصيد', () => {
    const b = computeCredit(contract(), [pay()], '2027-06-01')!;
    expect(b.consumedDays).toBe(365);
    expect(b.credit).toBe(0);
  });

  it('من لم يسدّد لا رصيد له', () => {
    const b = computeCredit(contract(), [pay({ status: 'pending' })], '2026-03-01')!;
    expect(b.paidTotal).toBe(0);
    expect(b.credit).toBe(0);
  });

  it('المتأخرات تُعرَض منفصلة ولا تُقاصّ تلقائياً', () => {
    const b = computeCredit(contract(), [pay(), pay({ id: 'p2', status: 'overdue', amount: 5000 })], '2026-03-01')!;
    expect(b.arrears).toBe(5000);
    expect(b.credit).toBe(54493);             // لم يُخصم منه المتأخر
  });

  it('تواريخ معطوبة ⇒ null لا أرقام عشوائية', () => {
    expect(computeCredit(contract({ startDate: 'xx' }), [], '2026-03-01')).toBeNull();
    expect(computeCredit(contract(), [], '2026-02-30')).toBeNull();
  });
});

describe('تخطيط النقل', () => {
  it('يحسب المستحق الصافي بعد خصم الرصيد', () => {
    const r = planTransfer(planArgs());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.credit).toBe(54493);
    expect(r.newAnnualValue).toBe(100000);    // القيمة التعاقدية تبقى كما هي
    expect(r.netDue).toBe(45507);             // ما يدفعه فعلاً
  });

  it('الرصيد المعدَّل يدوياً يُعتمد بدل المحسوب', () => {
    const r = planTransfer(planArgs({ creditOverride: 54160 }));
    if (!r.ok) throw new Error('توقعنا خطة');
    expect(r.credit).toBe(54160);
    expect(r.netDue).toBe(45840);             // الرقم المتفق عليه فعلاً
  });

  it('أقساط العقد القديم المعلّقة تُلغى — لا تتحول إلى متأخر كاذب', () => {
    const r = planTransfer(planArgs({
      payments: [pay(), pay({ id: 'future1', status: 'pending', dueDate: '2026-07-01' })],
    }));
    if (!r.ok) throw new Error('توقعنا خطة');
    expect(r.cancelIds).toEqual(['future1']);
  });

  it('المتأخر لا يُلغى — دَين واقع لا يمحوه النقل', () => {
    const r = planTransfer(planArgs({
      payments: [pay(), pay({ id: 'late1', status: 'overdue', dueDate: '2026-02-01' })],
    }));
    if (!r.ok) throw new Error('توقعنا خطة');
    expect(r.cancelIds).not.toContain('late1');
  });
});

describe('الرفض قبل أي كتابة', () => {
  it('نفس الوحدة', () => {
    expect(planTransfer(planArgs({ newUnitId: 'u-down' }))).toMatchObject({ ok: false, code: 'SAME_UNIT' });
  });
  it('رصيد أكبر من قيمة العقد الجديد', () => {
    const r = planTransfer(planArgs({ newAnnualValue: 40000 }));
    expect(r).toMatchObject({ ok: false, code: 'CREDIT_EXCEEDS_VALUE' });
    if (r.ok) return;
    expect(r.reason).toContain('54,493');
  });
  it('رصيد معدَّل سالب', () => {
    expect(planTransfer(planArgs({ creditOverride: -1 }))).toMatchObject({ ok: false, code: 'CREDIT_INVALID' });
  });
  it('قيمة أو عدد أقساط غير صالح', () => {
    expect(planTransfer(planArgs({ newAnnualValue: 0 }))).toMatchObject({ ok: false, code: 'BAD_VALUE' });
    expect(planTransfer(planArgs({ newInstallmentsCount: 1.5 }))).toMatchObject({ ok: false, code: 'BAD_COUNT' });
  });
  it('نهاية قبل بداية أو تاريخ معطوب', () => {
    expect(planTransfer(planArgs({ newEndDate: '2026-01-01' }))).toMatchObject({ ok: false, code: 'BAD_DATES' });
    expect(planTransfer(planArgs({ transferDate: 'xx' }))).toMatchObject({ ok: false, code: 'BAD_DATES' });
  });
  it('رصيد يساوي القيمة تماماً مقبول (لا مستحق)', () => {
    const r = planTransfer(planArgs({ creditOverride: 100000 }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.netDue).toBe(0);
  });
});
