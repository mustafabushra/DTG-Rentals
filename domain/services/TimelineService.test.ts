import { describe, it, expect } from 'vitest';
import { buildOwnerTimeline, groupTimeline, ownerUnitIds } from './TimelineService';

const src = {
  properties: [{ id: 'p1', name: 'برج', ownerId: 'o1', currency: 'SAR' }, { id: 'p2', name: 'فيلا', ownerId: 'o2' }],
  units: [{ id: 'u1', number: '101', propertyId: 'p1' }, { id: 'u2', number: '1', propertyId: 'p2' }, { id: 'u3', number: '301', propertyId: 'p2', ownerId: 'o1' }],
  tenants: [{ id: 't1', name: 'محمد' }, { id: 't2', name: 'سعد' }],
  contracts: [
    { id: 'c1', unitId: 'u1', tenantId: 't1', startDate: '2026-01-01', endDate: '2026-12-10', status: 'active' },
    { id: 'c2', unitId: 'u2', tenantId: 't2', startDate: '2026-01-01', endDate: '2026-12-31', status: 'active' },
  ],
  payments: [
    { id: 'a', contractId: 'c1', amount: 1000, dueDate: '2026-10-01', paidDate: '2026-10-03', status: 'paid' },
    { id: 'b', contractId: 'c1', amount: 1000, dueDate: '2026-11-01', status: 'pending' },
    { id: 'c', contractId: 'c1', amount: 1000, dueDate: '2026-12-01', status: 'pending' },
    { id: 'd', contractId: 'c1', amount: 1000, dueDate: '2027-06-01', status: 'pending' },
    { id: 'e', contractId: 'c2', amount: 9, dueDate: '2026-10-01', paidDate: '2026-10-01', status: 'paid' },
  ],
  maintenance: [{ id: 'm', unitId: 'u1', propertyId: 'p1', title: 'تسريب', openedAt: '2026-09-01', closedAt: '2026-09-05', status: 'completed', cost: 300 }],
  expenses: [
    { id: 'x', propertyId: 'p1', scope: 'property', status: 'active', date: '2026-08-01', amount: 50, currency: 'SAR', category: 'كهرباء' },
    { id: 'y', propertyId: 'p2', scope: 'property', status: 'active', date: '2026-08-01', amount: 70, currency: 'SAR' },
  ],
};

describe('owner timeline', () => {
  const ev = buildOwnerTimeline(src, { ownerId: 'o1', today: '2026-11-20' });
  it('scopes to the owner (own property + units owned inside others)', () => {
    expect([...ownerUnitIds(src, 'o1')].sort()).toEqual(['u1', 'u3']);
    expect(ev.some(e => e.id === 'pp-e')).toBe(false);       // دفعة عقار مالك آخر
    expect(ev.some(e => e.id === 'ex-y')).toBe(false);       // مصروف عقار مالك آخر
    expect(ev.some(e => e.id === 'ex-x')).toBe(true);
  });
  it('classifies payments and contracts', () => {
    expect(ev.find(e => e.id === 'pp-a')?.kind).toBe('payment_paid');
    expect(ev.find(e => e.id === 'po-b')?.kind).toBe('payment_overdue');
    expect(ev.find(e => e.id === 'pd-c')).toMatchObject({ kind: 'payment_due', upcoming: true });
    expect(ev.some(e => e.id === 'pd-d')).toBe(false);       // أبعد من 30 يوماً
    expect(ev.find(e => e.id === 'ce-c1')?.kind).toBe('contract_ending');
  });
  it('orders upcoming first (soonest), then past newest first, grouped by month', () => {
    expect(ev[0].upcoming).toBe(true);
    const past = ev.filter(e => !e.upcoming).map(e => e.date);
    expect([...past].sort().reverse()).toEqual(past);
    const g = groupTimeline(ev);
    expect(g[0].title).toBe('قادم');
    expect(g[1].title).toBe('نوفمبر 2026');
  });
});
