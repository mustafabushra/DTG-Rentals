/**
 * usePayments — Feature-layer hook for payments module.
 */
import { useState, useMemo } from 'react';
import { useAppStore }       from '../../state/AppStore';
import { PaymentService }    from '../../domain/services/PaymentService';
import type { FilterState }  from '../../domain/models';
import { defaultFilter }     from '../../domain/models';

export function usePayments(contractId?: string, initialFilter?: Partial<FilterState>) {
  const store  = useAppStore();
  const [filter, setFilter] = useState<FilterState>({ ...defaultFilter, ...initialFilter });

  const sourceList = useMemo(() =>
    contractId
      ? PaymentService.forContract(store.installments, contractId)
      : store.installments,
    [store.installments, contractId],
  );

  const filtered = useMemo(() => {
    return PaymentService.filterByStatus(sourceList, filter.status);
  }, [sourceList, filter.status]);

  const stats = useMemo(() => ({
    total:          sourceList.length,
    paid:           sourceList.filter(p => p.status === 'paid').length,
    pending:        sourceList.filter(p => p.status === 'pending').length,
    overdue:        sourceList.filter(p => PaymentService.isOverdue(p)).length,
    totalPaid:      PaymentService.totalPaid(sourceList),
    totalOverdue:   PaymentService.totalOverdue(sourceList),
    collectionRate: PaymentService.collectionRate(sourceList),
  }), [sourceList]);

  return {
    installments: filtered,
    allInstallments: store.installments,
    stats,
    filter,
    setFilter,
    record:    store.recordPayment,
    methodLabel: PaymentService.methodLabel,
    buildReceipt: (instId: string, issuedBy: string) => {
      const inst     = store.installments.find(i => i.id === instId);
      const contract = inst ? store.contracts.find(c => c.id === inst.contractId) : undefined;
      const tenant   = contract ? store.tenants.find(t => t.id === contract.tenantId) : undefined;
      const unit     = contract ? store.units.find(u => u.id === contract.unitId) : undefined;
      const property = unit ? store.properties.find(p => p.id === unit.propertyId) : undefined;
      if (!inst || !contract || !tenant || !unit || !property) return null;
      return PaymentService.buildReceipt(inst, contract, tenant, property, unit, issuedBy);
    },
  };
}
