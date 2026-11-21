/**
 * ختم المالك على المستندات المشتركة (مرفقات، صور، مستأجرين) — عشان قواعد قاعدة البيانات
 * تعطي كل مالك اللي له بس. دوال نقية مختبرة.
 */
type U = { id: string; propertyId: string; ownerId?: string };
type P = { id: string; ownerId?: string };
type C = { id: string; unitId: string; tenantId: string; ownerId?: string };
type Pay = { id: string; contractId: string; ownerId?: string };
type M = { id: string; propertyId: string; unitId?: string; ownerId?: string };
type E = { id: string; propertyId?: string; unitId?: string; ownerId?: string };

export interface StampSource { units: U[]; properties: P[]; contracts: C[]; payments: Pay[]; maintenance: M[]; expenses?: E[] }

export function unitOwner(src: StampSource, unitId?: string): string | undefined {
  const u = src.units.find(x => x.id === unitId);
  if (!u) return undefined;
  return u.ownerId || src.properties.find(p => p.id === u.propertyId)?.ownerId || undefined;
}

/** مالك الكيان اللي عليه المرفق/الصورة. المستأجر: أول مالك من عقوده (ownerIds تكمل الباقي) */
export function ownerOfEntity(src: StampSource, entityType: string, entityId: string): string | undefined {
  switch (entityType) {
    case 'owner': return entityId;
    case 'property': return src.properties.find(p => p.id === entityId)?.ownerId || undefined;
    case 'unit': return unitOwner(src, entityId);
    case 'contract': { const c = src.contracts.find(x => x.id === entityId); return c?.ownerId || unitOwner(src, c?.unitId); }
    case 'payment': { const p = src.payments.find(x => x.id === entityId); if (p?.ownerId) return p.ownerId;
      const c = src.contracts.find(x => x.id === p?.contractId); return c?.ownerId || unitOwner(src, c?.unitId); }
    case 'maintenance': { const m = src.maintenance.find(x => x.id === entityId); return m?.ownerId || (m?.unitId ? unitOwner(src, m.unitId) : src.properties.find(p => p.id === m?.propertyId)?.ownerId) || undefined; }
    case 'expense': { const e = src.expenses?.find(x => x.id === entityId); return e?.ownerId || (e?.unitId ? unitOwner(src, e.unitId) : src.properties.find(p => p.id === e?.propertyId)?.ownerId) || undefined; }
    case 'tenant': return tenantOwnerIds(src, entityId)[0];
    default: return undefined;
  }
}

/** كل الملاك اللي المستأجر عنده عقد (أي حالة) في وحداتهم */
export function tenantOwnerIds(src: StampSource, tenantId: string): string[] {
  const set = new Set<string>();
  for (const c of src.contracts) {
    if (c.tenantId !== tenantId) continue;
    const o = c.ownerId || unitOwner(src, c.unitId);
    if (o) set.add(o);
  }
  return [...set].sort();
}

const sameSet = (a: string[] = [], b: string[] = []) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

/** الفروقات اللي لازم تنكتب عشان الختم يصير صحيح */
export function planStamps(src: StampSource & {
  tenants: { id: string; ownerIds?: string[] }[];
  attachments: { id: string; entityType: string; entityId: string; ownerId?: string; chunks?: number; chunksOwnerId?: string }[];
  photos: { id: string; entityType: string; entityId: string; ownerId?: string }[];
}) {
  const tenants: { id: string; ownerIds: string[] }[] = [];
  for (const t of src.tenants) {
    const want = tenantOwnerIds(src, t.id);
    if (!sameSet(want, t.ownerIds ?? [])) tenants.push({ id: t.id, ownerIds: want });
  }
  const attachments: { id: string; ownerId: string; chunks?: number }[] = [];
  for (const a of src.attachments) {
    const want = ownerOfEntity(src, a.entityType, a.entityId);
    if (want && (a.ownerId !== want || (a.chunks && a.chunksOwnerId !== want))) attachments.push({ id: a.id, ownerId: want, chunks: a.chunks });
  }
  const photos: { id: string; ownerId: string }[] = [];
  for (const p of src.photos) {
    const want = ownerOfEntity(src, p.entityType, p.entityId);
    if (want && p.ownerId !== want) photos.push({ id: p.id, ownerId: want });
  }
  return { tenants, attachments, photos };
}
