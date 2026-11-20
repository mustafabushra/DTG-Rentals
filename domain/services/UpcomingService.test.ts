import { describe, it, expect } from 'vitest';
import { buildUpcoming, whenLabel, daysBetween } from './UpcomingService';

const src = {
  properties: [{ id: 'p', name: 'برج', currency: 'AED' }],
  units: [{ id: 'u', number: '301', propertyId: 'p' }],
  tenants: [{ id: 't', name: 'سيونجكي', phone: '0588263130' }],
  contracts: [
    { id: 'c', unitId: 'u', tenantId: 't', endDate: '2026-12-31', status: 'active', annualValue: 120000 },
    { id: 'old', unitId: 'u', tenantId: 't', endDate: '2026-12-10', status: 'expired' },
  ],
  payments: [
    { id: 'a', contractId: 'c', amount: 10000, dueDate: '2026-12-31', status: 'pending' },
    { id: 'b', contractId: 'c', amount: 10000, dueDate: '2026-11-25', status: 'paid' },
    { id: 'x', contractId: 'c', amount: 10000, dueDate: '2027-03-01', status: 'pending' },
  ],
  attachments: [{ id: 'f', name: 'رخصة', entityType: 'property', entityId: 'p', expiryDate: '2026-12-01' }],
  calendarEvents: [{ id: 'e', title: 'زيارة', date: '2026-11-30' }],
};

describe('upcoming events', () => {
  const ev = buildUpcoming(src, { today: '2026-11-20', days: 60 });
  it('includes rent, contract end, document and calendar within 60 days only', () => {
    expect(ev.map(e => e.id)).toEqual(['e-e', 'd-f', 'c-c', 'r-a']);
  });
  it('contract end sorts before rent on the same day and carries tenant/currency', () => {
    expect(ev[2]).toMatchObject({ kind: 'contract_end', currency: 'AED', tenantPhone: '0588263130', daysLeft: 41 });
    expect(ev[3].route).toBe('/payment/a');
  });
  it('labels', () => {
    expect(daysBetween('2026-11-20', '2026-11-21')).toBe(1);
    expect(whenLabel(0)).toBe('اليوم');
    expect(whenLabel(1)).toBe('بكرة');
    expect(whenLabel(5)).toBe('بعد 5 أيام');
    expect(whenLabel(15)).toBe('بعد أسبوعين');
    expect(whenLabel(35)).toBe('بعد شهر');
    expect(whenLabel(46)).toBe('بعد شهر ونص');
  });
});
