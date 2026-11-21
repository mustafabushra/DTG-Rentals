import { describe, it, expect } from 'vitest';
import { ownerOfEntity, tenantOwnerIds, planStamps } from './OwnerStamps';

const src = {
  properties: [{ id: 'p1', ownerId: 'oA' }, { id: 'p2', ownerId: 'oB' }],
  units: [{ id: 'u1', propertyId: 'p1' }, { id: 'u2', propertyId: 'p1', ownerId: 'oC' }, { id: 'u3', propertyId: 'p2' }],
  contracts: [{ id: 'c1', unitId: 'u1', tenantId: 't1' }, { id: 'c2', unitId: 'u3', tenantId: 't1' }, { id: 'c3', unitId: 'u2', tenantId: 't2' }],
  payments: [{ id: 'pay1', contractId: 'c3' }],
  maintenance: [],
};

describe('ختم المالك', () => {
  it('الوحدة اللي لها مستفيد تروح له، مو لمالك العقار', () => {
    expect(ownerOfEntity(src, 'unit', 'u2')).toBe('oC');
    expect(ownerOfEntity(src, 'unit', 'u1')).toBe('oA');
    expect(ownerOfEntity(src, 'payment', 'pay1')).toBe('oC');
  });
  it('المستأجر عند مالكين = الاثنين', () => {
    expect(tenantOwnerIds(src, 't1')).toEqual(['oA', 'oB']);
  });
  it('الخطة تكتب الناقص بس', () => {
    const plan = planStamps({ ...src,
      tenants: [{ id: 't1', ownerIds: ['oB', 'oA'] }, { id: 't2' }],
      attachments: [{ id: 'a1', entityType: 'unit', entityId: 'u2' }, { id: 'a2', entityType: 'unit', entityId: 'u1', ownerId: 'oA' },
        { id: 'a3', entityType: 'unit', entityId: 'u1', ownerId: 'oA', chunks: 2 }],
      photos: [{ id: 'ph', entityType: 'property', entityId: 'p2' }],
    });
    expect(plan.tenants).toEqual([{ id: 't2', ownerIds: ['oC'] }]);
    expect(plan.attachments.map(a => a.id)).toEqual(['a1', 'a3']);
    expect(plan.photos).toEqual([{ id: 'ph', ownerId: 'oB' }]);
  });
});
