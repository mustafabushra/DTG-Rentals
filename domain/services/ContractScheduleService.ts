/**
 * ContractScheduleService — تخطيط تعديل جدول أقساط عقد قائم.
 *
 * القاعدة الحاكمة: **السجل التاريخي لا يُمسّ.** كل دفعة ليست 'pending'
 * (مسدَّدة أو متأخرة أو ملغاة) التزام واقع بتاريخه — لا تُحذف ولا يُعاد تأريخها.
 * القابل لإعادة الجدولة هو المستقبل وحده: الأقساط المعلّقة.
 *
 * ولأن العقد قد يُجدَّد لفترات متتالية، تُنسب كل دفعة إلى فترتها بتاريخ استحقاقها،
 * فلا تُخصم مدفوعات فترة سابقة من قيمة الفترة الحالية.
 *
 * هذه الوحدة **تخطّط ولا تكتب**: ترجع خطة أو رفضاً مسبَّباً. القرارات الغامضة
 * تُرفض ولا تُخمَّن — لا سياسة مالية تُخترع هنا.
 *
 * دوال نقية — كل التواريخ 'YYYY-MM-DD'.
 */
import type { Payment } from '../../data/mockData';

export interface ContractTerms {
  id:                string;
  startDate:         string;
  endDate:           string;
  annualValue:       number;
  installmentsCount: number;
  ownerId?:          string;
  currency?:         string;
}

export interface PlannedInstallment {
  id:                string;
  installmentNumber: number;
  amount:            number;
  dueDate:           string;
}

export interface ReschedulePlan {
  ok: true;
  /** أقساط معلّقة تُستبدل — لا تشمل أي سجل تاريخي إطلاقاً. */
  removeIds:        string[];
  create:           PlannedInstallment[];
  /** الالتزامات المحفوظة داخل الفترة الحالية (مسدَّدة + متأخرة). */
  preservedInTerm:  number;
  /** التزامات فترات سابقة — محفوظة ولا تُخصم من قيمة الفترة الحالية. */
  preservedPrior:   number;
  remainingValue:   number;
}

export interface RescheduleRejection {
  ok: false;
  /** رمز ثابت للاختبار والتسجيل. */
  code:   'INVALID_DATES' | 'INVALID_VALUE' | 'INVALID_COUNT'
        | 'VALUE_BELOW_OBLIGATIONS' | 'NO_ROOM_FOR_REMAINDER'
        | 'ORPHANS_HISTORY' | 'TERM_ENDED';
  reason: string;
}

export type RescheduleOutcome = ReschedulePlan | RescheduleRejection;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;

function dayNum(date?: string): number {
  if (!date || !ISO.test(date)) return NaN;
  const [y, m, d] = date.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return NaN;
  const t = Date.UTC(y, m - 1, d);
  // يرفض التواريخ غير الموجودة مثل 2026-02-30
  const back = new Date(t);
  if (back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return NaN;
  return Math.floor(t / DAY_MS);
}

function isoFromDayNum(n: number): string {
  return new Date(n * DAY_MS).toISOString().split('T')[0];
}

function money(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** أصغر أرقام أقساط غير مستخدمة — تملأ الفجوات بدل أن تقفز فوق التاريخ. */
function freeNumbers(used: Set<number>, howMany: number): number[] {
  const out: number[] = [];
  let n = 1;
  while (out.length < howMany) {
    if (!used.has(n)) out.push(n);
    n++;
    if (n > 10000) break;   // حارس ضد الحلقة اللانهائية
  }
  return out;
}

export const ContractScheduleService = {

  /** هل هذه الدفعة سجل تاريخي محفوظ؟ (أي شيء غير 'pending'). */
  isPreserved(p: Pick<Payment, 'status'>): boolean {
    return p.status !== 'pending';
  },

  /**
   * مجموع الالتزامات غير المسدَّدة من سجل الأقساط الفعلي.
   * ليس `annualValue − المدفوع`: تلك الصيغة تخصم مدفوعات الفترات السابقة من
   * قيمة الفترة الحالية فتُظهر متبقياً خاطئاً (أو سالباً) بعد التجديد.
   */
  unsettledTotal(payments: Payment[], opts: { contractId: string; from?: string; to?: string } = { contractId: '' }): number {
    return payments
      .filter(p => p.contractId === opts.contractId)
      .filter(p => p.status !== 'paid')
      .filter(p => !opts.from || !opts.to || (p.dueDate >= opts.from && p.dueDate <= opts.to))
      .reduce((s, p) => s + (p.amount || 0), 0);
  },

  /**
   * خطّط تعديل عقد قائم. يُستدعى **قبل أي كتابة**؛ الرفض يعني لا تُكتب حرف.
   */
  planReschedule(input: {
    contract: ContractTerms;
    payments: Payment[];
    patch:    Partial<ContractTerms>;
    today:    string;
  }): RescheduleOutcome {
    const { contract, patch, today } = input;
    const next: ContractTerms = { ...contract, ...patch };

    // ── ① التحقق من الأرقام والتواريخ قبل أي شيء ──────────────────────────
    const start = dayNum(next.startDate);
    const end   = dayNum(next.endDate);
    if (isNaN(start) || isNaN(end)) {
      return { ok: false, code: 'INVALID_DATES', reason: 'تواريخ العقد غير صالحة. تحقّق من تاريخَي البداية والنهاية.' };
    }
    if (end <= start) {
      return { ok: false, code: 'INVALID_DATES', reason: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية.' };
    }
    const value = Number(next.annualValue);
    if (!Number.isFinite(value) || value <= 0) {
      return { ok: false, code: 'INVALID_VALUE', reason: 'القيمة السنوية يجب أن تكون رقماً أكبر من صفر.' };
    }
    const count = Number(next.installmentsCount);
    if (!Number.isInteger(count) || count < 1) {
      return { ok: false, code: 'INVALID_COUNT', reason: 'عدد الأقساط يجب أن يكون رقماً صحيحاً لا يقل عن 1.' };
    }

    // ── ② فرز دفعات العقد: تاريخ محفوظ مقابل مستقبل قابل للجدولة ─────────
    const mine          = input.payments.filter(p => p.contractId === contract.id);
    const preserved     = mine.filter(p => ContractScheduleService.isPreserved(p));
    const reschedulable = mine.filter(p => !ContractScheduleService.isPreserved(p));

    const inNewTerm = (p: Payment) => p.dueDate >= next.startDate && p.dueDate <= next.endDate;
    const preservedInTermList = preserved.filter(inNewTerm);
    const preservedInTerm     = preservedInTermList.reduce((s, p) => s + (p.amount || 0), 0);
    const preservedPrior      = preserved.filter(p => !inNewTerm(p)).reduce((s, p) => s + (p.amount || 0), 0);

    // ── ③ تغيير التواريخ يجب ألّا يُخرج سجلاً تاريخياً لهذه الفترة خارجها ──
    const datesChanged = next.startDate !== contract.startDate || next.endDate !== contract.endDate;
    if (datesChanged) {
      const wasInOldTerm = (p: Payment) => p.dueDate >= contract.startDate && p.dueDate <= contract.endDate;
      const orphans = preserved.filter(p => wasInOldTerm(p) && !inNewTerm(p));
      if (orphans.length > 0) {
        return {
          ok: false,
          code: 'ORPHANS_HISTORY',
          reason: `المدة الجديدة تُخرج ${orphans.length} دفعة محفوظة خارج العقد `
                + `(أقربها استحقاق ${orphans.map(o => o.dueDate).sort()[0]}). `
                + `عدّل التواريخ بحيث تشمل الدفعات المسجَّلة، أو صحّح تلك الدفعات أولاً.`,
        };
      }
    }

    // ── ④ المال: القيمة الجديدة لا يجوز أن تقل عن التزامات هذه الفترة ─────
    const remainingValue = Math.round(value - preservedInTerm);
    if (remainingValue < 0) {
      return {
        ok: false,
        code: 'VALUE_BELOW_OBLIGATIONS',
        reason: `القيمة السنوية الجديدة (${money(value)}) أقل من الالتزامات المسجَّلة لهذه الفترة `
              + `(${money(preservedInTerm)}) من مسدَّد ومتأخر. `
              + `ارفع القيمة، أو عدّل تلك الدفعات أولاً — لن تُحذف تلقائياً.`,
      };
    }

    const remainingCount = count - preservedInTermList.length;
    if (remainingValue > 0 && remainingCount < 1) {
      return {
        ok: false,
        code: 'NO_ROOM_FOR_REMAINDER',
        reason: `عدد الأقساط (${count}) لا يترك مكاناً للمبلغ المتبقي (${money(remainingValue)}) `
              + `بعد ${preservedInTermList.length} قسطاً مسجَّلاً. ارفع عدد الأقساط.`,
      };
    }

    // لا متبقٍ ⇒ الفترة مغطّاة بالكامل: تُزال الأقساط المعلّقة ولا يُنشأ جديد
    if (remainingValue === 0) {
      return {
        ok: true,
        removeIds: reschedulable.map(p => p.id),
        create: [],
        preservedInTerm, preservedPrior, remainingValue,
      };
    }

    // ── ⑤ نافذة الجدولة: لا تُولَّد أقساط بتواريخ ماضية ────────────────────
    const todayNum = dayNum(today);
    const from     = isNaN(todayNum) ? start : Math.max(todayNum, start);
    if (from > end) {
      return {
        ok: false,
        code: 'TERM_ENDED',
        reason: `مدة العقد تنتهي ${next.endDate} ولم يبقَ منها ما يُجدوَل عليه المتبقي (${money(remainingValue)}). `
              + `مدّد تاريخ النهاية أو سجّل المتبقي يدوياً.`,
      };
    }

    // ── ⑥ بناء الأقساط: توزيع متساوٍ والكسر في الأخير ─────────────────────
    const used    = new Set(preserved.map(p => p.installmentNumber).filter(n => Number.isFinite(n)));
    const numbers = freeNumbers(used, remainingCount);
    const baseAmt = Math.floor(remainingValue / remainingCount);
    const rem     = remainingValue - baseAmt * remainingCount;
    const span    = Math.max(0, end - from);

    const create: PlannedInstallment[] = numbers.map((num, i) => ({
      id:                `pay_${contract.id}_t${next.startDate}_n${num}`,
      installmentNumber: num,
      amount:            i === remainingCount - 1 ? baseAmt + rem : baseAmt,
      dueDate:           isoFromDayNum(from + Math.round((i / remainingCount) * span)),
    }));

    return {
      ok: true,
      removeIds: reschedulable.map(p => p.id),
      create,
      preservedInTerm, preservedPrior, remainingValue,
    };
  },
};
