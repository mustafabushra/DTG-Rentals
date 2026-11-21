import { describe, it, expect } from 'vitest';
import { ChequeService } from './ChequeService';

const base = {
  contracts: [{ id: 'c1', tenantId: 't1', unitId: 'u1', currency: 'AED' }],
  tenants: [{ id: 't1', name: 'أحمد' }],
  units: [{ id: 'u1', number: '101', propertyId: 'p1' }],
  properties: [{ id: 'p1', name: 'برج' }],
};
const pay = (id: string, cheque: any, amount = 1000) => ({ id, contractId: 'c1', amount, dueDate: cheque.date, status: 'pending', cheque });

describe('الشيكات', () => {
  it('يرتّب: المرتد ثم الجاهز للإيداع ثم البنك ثم الخزنة', () => {
    const rows = ChequeService.buildRows({ ...base, payments: [
      pay('a', { number: '1', date: '2026-12-30', status: 'held' }),
      pay('b', { number: '2', date: '2026-11-22', status: 'held' }),
      pay('c', { number: '3', date: '2026-11-01', status: 'deposited' }),
      pay('d', { number: '4', date: '2026-10-01', status: 'bounced' }),
    ] }, '2026-11-21');
    expect(rows.map(r => r.paymentId)).toEqual(['d', 'b', 'c', 'a']);
    expect(rows.find(r => r.paymentId === 'b')!.depositDue).toBe(true);
    expect(rows[0].currency).toBe('AED');
  });

  it('ملخص بالعدد والمبلغ', () => {
    const rows = ChequeService.buildRows({ ...base, payments: [
      pay('a', { number: '1', date: '2026-11-20', status: 'held' }, 500),
      pay('b', { number: '2', date: '2026-12-20', status: 'held' }, 700),
    ] }, '2026-11-21');
    const s = ChequeService.summarize(rows);
    expect(s.held).toEqual({ count: 2, total: 1200 });
    expect(s.depositDue).toEqual({ count: 1, total: 500 });
  });

  it('شيكات العقد: أرقام متسلسلة بنفس الأصفار وتواريخ الأقساط', () => {
    const plan = ChequeService.planForContract(
      [{ id: 'p2', dueDate: '2027-04-01' }, { id: 'p1', dueDate: '2027-01-01' }], '000981', 'ENBD', '2026-11-21');
    expect(plan.map(x => [x.paymentId, x.cheque.number, x.cheque.date])).toEqual([
      ['p1', '000981', '2027-01-01'], ['p2', '000982', '2027-04-01'],
    ]);
    expect(plan[0].cheque.status).toBe('held');
  });

  it('رقم بدون أرقام في آخره ⇒ لاحقة تسلسلية', () => {
    const plan = ChequeService.planForContract([{ id: 'x', dueDate: '2027-01-01' }], 'AB', '', '2026-11-21');
    expect(plan[0].cheque.number).toBe('AB-1');
  });

  it('الخطوة الجاية لكل حالة', () => {
    expect(ChequeService.nextActions('held').map(a => a.key)).toEqual(['deposit']);
    expect(ChequeService.nextActions('deposited').map(a => a.key)).toEqual(['clear', 'bounce']);
    expect(ChequeService.nextActions('cleared')).toEqual([]);
  });
});
