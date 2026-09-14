import {
  collection, doc, getDocs, getDoc,
  addDoc, setDoc, deleteDoc, deleteField,
  runTransaction, query, where,
  serverTimestamp,
  type DocumentData, type QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';

// ── المؤسسة النشطة (tenant) للجلسة الحالية ───────────────────────────────────
// تطبيق عميل بمستخدم واحد: مؤسسة واحدة نشطة في كل لحظة. تُضبط عند الدخول وتُمسح عند الخروج.
// تحل محل الثابت القديم ORG_ID='main' الذي كان يجعل كل المستخدمين يتشاركون نفس البيانات.
let _activeOrgId: string | null = null;
export function setActiveOrgId(orgId: string | null): void { _activeOrgId = orgId; }
export function getActiveOrgId(): string {
  if (!_activeOrgId) throw new Error('Active org not set — user not authenticated');
  return _activeOrgId;
}

/**
 * حوّل الحقول ذات القيمة undefined إلى حذف فعلي للحقل من المستند.
 * كل الكتابات هنا merge، لذا الحقل الذي يُمرَّر undefined يُحذَف من الـ patch
 * ويبقى في Firestore بقيمته القديمة. استخدم هذا عندما يعني المسح "امسح الحقل"
 * (مثال: إزالة هاتف الضيف، أو مسح cancelledAt عند إعادة تفعيل حجز).
 */
export function withFieldDeletes(data: DocumentData): DocumentData {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === undefined ? deleteField() : v]),
  );
}

function stripUndefined(obj: DocumentData): DocumentData {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

function normalizeTimestamps(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj?.toDate === 'function') return obj.toDate().toISOString();
  if (Array.isArray(obj)) return obj.map(normalizeTimestamps);
  if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, normalizeTimestamps(v)])
    );
  }
  return obj;
}

function orgCol(orgId: string, col: string) {
  return collection(db, 'orgs', orgId, col);
}
function orgDoc(orgId: string, col: string, id: string) {
  return doc(db, 'orgs', orgId, col, id);
}

export async function getAll(orgId: string, col: string): Promise<DocumentData[]> {
  const snap = await getDocs(orgCol(orgId, col));
  // id: d.id يجب أن يأتي آخراً ليكون دائماً هو الأولوية بغض النظر عن الحقول المخزّنة داخل المستند
  return snap.docs.map(d => ({ ...normalizeTimestamps(d.data()), id: d.id }));
}

// استعلام محصور — لجلب سجلات مالك واحد فقط (مثلاً where('ownerId','==',ownerId))
export async function getWhere(orgId: string, col: string, constraints: QueryConstraint[]): Promise<DocumentData[]> {
  const snap = await getDocs(query(orgCol(orgId, col), ...constraints));
  return snap.docs.map(d => ({ ...normalizeTimestamps(d.data()), id: d.id }));
}

// إعادة تصدير دالة where لاستخدامها في بناء القيود من خارج هذا الملف
export { where };

export async function getOne(orgId: string, col: string, id: string) {
  const snap = await getDoc(orgDoc(orgId, col, id));
  return snap.exists() ? { ...normalizeTimestamps(snap.data()), id: snap.id } : null;
}

export async function addOne(orgId: string, col: string, data: DocumentData) {
  const ref = await addDoc(orgCol(orgId, col), stripUndefined({
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  return ref.id;
}

export async function setOne(orgId: string, col: string, id: string, data: DocumentData) {
  await setDoc(orgDoc(orgId, col, id), stripUndefined({
    ...data,
    // Preserve existing createdAt (e.g. from backup import); only set if missing
    ...(data.createdAt == null ? { createdAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  }));
  console.log(`[Firestore] Data written to Firebase: ${col}/${id}`);
}

export async function updateOne(orgId: string, col: string, id: string, data: Partial<DocumentData>) {
  await setDoc(orgDoc(orgId, col, id), stripUndefined({
    ...data,
    updatedAt: serverTimestamp(),
  }), { merge: true });
}

export async function deleteOne(orgId: string, col: string, id: string) {
  await deleteDoc(orgDoc(orgId, col, id));
}

export async function deleteAll(orgId: string, col: string): Promise<void> {
  const snap = await getDocs(orgCol(orgId, col));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

/**
 * تحديث مشروط وذرّي: لا يكتب إلا إذا كانت قيمة الحقل في قاعدة البيانات مطابقة للمتوقع.
 *
 * ضروري لأي كتابة تنبع من "قراءة ثم قرار" (مثل وسم الدفعات المتأخرة تلقائياً):
 * اللقطة التي بُني عليها القرار قد تكون قديمة، فبدون هذا الشرط تكتب الحالة القديمة
 * فوق حالة أحدث كتبها المستخدم للتو (مثل دفعة أكّد استلامها ⇒ تعود "متأخرة").
 *
 * يرجع: 'updated' كُتبت | 'skipped' القيمة الحالية مختلفة فلم تُكتب | 'missing' المستند غير موجود.
 */
export async function updateIfFieldEquals(
  orgId: string,
  col: string,
  id: string,
  field: string,
  expected: unknown,
  patch: DocumentData,
): Promise<'updated' | 'skipped' | 'missing'> {
  return runTransaction(db, async tx => {
    const ref  = orgDoc(orgId, col, id);
    const snap = await tx.get(ref);
    if (!snap.exists()) return 'missing' as const;
    if (snap.data()?.[field] !== expected) return 'skipped' as const;
    tx.set(ref, stripUndefined({ ...patch, updatedAt: serverTimestamp() }), { merge: true });
    return 'updated' as const;
  });
}

/** خطأ معاملة برمز ثابت — يُترجم إلى رسالة عربية في طبقة الواجهة. */
export class TxError extends Error {
  constructor(public code: string, message?: string) { super(message ?? code); this.name = 'TxError'; }
}

/**
 * إعادة جدولة أقساط عقد ذرّياً: تعديل العقد + حذف الأقساط المعلّقة المستبدَلة +
 * إنشاء الجديدة في معاملة واحدة. إما أن تنجح كلها أو لا يتغيّر شيء — فلا يبقى
 * عقد معدَّل بجدول ناقص.
 *
 * `expectEndDate` حارس تفاؤلي: يرفض الطلب المبني على فترة تغيّرت من جهاز آخر.
 */
export async function runContractRescheduleTransaction(p: {
  orgId: string;
  contractId: string;
  contractPatch: DocumentData;
  removePaymentIds: string[];
  createPayments: { id: string; data: DocumentData }[];
  expectEndDate?: string;
}): Promise<void> {
  const now = serverTimestamp();
  await runTransaction(db, async tx => {
    const contractRef = orgDoc(p.orgId, 'contracts', p.contractId);
    const snap = await tx.get(contractRef);
    if (!snap.exists()) throw new TxError('CONTRACT_MISSING');
    if (p.expectEndDate !== undefined && snap.data()?.endDate !== p.expectEndDate) {
      throw new TxError('TERM_CHANGED');
    }

    tx.set(contractRef, stripUndefined({ ...p.contractPatch, updatedAt: now }), { merge: true });
    for (const id of p.removePaymentIds) tx.delete(orgDoc(p.orgId, 'payments', id));
    for (const { id, data } of p.createPayments) {
      tx.set(orgDoc(p.orgId, 'payments', id), stripUndefined({ ...data, createdAt: now, updatedAt: now }));
    }
  });
}

/**
 * تجديد عقد ذرّياً — يقرأ العقد والوحدة **من الخادم** لا من الحالة المحلية:
 *  - يرفض إن تغيّرت فترة العقد بعد بناء الطلب (TERM_CHANGED).
 *  - يرفض إن صارت الوحدة مرتبطة بعقد آخر (UNIT_CONFLICT).
 * معرّفات الأقساط ثابتة مشتقّة من الفترة، فإعادة المحاولة أو الضغط المزدوج
 * يكتب المستندات نفسها بدل أن يضاعف الجدول.
 */
export async function runRenewalTransaction(p: {
  orgId: string;
  contractId: string;
  unitId: string;
  expectEndDate: string;
  contractPatch: DocumentData;
  unitPatch: DocumentData;
  payments: { id: string; data: DocumentData }[];
}): Promise<void> {
  const now = serverTimestamp();
  await runTransaction(db, async tx => {
    const contractRef = orgDoc(p.orgId, 'contracts', p.contractId);
    const unitRef     = orgDoc(p.orgId, 'units', p.unitId);

    // كل القراءات قبل أي كتابة (شرط معاملات Firestore)
    const contractSnap = await tx.get(contractRef);
    const unitSnap     = await tx.get(unitRef);

    if (!contractSnap.exists()) throw new TxError('CONTRACT_MISSING');
    if (contractSnap.data()?.endDate !== p.expectEndDate) throw new TxError('TERM_CHANGED');

    if (unitSnap.exists()) {
      const current = unitSnap.data()?.currentContractId;
      if (current && current !== p.contractId) throw new TxError('UNIT_CONFLICT');
    }

    tx.set(contractRef, stripUndefined({ ...p.contractPatch, updatedAt: now }), { merge: true });
    tx.set(unitRef, stripUndefined({ ...p.unitPatch, updatedAt: now }), { merge: true });
    for (const { id, data } of p.payments) {
      tx.set(orgDoc(p.orgId, 'payments', id), stripUndefined({ ...data, createdAt: now, updatedAt: now }));
    }
  });
}

// ─── Atomic contract creation ─────────────────────────────────────────────────
// Writes contract + unit update + tenant contractIds + all payments in one
// transaction so a network drop mid-way can never leave partial data.
export interface ContractTransactionPayload {
  orgId:      string;
  contract:   DocumentData;
  unitId:     string;
  unitPatch:  DocumentData;
  tenantId:   string;
  tenantPatch: DocumentData;
  payments:   { id: string; data: DocumentData }[];
}

export async function runContractTransaction(p: ContractTransactionPayload): Promise<void> {
  const now = serverTimestamp();
  await runTransaction(db, async tx => {
    const contractRef = orgDoc(p.orgId, 'contracts', p.contract['id'] as string);
    const unitRef     = orgDoc(p.orgId, 'units', p.unitId);
    const tenantRef   = orgDoc(p.orgId, 'tenants', p.tenantId);

    // Read unit first to verify it's still vacant (race condition guard)
    const unitSnap = await tx.get(unitRef);
    if (unitSnap.exists()) {
      const currentContractId = unitSnap.data()['currentContractId'];
      if (currentContractId && currentContractId !== p.contract['id']) {
        throw new Error('الوحدة أُجِّرت لعقد آخر في نفس الوقت');
      }
    }

    tx.set(contractRef, stripUndefined({ ...p.contract, createdAt: now, updatedAt: now }));
    tx.set(unitRef,     stripUndefined({ ...unitSnap.data(), ...p.unitPatch, updatedAt: now }), { merge: true });
    tx.set(tenantRef,   stripUndefined({ ...p.tenantPatch, updatedAt: now }), { merge: true });

    for (const { id, data } of p.payments) {
      const payRef = orgDoc(p.orgId, 'payments', id);
      tx.set(payRef, stripUndefined({ ...data, createdAt: now, updatedAt: now }));
    }
  });
}
