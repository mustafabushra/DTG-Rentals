/**
 * PaymentService — All payment business logic.
 */
import type { PaymentInstallment, PaymentMethod, Receipt, Contract, Tenant, Property, Unit } from '../models';

export const PaymentService = {

  /**
   * Determine if an installment is overdue.
   */
  isOverdue(inst: PaymentInstallment): boolean {
    if (inst.status === 'paid' || inst.status === 'cancelled') return false;
    return new Date(inst.dueDate) < new Date();
  },

  /**
   * Sync status field with actual overdue state.
   */
  resolveStatus(inst: PaymentInstallment): PaymentInstallment {
    if (inst.status === 'paid' || inst.status === 'cancelled') return inst;
    const overdue = PaymentService.isOverdue(inst);
    return { ...inst, status: overdue ? 'overdue' : 'pending' };
  },

  /**
   * Filter installments by status ('all' returns everything).
   */
  filterByStatus(installments: PaymentInstallment[], status: string): PaymentInstallment[] {
    const resolved = installments.map(PaymentService.resolveStatus);
    if (status === 'all') return resolved;
    return resolved.filter(p => p.status === status);
  },

  /**
   * Filter installments for a specific contract.
   */
  forContract(installments: PaymentInstallment[], contractId: string): PaymentInstallment[] {
    return installments.filter(p => p.contractId === contractId);
  },

  /**
   * Next unpaid installment for a contract.
   */
  nextDue(installments: PaymentInstallment[], contractId: string): PaymentInstallment | null {
    const pending = installments
      .filter(p => p.contractId === contractId && p.status !== 'paid')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return pending[0] ?? null;
  },

  /**
   * Collection rate (0–100) for a set of installments.
   */
  collectionRate(installments: PaymentInstallment[]): number {
    if (installments.length === 0) return 0;
    const total = installments.filter(p => p.status !== 'cancelled');
    const paid  = total.filter(p => p.status === 'paid');
    return total.length > 0 ? Math.round((paid.length / total.length) * 100) : 0;
  },

  /**
   * Total paid amount for a list of installments.
   */
  totalPaid(installments: PaymentInstallment[]): number {
    return installments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);
  },

  /**
   * Total overdue amount.
   */
  totalOverdue(installments: PaymentInstallment[]): number {
    return installments
      .filter(p => PaymentService.isOverdue(p))
      .reduce((sum, p) => sum + p.amount, 0);
  },

  /**
   * Generate a receipt number in format: RCP-YYYYMM-XXXX
   */
  generateReceiptNumber(): string {
    const now  = new Date();
    const ym   = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const rand = String(Math.floor(Math.random() * 9000) + 1000);
    return `RCP-${ym}-${rand}`;
  },

  /**
   * Build a receipt from an installment and related entities.
   */
  buildReceipt(
    installment: PaymentInstallment,
    contract: Contract,
    tenant: Tenant,
    property: Property,
    unit: Unit,
    issuedBy: string,
  ): Receipt {
    return {
      receiptNumber:      PaymentService.generateReceiptNumber(),
      issuedDate:         new Date().toISOString().split('T')[0],
      tenantName:         tenant.name,
      tenantPhone:        tenant.phone,
      propertyName:       property.name,
      unitNumber:         unit.unitNumber,
      contractId:         contract.id,
      installmentNumber:  installment.installmentNumber,
      amount:             installment.amount,
      paymentMethod:      installment.paymentMethod ?? 'cash',
      referenceNumber:    installment.referenceNumber,
      notes:              installment.notes,
      issuedBy,
      currency: contract.currency ?? property.currency,
    };
  },

  /**
   * Validate a payment recording form.
   */
  validateRecording(data: {
    contractId?: string;
    installmentId?: string;
    paidDate?: string;
    paymentMethod?: PaymentMethod;
  }): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!data.contractId)    errors.contractId    = 'العقد مطلوب';
    if (!data.installmentId) errors.installmentId = 'القسط مطلوب';
    if (!data.paidDate)      errors.paidDate      = 'تاريخ الدفع مطلوب';
    if (!data.paymentMethod) errors.paymentMethod = 'طريقة الدفع مطلوبة';
    return errors;
  },

  /**
   * Payment method Arabic label.
   */
  methodLabel(method: PaymentMethod): string {
    const map: Record<PaymentMethod, string> = {
      cash:          'نقداً',
      bank_transfer: 'تحويل بنكي',
      check:         'شيك',
      online:        'دفع إلكتروني',
    };
    return map[method];
  },

  /**
   * Monthly breakdown grouped by month.
   */
  monthlyBreakdown(
    installments: PaymentInstallment[],
    year: number,
  ): { month: number; paid: number; due: number }[] {
    const result = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, paid: 0, due: 0 }));
    installments.forEach(p => {
      const d = new Date(p.dueDate);
      if (d.getFullYear() !== year) return;
      const m = d.getMonth();
      result[m].due += p.amount;
      if (p.status === 'paid') result[m].paid += p.amount;
    });
    return result;
  },
};
