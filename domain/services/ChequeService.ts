/**
 * الشيكات — شيك لكل قسط (الشائع في الإمارات: المستأجر يسلّم شيكات مؤجلة مقدماً).
 *
 * المسار: في الخزنة ← أودعته في البنك ← انصرف (القسط يصير مدفوع) أو ارتد.
 * القسط ما ينحسب مدفوع إلا لما الشيك "ينصرف" فعلاً.
 */
export type ChequeStatus = 'held' | 'deposited' | 'cleared' | 'bounced';

export interface Cheque {
  number: string;
  bank?: string;
  /** تاريخ الشيك (متى ينفع يتودع) */
  date: string;
  status: ChequeStatus;
  receivedAt?: string;
  depositedAt?: string;
  clearedAt?: string;
  bouncedAt?: string;
  bounceReason?: string;
}

type PaymentLike = { id: string; contractId: string; amount: number; dueDate: string; status: string; installmentNumber?: number; currency?: string; cheque?: Cheque };
type ContractLike = { id: string; tenantId: string; unitId: string; contractNumber?: string; currency?: string };
type TenantLike = { id: string; name: string; phone?: string };
type UnitLike = { id: string; number?: string; propertyId: string; currency?: string };
type PropertyLike = { id: string; name: string; currency?: string };

export const CHEQUE_STATUS: Record<ChequeStatus, { label: string; hint: string }> = {
  held:      { label: 'في الخزنة',   hint: 'استلمته وما أودعته للحين' },
  deposited: { label: 'في البنك',    hint: 'أودعته وتنتظر ينصرف' },
  cleared:   { label: 'انصرف',       hint: 'المبلغ وصل والقسط صار مدفوع' },
  bounced:   { label: 'ارتد',        hint: 'رجع بدون رصيد — تابع المستأجر' },
};

export interface ChequeRow {
  paymentId: string;
  contractId: string;
  tenantName: string;
  tenantPhone?: string;
  place: string;
  amount: number;
  currency?: string;
  installmentNumber?: number;
  cheque: Cheque;
  /** أيام لتاريخ الشيك (سالب = فات) */
  daysToDate: number;
  /** جاهز للإيداع: في الخزنة وتاريخه جا أو باقي عليه ≤ 3 أيام */
  depositDue: boolean;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
}

export const ChequeService = {
  buildRows(
    data: { payments: PaymentLike[]; contracts: ContractLike[]; tenants: TenantLike[]; units: UnitLike[]; properties: PropertyLike[] },
    today: string,
  ): ChequeRow[] {
    const c = new Map(data.contracts.map(x => [x.id, x]));
    const t = new Map(data.tenants.map(x => [x.id, x]));
    const u = new Map(data.units.map(x => [x.id, x]));
    const p = new Map(data.properties.map(x => [x.id, x]));
    const rows: ChequeRow[] = [];
    for (const pay of data.payments) {
      if (!pay.cheque) continue;
      const con = c.get(pay.contractId);
      const ten = con ? t.get(con.tenantId) : undefined;
      const unit = con ? u.get(con.unitId) : undefined;
      const prop = unit ? p.get(unit.propertyId) : undefined;
      const days = daysBetween(today, pay.cheque.date);
      rows.push({
        paymentId: pay.id,
        contractId: pay.contractId,
        tenantName: ten?.name ?? 'مستأجر',
        tenantPhone: ten?.phone,
        place: [prop?.name, unit?.number && `وحدة ${unit.number}`].filter(Boolean).join('، '),
        amount: pay.amount,
        currency: pay.currency ?? con?.currency ?? unit?.currency ?? prop?.currency,
        installmentNumber: pay.installmentNumber,
        cheque: pay.cheque,
        daysToDate: days,
        depositDue: pay.cheque.status === 'held' && days <= 3,
      });
    }
    // الأهم أولاً: المرتد، ثم الجاهز للإيداع، ثم البقية بتاريخ الشيك
    const rank = (r: ChequeRow) =>
      r.cheque.status === 'bounced' ? 0 : r.depositDue ? 1 : r.cheque.status === 'deposited' ? 2 : r.cheque.status === 'held' ? 3 : 4;
    return rows.sort((a, b) => rank(a) - rank(b) || a.cheque.date.localeCompare(b.cheque.date));
  },

  summarize(rows: ChequeRow[]) {
    const pick = (f: (r: ChequeRow) => boolean) => {
      const list = rows.filter(f);
      return { count: list.length, total: list.reduce((s, r) => s + r.amount, 0) };
    };
    return {
      held: pick(r => r.cheque.status === 'held'),
      depositDue: pick(r => r.depositDue),
      deposited: pick(r => r.cheque.status === 'deposited'),
      bounced: pick(r => r.cheque.status === 'bounced'),
      cleared: pick(r => r.cheque.status === 'cleared'),
    };
  },

  /** شيكات عقد كامل دفعة وحدة: رقم أول شيك يزيد واحد لكل قسط، وتاريخ كل شيك = استحقاق قسطه */
  planForContract(installments: { id: string; dueDate: string }[], firstNumber: string, bank: string, today: string) {
    const digits = firstNumber.match(/(\d+)$/);
    const prefix = digits ? firstNumber.slice(0, firstNumber.length - digits[1].length) : firstNumber;
    const start = digits ? Number(digits[1]) : NaN;
    const width = digits ? digits[1].length : 0;
    return [...installments]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((inst, i) => ({
        paymentId: inst.id,
        cheque: {
          number: Number.isFinite(start) ? prefix + String(start + i).padStart(width, '0') : `${firstNumber}-${i + 1}`,
          bank: bank || undefined,
          date: inst.dueDate,
          status: 'held' as ChequeStatus,
          receivedAt: today,
        } as Cheque,
      }));
  },

  /** الخطوة الجاية الوحيدة لكل حالة — زر واحد واضح */
  nextActions(status: ChequeStatus): { key: 'deposit' | 'clear' | 'bounce' | 'redeposit'; label: string }[] {
    switch (status) {
      case 'held': return [{ key: 'deposit', label: 'أودعته في البنك' }];
      case 'deposited': return [{ key: 'clear', label: 'انصرف' }, { key: 'bounce', label: 'ارتد' }];
      case 'bounced': return [{ key: 'redeposit', label: 'أعدت إيداعه' }];
      default: return [];
    }
  },
};
