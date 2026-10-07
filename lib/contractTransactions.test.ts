/**
 * اختبارات انحدار لمعاملتَي العقد الذرّيتين.
 *
 * تُحاكى طبقة Firestore بالكامل (vi.mock) فلا تلمس هذه الاختبارات شبكة ولا
 * بيانات سحابية — تتحقق من عقد المعاملة نفسه: ترتيب القراءة قبل الكتابة،
 * الحرّاس (فترة تغيّرت، وحدة مرتبطة بعقد آخر)، وثبات المعرّفات ضد التكرار.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── محاكاة Firestore ───────────────────────────────────────────────────────
const state: {
  docs: Record<string, any>;
  writes: { op: 'set' | 'delete'; path: string; data?: any }[];
  readsBeforeFirstWrite: number;
} = { docs: {}, writes: [], readsBeforeFirstWrite: 0 };

vi.mock('firebase/firestore', () => {
  const makeRef = (path: string) => ({ path });
  return {
    collection: (_db: any, ...parts: string[]) => makeRef(parts.join('/')),
    doc: (_db: any, ...parts: string[]) => makeRef(parts.join('/')),
    getDocs: vi.fn(), getDoc: vi.fn(), addDoc: vi.fn(),
    setDoc: vi.fn(), deleteDoc: vi.fn(), deleteField: () => '__delete__',
    query: vi.fn(), where: vi.fn(),
    serverTimestamp: () => '__ts__',
    runTransaction: async (_db: any, fn: any) => {
      const tx = {
        get: async (ref: { path: string }) => {
          if (state.writes.length === 0) state.readsBeforeFirstWrite++;
          const data = state.docs[ref.path];
          return { exists: () => data !== undefined, data: () => data };
        },
        set: (ref: { path: string }, data: any) => {
          state.writes.push({ op: 'set', path: ref.path, data });
          state.docs[ref.path] = { ...(state.docs[ref.path] ?? {}), ...data };
        },
        delete: (ref: { path: string }) => {
          state.writes.push({ op: 'delete', path: ref.path });
          delete state.docs[ref.path];
        },
      };
      return fn(tx);
    },
  };
});
vi.mock('./firebase', () => ({ db: {} }));

import { runContractRescheduleTransaction, runRenewalTransaction, runTransferTransaction, TxError } from './firestoreService';

const ORG = 'org1';
const C = `orgs/${ORG}/contracts/c1`;
const U = `orgs/${ORG}/units/u1`;

beforeEach(() => {
  state.docs = {
    [C]: { endDate: '2026-12-31', annualValue: 80000 },
    [U]: { currentContractId: 'c1' },
  };
  state.writes = [];
  state.readsBeforeFirstWrite = 0;
});

const renewalArgs = (over: any = {}) => ({
  orgId: ORG, contractId: 'c1', unitId: 'u1',
  expectEndDate: '2026-12-31',
  contractPatch: { startDate: '2027-01-01', endDate: '2027-12-31', status: 'active' },
  unitPatch: { status: 'rented', currentContractId: 'c1' },
  payments: [
    { id: 'pay_c1_t2027-01-01_n5', data: { amount: 40000, dueDate: '2027-01-01' } },
    { id: 'pay_c1_t2027-01-01_n6', data: { amount: 40000, dueDate: '2027-07-01' } },
  ],
  ...over,
});

describe('معاملة التجديد: الحرّاس', () => {
  it('ترفض تعارض الوحدة مع عقد آخر ولا تكتب شيئاً', async () => {
    state.docs[U] = { currentContractId: 'c-other' };
    await expect(runRenewalTransaction(renewalArgs())).rejects.toMatchObject({ code: 'UNIT_CONFLICT' });
    expect(state.writes).toHaveLength(0);
  });

  it('ترفض طلباً مبنياً على فترة تغيّرت على الخادم', async () => {
    state.docs[C] = { endDate: '2027-06-30' };     // جُدِّد من جهاز آخر
    await expect(runRenewalTransaction(renewalArgs())).rejects.toMatchObject({ code: 'TERM_CHANGED' });
    expect(state.writes).toHaveLength(0);
  });

  it('ترفض عقداً غير موجود', async () => {
    delete state.docs[C];
    await expect(runRenewalTransaction(renewalArgs())).rejects.toMatchObject({ code: 'CONTRACT_MISSING' });
    expect(state.writes).toHaveLength(0);
  });

  it('تقبل وحدة شاغرة (بلا عقد حالي)', async () => {
    state.docs[U] = {};
    await expect(runRenewalTransaction(renewalArgs())).resolves.toBeUndefined();
    expect(state.writes.length).toBeGreaterThan(0);
  });

  it('كل القراءات تسبق أول كتابة (شرط معاملات Firestore)', async () => {
    await runRenewalTransaction(renewalArgs());
    expect(state.readsBeforeFirstWrite).toBe(2);   // العقد + الوحدة
  });
});

describe('معاملة التجديد: منع تكرار أقساط الفترة', () => {
  it('إعادة التشغيل بنفس المعرّفات لا تضاعف الأقساط', async () => {
    await runRenewalTransaction(renewalArgs());
    const afterFirst = Object.keys(state.docs).filter(k => k.includes('/payments/'));

    state.writes = [];
    // الحارس يرفض الثانية لأن endDate تغيّر — وهذه هي الحماية الأساسية
    await expect(runRenewalTransaction(renewalArgs())).rejects.toMatchObject({ code: 'TERM_CHANGED' });

    // وحتى لو تجاوز الحارس (إعادة محاولة مشروعة)، المعرّفات ثابتة فلا تتضاعف
    await runRenewalTransaction(renewalArgs({ expectEndDate: '2027-12-31' }));
    const afterRetry = Object.keys(state.docs).filter(k => k.includes('/payments/'));
    expect(afterRetry.sort()).toEqual(afterFirst.sort());
    expect(afterRetry).toHaveLength(2);
  });

  it('تكتب العقد والوحدة وكل الأقساط في تشغيل واحد', async () => {
    await runRenewalTransaction(renewalArgs());
    const paths = state.writes.map(w => w.path);
    expect(paths).toContain(C);
    expect(paths).toContain(U);
    expect(paths.filter(p => p.includes('/payments/'))).toHaveLength(2);
  });
});

describe('معاملة إعادة الجدولة', () => {
  const rescheduleArgs = (over: any = {}) => ({
    orgId: ORG, contractId: 'c1',
    contractPatch: { annualValue: 100000 },
    removePaymentIds: ['old1', 'old2'],
    createPayments: [{ id: 'new1', data: { amount: 60000, dueDate: '2026-10-01' } }],
    expectEndDate: '2026-12-31',
    ...over,
  });

  it('تحذف المعلّقة المحددة وتنشئ الجديدة وتعدّل العقد معاً', async () => {
    state.docs[`orgs/${ORG}/payments/old1`] = { amount: 1 };
    state.docs[`orgs/${ORG}/payments/old2`] = { amount: 2 };
    await runContractRescheduleTransaction(rescheduleArgs());

    expect(state.docs[`orgs/${ORG}/payments/old1`]).toBeUndefined();
    expect(state.docs[`orgs/${ORG}/payments/new1`]).toBeDefined();
    expect(state.docs[C].annualValue).toBe(100000);
  });

  it('ترفض إن تغيّرت الفترة ولا تكتب شيئاً — لا حذف جزئي', async () => {
    state.docs[`orgs/${ORG}/payments/old1`] = { amount: 1 };
    state.docs[C] = { endDate: '2027-12-31' };
    await expect(runContractRescheduleTransaction(rescheduleArgs()))
      .rejects.toMatchObject({ code: 'TERM_CHANGED' });
    expect(state.writes).toHaveLength(0);
    expect(state.docs[`orgs/${ORG}/payments/old1`]).toBeDefined();   // لم تُحذف
  });

  it('ترفض عقداً غير موجود', async () => {
    delete state.docs[C];
    await expect(runContractRescheduleTransaction(rescheduleArgs()))
      .rejects.toMatchObject({ code: 'CONTRACT_MISSING' });
  });

  it('TxError يحمل رمزاً ثابتاً قابلاً للترجمة', () => {
    const e = new TxError('UNIT_CONFLICT');
    expect(e.code).toBe('UNIT_CONFLICT');
    expect(e).toBeInstanceOf(Error);
  });
});

describe('معاملة نقل المستأجر', () => {
  const NEW_C = `orgs/${ORG}/contracts/c-new`;
  const NEW_U = `orgs/${ORG}/units/u-new`;
  const T     = `orgs/${ORG}/tenants/t1`;

  const transferArgs = (over: any = {}) => ({
    orgId: ORG,
    oldContractId: 'c1',
    oldUnitId: 'u1',
    expectOldStatus: 'active',
    oldContractPatch: { status: 'terminated', transferredToContractId: 'c-new' },
    cancelPaymentIds: ['future1'],
    newContractId: 'c-new',
    newContract: { annualValue: 100000, openingCredit: 54160, status: 'active' },
    newUnitId: 'u-new',
    newUnitPatch: { status: 'rented', currentContractId: 'c-new' },
    newPayments: [{ id: 'pay_new_1', data: { amount: 45840, dueDate: '2026-03-01' } }],
    tenantId: 't1',
    tenantContractIds: ['c1', 'c-new'],
    ...over,
  });

  beforeEach(() => {
    state.docs[C] = { endDate: '2026-12-31', status: 'active' };
    state.docs[`orgs/${ORG}/payments/future1`] = { amount: 20000, status: 'pending' };
    state.docs[NEW_U] = {};
    state.docs[T] = { contractIds: ['c1'] };
    delete state.docs[NEW_C];
    state.writes = [];
    state.readsBeforeFirstWrite = 0;
  });

  it('ينفّذ كل الخطوات في تشغيل واحد', async () => {
    await runTransferTransaction(transferArgs());
    expect(state.docs[C].status).toBe('terminated');
    expect(state.docs[C].transferredToContractId).toBe('c-new');
    expect(state.docs[NEW_C]).toBeDefined();
    expect(state.docs[NEW_C].openingCredit).toBe(54160);
    expect(state.docs[`orgs/${ORG}/units/u1`].status).toBe('vacant');
    expect(state.docs[NEW_U].currentContractId).toBe('c-new');
    expect(state.docs[`orgs/${ORG}/payments/pay_new_1`].amount).toBe(45840);
    expect(state.docs[T].contractIds).toEqual(['c1', 'c-new']);
  });

  it('أقساط العقد القديم غير المستحقة تُلغى لا تتحول إلى متأخر', async () => {
    await runTransferTransaction(transferArgs());
    expect(state.docs[`orgs/${ORG}/payments/future1`]).toBeUndefined();
  });

  it('ترفض وحدة مرتبطة بعقد آخر بلا أي كتابة', async () => {
    state.docs[NEW_U] = { currentContractId: 'c-other' };
    await expect(runTransferTransaction(transferArgs())).rejects.toMatchObject({ code: 'UNIT_CONFLICT' });
    expect(state.writes).toHaveLength(0);
    expect(state.docs[`orgs/${ORG}/payments/future1`]).toBeDefined();
  });

  it('ترفض تكرار النقل إن وُجد العقد الجديد (الضغط المزدوج)', async () => {
    state.docs[NEW_C] = { status: 'active' };
    await expect(runTransferTransaction(transferArgs())).rejects.toMatchObject({ code: 'NEW_CONTRACT_EXISTS' });
    expect(state.writes).toHaveLength(0);
  });

  it('ترفض إن تغيّرت حالة العقد القديم من جهاز آخر', async () => {
    state.docs[C] = { status: 'terminated' };
    await expect(runTransferTransaction(transferArgs())).rejects.toMatchObject({ code: 'OLD_CONTRACT_CHANGED' });
    expect(state.writes).toHaveLength(0);
  });

  it('ترفض عقداً قديماً غير موجود', async () => {
    delete state.docs[C];
    await expect(runTransferTransaction(transferArgs())).rejects.toMatchObject({ code: 'OLD_CONTRACT_MISSING' });
  });

  it('كل القراءات تسبق أول كتابة', async () => {
    await runTransferTransaction(transferArgs());
    expect(state.readsBeforeFirstWrite).toBe(3);   // العقد القديم + الجديد + الوحدة الجديدة
  });
});
