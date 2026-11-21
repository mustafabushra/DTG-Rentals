import { describe, it, expect, vi, beforeEach } from 'vitest';

const store: Record<string, Record<string, any>> = {};
vi.mock('./firestoreService', () => ({
  getAll: vi.fn(async (_o: string, c: string) => Object.values(store[c] ?? {})),
  getOne: vi.fn(async (_o: string, c: string, id: string) => store[c]?.[id] ?? null),
  setOne: vi.fn(async (_o: string, c: string, id: string, d: any) => { (store[c] ??= {})[id] = { ...d, id }; }),
}));
import { buildFullBackup, restoreExtras } from './backupBuilder';

beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

describe('النسخة الاحتياطية الكاملة', () => {
  it('تشمل المرفقات والملفات الكبيرة وطلبات الصرف والإعدادات — بدون سرّ المساعد', async () => {
    store.owners = { o1: { id: 'o1' } };
    store.attachments = { a1: { id: 'a1', chunks: 2 } };
    store.fileChunks = { a1_0: { id: 'a1_0' }, a1_1: { id: 'a1_1' } };
    store.paymentRequests = { r1: { id: 'r1' } };
    store.settings = { system: { id: 'system', currency: 'SAR' }, assistant: { id: 'assistant', apiKey: 'SECRET' } };
    const b = await buildFullBackup('org');
    expect(b.version).toBe('2.0');
    expect(b.summary.fileChunks).toBe(2);
    expect(b.data.paymentRequests).toHaveLength(1);
    expect(JSON.stringify(b)).not.toContain('SECRET');
  });

  it('الاستعادة: السند الموجود ما يتغيّر، والناقص ينضاف، والعدّاد ياخذ الأكبر', async () => {
    store.vouchers = { v1: { id: 'v1', amount: 100 } };
    store.counters = { vouchers: { id: 'vouchers', receipt: 50, payment: 3 } };
    const r = await restoreExtras('org', {
      data: { vouchers: [{ id: 'v1', amount: 999 }, { id: 'v2', amount: 5 }], attachments: [{ id: 'a9' }] },
      counters: { vouchers: { receipt: 40, payment: 9 } },
      settings: { finance: { id: 'finance', officeCategories: ['x'] } },
    });
    expect(r.errors).toEqual([]);
    expect(store.vouchers.v1.amount).toBe(100);
    expect(store.vouchers.v2.amount).toBe(5);
    expect(store.counters.vouchers.receipt).toBe(50);
    expect(store.counters.vouchers.payment).toBe(9);
    expect(store.attachments.a9).toBeTruthy();
    expect(store.settings.finance.officeCategories).toEqual(['x']);
  });
});
