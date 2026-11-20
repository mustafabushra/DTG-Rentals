/**
 * الخط الزمني للمالك — كل ما حدث (وما سيحدث قريباً) في عقاراته بترتيب زمني:
 * دفعات مستلمة/متأخرة/قادمة، عقود بدأت/انتهت/تنتهي قريباً، صيانة فُتحت/أُغلقت، مصاريف.
 * دالة صرفة: تأخذ البيانات وتُرجع أحداثاً مرتبة؛ العرض في components/owners/OwnerTimeline.
 */

export type TimelineKind =
  | 'payment_paid' | 'payment_overdue' | 'payment_due'
  | 'contract_start' | 'contract_end' | 'contract_ending'
  | 'maintenance_open' | 'maintenance_done'
  | 'expense';

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  date: string;          // YYYY-MM-DD
  title: string;
  subtitle: string;
  amount?: number;
  currency?: string;
  route?: string;
  upcoming: boolean;     // بعد اليوم
}

interface Src {
  units: { id: string; number: string; propertyId: string; ownerId?: string }[];
  properties: { id: string; name: string; ownerId?: string; currency?: string }[];
  contracts: { id: string; unitId: string; tenantId: string; startDate: string; endDate: string; status: string; contractNumber?: string; currency?: string }[];
  tenants: { id: string; name: string }[];
  payments: { id: string; contractId: string; amount: number; dueDate: string; paidDate?: string; status: string; currency?: string }[];
  maintenance: { id: string; unitId: string; propertyId: string; title: string; openedAt: string; closedAt?: string; status: string; cost?: number }[];
  expenses?: { id: string; propertyId?: string; unitId?: string; scope: string; status: string; date: string; amount: number; currency: string; category?: string; vendor?: string }[];
}

const d10 = (s?: string) => (s ? s.slice(0, 10) : '');

/** وحدات المالك: صراحةً (unit.ownerId) أو بالوراثة من عقار يملكه. بلا ownerId ⇒ كل الوحدات. */
export function ownerUnitIds(src: Pick<Src, 'units' | 'properties'>, ownerId?: string): Set<string> {
  if (!ownerId) return new Set(src.units.map(u => u.id));
  const propOwner = new Map(src.properties.map(p => [p.id, p.ownerId]));
  return new Set(src.units.filter(u => (u.ownerId ? u.ownerId === ownerId : propOwner.get(u.propertyId) === ownerId)).map(u => u.id));
}

export function buildOwnerTimeline(src: Src, opts: { ownerId?: string; today?: string; aheadDays?: number } = {}): TimelineEvent[] {
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const ahead = new Date(today); ahead.setDate(ahead.getDate() + (opts.aheadDays ?? 60));
  const horizon = ahead.toISOString().slice(0, 10);

  const unitIds = ownerUnitIds(src, opts.ownerId);
  const unit = new Map(src.units.map(u => [u.id, u]));
  const prop = new Map(src.properties.map(p => [p.id, p]));
  const tenant = new Map(src.tenants.map(t => [t.id, t.name]));
  const where = (unitId: string) => {
    const u = unit.get(unitId); const p = u && prop.get(u.propertyId);
    return [p?.name, u ? `وحدة ${u.number}` : null].filter(Boolean).join('، ');
  };
  const curOf = (unitId: string) => prop.get(unit.get(unitId)?.propertyId ?? '')?.currency;

  const contracts = src.contracts.filter(c => unitIds.has(c.unitId));
  const cmap = new Map(contracts.map(c => [c.id, c]));
  const out: TimelineEvent[] = [];
  const push = (e: Omit<TimelineEvent, 'upcoming'>) => {
    if (!e.date || e.date > horizon) return;
    out.push({ ...e, upcoming: e.date > today });
  };

  for (const p of src.payments) {
    const c = cmap.get(p.contractId); if (!c) continue;
    const who = tenant.get(c.tenantId) ?? 'المستأجر';
    const cur = p.currency ?? c.currency ?? curOf(c.unitId);
    if (p.status === 'paid' && p.paidDate) {
      push({ id: `pp-${p.id}`, kind: 'payment_paid', date: d10(p.paidDate), title: `استلام إيجار من ${who}`, subtitle: where(c.unitId), amount: p.amount, currency: cur, route: `/payment/${p.id}` });
    } else if (p.status === 'overdue' || (p.status !== 'paid' && d10(p.dueDate) < today)) {
      push({ id: `po-${p.id}`, kind: 'payment_overdue', date: d10(p.dueDate), title: `إيجار متأخر على ${who}`, subtitle: where(c.unitId), amount: p.amount, currency: cur, route: `/payment/${p.id}` });
    } else if (p.status !== 'paid' && p.status !== 'cancelled') {
      push({ id: `pd-${p.id}`, kind: 'payment_due', date: d10(p.dueDate), title: `إيجار مستحق من ${who}`, subtitle: where(c.unitId), amount: p.amount, currency: cur, route: `/payment/${p.id}` });
    }
  }

  for (const c of contracts) {
    const who = tenant.get(c.tenantId) ?? 'مستأجر';
    push({ id: `cs-${c.id}`, kind: 'contract_start', date: d10(c.startDate), title: `بداية عقد ${who}`, subtitle: where(c.unitId), route: `/contract/${c.id}` });
    const end = d10(c.endDate);
    if (c.status === 'active' && end >= today) {
      push({ id: `ce-${c.id}`, kind: 'contract_ending', date: end, title: `ينتهي عقد ${who}`, subtitle: where(c.unitId), route: `/contract/${c.id}` });
    } else if (end < today) {
      push({ id: `ce-${c.id}`, kind: 'contract_end', date: end, title: `انتهى عقد ${who}`, subtitle: where(c.unitId), route: `/contract/${c.id}` });
    }
  }

  for (const m of src.maintenance) {
    if (!unitIds.has(m.unitId)) continue;
    push({ id: `mo-${m.id}`, kind: 'maintenance_open', date: d10(m.openedAt), title: `طلب صيانة: ${m.title}`, subtitle: where(m.unitId), route: `/maintenance/${m.id}` });
    if (m.closedAt) push({ id: `md-${m.id}`, kind: 'maintenance_done', date: d10(m.closedAt), title: `اكتملت الصيانة: ${m.title}`, subtitle: where(m.unitId), amount: m.cost || undefined, currency: curOf(m.unitId), route: `/maintenance/${m.id}` });
  }

  const ownerProps = new Set([...unitIds].map(id => unit.get(id)?.propertyId).filter(Boolean) as string[]);
  for (const e of src.expenses ?? []) {
    if (e.status !== 'active' || e.scope !== 'property') continue;
    const inScope = e.unitId ? unitIds.has(e.unitId) : !!e.propertyId && ownerProps.has(e.propertyId) && (!opts.ownerId || prop.get(e.propertyId)?.ownerId === opts.ownerId);
    if (!inScope) continue;
    push({ id: `ex-${e.id}`, kind: 'expense', date: d10(e.date), title: `مصروف: ${e.category ?? 'عام'}${e.vendor ? ` — ${e.vendor}` : ''}`, subtitle: e.unitId ? where(e.unitId) : (prop.get(e.propertyId ?? '')?.name ?? ''), amount: e.amount, currency: e.currency, route: `/expense/${e.id}` });
  }

  // الأحدث أولاً؛ القادم يظهر في الأعلى بترتيب الأقرب
  const upcoming = out.filter(e => e.upcoming).sort((a, b) => a.date.localeCompare(b.date));
  const past = out.filter(e => !e.upcoming).sort((a, b) => b.date.localeCompare(a.date));
  return [...upcoming, ...past];
}

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/** تجميع للعرض: "قادم" ثم كل شهر باسمه. */
export function groupTimeline(events: TimelineEvent[]): { title: string; events: TimelineEvent[] }[] {
  const groups: { title: string; events: TimelineEvent[] }[] = [];
  const up = events.filter(e => e.upcoming);
  if (up.length) groups.push({ title: 'قادم', events: up });
  for (const e of events.filter(x => !x.upcoming)) {
    const [y, m] = e.date.split('-');
    const title = `${MONTHS[Number(m) - 1]} ${y}`;
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.events.push(e); else groups.push({ title, events: [e] });
  }
  return groups;
}
