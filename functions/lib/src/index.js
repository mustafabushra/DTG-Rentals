"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.weeklyIntegrityCheck = exports.generateReceiptNumber = exports.dailyPaymentOverdue = exports.dailyContractExpiry = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-functions/v2/firestore");
const v2_1 = require("firebase-functions/v2");
admin.initializeApp();
const db = admin.firestore();
const REGION = 'us-central1';
const TZ = 'Asia/Riyadh';
// ─── helpers ─────────────────────────────────────────────────────────────────
function today() {
    return new Date().toISOString().split('T')[0];
}
async function addAuditLog(orgId, action, entityType, entityName, details) {
    const entry = {
        id: `al${Date.now()}`,
        action,
        entityType,
        entityName,
        userId: 'system',
        userName: 'النظام التلقائي',
        timestamp: new Date().toISOString(),
        details,
    };
    await db.collection('orgs').doc(orgId).collection('auditLogs').doc(entry.id).set(entry);
}
// ─── [1] إنهاء العقود تلقائياً كل يوم ───────────────────────────────────────
exports.dailyContractExpiry = (0, scheduler_1.onSchedule)({ schedule: 'every day 00:05', timeZone: TZ, region: REGION }, async () => {
    const todayStr = today();
    v2_1.logger.info(`[dailyContractExpiry] running for date: ${todayStr}`);
    const snap = await db.collectionGroup('contracts')
        .where('status', '==', 'active')
        .where('endDate', '<', todayStr)
        .get();
    if (snap.empty) {
        v2_1.logger.info('[dailyContractExpiry] no contracts to expire');
        return;
    }
    // Group docs by org
    const docsByOrg = new Map();
    snap.docs.forEach(doc => {
        const orgId = doc.ref.parent.parent.id;
        if (!docsByOrg.has(orgId)) {
            docsByOrg.set(orgId, []);
        }
        docsByOrg.get(orgId).push(doc);
    });
    // Process each org
    for (const [orgId, orgDocs] of docsByOrg.entries()) {
        const chunkSize = 400;
        for (let i = 0; i < orgDocs.length; i += chunkSize) {
            const chunk = orgDocs.slice(i, i + chunkSize);
            const batch = db.batch();
            const unitUpdates = [];
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
                    currentTenantId: admin.firestore.FieldValue.delete(),
                    currentContractId: admin.firestore.FieldValue.delete(),
                });
            }
            await batch.commit();
        }
        await addAuditLog(orgId, 'edit', 'عقد', 'تشغيل تلقائي', `تم إنهاء ${orgDocs.length} عقد تلقائياً وتحرير ${orgDocs.length} وحدة`);
    }
    v2_1.logger.info(`[dailyContractExpiry] expired ${snap.size} contracts across all orgs`);
});
// ─── [2] تحويل الدفعات لـ overdue كل يوم ────────────────────────────────────
exports.dailyPaymentOverdue = (0, scheduler_1.onSchedule)({ schedule: 'every day 06:00', timeZone: TZ, region: REGION }, async () => {
    const todayStr = today();
    v2_1.logger.info(`[dailyPaymentOverdue] running for date: ${todayStr}`);
    const snap = await db.collectionGroup('payments')
        .where('status', '==', 'pending')
        .where('dueDate', '<', todayStr)
        .get();
    if (snap.empty) {
        v2_1.logger.info('[dailyPaymentOverdue] no payments to mark overdue');
        return;
    }
    // Group docs by org
    const docsByOrg = new Map();
    snap.docs.forEach(doc => {
        const orgId = doc.ref.parent.parent.id;
        if (!docsByOrg.has(orgId)) {
            docsByOrg.set(orgId, []);
        }
        docsByOrg.get(orgId).push(doc);
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
        await addAuditLog(orgId, 'edit', 'دفعة', 'تشغيل تلقائي', `تم تحويل ${orgDocs.length} دفعة إلى متأخرة تلقائياً`);
    }
    v2_1.logger.info(`[dailyPaymentOverdue] marked ${snap.size} payments as overdue across all orgs`);
});
// ─── [3] توليد رقم إيصال تسلسلي عند تأكيد الدفع ─────────────────────────────
exports.generateReceiptNumber = (0, firestore_1.onDocumentWritten)({
    document: 'orgs/{orgId}/payments/{paymentId}',
    region: REGION,
}, async (event) => {
    var _a, _b;
    const after = ((_a = event.data) === null || _a === void 0 ? void 0 : _a.after.exists) ? event.data.after.data() : null;
    const before = ((_b = event.data) === null || _b === void 0 ? void 0 : _b.before.exists) ? event.data.before.data() : null;
    if (!after || after['status'] !== 'paid')
        return;
    if (after['receiptNumber'] && !String(after['receiptNumber']).startsWith('RCP-PENDING-'))
        return;
    if ((before === null || before === void 0 ? void 0 : before['status']) === 'paid')
        return;
    const paymentId = event.params['paymentId'];
    const orgId = event.params['orgId'];
    const counterRef = db.collection('orgs').doc(orgId).collection('_counters').doc('receipts');
    await db.runTransaction(async (tx) => {
        var _a;
        const counterDoc = await tx.get(counterRef);
        const current = counterDoc.exists ? counterDoc.data()['value'] : 0;
        const next = current + 1;
        const year = new Date().getFullYear();
        const padded = String(next).padStart(6, '0');
        const receipt = `RCP-${year}-${padded}`;
        tx.set(counterRef, { value: next }, { merge: true });
        if ((_a = event.data) === null || _a === void 0 ? void 0 : _a.after.ref) {
            tx.update(event.data.after.ref, { receiptNumber: receipt });
        }
        v2_1.logger.info(`[generateReceiptNumber] ${orgId}/${paymentId} → ${receipt}`);
    });
});
// ─── [4] فحص دوري للسلامة أسبوعياً ──────────────────────────────────────────
exports.weeklyIntegrityCheck = (0, scheduler_1.onSchedule)({ schedule: 'every monday 03:00', timeZone: TZ, region: REGION }, async () => {
    v2_1.logger.info('[weeklyIntegrityCheck] starting...');
    const [contractsSnap, unitsSnap, paymentsSnap] = await Promise.all([
        db.collectionGroup('contracts').where('status', '==', 'active').get(),
        db.collectionGroup('units').where('status', '==', 'rented').get(),
        db.collectionGroup('payments').where('status', '==', 'pending').get(),
    ]);
    // Group docs by org
    const contractsByOrg = new Map();
    const unitsByOrg = new Map();
    const paymentsByOrg = new Map();
    contractsSnap.docs.forEach(doc => {
        const orgId = doc.ref.parent.parent.id;
        if (!contractsByOrg.has(orgId)) {
            contractsByOrg.set(orgId, []);
        }
        contractsByOrg.get(orgId).push(doc);
    });
    unitsSnap.docs.forEach(doc => {
        const orgId = doc.ref.parent.parent.id;
        if (!unitsByOrg.has(orgId)) {
            unitsByOrg.set(orgId, []);
        }
        unitsByOrg.get(orgId).push(doc);
    });
    paymentsSnap.docs.forEach(doc => {
        const orgId = doc.ref.parent.parent.id;
        if (!paymentsByOrg.has(orgId)) {
            paymentsByOrg.set(orgId, []);
        }
        paymentsByOrg.get(orgId).push(doc);
    });
    // Get all orgs to check
    const allOrgIds = new Set([
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
        const issues = [];
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
            v2_1.logger.warn(`[weeklyIntegrityCheck] ${orgId} issues:`, issues);
        }
        else {
            v2_1.logger.info(`[weeklyIntegrityCheck] ${orgId} all clear`);
        }
    }
    v2_1.logger.info('[weeklyIntegrityCheck] completed for all orgs');
});
//# sourceMappingURL=index.js.map