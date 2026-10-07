/**
 * TransferService — نقل مستأجر من وحدة إلى أخرى مع ترحيل رصيده.
 *
 * الحالة التي يعالجها: مستأجر دفع عقده ثم انتقل إلى وحدة أخرى قبل انتهاء المدة.
 * بلا هذه الميزة كان الإجراء يدوياً: تُنهي العقد فتتحوّل أقساطه غير المستحقة إلى
 * "متأخر" كاذب فيظهر مطالَباً بمال لا يدين به، ويختفي رصيده من الدفاتر تماماً
 * لأن النظام لا يعرف مفهوم "رصيد لصالح المستأجر".
 *
 * الحساب شفّاف ومعروض قبل الاعتماد، وأساسه **الأيام** (دقيق ولا يُنتج فروق
 * التقريب الشهري). والرصيد المحسوب **قابل للتعديل يدوياً** بسبب مكتوب، لأن
 * الاتفاق مع المستأجر قد يخالف الحساب — والنظام يوثّق ولا يفرض سياسة مالية.
 *
 * دوال نقية — كل التواريخ 'YYYY-MM-DD'.
 */
import type { Payment } from '../../data/mockData';

export interface TransferContract {
  id:                string;
  contractNumber?:   string;
  tenantId:          string;
  unitId:            string;
  startDate:         string;
  endDate:           string;
  annualValue:       number;
  installmentsCount: number;
  currency?:         string;
  ownerId?:          string;
}

const DAY_MS = 86400000;

function dayNum(date?: string): number {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  const [y, m, d] = date.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return NaN;
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  if (back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return NaN;
  return Math.floor(t / DAY_MS);
}

function money(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export interface CreditBreakdown {
  /** أيام المدة كاملةً (شاملة اليومين الطرفيين). */
  termDays:       number;
  /** الأيام المستهلكة حتى تاريخ النقل (لا تشمل يوم النقل نفسه). */
  consumedDays:   number;
  remainingDays:  number;
  /** قيمة ما استُهلك فعلاً من العقد. */
  consumedAmount: number;
  /** مجموع ما سدَّده المستأجر على هذا العقد. */
  paidTotal:      number;
  /** الرصيد لصالحه = المدفوع − المستهلك (صفر إن كان سالباً). */
  credit:         number;
  /** متأخرات قائمة على العقد القديم — دَين حقيقي لا يُقاصّ تلقائياً. */
  arrears:        number;
}

/**
 * احسب رصيد المستأجر عند تاريخ النقل — بالأيام.
 * لا يُقاصّ المتأخر من الرصيد تلقائياً: المقاصّة قرار مالي يخصّ صاحب العمل،
 * فتُعرَض الأرقام منفصلة ويُترك التعديل اليدوي متاحاً.
 */
export function computeCredit(
  contract: TransferContract,
  payments: Payment[],
  transferDate: string,
): CreditBreakdown | null {
  const start = dayNum(contract.startDate);
  const end   = dayNum(contract.endDate);
  const cut   = dayNum(transferDate);
  if (isNaN(start) || isNaN(end) || isNaN(cut) || end < start) return null;

  const termDays     = end - start + 1;
  const consumedDays = Math.min(Math.max(cut - start, 0), termDays);
  const remainingDays = termDays - consumedDays;

  const mine      = payments.filter(p => p.contractId === contract.id);
  const paidTotal = mine.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0);
  const arrears   = mine.filter(p => p.status === 'overdue').reduce((s, p) => s + (p.amount || 0), 0);

  const consumedAmount = termDays > 0
    ? Math.round((contract.annualValue * consumedDays) / termDays)
    : 0;

  return {
    termDays, consumedDays, remainingDays,
    consumedAmount,
    paidTotal,
    credit: Math.max(0, paidTotal - consumedAmount),
    arrears,
  };
}

export interface TransferPlan {
  ok: true;
  transferDate: string;
  credit:       number;
  /** القيمة التعاقدية للعقد الجديد كما هي — الرصيد يُخصم من الجدول لا منها. */
  newAnnualValue: number;
  /** ما يستحق فعلاً على المستأجر بعد خصم الرصيد. */
  netDue:       number;
  /** أقساط العقد القديم المعلّقة التي لم تُستحق — تُلغى لأنه لن يشغل الوحدة. */
  cancelIds:    string[];
  breakdown:    CreditBreakdown;
}

export interface TransferRejection {
  ok: false;
  code: 'BAD_DATES' | 'BAD_VALUE' | 'BAD_COUNT' | 'SAME_UNIT'
      | 'CREDIT_EXCEEDS_VALUE' | 'CREDIT_INVALID' | 'NO_BREAKDOWN';
  reason: string;
}

export type TransferOutcome = TransferPlan | TransferRejection;

/**
 * خطّط النقل. يرفض قبل أي كتابة عند أي غموض — ولا يخترع سياسة.
 * `creditOverride` يسمح باعتماد رصيد متفق عليه يخالف الحساب (بسبب مكتوب).
 */
export function planTransfer(input: {
  contract:       TransferContract;
  payments:       Payment[];
  transferDate:   string;
  newUnitId:      string;
  newAnnualValue: number;
  newInstallmentsCount: number;
  newStartDate:   string;
  newEndDate:     string;
  creditOverride?: number | null;
}): TransferOutcome {
  const { contract } = input;

  if (input.newUnitId === contract.unitId) {
    return { ok: false, code: 'SAME_UNIT', reason: 'الوحدة الجديدة هي نفسها الحالية. اختر وحدة مختلفة.' };
  }

  const cut = dayNum(input.transferDate);
  const ns  = dayNum(input.newStartDate);
  const ne  = dayNum(input.newEndDate);
  if (isNaN(cut) || isNaN(ns) || isNaN(ne)) {
    return { ok: false, code: 'BAD_DATES', reason: 'تواريخ غير صالحة. تحقّق من تاريخ النقل ومدة العقد الجديد.' };
  }
  if (ne <= ns) {
    return { ok: false, code: 'BAD_DATES', reason: 'تاريخ نهاية العقد الجديد يجب أن يكون بعد بدايته.' };
  }

  const value = Number(input.newAnnualValue);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, code: 'BAD_VALUE', reason: 'القيمة السنوية للعقد الجديد يجب أن تكون أكبر من صفر.' };
  }
  const count = Number(input.newInstallmentsCount);
  if (!Number.isInteger(count) || count < 1) {
    return { ok: false, code: 'BAD_COUNT', reason: 'عدد أقساط العقد الجديد يجب أن يكون رقماً صحيحاً لا يقل عن 1.' };
  }

  const breakdown = computeCredit(contract, input.payments, input.transferDate);
  if (!breakdown) {
    return { ok: false, code: 'NO_BREAKDOWN', reason: 'تعذّر حساب الرصيد — تحقّق من تواريخ العقد الحالي.' };
  }

  let credit = breakdown.credit;
  if (input.creditOverride !== undefined && input.creditOverride !== null) {
    const o = Number(input.creditOverride);
    if (!Number.isFinite(o) || o < 0) {
      return { ok: false, code: 'CREDIT_INVALID', reason: 'الرصيد المعدَّل يجب أن يكون رقماً غير سالب.' };
    }
    credit = Math.round(o);
  }

  if (credit > value) {
    return {
      ok: false,
      code: 'CREDIT_EXCEEDS_VALUE',
      reason: `الرصيد (${money(credit)}) أكبر من قيمة العقد الجديد (${money(value)}). `
            + `مدّد مدة العقد الجديد أو ارفع قيمته، أو عدّل الرصيد يدوياً — لن يُهدَر الفرق تلقائياً.`,
    };
  }

  // أقساط العقد القديم المعلّقة تُلغى: لن يشغل الوحدة فلا يدين بها.
  // المتأخرة تبقى — دَين واقع بتاريخه لا يمحوه النقل.
  const cancelIds = input.payments
    .filter(p => p.contractId === contract.id && p.status === 'pending')
    .map(p => p.id);

  return {
    ok: true,
    transferDate: input.transferDate,
    credit,
    newAnnualValue: value,
    netDue: Math.round(value - credit),
    cancelIds,
    breakdown,
  };
}

export const TransferService = { computeCredit, planTransfer };
