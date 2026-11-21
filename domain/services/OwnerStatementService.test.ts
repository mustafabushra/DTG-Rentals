import { describe, it, expect } from 'vitest';
import { buildOwnerStatement, statementMessage } from './OwnerStatementService';

const src = {
  properties: [{ id: 'p1', name: 'برج', currency: 'SAR' }, { id: 'p2', name: 'فيلا', currency: 'AED' }, { id: 'p3', name: 'غيره' }],
  units: [{ id: 'u1', propertyId: 'p1', number: '1' }, { id: 'u2', propertyId: 'p2', number: '2' }, { id: 'u3', propertyId: 'p3' }],
  contracts: [{ id: 'c1', unitId: 'u1', tenantId: 't1' }, { id: 'c2', unitId: 'u2', tenantId: 't1', currency: 'AED' }, { id: 'c3', unitId: 'u3', tenantId: 't1' }],
  tenants: [{ id: 't1', name: 'أحمد' }],
  payments: [
    { id: 'a', contractId: 'c1', amount: 1000, status: 'paid', paidDate: '2026-10-05', dueDate: '2026-10-01' },
    { id: 'b', contractId: 'c2', amount: 500, status: 'paid', paidDate: '2026-10-07', dueDate: '2026-10-01' },
    { id: 'c', contractId: 'c1', amount: 900, status: 'overdue', dueDate: '2026-09-01' },
    { id: 'd', contractId: 'c1', amount: 1000, status: 'paid', paidDate: '2026-08-05', dueDate: '2026-08-01' },
    { id: 'e', contractId: 'c3', amount: 7777, status: 'paid', paidDate: '2026-10-05', dueDate: '2026-10-01' },
  ],
  expenses: [
    { id: 'x', scope: 'property', propertyId: 'p1', category: 'صيانة', amount: 200, currency: 'SAR', date: '2026-10-10', status: 'active' },
    { id: 'y', scope: 'property', propertyId: 'p1', category: 'ملغي', amount: 999, currency: 'SAR', date: '2026-10-10', status: 'cancelled' },
  ],
};

describe('كشف المالك', () => {
  const s = buildOwnerStatement(src, { propertyIds: ['p1', 'p2'], from: '2026-10-01', to: '2026-10-31', today: '2026-11-21' });
  it('يحسب لكل عملة بدون خلط، ويستبعد عقارات غيره والملغي', () => {
    expect(s.totals.find(t => t.currency === 'SAR')).toEqual({ currency: 'SAR', income: 1000, expenses: 200, net: 800, overdue: 900 });
    expect(s.totals.find(t => t.currency === 'AED')!.income).toBe(500);
    expect(s.income).toHaveLength(2);
  });
  it('المتأخرات للعلم ولا تدخل الصافي', () => {
    expect(s.overdue).toHaveLength(1);
    expect(s.properties.find(p => p.propertyId === 'p1')!.net).toBe(800);
  });
  it('المستفيد من وحدة في عقار غيره: إيجارها له، ومصروف العقار العام لا', () => {
    const b = buildOwnerStatement(src, { unitIds: ['u3'], propertyIds: [], from: '2026-10-01', to: '2026-10-31', today: '2026-11-21' });
    expect(b.income.map(l => l.amount)).toEqual([7777]);
    expect(b.expenses).toHaveLength(0);
  });

  it('رسالة الواتساب فيها الصافي', () => {
    const m = statementMessage('خالد', 'أكتوبر', s, (n, c) => `${n} ${c}`);
    expect(m).toContain('الصافي لك: 800 SAR');
  });
});
