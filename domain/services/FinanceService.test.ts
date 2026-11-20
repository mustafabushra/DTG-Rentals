import { describe, it, expect } from 'vitest';
import {
  numberToArabicWords, amountToArabicWords, formatVoucherNumber, voucherDocId,
  nextAttempt, activeVoucherFor, netByProperty, totalsByCurrency, totalsByCategory,
  mergeCategories, validateExpense, expenseVoucherFieldsChanged, inRange,
} from './FinanceService';
import type { Expense, Voucher } from '../models';

const exp = (o: Partial<Expense> = {}): Expense => ({
  id: 'e1', scope: 'property', propertyId: 'p1', category: 'صيانة', amount: 1000,
  currency: 'SAR', date: '2026-10-05', status: 'active', createdAt: '2026-10-05', ...o,
});
const vch = (o: Partial<Voucher> = {}): Voucher => ({
  id: 'v1', type: 'receipt', number: 'ق-00001', seq: 1, date: '2026-10-05', amount: 100,
  currency: 'SAR', amountInWords: '', partyName: 'x', description: '', status: 'issued',
  issuedBy: 'u', createdAt: '2026-10-05', ...o,
});

describe('numberToArabicWords', () => {
  it.each([
    [0, 'صفر'],
    [1, 'واحد'],
    [11, 'أحد عشر'],
    [12, 'اثنا عشر'],
    [21, 'واحد وعشرون'],
    [100, 'مائة'],
    [250, 'مائتان وخمسون'],
    [1000, 'ألف'],
    [2000, 'ألفان'],
    [3000, 'ثلاثة آلاف'],
    [11000, 'أحد عشر ألف'],
    [5250, 'خمسة آلاف ومائتان وخمسون'],
    [150000, 'مائة وخمسون ألف'],
    [1000000, 'مليون'],
    [2500000, 'مليونان وخمسمائة ألف'],
    [3000001, 'ثلاثة ملايين وواحد'],
  ])('%i → %s', (n, words) => {
    expect(numberToArabicWords(n)).toBe(words);
  });
});

describe('amountToArabicWords', () => {
  it('whole riyals', () => {
    expect(amountToArabicWords(54000, 'SAR')).toBe('فقط أربعة وخمسون ألف ريال سعودي لا غير');
  });
  it('riyals and halalas', () => {
    expect(amountToArabicWords(1500.5, 'SAR')).toBe('فقط ألف وخمسمائة ريال سعودي وخمسون هللة لا غير');
  });
  it('dirhams', () => {
    expect(amountToArabicWords(3, 'AED')).toBe('فقط ثلاثة درهم إماراتي لا غير');
  });
  it('three-decimal currencies', () => {
    expect(amountToArabicWords(1.25, 'KWD')).toBe('فقط واحد دينار كويتي ومائتان وخمسون فلس لا غير');
  });
  it('rounding up a fraction to a whole unit', () => {
    expect(amountToArabicWords(9.999, 'SAR')).toBe('فقط عشرة ريال سعودي لا غير');
  });
  it('unknown currency falls back to SAR', () => {
    expect(amountToArabicWords(5, 'XYZ')).toContain('ريال سعودي');
  });
});

describe('voucher numbering', () => {
  it('pads and prefixes per type', () => {
    expect(formatVoucherNumber('receipt', 7)).toBe('ق-00007');
    expect(formatVoucherNumber('payment', 12345)).toBe('ص-12345');
  });
  it('deterministic doc ids per source and attempt', () => {
    expect(voucherDocId('receipt', 'pay1', 0)).toBe('rv_pay1');
    expect(voucherDocId('payment', 'e9', 2)).toBe('pv_e9_2');
  });
  it('attempt counts previous vouchers of the same source, including cancelled', () => {
    const vs = [vch({ paymentId: 'pay1', status: 'cancelled' }), vch({ id: 'v2', paymentId: 'pay2' })];
    expect(nextAttempt(vs, 'receipt', 'pay1')).toBe(1);
    expect(nextAttempt(vs, 'receipt', 'pay3')).toBe(0);
    expect(nextAttempt(vs, 'payment', 'pay1')).toBe(0);
  });
  it('active voucher ignores cancelled ones', () => {
    const vs = [vch({ paymentId: 'pay1', status: 'cancelled' }), vch({ id: 'v2', paymentId: 'pay1' })];
    expect(activeVoucherFor(vs, 'receipt', 'pay1')?.id).toBe('v2');
    expect(activeVoucherFor([vs[0]], 'receipt', 'pay1')).toBeUndefined();
  });
});

describe('netByProperty', () => {
  const base = {
    payments: [
      { id: 'a', contractId: 'c1', amount: 10000, status: 'paid', paidDate: '2026-10-01' },
      { id: 'b', contractId: 'c1', amount: 5000, status: 'pending' },
      { id: 'c', contractId: 'c1', amount: 2000, status: 'paid', paidDate: '2026-08-01' },
    ],
    contracts: [{ id: 'c1', unitId: 'u1' }],
    units: [{ id: 'u1', propertyId: 'p1' }],
    properties: [{ id: 'p1', name: 'برج', currency: 'AED' }],
    expenses: [
      exp({ amount: 3000 }),
      exp({ id: 'e2', amount: 999, status: 'cancelled' }),
      exp({ id: 'e3', scope: 'office', propertyId: undefined, amount: 500 }),
    ],
  };
  it('subtracts active property expenses from collected income', () => {
    const [r] = netByProperty(base);
    expect(r).toMatchObject({ propertyId: 'p1', currency: 'AED', income: 12000, expenses: 3000, net: 9000 });
  });
  it('respects the date range on both sides', () => {
    const [r] = netByProperty(base, '2026-09-01', '2026-10-31');
    expect(r.income).toBe(10000);
    expect(r.expenses).toBe(3000);
  });
  it('a property with expenses but no income still appears', () => {
    const rows = netByProperty({ ...base, payments: [] });
    expect(rows[0].net).toBe(-3000);
  });
});

describe('totals', () => {
  it('per currency, excluding cancelled', () => {
    expect(totalsByCurrency([exp(), exp({ id: 'x', currency: 'AED', amount: 50 }), exp({ id: 'y', status: 'cancelled' })]))
      .toEqual({ SAR: 1000, AED: 50 });
  });
  it('per category, sorted desc', () => {
    const r = totalsByCategory([exp({ category: 'كهرباء', amount: 10 }), exp({ id: 'z', amount: 900 })]);
    expect(r.map(x => x.category)).toEqual(['صيانة', 'كهرباء']);
  });
});

describe('categories and validation', () => {
  it('merges custom categories, dedupes, keeps أخرى last', () => {
    const c = mergeCategories('property', ['مصعد', 'صيانة', ' ', 'أخرى']);
    expect(c[c.length - 1]).toBe('أخرى');
    expect(c.filter(x => x === 'صيانة')).toHaveLength(1);
    expect(c).toContain('مصعد');
  });
  it('office scope does not require a property', () => {
    expect(validateExpense({ scope: 'office', category: 'رواتب', amount: 10, date: '2026-10-01', currency: 'SAR' })).toEqual({});
  });
  it('flags missing fields', () => {
    const e = validateExpense({ scope: 'property', amount: 0, date: '', currency: '' });
    expect(Object.keys(e).sort()).toEqual(['amount', 'category', 'currency', 'date', 'propertyId']);
  });
  it('detects voucher-relevant edits only', () => {
    const before = exp();
    expect(expenseVoucherFieldsChanged(before, { notes: 'x' })).toBe(false);
    expect(expenseVoucherFieldsChanged(before, { amount: 1000 })).toBe(false);
    expect(expenseVoucherFieldsChanged(before, { amount: 1200 })).toBe(true);
  });
  it('inRange is inclusive and open-ended', () => {
    expect(inRange('2026-10-01', '2026-10-01', '2026-10-01')).toBe(true);
    expect(inRange('2026-10-01T10:00:00Z', undefined, '2026-10-01')).toBe(true);
    expect(inRange(undefined)).toBe(false);
  });
});

describe('netByUnit / ownerShareOf', () => {
  it('sums paid income per unit and unit-level expenses only', async () => {
    const { netByUnit, ownerShareOf } = await import('./FinanceService');
    const m = netByUnit({
      payments: [
        { id: 'p1', contractId: 'c1', amount: 1000, status: 'paid', paidDate: '2026-11-05' },
        { id: 'p2', contractId: 'c1', amount: 500, status: 'pending' },
        { id: 'p3', contractId: 'c2', amount: 300, status: 'paid', paidDate: '2025-01-01' },
      ],
      contracts: [{ id: 'c1', unitId: 'u1' }, { id: 'c2', unitId: 'u2' }],
      units: [{ id: 'u1', propertyId: 'p' }, { id: 'u2', propertyId: 'p' }],
      properties: [{ id: 'p', name: 'x' }],
      expenses: [
        { status: 'active', scope: 'property', propertyId: 'p', unitId: 'u1', amount: 200, date: '2026-11-10' } as any,
        { status: 'active', scope: 'property', propertyId: 'p', amount: 999, date: '2026-11-10' } as any,
      ],
    }, '2026-11-01', '2026-11-30');
    expect(m.get('u1')).toMatchObject({ income: 1000, expenses: 200, net: 800 });
    expect(m.has('u2')).toBe(false);
    expect(ownerShareOf(800, 33.33)).toBe(266.64);
  });
});
