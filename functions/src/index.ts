import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';

admin.initializeApp();
const db = admin.firestore();

const ORG_ID  = 'main';
const REGION  = 'us-central1';
const TZ      = 'Asia/Riyadh';

// ─── helpers ─────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function orgCol(col: string) {
  return db.collection('orgs').doc(ORG_ID).collection(col);
}

async function addAuditLog(
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
  await orgCol('auditLogs').doc(entry.id).set(entry);
}

// ─── [1] إنهاء العقود تلقائياً كل يوم ───────────────────────────────────────

export const dailyContractExpiry = onSchedule(
  { schedule: 'every day 00:05', timeZone: TZ, region: REGION },
  async () => {
    const todayStr = today();
    logger.info(`[dailyContractExpiry] running for date: ${todayStr}`);

    const snap = await orgCol('contracts')
      .where('status', '==', 'active')
      .where('endDate', '<', todayStr)
      .get();

    if (snap.empty) {
      logger.info('[dailyContractExpiry] no contracts to expire');
      return;
    }

    const batch = db.batch();
    const unitUpdates: { unitId: string; tenantId: string }[] = [];

    snap.docs.forEach(doc => {
      const c = doc.data();
      batch.update(doc.ref, { status: 'expired' });
      if (c['unitId']) {
        unitUpdates.push({ unitId: c['unitId'], tenantId: c['tenantId'] });
      }
    });

    for (const { unitId } of unitUpdates) {
      const unitRef = orgCol('units').doc(unitId);
      batch.update(unitRef, {
        status: 'vacant',
        currentTenantId:  admin.firestore.FieldValue.delete(),
        currentContractId: admin.firestore.FieldValue.delete(),
      });
    }

    await batch.commit();

    await addAuditLog(
      'edit', 'عقد', 'تشغيل تلقائي',
      `تم إنهاء ${snap.size} عقد تلقائياً وتحرير ${unitUpdates.length} وحدة`,
    );

    logger.info(`[dailyContractExpiry] expired ${snap.size} contracts`);
  },
);

// ─── [2] تحويل الدفعات لـ overdue كل يوم ────────────────────────────────────

export const dailyPaymentOverdue = onSchedule(
  { schedule: 'every day 06:00', timeZone: TZ, region: REGION },
  async () => {
    const todayStr = today();
    logger.info(`[dailyPaymentOverdue] running for date: ${todayStr}`);

    const snap = await orgCol('payments')
      .where('status', '==', 'pending')
      .where('dueDate', '<', todayStr)
      .get();

    if (snap.empty) {
      logger.info('[dailyPaymentOverdue] no payments to mark overdue');
      return;
    }

    const chunkSize = 400;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const batch = db.batch();
      chunk.forEach(doc => batch.update(doc.ref, { status: 'overdue' }));
      await batch.commit();
    }

    await addAuditLog(
      'edit', 'دفعة', 'تشغيل تلقائي',
      `تم تحويل ${snap.size} دفعة إلى متأخرة تلقائياً`,
    );

    logger.info(`[dailyPaymentOverdue] marked ${snap.size} payments as overdue`);
  },
);

// ─── [3] توليد رقم إيصال تسلسلي عند تأكيد الدفع ─────────────────────────────

export const generateReceiptNumber = onDocumentWritten(
  {
    document: `orgs/${ORG_ID}/payments/{paymentId}`,
    region:   REGION,
  },
  async event => {
    const after  = event.data?.after.exists  ? event.data.after.data()  : null;
    const before = event.data?.before.exists ? event.data.before.data() : null;

    if (!after || after['status'] !== 'paid') return;
    if (after['receiptNumber'] && !String(after['receiptNumber']).startsWith('RCP-PENDING-')) return;
    if (before?.['status'] === 'paid') return;

    const paymentId = event.params['paymentId'];
    const counterRef = db.collection('orgs').doc(ORG_ID).collection('_counters').doc('receipts');

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

      logger.info(`[generateReceiptNumber] ${paymentId} → ${receipt}`);
    });
  },
);

// ─── [4] فحص دوري للسلامة أسبوعياً ──────────────────────────────────────────

export const weeklyIntegrityCheck = onSchedule(
  { schedule: 'every monday 03:00', timeZone: TZ, region: REGION },
  async () => {
    logger.info('[weeklyIntegrityCheck] starting...');

    const [contractsSnap, unitsSnap, paymentsSnap] = await Promise.all([
      orgCol('contracts').where('status', '==', 'active').get(),
      orgCol('units').where('status', '==', 'rented').get(),
      orgCol('payments').where('status', '==', 'pending').get(),
    ]);

    const activeContractUnitIds = new Set(contractsSnap.docs.map(d => d.data()['unitId']));
    const issues: string[] = [];

    unitsSnap.docs.forEach(doc => {
      if (!activeContractUnitIds.has(doc.id)) {
        issues.push(`وحدة ${doc.id} حالتها rented لكن لا يوجد عقد active`);
      }
    });

    const activeContractIds = new Set(contractsSnap.docs.map(d => d.id));
    const orphanPayments = paymentsSnap.docs.filter(d => {
      const cid = d.data()['contractId'];
      return cid && !activeContractIds.has(cid);
    });
    if (orphanPayments.length > 0) {
      issues.push(`${orphanPayments.length} دفعة معلقة مرتبطة بعقود غير نشطة`);
    }

    if (issues.length > 0) {
      await addAuditLog('edit', 'فحص سلامة', 'أسبوعي', `تحذيرات: ${issues.join(' | ')}`);
      logger.warn('[weeklyIntegrityCheck] issues found:', issues);
    } else {
      logger.info('[weeklyIntegrityCheck] all clear');
    }
  },
);
