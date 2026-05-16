/**
 * useProperties — Feature-layer hook for properties module.
 */
import { useState, useMemo } from 'react';
import { useAppStore }       from '../../state/AppStore';
import type { FilterState }  from '../../domain/models';
import { defaultFilter }     from '../../domain/models';

export function useProperties(initialFilter?: Partial<FilterState>) {
  const store  = useAppStore();
  const [filter, setFilter] = useState<FilterState>({ ...defaultFilter, ...initialFilter });

  const filtered = useMemo(() => {
    let list = [...store.properties];

    if (filter.status !== 'all') {
      // Filter by property type (apartment, villa, office, shop, building)
      list = list.filter(p => (p.type as string) === filter.status);
    }

    if (filter.search.trim()) {
      const q = filter.search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q),
      );
    }

    return list;
  }, [store.properties, filter]);

  const getById    = (id: string) => store.properties.find(p => p.id === id);
  const getOwner   = (ownerId: string) => store.owners.find(o => o.id === ownerId);
  const getUnits   = (propertyId: string) => store.units.filter(u => u.propertyId === propertyId);

  const statsFor = (propertyId: string) => {
    const units  = getUnits(propertyId);
    const rented = units.filter(u => u.status === 'rented').length;
    const activeContracts = store.contracts.filter(c =>
      units.some(u => u.id === c.unitId) && c.status === 'active',
    );
    const monthlyRevenue = activeContracts.reduce(
      (s, c) => s + Math.round(c.annualValue / 12), 0,
    );
    return { total: units.length, rented, vacant: units.length - rented, monthlyRevenue };
  };

  return {
    properties: filtered,
    filter,
    setFilter,
    getById,
    getOwner,
    getUnits,
    statsFor,
    add:    store.addProperty,
    update: store.updateProperty,
    remove: store.deleteProperty,
  };
}
