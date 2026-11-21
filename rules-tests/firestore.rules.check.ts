/**
 * اختبارات قواعد الصلاحيات — تشتغل في CI على محاكي Firestore قبل نشر القواعد.
 * لو أي اختبار فشل، القواعد ما تنتشر.
 *
 * السؤال الأساسي: هل يقدر أي أحد (حتى لو فتح أدوات المتصفح وكتب استعلام بنفسه)
 * يطلع بيانات مو له؟
 */
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll } from 'vitest';
import {
  initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';

let env: RulesTestEnvironment;
const ORG = 'org1';
const users: Record<string, any> = {
  admin:   { role: 'admin',   orgId: ORG, status: 'active' },
  manager: { role: 'manager', orgId: ORG, status: 'active' },
  viewer:  { role: 'viewer',  orgId: ORG, status: 'active', ownerId: 'oA' },
  ownerA:  { role: 'owner',   orgId: ORG, status: 'active', ownerId: 'oA' },
  ownerB:  { role: 'owner',   orgId: ORG, status: 'active', ownerId: 'oB' },
  suspendedAdmin: { role: 'admin', orgId: ORG, status: 'suspended' },
  outsider: { role: 'admin',  orgId: 'org2', status: 'active' },
};
const db = (u?: string) => (u ? env.authenticatedContext(u) : env.unauthenticatedContext()).firestore();
const d = (u: string | undefined, col: string, id: string) => doc(db(u), `orgs/${ORG}/${col}/${id}`);
const c = (u: string | undefined, col: string) => collection(db(u), `orgs/${ORG}/${col}`);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-dtg-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
  await env.withSecurityRulesDisabled(async ctx => {
    const f = ctx.firestore();
    for (const [uid, data] of Object.entries(users)) await setDoc(doc(f, `users/${uid}`), data);
    const put = (col: string, id: string, data: any) => setDoc(doc(f, `orgs/${ORG}/${col}/${id}`), data);
    await put('properties', 'p1', { name: 'برج A', ownerId: 'oA' });
    await put('properties', 'p2', { name: 'برج B', ownerId: 'oB' });
    await put('tenants', 'tA', { name: 'مستأجر A', phone: '0500000001', ownerIds: ['oA'] });
    await put('tenants', 'tB', { name: 'مستأجر B', phone: '0500000002', ownerIds: ['oB'] });
    await put('attachments', 'attA', { name: 'صك A', ownerId: 'oA', entityType: 'unit', entityId: 'u1' });
    await put('attachments', 'attB', { name: 'صك B', ownerId: 'oB', entityType: 'unit', entityId: 'u2' });
    await put('attachments', 'attCtx', { name: 'رفعها A', ownerContext: 'oA', entityType: 'unit', entityId: 'u1' });
    await put('fileChunks', 'attB_0', { fileId: 'attB', index: 0, data: 'xxx', ownerId: 'oB' });
    await put('payments', 'payB', { contractId: 'cB', amount: 100, status: 'paid', ownerId: 'oB' });
    await put('paymentRequests', 'r1', { amount: 50, status: 'pending' });
    await put('settings', 'assistant', { apiKey: 'SECRET' });
    await put('settings', 'system', { currency: 'SAR' });
    await put('errorLogs', 'e1', { message: 'x', userId: 'admin' });
    await setDoc(doc(f, `orgs/${ORG}/auditLogs/l1`), { details: 'x' });
  });
});

afterAll(async () => { await env?.cleanup(); });

describe('المالك التابع يشوف اللي له بس', () => {
  it('عقاره نعم، عقار غيره لا', async () => {
    await assertSucceeds(getDoc(d('ownerA', 'properties', 'p1')));
    await assertFails(getDoc(d('ownerA', 'properties', 'p2')));
  });
  it('ما يقدر يسحب كل العقارات باستعلام من المتصفح', async () => {
    await assertFails(getDocs(c('ownerA', 'properties')));
    await assertSucceeds(getDocs(query(c('ownerA', 'properties'), where('ownerId', '==', 'oA'))));
  });
  it('المستأجرين: حقه بس، وما يقدر يسحب الكل', async () => {
    await assertSucceeds(getDoc(d('ownerA', 'tenants', 'tA')));
    await assertFails(getDoc(d('ownerA', 'tenants', 'tB')));
    await assertFails(getDocs(c('ownerA', 'tenants')));
    await assertSucceeds(getDocs(query(c('ownerA', 'tenants'), where('ownerIds', 'array-contains', 'oA'))));
  });
  it('المرفقات والصكوك: حقه بس', async () => {
    await assertSucceeds(getDoc(d('ownerA', 'attachments', 'attA')));
    await assertSucceeds(getDoc(d('ownerA', 'attachments', 'attCtx')));
    await assertFails(getDoc(d('ownerA', 'attachments', 'attB')));
    await assertFails(getDocs(c('ownerA', 'attachments')));
    await assertSucceeds(getDocs(query(c('ownerA', 'attachments'), where('ownerId', '==', 'oA'))));
    await assertSucceeds(getDocs(query(c('ownerA', 'attachments'), where('ownerContext', '==', 'oA'))));
  });
  it('أجزاء ملف مالك ثاني: لا', async () => {
    await assertFails(getDoc(d('ownerA', 'fileChunks', 'attB_0')));
  });
  it('دفعات مالك ثاني: لا', async () => {
    await assertFails(getDoc(d('ownerA', 'payments', 'payB')));
  });
  it('طلبات الصرف وسجل الأخطاء وسجل الإجراءات وسرّ المساعد: لا', async () => {
    await assertFails(getDoc(d('ownerA', 'paymentRequests', 'r1')));
    await assertFails(getDoc(d('ownerA', 'errorLogs', 'e1')));
    await assertFails(getDoc(d('ownerA', 'auditLogs', 'l1')));
    await assertFails(getDoc(d('ownerA', 'settings', 'assistant')));
    await assertSucceeds(getDoc(d('ownerA', 'settings', 'system')));
  });
  it('ما يعدّل مستأجر غيره، وما يسجّل عقار باسم غيره', async () => {
    await assertFails(updateDoc(d('ownerA', 'tenants', 'tB'), { phone: '0599999999' }));
    await assertFails(setDoc(d('ownerA', 'properties', 'pX'), { name: 'x', ownerId: 'oB' }));
  });
});

describe('يشوف كل شي (viewer)', () => {
  it('يقرا بيانات كل الملاك', async () => {
    await assertSucceeds(getDoc(d('viewer', 'properties', 'p2')));
    await assertSucceeds(getDoc(d('viewer', 'tenants', 'tB')));
    await assertSucceeds(getDoc(d('viewer', 'attachments', 'attB')));
    await assertSucceeds(getDocs(c('viewer', 'payments')));
  });
  it('ما يكتب ولا يحذف، وما يشوف سرّ المساعد', async () => {
    await assertFails(setDoc(d('viewer', 'properties', 'pV'), { name: 'x', ownerId: 'oA' }));
    await assertFails(updateDoc(d('viewer', 'properties', 'p1'), { name: 'y' }));
    await assertFails(getDoc(d('viewer', 'settings', 'assistant')));
  });
});

describe('الموظفين والمدير', () => {
  it('المدير التنفيذي يقرا ويكتب، وما يشوف سرّ المساعد', async () => {
    await assertSucceeds(getDocs(c('manager', 'tenants')));
    await assertSucceeds(setDoc(d('manager', 'properties', 'pM'), { name: 'جديد', ownerId: 'oA' }));
    await assertFails(getDoc(d('manager', 'settings', 'assistant')));
  });
  it('المدير يشوف سجل الأخطاء', async () => {
    await assertSucceeds(getDocs(c('admin', 'errorLogs')));
  });
  it('مدير موقوف: ما يقرا شي', async () => {
    await assertFails(getDoc(d('suspendedAdmin', 'properties', 'p1')));
  });
});

describe('من برا المؤسسة', () => {
  it('مدير مؤسسة ثانية ما يشوف شي', async () => {
    await assertFails(getDoc(d('outsider', 'properties', 'p1')));
    await assertFails(getDocs(c('outsider', 'tenants')));
  });
  it('بدون تسجيل دخول: ولا شي', async () => {
    await assertFails(getDoc(d(undefined, 'properties', 'p1')));
    await assertFails(getDoc(d(undefined, 'settings', 'system')));
  });
});

describe('الحسابات', () => {
  it('المستخدم ما يقدر يرفع صلاحيته بنفسه', async () => {
    await assertFails(updateDoc(doc(db('ownerA'), 'users/ownerA'), { role: 'admin' }));
    await assertFails(updateDoc(doc(db('ownerA'), 'users/ownerA'), { ownerId: 'oB' }));
    await assertSucceeds(updateDoc(doc(db('ownerA'), 'users/ownerA'), { phone: '0501111111' }));
  });
  it('ما يقرا ملف مستخدم ثاني', async () => {
    await assertFails(getDoc(doc(db('ownerA'), 'users/ownerB')));
  });
});

describe('سجل الأخطاء', () => {
  it('أي عضو يرسل تقرير باسمه بس', async () => {
    await assertSucceeds(setDoc(d('ownerA', 'errorLogs', 'eA'), { message: 'boom', userId: 'ownerA' }));
    await assertFails(setDoc(d('ownerA', 'errorLogs', 'eB'), { message: 'boom', userId: 'admin' }));
  });
});
