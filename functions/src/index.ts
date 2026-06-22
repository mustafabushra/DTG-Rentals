import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';

admin.initializeApp();
const db = admin.firestore();

const REGION  = 'us-central1';
const TZ      = 'Asia/Riyadh';

// ─── helpers ─────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0];
}

async function addAuditLog(
  orgId: string,
  action: 'add' | 'edit' | 'delete',
  entityType: string,
  entityName: string,
  details: string,
) {
  const entry = {
    id:         `al${Date.now()}`,
    action,
    entityType,
    entityName,
    userId:     'system',
    userName:   'النظام التلقائي',
    timestamp:  new Date().toISOString(),
    details,
  };
  await db.collection('orgs').doc(orgId).collection('auditLogs').doc(entry.id).set(entry);
}

// ─── [1] إنهاء العقود تلقائياً كل يوم ───────────────────────────────────────

export const dailyContractExpiry = onSchedule(
  { schedule: 'every day 00:05', timeZone: TZ, region: REGION },
  async () => {
    const todayStr = today();
    logger.info(`[dailyContractExpiry] running for date: ${todayStr}`);

    const snap = await db.collectionGroup('contracts')
      .where('status', '==', 'active')
      .where('endDate', '<', todayStr)
      .get();

    if (snap.empty) {
      logger.info('[dailyContractExpiry] no contracts to expire');
      return;
    }

    // Group docs by org
    const docsByOrg = new Map<string, typeof snap.docs>();
    snap.docs.forEach(doc => {
      const orgId = doc.ref.parent.parent!.id;
      if (!docsByOrg.has(orgId)) {
        docsByOrg.set(orgId, []);
      }
      docsByOrg.get(orgId)!.push(doc);
    });

    // Process each org
    for (const [orgId, orgDocs] of docsByOrg.entries()) {
      const chunkSize = 400;
      for (let i = 0; i < orgDocs.length; i += chunkSize) {
        const chunk = orgDocs.slice(i, i + chunkSize);
        const batch = db.batch();
        const unitUpdates: { unitId: string; tenantId: string }[] = [];

        chunk.forEach(doc => {
          const c = doc.data();
          batch.update(doc.ref, { status: 'expired' });
          if (c['unitId']) {
            unitUpdates.push({ unitId: c['unitId'], tenantId: c['tenantId'] });
          }
        });

        for (const { unitId } of unitUpdates) {
          const unitRef = db.collection('orgs').doc(orgId).collection('units').doc(unitId);
          batch.update(unitRef, {
            status: 'vacant',
            currentTenantId:  admin.firestore.FieldValue.delete(),
            currentContractId: admin.firestore.FieldValue.delete(),
          });
        }

        await batch.commit();
      }

      await addAuditLog(
        orgId,
        'edit', 'عقد', 'تشغيل تلقائي',
        `تم إنهاء ${orgDocs.length} عقد تلقائياً وتحرير ${orgDocs.length} وحدة`,
      );
    }

    logger.info(`[dailyContractExpiry] expired ${snap.size} contracts across all orgs`);
  },
);

// ─── [2] تحويل الدفعات لـ overdue كل يوم ────────────────────────────────────

export const dailyPaymentOverdue = onSchedule(
  { schedule: 'every day 06:00', timeZone: TZ, region: REGION },
  async () => {
    const todayStr = today();
    logger.info(`[dailyPaymentOverdue] running for date: ${todayStr}`);

    const snap = await db.collectionGroup('payments')
      .where('status', '==', 'pending')
      .where('dueDate', '<', todayStr)
      .get();

    if (snap.empty) {
      logger.info('[dailyPaymentOverdue] no payments to mark overdue');
      return;
    }

    // Group docs by org
    const docsByOrg = new Map<string, typeof snap.docs>();
    snap.docs.forEach(doc => {
      const orgId = doc.ref.parent.parent!.id;
      if (!docsByOrg.has(orgId)) {
        docsByOrg.set(orgId, []);
      }
      docsByOrg.get(orgId)!.push(doc);
    });

    // Process each org
    for (const [orgId, orgDocs] of docsByOrg.entries()) {
      const chunkSize = 400;
      for (let i = 0; i < orgDocs.length; i += chunkSize) {
        const chunk = orgDocs.slice(i, i + chunkSize);
        const batch = db.batch();
        chunk.forEach(doc => batch.update(doc.ref, { status: 'overdue' }));
        await batch.commit();
      }

      await addAuditLog(
        orgId,
        'edit', 'دفعة', 'تشغيل تلقائي',
        `تم تحويل ${orgDocs.length} دفعة إلى متأخرة تلقائياً`,
      );
    }

    logger.info(`[dailyPaymentOverdue] marked ${snap.size} payments as overdue across all orgs`);
  },
);

// ─── [3] توليد رقم إيصال تسلسلي عند تأكيد الدفع ─────────────────────────────

export const generateReceiptNumber = onDocumentWritten(
  {
    document: 'orgs/{orgId}/payments/{paymentId}',
    region:   REGION,
  },
  async event => {
    const after  = event.data?.after.exists  ? event.data.after.data()  : null;
    const before = event.data?.before.exists ? event.data.before.data() : null;

    if (!after || after['status'] !== 'paid') return;
    if (after['receiptNumber'] && !String(after['receiptNumber']).startsWith('RCP-PENDING-')) return;
    if (before?.['status'] === 'paid') return;

    const paymentId = event.params['paymentId'];
    const orgId     = event.params['orgId'];
    const counterRef = db.collection('orgs').doc(orgId).collection('_counters').doc('receipts');

    await db.runTransaction(async tx => {
      const counterDoc = await tx.get(counterRef);
      const current    = counterDoc.exists ? (counterDoc.data()!['value'] as number) : 0;
      const next       = current + 1;

      const year    = new Date().getFullYear();
      const padded  = String(next).padStart(6, '0');
      const receipt = `RCP-${year}-${padded}`;

      tx.set(counterRef, { value: next }, { merge: true });
      if (event.data?.after.ref) {
        tx.update(event.data.after.ref, { receiptNumber: receipt });
      }

      logger.info(`[generateReceiptNumber] ${orgId}/${paymentId} → ${receipt}`);
    });
  },
);

// ─── [4] فحص دوري للسلامة أسبوعياً ──────────────────────────────────────────

export const weeklyIntegrityCheck = onSchedule(
  { schedule: 'every monday 03:00', timeZone: TZ, region: REGION },
  async () => {
    logger.info('[weeklyIntegrityCheck] starting...');

    const [contractsSnap, unitsSnap, paymentsSnap] = await Promise.all([
      db.collectionGroup('contracts').where('status', '==', 'active').get(),
      db.collectionGroup('units').where('status', '==', 'rented').get(),
      db.collectionGroup('payments').where('status', '==', 'pending').get(),
    ]);

    // Group docs by org
    const contractsByOrg = new Map<string, typeof contractsSnap.docs>();
    const unitsByOrg = new Map<string, typeof unitsSnap.docs>();
    const paymentsByOrg = new Map<string, typeof paymentsSnap.docs>();

    contractsSnap.docs.forEach(doc => {
      const orgId = doc.ref.parent.parent!.id;
      if (!contractsByOrg.has(orgId)) {
        contractsByOrg.set(orgId, []);
      }
      contractsByOrg.get(orgId)!.push(doc);
    });

    unitsSnap.docs.forEach(doc => {
      const orgId = doc.ref.parent.parent!.id;
      if (!unitsByOrg.has(orgId)) {
        unitsByOrg.set(orgId, []);
      }
      unitsByOrg.get(orgId)!.push(doc);
    });

    paymentsSnap.docs.forEach(doc => {
      const orgId = doc.ref.parent.parent!.id;
      if (!paymentsByOrg.has(orgId)) {
        paymentsByOrg.set(orgId, []);
      }
      paymentsByOrg.get(orgId)!.push(doc);
    });

    // Get all orgs to check
    const allOrgIds = new Set<string>([
      ...contractsByOrg.keys(),
      ...unitsByOrg.keys(),
      ...paymentsByOrg.keys(),
    ]);

    // Check each org independently
    for (const orgId of allOrgIds) {
      const orgContracts = contractsByOrg.get(orgId) || [];
      const orgUnits = unitsByOrg.get(orgId) || [];
      const orgPayments = paymentsByOrg.get(orgId) || [];

      const activeContractUnitIds = new Set(orgContracts.map(d => d.data()['unitId']));
      const issues: string[] = [];

      orgUnits.forEach(doc => {
        if (!activeContractUnitIds.has(doc.id)) {
          issues.push(`وحدة ${doc.id} حالتها rented لكن لا يوجد عقد active`);
        }
      });

      const activeContractIds = new Set(orgContracts.map(d => d.id));
      const orphanPayments = orgPayments.filter(d => {
        const cid = d.data()['contractId'];
        return cid && !activeContractIds.has(cid);
      });
      if (orphanPayments.length > 0) {
        issues.push(`${orphanPayments.length} دفعة معلقة مرتبطة بعقود غير نشطة`);
      }

      if (issues.length > 0) {
        await addAuditLog(orgId, 'edit', 'فحص سلامة', 'أسبوعي', `تحذيرات: ${issues.join(' | ')}`);
        logger.warn(`[weeklyIntegrityCheck] ${orgId} issues:`, issues);
      } else {
        logger.info(`[weeklyIntegrityCheck] ${orgId} all clear`);
      }
    }

    logger.info('[weeklyIntegrityCheck] completed for all orgs');
  },
);

// ─── [5] استبدال كود الدعوة → إنشاء حساب المستخدم وربطه بمؤسسته ─────────────
// البوابة الآمنة الوحيدة التي يُنشأ عبرها مستخدم بـ orgId يخصّ مؤسسة قائمة (وليس uid).
// قواعد Firestore تمنع المستخدم من فعل ذلك بنفسه عمداً؛ هنا الـ Admin SDK يتجاوزها
// بعد التحقق من كود دعوة صالح (الكود نفسه هو "السر" الذي يصرّح بالانضمام).
// تُستدعى بدون مصادقة (المستخدم لا يملك حساباً بعد) — الحماية بالكود + الاستهلاك لمرة واحدة.
const OWNER_ROLES = ['owner', 'مالك'];

export const redeemInvite = onCall({ region: REGION }, async (request) => {
  const code     = String(request.data?.code ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const email    = String(request.data?.email ?? '').trim().toLowerCase();
  const password = String(request.data?.password ?? '');

  if (!code)                                          throw new HttpsError('invalid-argument', 'الكود مطلوب');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))       throw new HttpsError('invalid-argument', 'بريد إلكتروني غير صحيح');
  if (password.length < 6)                            throw new HttpsError('invalid-argument', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');

  // البحث عن الدعوة عبر كل المؤسسات (المستخدم لا يعرف orgId)
  const snap = await db.collectionGroup('invites')
    .where('code', '==', code)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  if (snap.empty) throw new HttpsError('not-found', 'الكود غير صحيح أو استُخدم مسبقاً');

  const inviteRef = snap.docs[0].ref;
  const invite    = snap.docs[0].data();
  const orgId     = inviteRef.parent.parent!.id;

  if (invite['expiresAt'] && new Date(invite['expiresAt']).getTime() < Date.now()) {
    throw new HttpsError('deadline-exceeded', 'انتهت صلاحية الكود — اطلب كوداً جديداً');
  }
  // حماية حرجة للعزل: دعوة بدور "مالك" يجب أن تحمل ownerId، وإلا سيرى المالك كل بيانات المؤسسة
  if (OWNER_ROLES.includes(invite['role']) && !invite['ownerId']) {
    throw new HttpsError('failed-precondition', 'الدعوة غير مكتملة (مالك بلا ربط) — راجع المدير');
  }

  // 1) إنشاء حساب المصادقة أولاً (نفشل مبكراً قبل المساس بالدعوة لو الإيميل مستخدم)
  let uid: string;
  try {
    const userRecord = await admin.auth().createUser({ email, password, displayName: invite['name'] });
    uid = userRecord.uid;
  } catch (e: any) {
    if (e.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'هذا البريد مسجّل مسبقاً — استخدم تسجيل الدخول');
    }
    logger.error('[redeemInvite] createUser failed', e);
    throw new HttpsError('internal', 'تعذّر إنشاء الحساب');
  }

  // 2) استهلاك الدعوة + كتابة الملف الشخصي ضمن معاملة واحدة (حارس ضد إعادة الاستخدام المتزامن)
  try {
    await db.runTransaction(async tx => {
      const fresh = await tx.get(inviteRef);
      if (!fresh.exists || fresh.data()!['status'] !== 'pending') {
        throw new HttpsError('failed-precondition', 'الكود استُخدم بالفعل');
      }
      tx.update(inviteRef, {
        status: 'used',
        usedBy: uid,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.set(db.doc(`users/${uid}`), {
        name:      invite['name'],
        email,
        role:      invite['role'],
        orgId,
        ...(invite['ownerId'] ? { ownerId: invite['ownerId'] } : {}),
        status:    'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.set(db.collection('orgs').doc(orgId).collection('managedUsers').doc(uid), {
        name:      invite['name'],
        email,
        role:      invite['role'],
        ...(invite['ownerId'] ? { ownerId: invite['ownerId'] } : {}),
        status:    'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  } catch (e) {
    // خسرنا السباق أو فشلت الكتابة → نظّف حساب المصادقة اليتيم
    await admin.auth().deleteUser(uid).catch(() => { /* تجاهل */ });
    throw e instanceof HttpsError ? e : new HttpsError('internal', 'تعذّر إكمال التسجيل');
  }

  // 3) رمز مخصّص لتسجيل الدخول فوراً دون إعادة إدخال
  const token = await admin.auth().createCustomToken(uid);
  return { token };
});
