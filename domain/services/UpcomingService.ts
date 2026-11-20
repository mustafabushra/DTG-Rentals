/**
 * الأحداث القادمة — كل ما سيحدث خلال فترة (افتراضياً شهرين):
 * إيجارات مستحقة، عقود تنتهي، مستندات تنتهي صلاحيتها، ومواعيد التقويم.
 * دالة صرفة؛ العرض والإجراءات في components/dashboard/UpcomingEvents.
 */
export type UpcomingKind = 'rent' | 'contract_end' | 'document' | 'calendar';

export interface UpcomingEvent {
  id: string;
  kind: UpcomingKind;
  date: string;               // YYYY-MM-DD
  daysLeft: number;
  title: string;
  subtitle: string;
  amount?: number;
  currency?: string;
  route?: string;
  contractId?: string;
  paymentId?: string;
  tenantName?: string;
  tenantPhone?: string;
}

interface Src {
  payments: { id: string; contractId: string; amount: number; dueDate: string; status: string; currency?: string }[];
  contracts: { id: string; unitId: string; tenantId: string; endDate: string; status: string; currency?: string; annualValue?: number }[];
  units: { id: string; number: string; propertyId: string; currency?: string }[];
  properties: { id: string; name: string; currency?: string }[];
  tenants: { id: string; name: string; phone?: string }[];
  attachments?: { id: string; name: string; entityType: string; entityId: string; expiryDate?: string }[];
  calendarEvents?: { id: string; title: string; date: string; type?: string; notes?: string }[];
}

const day = 86400000;
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to.slice(0, 10) + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / day);

const ENTITY_ROUTE: Record<string, string> = { property: '/property/', unit: '/unit/', tenant: '/tenant/', owner: '/owner/', contract: '/contract/' };

export function buildUpcoming(src: Src, opts: { today?: string; days?: number } = {}): UpcomingEvent[] {
  const today = opts.today ?? toIso(new Date());
  const end = toIso(new Date(Date.parse(today + 'T00:00:00') + (opts.days ?? 60) * day));
  const inWindow = (d?: string) => !!d && d.slice(0, 10) >= today && d.slice(0, 10) <= end;

  const unit = new Map(src.units.map(u => [u.id, u]));
  const prop = new Map(src.properties.map(p => [p.id, p]));
  const tenant = new Map(src.tenants.map(t => [t.id, t]));
  const contract = new Map(src.contracts.map(c => [c.id, c]));
  const place = (unitId: string) => {
    const u = unit.get(unitId); const p = u && prop.get(u.propertyId);
    return [p?.name, u ? `وحدة ${u.number}` : null].filter(Boolean).join('، ');
  };
  const cur = (c?: { currency?: string; unitId: string }) => {
    if (!c) return undefined;
    const u = unit.get(c.unitId);
    return c.currency ?? u?.currency ?? prop.get(u?.propertyId ?? '')?.currency;
  };

  const out: UpcomingEvent[] = [];

  for (const p of src.payments) {
    if (p.status === 'paid' || p.status === 'cancelled' || !inWindow(p.dueDate)) continue;
    const c = contract.get(p.contractId); if (!c) continue;
    const t = tenant.get(c.tenantId);
    out.push({
      id: `r-${p.id}`, kind: 'rent', date: p.dueDate.slice(0, 10), daysLeft: daysBetween(today, p.dueDate),
      title: `إيجار ${t?.name ?? 'مستأجر'}`, subtitle: place(c.unitId),
      amount: p.amount, currency: p.currency ?? cur(c), route: `/payment/${p.id}`,
      contractId: c.id, paymentId: p.id, tenantName: t?.name, tenantPhone: t?.phone,
    });
  }

  for (const c of src.contracts) {
    if (c.status !== 'active' || !inWindow(c.endDate)) continue;
    const t = tenant.get(c.tenantId);
    out.push({
      id: `c-${c.id}`, kind: 'contract_end', date: c.endDate.slice(0, 10), daysLeft: daysBetween(today, c.endDate),
      title: `ينتهي عقد ${t?.name ?? 'مستأجر'}`, subtitle: place(c.unitId),
      amount: c.annualValue, currency: cur(c), route: `/contract/${c.id}`,
      contractId: c.id, tenantName: t?.name, tenantPhone: t?.phone,
    });
  }

  for (const a of src.attachments ?? []) {
    if (!inWindow(a.expiryDate)) continue;
    out.push({
      id: `d-${a.id}`, kind: 'document', date: a.expiryDate!.slice(0, 10), daysLeft: daysBetween(today, a.expiryDate!),
      title: `تنتهي صلاحية: ${a.name}`, subtitle: 'مستند',
      route: ENTITY_ROUTE[a.entityType] ? `${ENTITY_ROUTE[a.entityType]}${a.entityId}` : '/attachments',
    });
  }

  for (const e of src.calendarEvents ?? []) {
    if (!inWindow(e.date)) continue;
    out.push({
      id: `e-${e.id}`, kind: 'calendar', date: e.date.slice(0, 10), daysLeft: daysBetween(today, e.date),
      title: e.title, subtitle: e.notes ?? 'موعد في التقويم', route: '/calendar',
    });
  }

  // نفس اليوم: انتهاء العقود أولاً (أهم من دفعة)، ثم الإيجار
  const order: Record<UpcomingKind, number> = { contract_end: 0, rent: 1, document: 2, calendar: 3 };
  return out.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind]);
}

/** "اليوم"، "بكرة"، "بعد 5 أيام"، "بعد 3 أسابيع" */
export function whenLabel(daysLeft: number): string {
  if (daysLeft <= 0) return 'اليوم';
  if (daysLeft === 1) return 'بكرة';
  if (daysLeft === 2) return 'بعد يومين';
  if (daysLeft <= 10) return `بعد ${daysLeft} أيام`;
  if (daysLeft < 14) return `بعد ${daysLeft} يوم`;
  const w = Math.round(daysLeft / 7);
  if (daysLeft < 30) return w === 2 ? 'بعد أسبوعين' : `بعد ${w} أسابيع`;
  if (daysLeft < 38) return 'بعد شهر';
  if (daysLeft < 53) return 'بعد شهر ونص';
  return 'بعد شهرين';
}

export function rentReminder(e: UpcomingEvent, symbol: string): string {
  return `السلام عليكم ${e.tenantName ?? ''}،\nنذكّركم بموعد دفعة الإيجار بتاريخ ${e.date} بمبلغ ${(e.amount ?? 0).toLocaleString('en-US')} ${symbol} — ${e.subtitle}.\nشاكرين لكم.`;
}

export function renewalReminder(e: UpcomingEvent): string {
  return `السلام عليكم ${e.tenantName ?? ''}،\nعقد الإيجار (${e.subtitle}) ينتهي بتاريخ ${e.date}. هل ترغبون بالتجديد؟ نسعد بالتواصل معكم لترتيب ذلك.\nشاكرين لكم.`;
}
