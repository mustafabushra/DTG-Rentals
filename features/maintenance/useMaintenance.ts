/**
 * useMaintenance — Feature-layer hook for maintenance module.
 */
import { useState, useMemo } from 'react';
import { useAppStore }       from '../../state/AppStore';
import type { FilterState }  from '../../domain/models';
import { defaultFilter }     from '../../domain/models';

export function useMaintenance(propertyId?: string, initialFilter?: Partial<FilterState>) {
  const store  = useAppStore();
  const [filter, setFilter] = useState<FilterState>({ ...defaultFilter, ...initialFilter });

  const sourceList = useMemo(() =>
    propertyId
      ? store.maintenance.filter(m => m.propertyId === propertyId)
      : store.maintenance,
    [store.maintenance, propertyId],
  );

  const filtered = useMemo(() => {
    let list = [...sourceList];

    if (filter.status !== 'all') {
      list = list.filter(m => m.status === filter.status);
    }

    if (filter.search.trim()) {
      const q = filter.search.toLowerCase();
      list = list.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q),
      );
    }

    // Sort by priority then date
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    list.sort((a, b) =>
      (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9),
    );

    return list;
  }, [sourceList, filter]);

  const stats = useMemo(() => ({
    total:       sourceList.length,
    new:         sourceList.filter(m => m.status === 'new').length,
    inProgress:  sourceList.filter(m => m.status === 'in_progress').length,
    completed:   sourceList.filter(m => m.status === 'completed').length,
    urgent:      sourceList.filter(m => m.priority === 'urgent').length,
  }), [sourceList]);

  const getById      = (id: string) => store.maintenance.find(m => m.id === id);
  const getProperty  = (id: string) => store.properties.find(p => p.id === id);
  const getUnit      = (id: string) => store.units.find(u => u.id === id);

  const advanceStatus = (id: string) => {
    const m = store.maintenance.find(x => x.id === id);
    if (!m) return;
    const next: Record<string, string> = {
      new: 'in_progress', in_progress: 'completed',
    };
    if (next[m.status]) {
      store.updateMaintenance(id, {
        status: next[m.status] as any,
        completedDate: next[m.status] === 'completed' ? new Date().toISOString().split('T')[0] : undefined,
      });
    }
  };

  return {
    requests: filtered,
    stats,
    filter,
    setFilter,
    getById,
    getProperty,
    getUnit,
    advanceStatus,
    add:    store.addMaintenance,
    update: store.updateMaintenance,
    remove: store.deleteMaintenance,
  };
}
