import { describe, it, expect } from 'vitest';
import { ContractScheduleService, type ContractTerms } from './ContractScheduleService';
import type { Payment } from '../../data/mockData';

const TODAY = '2026-09-14';

const terms = (o: Partial<ContractTerms> = {}): ContractTerms => ({
  id: 'c1', startDate: '2026-01-01', endDate: '2026-12-31',
  annualValue: 80000, installmentsCount: 4, ...o,
});

const pay = (o: Partial<Payment> = {}): Payment => ({
  id: 'p1', receiptNumber: 'RCP-1', contractId: 'c1', amount: 20000,
  dueDate: '2026-01-01', status: 'pending', installmentNumber: 1, ...o,
});

const plan = (contract: ContractTerms, payments: Payment[], patch: Partial<ContractTerms>) =>
  ContractScheduleService.planReschedule({ contract, payments, patch, today: TODAY });

describe('التحقق من القيم قبل أي كتابة', () => {
  it('تاريخ معطوب يُرفض', () => {
    const r = plan(terms(), [], { endDate: '2026-13-45' });
    expect(r).toMatchObject({ ok: false, code: 'INVALID_DATES' });
  });
  it('تاريخ غير موجود في التقويم يُرفض (30 فبراير)', () => {
    expect(plan(terms(), [], { endDate: '2026-02-30' })).toMatchObject({ ok: false, code: 'INVALID_DATES' });
  });
  it('النهاية قبل البداية تُرفض', () => {
    expect(plan(terms(), [], { endDate: '2025-12-31' })).toMatchObject({ ok: false, code: 'INVALID_DATES' });
  });
  it('قيمة سنوية صفر أو سالبة أو غير رقمية تُرفض', () => {
    for (const v of [0, -5, NaN]) {
      expect(plan(terms(), [], { annualValue: v })).toMatchObject({ ok: false, code: 'INVALID_VALUE' });
    }
  });
  it('عدد أقساط كسري أو أقل من واحد يُرفض', () => {
    for (const c of [0, -1, 2.5]) {
      expect(plan(terms(), [], { installmentsCount: c })).toMatchObject({ ok: false, code: 'INVALID_COUNT' });
    }
  });
});

describe('السجل التاريخي لا يُحذف ولا يُعاد تأريخه', () => {
  const history = [
    pay({ id: 'paid1',    status: 'paid',    amount: 20000, dueDate: '2026-01-01', installmentNumber: 1 }),
    pay({ id: 'overdue1', status: 'overdue', amount: 20000, dueDate: '2026-04-01', installmentNumber: 2 }),
    pay({ id: 'pend1',    status: 'pending', amount: 20000, dueDate: '2026-07-01', installmentNumber: 3 }),
    pay({ id: 'pend2',    status: 'pending', amount: 20000, dueDate: '2026-10-01', installmentNumber: 4 }),
  ];

  it('الانحدار الأساسي: المتأخر لا يُحذف عند تعديل القيمة', () => {
    const r = plan(terms(), history, { annualValue: 100000 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.removeIds).toEqual(['pend1', 'pend2']);       // المعلّق فقط
    expect(r.removeIds).not.toContain('overdue1');
    expect(r.removeIds).not.toContain('paid1');
  });

  it('المسدَّد والمتأخر يُخصمان من القيمة الجديدة مرة واحدة', () => {
    const r = plan(terms(), history, { annualValue: 100000 });
    if (!r.ok) throw new Error('توقعنا خطة');
    expect(r.preservedInTerm).toBe(40000);                  // 20000 مسدَّد + 20000 متأخر
    expect(r.remainingValue).toBe(60000);
    expect(r.create.reduce((s, i) => s + i.amount, 0)).toBe(60000);
  });

  it('الملغاة (حالة غير معروفة) تُعامَل كسجل محفوظ لا كقابل للحذف', () => {
    const withCancelled = [...history, pay({ id: 'canc', status: 'cancelled' as Payment['status'], amount: 5000, dueDate: '2026-05-01', installmentNumber: 9 })];
    const r = plan(terms(), withCancelled, { annualValue: 100000 });
    if (!r.ok) throw new Error('توقعنا خطة');
    expect(r.removeIds).not.toContain('canc');
    expect(r.preservedInTerm).toBe(45000);
  });

  it('أرقام الأقساط الجديدة تملأ الفجوات ولا تصطدم بالمحفوظة', () => {
    const r = plan(terms(), history, { annualValue: 100000 });
    if (!r.ok) throw new Error('توقعنا خطة');
    expect(r.create.map(i => i.installmentNumber)).toEqual([3, 4]);   // 1 و2 محجوزان
  });

  it('لا يُولَّد قسط بتاريخ ماضٍ', () => {
    const r = plan(terms(), history, { annualValue: 100000 });
    if (!r.ok) throw new Error('توقعنا خطة');
    expect(r.create.every(i => i.dueDate >= TODAY)).toBe(true);
  });
});

describe('رفض التصحيح الغامض أو المستحيل', () => {
  const history = [
    pay({ id: 'paid1',    status: 'paid',    amount: 30000, dueDate: '2026-01-01', installmentNumber: 1 }),
    pay({ id: 'overdue1', status: 'overdue', amount: 30000, dueDate: '2026-04-01', installmentNumber: 2 }),
  ];

  it('قيمة جديدة أقل من الالتزامات المحفوظة تُرفض قبل أي كتابة', () => {
    const r = plan(terms(), history, { annualValue: 50000 });
    expect(r).toMatchObject({ ok: false, code: 'VALUE_BELOW_OBLIGATIONS' });
    if (r.ok) return;
    expect(r.reason).toContain('50,000');
    expect(r.reason).toContain('60,000');
  });

  it('القيمة تساوي الالتزامات تماماً ⇒ لا أقساط جديدة ولا رفض', () => {
    const r = plan(terms(), history, { annualValue: 60000 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.create).toEqual([]);
    expect(r.remainingValue).toBe(0);
  });

  it('عدد أقساط لا يتسع للمتبقي يُرفض', () => {
    const r = plan(terms(), history, { annualValue: 100000, installmentsCount: 2 });
    expect(r).toMatchObject({ ok: false, code: 'NO_ROOM_FOR_REMAINDER' });
  });

  it('تعديل التواريخ الذي يُخرج سجلاً محفوظاً خارج المدة يُرفض', () => {
    const r = plan(terms(), history, { startDate: '2026-06-01', endDate: '2027-05-31' });
    expect(r).toMatchObject({ ok: false, code: 'ORPHANS_HISTORY' });
    if (r.ok) return;
    expect(r.reason).toContain('2026-01-01');
  });

  it('مدة منتهية بالكامل لا تُجدوَل عليها بقية ⇒ رفض لا أقساط في الماضي', () => {
    const past = terms({ startDate: '2025-01-01', endDate: '2025-12-31' });
    const r = ContractScheduleService.planReschedule({
      contract: past, payments: [], patch: { annualValue: 90000 }, today: TODAY });
    expect(r).toMatchObject({ ok: false, code: 'TERM_ENDED' });
  });
});

describe('بعد التجديد: مدفوعات الفترة السابقة لا تُخصم من الفترة الحالية', () => {
  // عقد جُدِّد: فترة 2026 مسدَّدة بالكامل، والفترة الحالية 2027
  const renewed = terms({ startDate: '2027-01-01', endDate: '2027-12-31', annualValue: 80000 });
  const history = [
    pay({ id: 'old1', status: 'paid', amount: 40000, dueDate: '2026-01-01', installmentNumber: 1 }),
    pay({ id: 'old2', status: 'paid', amount: 40000, dueDate: '2026-07-01', installmentNumber: 2 }),
    pay({ id: 'new1', status: 'pending', amount: 40000, dueDate: '2027-01-01', installmentNumber: 3 }),
    pay({ id: 'new2', status: 'pending', amount: 40000, dueDate: '2027-07-01', installmentNumber: 4 }),
  ];

  it('الفترة السابقة تُحسب منفصلة ولا تُخصم', () => {
    const r = ContractScheduleService.planReschedule({
      contract: renewed, payments: history, patch: { annualValue: 90000 }, today: TODAY });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preservedPrior).toBe(80000);    // مدفوعات 2026 محفوظة خارج الحساب
    expect(r.preservedInTerm).toBe(0);
    expect(r.remainingValue).toBe(90000);    // كامل قيمة 2027 لا 10,000
  });

  it('الصيغة القديمة (القيمة − كل المدفوع) كانت ستعطي متبقياً خاطئاً', () => {
    const allPaid = history.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
    expect(90000 - allPaid).toBe(10000);     // الخطأ الذي كان يظهر للمستخدم
    const r = ContractScheduleService.planReschedule({
      contract: renewed, payments: history, patch: { annualValue: 90000 }, today: TODAY });
    if (!r.ok) throw new Error('توقعنا خطة');
    expect(r.remainingValue).not.toBe(10000);
  });

  it('لا يمسّ أقساط الفترة السابقة عند إعادة جدولة الحالية', () => {
    const r = ContractScheduleService.planReschedule({
      contract: renewed, payments: history, patch: { annualValue: 90000 }, today: TODAY });
    if (!r.ok) throw new Error('توقعنا خطة');
    expect(r.removeIds).toEqual(['new1', 'new2']);
  });
});

describe('الالتزامات غير المسدَّدة (المتبقي في شاشة العقد)', () => {
  const payments = [
    pay({ id: 'old1', status: 'paid',    amount: 40000, dueDate: '2026-01-01' }),
    pay({ id: 'new1', status: 'pending', amount: 40000, dueDate: '2027-01-01' }),
    pay({ id: 'new2', status: 'overdue', amount: 40000, dueDate: '2027-07-01' }),
    pay({ id: 'other', contractId: 'c2', status: 'pending', amount: 99999, dueDate: '2027-01-01' }),
  ];

  it('تُحسب من سجل الأقساط الفعلي لا من القيمة ناقص المدفوع', () => {
    expect(ContractScheduleService.unsettledTotal(payments, { contractId: 'c1' })).toBe(80000);
  });

  it('تتجاهل عقوداً أخرى', () => {
    expect(ContractScheduleService.unsettledTotal(payments, { contractId: 'c2' })).toBe(99999);
  });

  it('يمكن حصرها في فترة بعينها', () => {
    expect(ContractScheduleService.unsettledTotal(payments,
      { contractId: 'c1', from: '2027-01-01', to: '2027-12-31' })).toBe(80000);
    expect(ContractScheduleService.unsettledTotal(payments,
      { contractId: 'c1', from: '2026-01-01', to: '2026-12-31' })).toBe(0);
  });
});

describe('ثبات المعرّفات (منع التكرار عند إعادة المحاولة)', () => {
  it('تشغيل الخطة مرتين يُنتج نفس معرّفات الأقساط', () => {
    const a = plan(terms(), [], { annualValue: 80000 });
    const b = plan(terms(), [], { annualValue: 80000 });
    if (!a.ok || !b.ok) throw new Error('توقعنا خطة');
    expect(a.create.map(i => i.id)).toEqual(b.create.map(i => i.id));
  });

  it('المعرّف يحمل الفترة فيختلف بين فترتين', () => {
    const a = plan(terms(), [], { annualValue: 80000 });
    const b = plan(terms({ startDate: '2027-01-01', endDate: '2027-12-31' }), [], { annualValue: 80000 });
    if (!a.ok || !b.ok) throw new Error('توقعنا خطة');
    expect(a.create[0].id).not.toBe(b.create[0].id);
  });
});
