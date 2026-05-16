/**
 * ContractService — All contract business logic lives here.
 * UI components must NEVER contain this logic.
 */
import type { Contract, ContractStatus, DashboardKPIs } from '../models';

export const ContractService = {

  /**
   * Days remaining until contract end.
   * Returns negative if expired.
   */
  daysRemaining(contract: Contract): number {
    const end  = new Date(contract.endDate).getTime();
    const now  = Date.now();
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  },

  /**
   * Human-readable countdown string.
   */
  countdownLabel(contract: Contract): string {
    const days = ContractService.daysRemaining(contract);
    if (contract.status === 'cancelled') return 'العقد ملغي';
    if (days < 0)  return 'العقد منتهي';
    if (days === 0) return 'ينتهي اليوم';
    if (days <= 30) return `باقي ${days} يوم`;
    const months = Math.floor(days / 30);
    const rem    = days % 30;
    if (rem === 0) return `باقي ${months} شهر`;
    return `باقي ${months} شهر و${rem} يوم`;
  },

  /**
   * Urgency level based on days remaining.
   */
  urgency(contract: Contract): 'critical' | 'warning' | 'normal' | 'expired' | 'cancelled' {
    if (contract.status === 'cancelled') return 'cancelled';
    const days = ContractService.daysRemaining(contract);
    if (days < 0)   return 'expired';
    if (days <= 30) return 'critical';
    if (days <= 90) return 'warning';
    return 'normal';
  },

  /**
   * Color token key for urgency state.
   */
  urgencyColor(contract: Contract, colors: Record<string, string>): string {
    const level = ContractService.urgency(contract);
    const map: Record<string, string> = {
      critical:  colors.danger,
      warning:   colors.warning,
      normal:    colors.success,
      expired:   colors.textMuted,
      cancelled: colors.textMuted,
    };
    return map[level] ?? colors.textMuted;
  },

  /**
   * Monthly rent from annual contract value.
   */
  monthlyRent(contract: Contract): number {
    return Math.round(contract.annualValue / 12);
  },

  /**
   * Installment amount based on payment cycle.
   */
  installmentAmount(contract: Contract): number {
    return Math.round(contract.annualValue / contract.paymentCycles);
  },

  /**
   * Generate all payment installment due dates.
   */
  generateInstallmentDates(contract: Contract): string[] {
    const start  = new Date(contract.startDate);
    const count  = contract.paymentCycles;
    const dates: string[] = [];
    const interval = 12 / count; // months between installments

    for (let i = 0; i < count; i++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + Math.round(i * interval));
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  },

  /**
   * Validate contract before save.
   * Returns map of field → error message, or empty object if valid.
   */
  validate(data: Partial<Contract>): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!data.unitId)    errors.unitId    = 'الوحدة مطلوبة';
    if (!data.tenantId)  errors.tenantId  = 'المستأجر مطلوب';
    if (!data.startDate) errors.startDate = 'تاريخ البداية مطلوب';
    if (!data.endDate)   errors.endDate   = 'تاريخ النهاية مطلوب';
    if (!data.annualValue || data.annualValue <= 0) errors.annualValue = 'قيمة العقد يجب أن تكون أكبر من صفر';
    if (data.startDate && data.endDate && data.startDate >= data.endDate) {
      errors.endDate = 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية';
    }
    return errors;
  },

  /**
   * Check if contract is expiring within N days.
   */
  isExpiringSoon(contract: Contract, days = 90): boolean {
    if (contract.status !== 'active') return false;
    const remaining = ContractService.daysRemaining(contract);
    return remaining >= 0 && remaining <= days;
  },

  /**
   * Filter contracts by status string (supports 'all').
   */
  filterByStatus(contracts: Contract[], status: string): Contract[] {
    if (status === 'all') return contracts;
    return contracts.filter(c => c.status === status);
  },

  /**
   * Compute summary KPIs from a list of contracts.
   */
  computeStats(contracts: Contract[]): {
    total: number;
    active: number;
    expired: number;
    cancelled: number;
    expiringIn90Days: number;
    totalAnnualValue: number;
  } {
    const active    = contracts.filter(c => c.status === 'active');
    const expired   = contracts.filter(c => c.status === 'expired');
    const cancelled = contracts.filter(c => c.status === 'cancelled');
    const expiring  = active.filter(c => ContractService.isExpiringSoon(c));
    const totalValue = active.reduce((sum, c) => sum + c.annualValue, 0);

    return {
      total:            contracts.length,
      active:           active.length,
      expired:          expired.length,
      cancelled:        cancelled.length,
      expiringIn90Days: expiring.length,
      totalAnnualValue: totalValue,
    };
  },
};
