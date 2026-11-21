/** سجل الأخطاء للمدير: مجمّعة بالبصمة (نفس الخطأ عند كذا مستخدم = سطر واحد) */
import { useCallback, useEffect, useState } from 'react';
import { getAll, deleteOne, getActiveOrgId } from '../lib/firestoreService';
import { useApp } from '../context/AppProvider';

export interface ErrorGroup {
  fingerprint: string; where: string; message: string; code?: string; stack?: string;
  count: number; lastAt: string; firstAt: string; users: string[]; pages: string[]; ids: string[];
}

export function useErrorLogs() {
  const { isAdmin, previewing } = useApp();
  const [groups, setGroups] = useState<ErrorGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin || previewing) return;
    setLoading(true);
    try {
      const rows = (await getAll(getActiveOrgId(), 'errorLogs')) as any[];
      const m = new Map<string, ErrorGroup>();
      for (const r of rows) {
        const g = m.get(r.fingerprint) ?? { fingerprint: r.fingerprint, where: r.where, message: r.message, code: r.code, stack: r.stack,
          count: 0, lastAt: r.at, firstAt: r.at, users: [] as string[], pages: [] as string[], ids: [] as string[] } as ErrorGroup;
        g.count++; g.ids.push(r.id);
        if (r.at > g.lastAt) { g.lastAt = r.at; g.message = r.message; g.stack = r.stack; }
        if (r.at < g.firstAt) g.firstAt = r.at;
        if (r.userName && !g.users.includes(r.userName)) g.users.push(r.userName);
        if (r.page && !g.pages.includes(r.page)) g.pages.push(r.page);
        m.set(r.fingerprint, g);
      }
      setGroups([...m.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt)));
    } catch { /* ما عنده صلاحية أو ما في اتصال */ }
    finally { setLoading(false); }
  }, [isAdmin, previewing]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (g: ErrorGroup) => {
    setGroups(prev => prev.filter(x => x.fingerprint !== g.fingerprint));
    await Promise.all(g.ids.map(id => deleteOne(getActiveOrgId(), 'errorLogs', id).catch(() => {})));
  };

  const recent = groups.filter(g => Date.now() - Date.parse(g.lastAt) < 24 * 3600 * 1000);
  return { groups, recent, loading, reload: load, resolve };
}
