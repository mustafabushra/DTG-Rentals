/**
 * useContracts — Feature-layer hook for contracts module.
 * Composes AppStore state + ContractService logic.
 * UI components import from here, never from AppStore directly.
 */
import { useState, useMemo } from 'react';
import { useAppStore }       from '../../state/AppStore';
import { ContractService }   from '../../domain/services/ContractService';
import type { Contract, FilterState } from '../../domain/models';
import { defaultFilter }     from '../../domain/models';

export function useContracts(initialFilter?: Partial<FilterState>) {
  const store = useAppStore();
  const [filter, setFilter] = useState<FilterState>({ ...defaultFilter, ...initialFilter });

  const filtered = useMemo(() => {
    let list = ContractService.filterByStatus(store.contracts, filter.status);

    // Search
    if (filter.search.trim()) {
      const q = filter.search.toLowerCase();
      list = list.filter(c => c.id.toLowerCase().includes(q));
    }

    // Sort
    list = [...list].sort((a, b) =>
      filter.sortDir === 'asc'
        ? a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt),
    );

    return list;
  }, [store.contracts, filter]);

  const stats = useMemo(
    () => ContractService.computeStats(store.contracts),
    [store.contracts],
  );

  const getById = (id: string): Contract | undefined =>
    store.contracts.find(c => c.id === id);

  const countdown = (c: Contract) => ContractService.countdownLabel(c);
  const urgency   = (c: Contract) => ContractService.urgency(c);

  return {
    contracts:    filtered,
    allContracts: store.contracts,
    stats,
    filter,
    setFilter,
    getById,
    countdown,
    urgency,
    add:    store.addContract,
    update: store.updateContract,
    cancel: store.cancelContract,
    remove: store.deleteContract,
  };
}
