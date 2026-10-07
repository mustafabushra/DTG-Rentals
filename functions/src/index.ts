import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import {
  SYSTEM_PROMPT, validateRequest, parseModelJson, sanitizeExtraction, createRateLimiter,
} from './lib/extraction';

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

// ─── [5] قراءة عقد من صورة ───────────────────────────────────────────────────
// دالة قابلة للنداء: الهوية تأتي محقَّقة من Firebase في request.auth، فلا تحقق
// يدوي من الرموز ولا CORS ولا رابط علني — وهذا سبب اختيار onCall على onRequest.
//
// السرّ يسكن Secret Manager لا متغيّرات البيئة ولا المستودع:
//   firebase functions:secrets:set ANTHROPIC_API_KEY

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const MODEL = 'claude-sonnet-5';
const scanLimiter = createRateLimiter({ max: 30, windowMs: 60 * 60_000 });

export const extractContract = onCall(
  {
    region: REGION,
    secrets: [ANTHROPIC_API_KEY],
    memory: '512MiB',
    timeoutSeconds: 120,
    // الصورة حتى 5 ميجابايت base64 ⇒ نحتاج سعة طلب أكبر من الافتراضي
    enforceAppCheck: false,
  },
  async (request) => {
    // ① الهوية — Firebase تحقّقت منها قبل وصول الطلب
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'الجلسة غير صالحة. أعد تسجيل الدخول.');
    }

    // ② حدّ المعدل لكل مستخدم
    const gate = scanLimiter.check(uid);
    if (!gate.allowed) {
      throw new HttpsError(
        'resource-exhausted',
        `تجاوزت الحد المسموح. أعد المحاولة بعد ${Math.ceil(gate.retryAfterMs / 60000)} دقيقة.`,
      );
    }

    // ③ صحة الطلب — قبل إنفاق أي استدعاء مدفوع
    const check = validateRequest(request.data);
    if (!check.ok) {
      throw new HttpsError('invalid-argument', check.message, { code: check.code });
    }

    // ④ القراءة
    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY.value(),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: check.image.mimeType, data: check.image.data },
              },
              { type: 'text', text: 'اقرأ هذا العقد وأرجِع JSON فقط.' },
            ],
          }],
        }),
      });
    } catch (e) {
      logger.error('extractContract: upstream unreachable', e);
      throw new HttpsError('unavailable', 'تعذّر الوصول إلى خدمة القراءة. أعد المحاولة.');
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.error('extractContract: upstream error', { status: res.status, detail: detail.slice(0, 400) });
      throw new HttpsError(
        res.status === 429 ? 'resource-exhausted' : 'internal',
        res.status === 429
          ? 'الخدمة مزدحمة حالياً. أعد المحاولة بعد قليل.'
          : 'تعذّرت قراءة الصورة. أعد المحاولة أو أدخل البيانات يدوياً.',
      );
    }

    const data = await res.json() as { content?: { type?: string; text?: string }[] };
    const text = (data.content ?? [])
      .filter(b => b?.type === 'text')
      .map(b => b.text ?? '')
      .join('\n');

    const extraction = sanitizeExtraction(parseModelJson(text));
    if (!extraction) {
      logger.warn('extractContract: unparseable model output', { uid });
      throw new HttpsError(
        'failed-precondition',
        'لم تُقرأ الصورة بوضوح. صوّر العقد مستوياً بإضاءة أفضل، أو أدخل البيانات يدوياً.',
      );
    }

    logger.info('extractContract: ok', { uid, remaining: gate.remaining });
    return { extraction };
  },
);
