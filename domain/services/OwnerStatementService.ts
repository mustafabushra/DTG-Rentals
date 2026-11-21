/**
 * كشف حساب المالك لفترة: المحصَّل، المصاريف، الصافي — لكل عقار ولكل عملة،
 * مع تفاصيل كل دفعة وكل مصروف، والمتأخرات (للعلم، ما تدخل في الصافي).
 */
type Pay = { id: string; contractId: string; amount: number; status: string; paidDate?: string; dueDate: string; currency?: string; installmentNumber?: number };
type Con = { id: string; unitId: string; tenantId: string; currency?: string };
type Unit = { id: string; propertyId: string; number?: string; currency?: string };
type Prop = { id: string; name: string; currency?: string; ownerId?: string };
type Ten = { id: string; name: string };
type Exp = { id: string; scope: string; propertyId?: string; unitId?: string; category: string; amount: number; currency: string; date: string; vendor?: string; status: string };

export interface StatementLine { date: string; label: string; detail: string; amount: number; currency: string; propertyId: string }
export interface StatementProperty { propertyId: string; name: string; currency: string; income: number; expenses: number; net: number }
export interface OwnerStatement {
  properties: StatementProperty[];
  totals: { currency: string; income: number; expenses: number; net: number; overdue: number }[];
  income: StatementLine[];
  expenses: StatementLine[];
  overdue: StatementLine[];
}

const inRange = (d: string | undefined, from?: string, to?: string) =>
  !!d && (!from || d >= from) && (!to || d <= to);

export function buildOwnerStatement(
  src: { payments: Pay[]; contracts: Con[]; units: Unit[]; properties: Prop[]; tenants: Ten[]; expenses: Exp[] },
  opts: { propertyIds?: string[]; from?: string; to?: string; today: string },
): OwnerStatement {
  const allowed = opts.propertyIds ? new Set(opts.propertyIds) : null;
  const props = src.properties.filter(p => !allowed || allowed.has(p.id));
  const propById = new Map(props.map(p => [p.id, p]));
  const unitById = new Map(src.units.map(u => [u.id, u]));
  const conById = new Map(src.contracts.map(c => [c.id, c]));
  const tenById = new Map(src.tenants.map(t => [t.id, t]));

  const rows = new Map<string, StatementProperty>();
  const row = (p: Prop) => {
    let r = rows.get(p.id);
    if (!r) { r = { propertyId: p.id, name: p.name, currency: p.currency ?? 'SAR', income: 0, expenses: 0, net: 0 }; rows.set(p.id, r); }
    return r;
  };
  const income: StatementLine[] = [], expenses: StatementLine[] = [], overdue: StatementLine[] = [];

  for (const pay of src.payments) {
    const con = conById.get(pay.contractId); if (!con) continue;
    const unit = unitById.get(con.unitId); if (!unit) continue;
    const prop = propById.get(unit.propertyId); if (!prop) continue;
    const cur = pay.currency ?? con.currency ?? unit.currency ?? prop.currency ?? 'SAR';
    const who = tenById.get(con.tenantId)?.name ?? 'مستأجر';
    const detail = `${prop.name}${unit.number ? `، وحدة ${unit.number}` : ''}`;
    if (pay.status === 'paid' && inRange(pay.paidDate, opts.from, opts.to)) {
      row(prop).income += pay.amount || 0;
      income.push({ date: pay.paidDate!, label: `إيجار — ${who}`, detail, amount: pay.amount || 0, currency: cur, propertyId: prop.id });
    } else if (pay.status !== 'paid' && pay.status !== 'cancelled' && pay.dueDate < opts.today) {
      overdue.push({ date: pay.dueDate, label: `متأخر — ${who}`, detail, amount: pay.amount || 0, currency: cur, propertyId: prop.id });
    }
  }
  for (const e of src.expenses) {
    if (e.status !== 'active' || e.scope !== 'property' || !e.propertyId) continue;
    const prop = propById.get(e.propertyId); if (!prop) continue;
    if (!inRange(e.date, opts.from, opts.to)) continue;
    row(prop).expenses += e.amount || 0;
    const unit = e.unitId ? unitById.get(e.unitId) : undefined;
    expenses.push({ date: e.date, label: e.category + (e.vendor ? ` — ${e.vendor}` : ''), detail: `${prop.name}${unit?.number ? `، وحدة ${unit.number}` : ''}`, amount: e.amount || 0, currency: e.currency, propertyId: prop.id });
  }
  for (const r of rows.values()) r.net = r.income - r.expenses;

  const t = new Map<string, { currency: string; income: number; expenses: number; net: number; overdue: number }>();
  const tot = (c: string) => { let x = t.get(c); if (!x) { x = { currency: c, income: 0, expenses: 0, net: 0, overdue: 0 }; t.set(c, x); } return x; };
  income.forEach(l => { tot(l.currency).income += l.amount; });
  expenses.forEach(l => { tot(l.currency).expenses += l.amount; });
  overdue.forEach(l => { tot(l.currency).overdue += l.amount; });
  for (const x of t.values()) x.net = x.income - x.expenses;

  const byDate = (a: StatementLine, b: StatementLine) => a.date.localeCompare(b.date);
  return {
    properties: [...rows.values()].sort((a, b) => b.net - a.net),
    totals: [...t.values()],
    income: income.sort(byDate), expenses: expenses.sort(byDate), overdue: overdue.sort(byDate),
  };
}

/** نص قصير للواتساب */
export function statementMessage(ownerName: string, periodLabel: string, s: OwnerStatement, fmt: (n: number, c: string) => string): string {
  const lines = [`السلام عليكم ${ownerName}،`, `هذا ملخص حساب عقاراتك — ${periodLabel}:`, ''];
  for (const t of s.totals) {
    lines.push(`• الإيجار المحصَّل: ${fmt(t.income, t.currency)}`);
    lines.push(`• المصاريف: ${fmt(t.expenses, t.currency)}`);
    lines.push(`• الصافي لك: ${fmt(t.net, t.currency)}`);
    if (t.overdue > 0) lines.push(`• متأخرات على المستأجرين (قيد المتابعة): ${fmt(t.overdue, t.currency)}`);
    lines.push('');
  }
  lines.push('الكشف التفصيلي مرفق. لأي استفسار تواصل معنا.', 'مجموعة ظهران التجارية');
  return lines.join('\n');
}
