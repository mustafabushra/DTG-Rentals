/**
 * طلبات الصرف بالموافقة.
 * الموظف يرفع الطلب ← المدير يعتمده (يتسجّل مصروف ويصدر سند صرف) أو يرفضه بسبب.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useApp } from './AppProvider';
import { useFinance } from './FinanceProvider';
import type { PaymentRequest } from '../domain/models';
import { getAll, setOne, updateOne, getActiveOrgId } from '../lib/firestoreService';
import { isAdminRole } from '../utils/roleUtils';

type Result = { ok: true } | { ok: false; error: string };
export type RequestInput = Pick<PaymentRequest, 'scope' | 'propertyId' | 'unitId' | 'category' | 'amount' | 'currency' | 'vendor' | 'notes' | 'neededBy'>;

interface Ctx {
  requests: PaymentRequest[];
  /** المدير يقدر يعتمد */
  canApprove: boolean;
  pendingCount: number;
  addRequest: (input: RequestInput) => Promise<Result>;
  approve: (id: string, pay: { paymentMethod: 'cash' | 'transfer' | 'check'; referenceNumber?: string; date: string }) => Promise<Result & { expenseId?: string }>;
  reject: (id: string, reason: string) => Promise<Result>;
  withdraw: (id: string) => Promise<Result>;
}

const RequestsContext = createContext<Ctx | undefined>(undefined);
const newId = () => `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function RequestsProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, isAuthenticated, isOwner, previewing, canWrite, logAudit, properties, units } = useApp();
  const { addExpense } = useFinance();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const canApprove = isAdminRole(currentUser.role) && !previewing;
  const enabled = isAuthenticated && !isOwner && !!currentUser.orgId;

  useEffect(() => {
    if (!enabled) { setRequests([]); return; }
    let alive = true;
    (async () => {
      try {
        const rows = await getAll(getActiveOrgId(), 'paymentRequests');
        if (alive) setRequests((rows as PaymentRequest[]).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)));
      } catch (e) { console.warn('[REQUESTS] load failed', e); }
    })();
    return () => { alive = false; };
  }, [enabled, currentUser.orgId]);

  const ownerFor = (propertyId?: string, unitId?: string) =>
    (units.find(u => u.id === unitId) as any)?.ownerId ?? (properties.find(p => p.id === propertyId) as any)?.ownerId;

  const patch = async (id: string, data: Partial<PaymentRequest>) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
    await updateOne(getActiveOrgId(), 'paymentRequests', id, data);
  };

  const addRequest: Ctx['addRequest'] = async (input) => {
    if (!canWrite || previewing) return { ok: false, error: 'ليست لديك صلاحية رفع طلب.' };
    if (!(input.amount > 0)) return { ok: false, error: 'اكتب المبلغ' };
    const req: PaymentRequest = {
      ...input,
      id: newId(),
      ownerId: input.scope === 'property' ? ownerFor(input.propertyId, input.unitId) : undefined,
      status: 'pending',
      requestedBy: currentUser.name,
      requestedById: currentUser.id,
      requestedAt: new Date().toISOString(),
    };
    try {
      await setOne(getActiveOrgId(), 'paymentRequests', req.id, req);
      setRequests(prev => [req, ...prev]);
      logAudit('add', 'طلب صرف', req.category, `طلب صرف ${req.amount} ${req.currency} — ${req.category} — ${currentUser.name}`);
      return { ok: true };
    } catch { return { ok: false, error: 'تعذّر رفع الطلب. تحقق من الاتصال وأعد المحاولة.' }; }
  };

  const approve: Ctx['approve'] = async (id, pay) => {
    if (!canApprove) return { ok: false, error: 'الاعتماد للمدير فقط.' };
    const r = requests.find(x => x.id === id);
    if (!r || r.status !== 'pending') return { ok: false, error: 'الطلب ما عاد بانتظار الموافقة.' };
    const res = await addExpense({
      scope: r.scope, propertyId: r.propertyId, unitId: r.unitId, category: r.category,
      amount: r.amount, currency: r.currency, date: pay.date, vendor: r.vendor,
      paymentMethod: pay.paymentMethod, referenceNumber: pay.referenceNumber,
      notes: [r.notes, `طلب صرف من ${r.requestedBy}`].filter(Boolean).join(' — '),
    } as any);
    if (!res.ok) return res;
    const expenseId = (res.value as any)?.id;
    await patch(id, { status: 'approved', decidedBy: currentUser.name, decidedAt: new Date().toISOString(), expenseId });
    return { ok: true, expenseId };
  };

  const reject: Ctx['reject'] = async (id, reason) => {
    if (!canApprove) return { ok: false, error: 'الرفض للمدير فقط.' };
    await patch(id, { status: 'rejected', decidedBy: currentUser.name, decidedAt: new Date().toISOString(), rejectReason: reason || undefined });
    logAudit('edit', 'طلب صرف', id, `رفض طلب صرف${reason ? ` — ${reason}` : ''}`);
    return { ok: true };
  };

  const withdraw: Ctx['withdraw'] = async (id) => {
    await patch(id, { status: 'withdrawn', decidedAt: new Date().toISOString() });
    return { ok: true };
  };

  const pendingCount = useMemo(() => requests.filter(r => r.status === 'pending').length, [requests]);

  return (
    <RequestsContext.Provider value={{ requests, canApprove, pendingCount, addRequest, approve, reject, withdraw }}>
      {children}
    </RequestsContext.Provider>
  );
}

export function useRequests() {
  const c = useContext(RequestsContext);
  if (!c) throw new Error('useRequests must be inside RequestsProvider');
  return c;
}
