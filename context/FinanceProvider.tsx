/**
 * FinanceProvider — المصاريف (عقارات + مكتب) والسندات (قبض + صرف).
 *
 * وحدة مستقلة فوق AppProvider: تقرأ منه المستخدم والصلاحيات والعقارات والدفعات،
 * وتدير مجموعتيها الخاصتين (expenses, vouchers) في مؤسسة المستخدم.
 *
 * قواعد ثابتة:
 *  - كل مصروف يُنشأ مع سند صرفه في معاملة واحدة — لا مصروف بلا سند ولا سند بلا مصروف.
 *  - رقم السند تسلسلي لكل نوع ويُحجز داخل المعاملة نفسها، فلا يتكرر ولا يُحرق.
 *  - لا حذف: المصروف والسند يُلغيان ويبقيان ظاهرين بحالة "ملغي" مع السبب ومن ألغى.
 *  - تعديل يغيّر ما يظهر على السند ⇒ يُلغى السند القديم ويُصدر بديل في المعاملة نفسها.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './AppProvider';
import type { Expense, ExpenseScope, FinanceSettings, Voucher, VoucherType } from '../domain/models';
import {
  amountToArabicWords, formatVoucherNumber, voucherDocId, nextAttempt, activeVoucherFor,
  expenseVoucherFieldsChanged, mergeCategories, validateExpense, VOUCHER_LABEL,
} from '../domain/services/FinanceService';
import { resolvePaymentCurrency } from '../utils/currency';
import {
  getAll, getOne, getWhere, where, updateOne, getActiveOrgId,
  runIssueVoucherTransaction, TxError,
} from '../lib/firestoreService';

type Result<T = undefined> = { ok: true; value?: T } | { ok: false; error: string };

export type ExpenseInput = Omit<Expense, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'voucherId' | 'ownerId' | 'createdBy'>;

interface FinanceContextType {
  expenses: Expense[];
  vouchers: Voucher[];
  financeLoading: boolean;
  categories: (scope: ExpenseScope) => string[];
  addCategory: (scope: ExpenseScope, name: string) => Promise<void>;
  addExpense: (input: ExpenseInput) => Promise<Result<Expense>>;
  updateExpense: (id: string, patch: Partial<ExpenseInput>) => Promise<Result>;
  cancelExpense: (id: string, reason: string) => Promise<Result>;
  /** يصدر سند قبض لدفعة مدفوعة (idempotent: إن وُجد سند سارٍ يُرجعه). */
  issueReceiptForPayment: (paymentId: string, override?: { paidDate?: string; method?: string; referenceNumber?: string; amount?: number }) => Promise<Result<Voucher>>;
  /** يلغي سند القبض الساري لدفعة (عند إلغاء تأكيد استلامها). */
  cancelReceiptForPayment: (paymentId: string, reason: string) => Promise<void>;
  cancelVoucher: (id: string, reason: string) => Promise<Result>;
  receiptFor: (paymentId: string) => Voucher | undefined;
  refreshFinance: () => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const CACHE_KEY = (uid: string) => `dtg-finance-v1:${uid}`;
const today = () => new Date().toISOString().split('T')[0];
const newId = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function readCache(uid: string): { expenses: Expense[]; vouchers: Voucher[]; settings: FinanceSettings } | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CACHE_KEY(uid)) : null;
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeCache(uid: string, data: { expenses: Expense[]; vouchers: Voucher[]; settings: FinanceSettings }) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(CACHE_KEY(uid), JSON.stringify(data)); } catch {}
}

function txMessage(e: any): string {
  if (e instanceof TxError && e.code === 'VOUCHER_EXISTS') return 'هذا السند صدر مسبقاً — حدّث الصفحة.';
  if (e?.code === 'permission-denied') return 'ليست لديك صلاحية تنفيذ هذا الإجراء.';
  if (e?.code === 'unavailable' || /offline|network/i.test(String(e?.message))) return 'تعذّر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.';
  return 'تعذّر الحفظ. أعد المحاولة.';
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const {
    currentUser, isAuthenticated, isOwner, previewing, canWrite, canDelete,
    properties, units, contracts, payments, tenants, logAudit, updateMaintenance,
  } = useApp();

  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [allVouchers, setAllVouchers] = useState<Voucher[]>([]);
  const [settings, setSettings] = useState<FinanceSettings>({});
  const [financeLoading, setFinanceLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const loadGen = useRef(0);

  const uid = currentUser.id;
  const orgId = currentUser.orgId;

  // ── التحميل ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !uid || !orgId) {
      setAllExpenses([]); setAllVouchers([]); setSettings({});
      return;
    }
    const gen = ++loadGen.current;
    const cached = readCache(uid);
    if (cached) {
      setAllExpenses(cached.expenses ?? []);
      setAllVouchers(cached.vouchers ?? []);
      setSettings(cached.settings ?? {});
    }
    setFinanceLoading(!cached);
    (async () => {
      try {
        let org: string;
        try { org = getActiveOrgId(); } catch { org = orgId; }
        // المالك التابع: قواعد Firestore تشترط استعلاماً محصوراً بسجلاته
        const scoped = isOwner && currentUser.ownerId;
        const [exp, vch, fin] = await Promise.all([
          scoped ? getWhere(org, 'expenses', [where('ownerId', '==', currentUser.ownerId)]) : getAll(org, 'expenses'),
          scoped ? getWhere(org, 'vouchers', [where('ownerId', '==', currentUser.ownerId)]) : getAll(org, 'vouchers'),
          getOne(org, 'settings', 'finance').catch(() => null),
        ]);
        if (gen !== loadGen.current) return;
        // دمج لا استبدال: المصاريف والسندات لا تُحذف أبداً، فأي سجل في النسخة المحلية
        // غائب عن الجلب هو نتيجة جلب ناقص (مثل قراءة دون اتصال تعود فارغة من الذاكرة)
        // لا حذف حقيقي — فنُبقيه. نسخة الخادم تفوز عند وجود السجل في الاثنين.
        const merge = <T extends { id: string }>(server: T[], local: T[] = []) => {
          const ids = new Set(server.map(x => x.id));
          return [...server, ...local.filter(x => !ids.has(x.id))];
        };
        const next = {
          expenses: merge(exp as Expense[], cached?.expenses),
          vouchers: merge(vch as Voucher[], cached?.vouchers),
          settings: { ...(cached?.settings ?? {}), ...((fin ?? {}) as FinanceSettings) },
        };
        setAllExpenses(next.expenses);
        setAllVouchers(next.vouchers);
        setSettings(next.settings);
        writeCache(uid, next);
      } catch (e) {
        console.warn('[FINANCE] load failed', e);
      } finally {
        if (gen === loadGen.current) setFinanceLoading(false);
      }
    })();
  }, [isAuthenticated, uid, orgId, isOwner, currentUser.ownerId, reloadTick]);

  // حفظ النسخة المحلية بعد كل تعديل
  // (لا نكتب حالة فارغة: لحظة تبديل المستخدم قد تحمل حالة سابقة فارغة قبل قراءة نسخته)
  useEffect(() => {
    if (!uid || (allExpenses.length === 0 && allVouchers.length === 0)) return;
    writeCache(uid, { expenses: allExpenses, vouchers: allVouchers, settings });
  }, [uid, allExpenses, allVouchers, settings]);

  // ── الرؤية: المالك (أو معاينة المالك) يرى مصاريف عقاراته فقط، بلا مصاريف المكتب ──
  const restrict = isOwner || previewing;
  const visiblePropIds = useMemo(() => new Set(properties.map(p => p.id)), [properties]);
  const expenses = useMemo(() => restrict
    ? allExpenses.filter(e => e.scope === 'property' && e.propertyId && visiblePropIds.has(e.propertyId))
    : allExpenses,
  [restrict, allExpenses, visiblePropIds]);
  const vouchers = useMemo(() => restrict
    ? allVouchers.filter(v => v.propertyId && visiblePropIds.has(v.propertyId))
    : allVouchers,
  [restrict, allVouchers, visiblePropIds]);

  const org = () => { try { return getActiveOrgId(); } catch { return orgId ?? ''; } };

  const guardWrite = (): string | null => {
    if (previewing) return 'وضع المعاينة للعرض فقط.';
    if (!canWrite) return 'ليست لديك صلاحية الإضافة أو التعديل.';
    return null;
  };

  // ── التصنيفات ──────────────────────────────────────────────────────────────
  const categories = useCallback((scope: ExpenseScope) =>
    mergeCategories(scope, scope === 'office' ? settings.officeCategories : settings.propertyCategories),
  [settings]);

  const addCategory = async (scope: ExpenseScope, name: string) => {
    const t = name.trim();
    if (!t) return;
    const key = scope === 'office' ? 'officeCategories' : 'propertyCategories';
    const list = Array.from(new Set([...(settings[key] ?? []), t]));
    setSettings(s => ({ ...s, [key]: list }));
    try { await updateOne(org(), 'settings', 'finance', { [key]: list }); }
    catch (e) { console.warn('[FINANCE] category save failed', e); }
  };

  // ── بناء بيانات سند الصرف من مصروف ─────────────────────────────────────────
  const describeExpense = (e: Expense) => {
    const prop = properties.find(p => p.id === e.propertyId);
    const unit = units.find(u => u.id === e.unitId);
    const where_ = e.scope === 'office'
      ? 'مصاريف المكتب'
      : [prop?.name, unit ? `وحدة ${(unit as any).number ?? ''}` : ''].filter(Boolean).join(' — ');
    return [e.category, where_, e.notes?.trim()].filter(Boolean).join(' — ');
  };

  const buildPaymentVoucher = (e: Expense, seq: number): Voucher => ({
    id: '',
    type: 'payment',
    number: formatVoucherNumber('payment', seq),
    seq,
    date: e.date,
    amount: e.amount,
    currency: e.currency,
    amountInWords: amountToArabicWords(e.amount, e.currency),
    partyName: e.vendor?.trim() || e.category,
    description: describeExpense(e),
    paymentMethod: e.paymentMethod,
    referenceNumber: e.referenceNumber,
    propertyId: e.propertyId,
    unitId: e.unitId,
    ownerId: e.ownerId,
    expenseId: e.id,
    status: 'issued',
    issuedBy: currentUser.name,
    createdAt: new Date().toISOString(),
  });

  const ownerFor = (propertyId?: string, unitId?: string) =>
    units.find(u => u.id === unitId)?.ownerId ?? properties.find(p => p.id === propertyId)?.ownerId;

  // ── المصاريف ──────────────────────────────────────────────────────────────
  const addExpense = async (input: ExpenseInput): Promise<Result<Expense>> => {
    const blocked = guardWrite(); if (blocked) return { ok: false, error: blocked };
    const errs = validateExpense(input);
    if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };

    const id = newId('exp');
    const vId = voucherDocId('payment', id, 0);
    const expense: Expense = {
      ...input,
      id,
      propertyId: input.scope === 'office' ? undefined : input.propertyId,
      unitId: input.scope === 'office' ? undefined : input.unitId,
      ownerId: input.scope === 'office' ? undefined : ownerFor(input.propertyId, input.unitId),
      status: 'active',
      voucherId: vId,
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
    };
    try {
      const { seq } = await runIssueVoucherTransaction({
        orgId: org(), voucherId: vId, type: 'payment',
        build: s => ({ ...buildPaymentVoucher(expense, s), id: vId }),
        sourcePatch: { col: 'expenses', id, data: expense },
      });
      const voucher = { ...buildPaymentVoucher(expense, seq), id: vId };
      setAllExpenses(prev => [expense, ...prev]);
      setAllVouchers(prev => [voucher, ...prev]);
      // مصروف ناشئ عن طلب صيانة ⇒ تُحدَّث تكلفة الطلب لتطابق ما صُرف فعلاً
      if (expense.maintenanceId) updateMaintenance(expense.maintenanceId, { cost: expense.amount });
      logAudit('add', expense.scope === 'office' ? 'مصروف مكتب' : 'مصروف عقار', voucher.number,
        `تسجيل مصروف ${expense.category} بمبلغ ${expense.amount} ${expense.currency} — سند صرف ${voucher.number}`);
      return { ok: true, value: expense };
    } catch (e) {
      console.error('[FINANCE] addExpense failed', e);
      return { ok: false, error: txMessage(e) };
    }
  };

  const updateExpense = async (id: string, patch: Partial<ExpenseInput>): Promise<Result> => {
    const blocked = guardWrite(); if (blocked) return { ok: false, error: blocked };
    const before = allExpenses.find(e => e.id === id);
    if (!before) return { ok: false, error: 'المصروف غير موجود.' };
    if (before.status === 'cancelled') return { ok: false, error: 'لا يمكن تعديل مصروف ملغي.' };
    const after: Expense = {
      ...before, ...patch,
      ownerId: (patch.scope ?? before.scope) === 'office' ? undefined
        : ownerFor(patch.propertyId ?? before.propertyId, patch.unitId ?? before.unitId),
    };
    const errs = validateExpense(after);
    if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };

    try {
      if (expenseVoucherFieldsChanged(before, patch)) {
        // ما يظهر على السند تغيّر ⇒ سند بديل برقم جديد، والقديم يُلغى في المعاملة نفسها
        const old = activeVoucherFor(allVouchers, 'payment', id);
        const attempt = nextAttempt(allVouchers, 'payment', id);
        const vId = voucherDocId('payment', id, attempt);
        const cancelPatch = old ? {
          status: 'cancelled', cancelledAt: new Date().toISOString(), cancelledBy: currentUser.name,
          cancelReason: 'تعديل بيانات المصروف — صدر سند بديل',
        } : undefined;
        const next = { ...after, voucherId: vId };
        const { seq } = await runIssueVoucherTransaction({
          orgId: org(), voucherId: vId, type: 'payment',
          build: s => ({ ...buildPaymentVoucher(next, s), id: vId }),
          cancelVoucherId: old?.id, cancelPatch,
          sourcePatch: { col: 'expenses', id, data: { ...patch, ownerId: next.ownerId ?? null, voucherId: vId } },
        });
        const voucher = { ...buildPaymentVoucher(next, seq), id: vId };
        setAllExpenses(prev => prev.map(e => e.id === id ? next : e));
        setAllVouchers(prev => [voucher, ...prev.map(v => v.id === old?.id ? { ...v, ...(cancelPatch as any) } : v)]);
        logAudit('edit', 'مصروف', voucher.number,
          `تعديل مصروف${old ? ` — أُلغي السند ${old.number} وصدر بديل ${voucher.number}` : ''}`);
      } else {
        await updateOne(org(), 'expenses', id, { ...patch });
        setAllExpenses(prev => prev.map(e => e.id === id ? after : e));
        logAudit('edit', 'مصروف', before.category, 'تعديل ملاحظات/بيانات المصروف');
      }
      return { ok: true };
    } catch (e) {
      console.error('[FINANCE] updateExpense failed', e);
      return { ok: false, error: txMessage(e) };
    }
  };

  const cancelExpense = async (id: string, reason: string): Promise<Result> => {
    if (previewing) return { ok: false, error: 'وضع المعاينة للعرض فقط.' };
    if (!canDelete) return { ok: false, error: 'إلغاء المصاريف للمدير فقط.' };
    if (!reason.trim()) return { ok: false, error: 'اكتب سبب الإلغاء.' };
    const exp = allExpenses.find(e => e.id === id);
    if (!exp) return { ok: false, error: 'المصروف غير موجود.' };
    const stamp = { status: 'cancelled' as const, cancelledAt: new Date().toISOString(), cancelledBy: currentUser.name, cancelReason: reason.trim() };
    const v = activeVoucherFor(allVouchers, 'payment', id);
    try {
      await updateOne(org(), 'expenses', id, stamp);
      if (v) await updateOne(org(), 'vouchers', v.id, stamp);
      setAllExpenses(prev => prev.map(e => e.id === id ? { ...e, ...stamp } : e));
      if (v) setAllVouchers(prev => prev.map(x => x.id === v.id ? { ...x, ...stamp } as Voucher : x));
      logAudit('edit', 'مصروف', v?.number ?? exp.category, `إلغاء المصروف — السبب: ${reason.trim()}`);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: txMessage(e) };
    }
  };

  // ── سندات القبض ───────────────────────────────────────────────────────────
  const receiptFor = useCallback((paymentId: string) =>
    activeVoucherFor(allVouchers, 'receipt', paymentId), [allVouchers]);

  const issueReceiptForPayment: FinanceContextType['issueReceiptForPayment'] = async (paymentId, override) => {
    if (previewing) return { ok: false, error: 'وضع المعاينة للعرض فقط.' };
    const existing = activeVoucherFor(allVouchers, 'receipt', paymentId);
    if (existing) return { ok: true, value: existing };
    const pay = payments.find(p => p.id === paymentId);
    if (!pay) return { ok: false, error: 'الدفعة غير موجودة.' };
    const contract = contracts.find(c => c.id === pay.contractId);
    const unit = units.find(u => u.id === contract?.unitId);
    const prop = properties.find(p => p.id === unit?.propertyId);
    const tenant = tenants.find(t => t.id === contract?.tenantId);
    const currency = resolvePaymentCurrency(pay as any, contracts as any, units as any, properties as any);
    const amount = override?.amount ?? pay.amount;
    const date = override?.paidDate ?? pay.paidDate ?? today();
    const method = (override?.method ?? (pay as any).method) as Voucher['paymentMethod'];
    const attempt = nextAttempt(allVouchers, 'receipt', paymentId);
    const vId = voucherDocId('receipt', paymentId, attempt);
    const build = (seq: number): Voucher => ({
      id: vId,
      type: 'receipt',
      number: formatVoucherNumber('receipt', seq),
      seq,
      date,
      amount,
      currency,
      amountInWords: amountToArabicWords(amount, currency),
      partyName: tenant?.name ?? '—',
      description: [
        `دفعة إيجار رقم ${pay.installmentNumber}`,
        contract?.contractNumber ? `عقد ${contract.contractNumber}` : '',
        [prop?.name, unit ? `وحدة ${(unit as any).number ?? ''}` : ''].filter(Boolean).join(' — '),
      ].filter(Boolean).join(' — '),
      paymentMethod: method === ('bank_transfer' as any) ? 'transfer' : method,
      referenceNumber: override?.referenceNumber ?? pay.referenceNumber,
      propertyId: prop?.id,
      unitId: unit?.id,
      ownerId: (pay as any).ownerId ?? contract?.ownerId ?? ownerFor(prop?.id, unit?.id),
      contractId: contract?.id,
      paymentId,
      status: 'issued',
      issuedBy: currentUser.name,
      createdAt: new Date().toISOString(),
    });
    try {
      const { seq } = await runIssueVoucherTransaction({ orgId: org(), voucherId: vId, type: 'receipt', build });
      const voucher = build(seq);
      setAllVouchers(prev => [voucher, ...prev]);
      logAudit('add', VOUCHER_LABEL.receipt, voucher.number,
        `إصدار سند قبض ${voucher.number} — ${voucher.partyName} — ${amount} ${currency}`);
      return { ok: true, value: voucher };
    } catch (e) {
      console.error('[FINANCE] issueReceipt failed', e);
      return { ok: false, error: txMessage(e) };
    }
  };

  const cancelReceiptForPayment = async (paymentId: string, reason: string) => {
    const v = activeVoucherFor(allVouchers, 'receipt', paymentId);
    if (!v) return;
    const stamp = { status: 'cancelled' as const, cancelledAt: new Date().toISOString(), cancelledBy: currentUser.name, cancelReason: reason };
    try {
      await updateOne(org(), 'vouchers', v.id, stamp);
      setAllVouchers(prev => prev.map(x => x.id === v.id ? { ...x, ...stamp } : x));
      logAudit('edit', VOUCHER_LABEL.receipt, v.number, `إلغاء سند القبض — ${reason}`);
    } catch (e) {
      console.error('[FINANCE] cancel receipt failed', e);
    }
  };

  const cancelVoucher = async (id: string, reason: string): Promise<Result> => {
    if (previewing) return { ok: false, error: 'وضع المعاينة للعرض فقط.' };
    if (!canDelete) return { ok: false, error: 'إلغاء السندات للمدير فقط.' };
    if (!reason.trim()) return { ok: false, error: 'اكتب سبب الإلغاء.' };
    const v = allVouchers.find(x => x.id === id);
    if (!v) return { ok: false, error: 'السند غير موجود.' };
    if (v.status === 'cancelled') return { ok: true };
    // سند الصرف مرتبط بمصروف: إلغاؤه وحده يترك مصروفاً بلا سند ⇒ يُلغى المصروف معه
    if (v.type === 'payment' && v.expenseId) return cancelExpense(v.expenseId, reason);
    const stamp = { status: 'cancelled' as const, cancelledAt: new Date().toISOString(), cancelledBy: currentUser.name, cancelReason: reason.trim() };
    try {
      await updateOne(org(), 'vouchers', id, stamp);
      setAllVouchers(prev => prev.map(x => x.id === id ? { ...x, ...stamp } : x));
      logAudit('edit', VOUCHER_LABEL[v.type as VoucherType], v.number, `إلغاء السند — السبب: ${reason.trim()}`);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: txMessage(e) };
    }
  };

  const value: FinanceContextType = {
    expenses, vouchers, financeLoading,
    categories, addCategory,
    addExpense, updateExpense, cancelExpense,
    issueReceiptForPayment, cancelReceiptForPayment, cancelVoucher, receiptFor,
    refreshFinance: () => setReloadTick(t => t + 1),
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextType {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}

