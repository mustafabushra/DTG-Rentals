/**
 * RenewalService — منطق نهاية العقد وتجديده.
 *
 * يغطي ثلاثة أشياء كانت ناقصة أو مكسورة:
 *  ① تذكير المستأجر قبل الانتهاء (لم يكن موجوداً إطلاقاً).
 *  ② حساب مدة العقد الجديد عند التجديد.
 *  ③ توليد جدول أقساط الفترة الجديدة — منطق كان مدفوناً داخل AppProvider
 *    بلا اختبار، ويُعاد استخدامه في التجديد فيمحو مستحقات الفترة السابقة.
 *
 * دوال نقية فقط — كل التواريخ 'YYYY-MM-DD'.
 */
import { formatDate } from '../../data/mockData';
import { CURRENCY_MAP, type CurrencyCode } from '../../utils/currency';

/** الأشكال الأدنى المطلوبة — تقبل تعريفَي النموذج المتوازيين في المشروع. */
export interface ContractLike {
  id: string; contractNumber?: string; tenantId: string; unitId: string;
  startDate: string; endDate: string; annualValue: number; installmentsCount: number;
  status: string; currency?: string; renewalRemindedAt?: string;
}
export interface TenantLike   { id: string; name: string; phone: string }
export interface UnitLike     { id: string; propertyId: string; number: string; currency?: string }
export interface PropertyLike { id: string; name: string; currency?: string }

const DAY_MS = 86400000;

function dayNum(date: string): number {
  const parts = date?.split('-');
  if (!parts || parts.length !== 3) return NaN;
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12) return NaN;
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

function isoFromDayNum(n: number): string {
  return new Date(n * DAY_MS).toISOString().split('T')[0];
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function pad(n: number): string { return String(n).padStart(2, '0'); }

/** إضافة أشهر تقويمية مع قصّ اليوم لآخر يوم في الشهر (31 يناير + شهر = 28/29 فبراير). */
function addMonths(iso: string, months: number): string {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return iso;
  const [y, m, d] = parts;
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, lastDay))}`;
}

/** عدد الأشهر التقويمية الكاملة بين تاريخين، أو null إن لم تكن المدة أشهراً كاملة. */
function wholeMonthsBetween(from: string, to: string): number | null {
  const a = from.split('-').map(Number);
  const b = to.split('-').map(Number);
  if (a.length !== 3 || b.length !== 3) return null;
  const months = (b[0] - a[0]) * 12 + (b[1] - a[1]);
  if (months <= 0) return null;
  return addMonths(from, months) === to ? months : null;
}

export type RenewalUrgency = 'expired' | 'critical' | 'soon' | 'upcoming';

export interface RenewalRow {
  contractId:      string;
  contractNumber:  string;
  tenantId:        string;
  tenantName:      string;
  tenantPhone:     string;
  propertyName:    string;
  unitNumber:      string;
  currency:        string;
  startDate:       string;
  endDate:         string;
  annualValue:     number;
  /** موجب = باقٍ هذا العدد من الأيام، سالب = انتهى منذ هذا العدد. */
  daysLeft:        number;
  urgency:         RenewalUrgency;
  status:          string;
  lastRemindedAt?: string;
}

/** قسط مُولَّد — بلا معرّف أو حالة: الطبقة المستدعية تضيفهما. */
export interface ScheduledInstallment {
  installmentNumber: number;
  amount:            number;
  dueDate:           string;
}

export const RenewalService = {

  /** الأيام حتى انتهاء العقد: موجب = باقٍ، صفر = ينتهي اليوم، سالب = منتهٍ. */
  daysUntilExpiry(endDate: string, today: string = todayIso()): number {
    const end = dayNum(endDate);
    const now = dayNum(today);
    if (isNaN(end) || isNaN(now)) return 0;
    return end - now;
  },

  /** درجة الإلحاح المشتقة من الأيام المتبقية. */
  urgency(daysLeft: number): RenewalUrgency {
    if (daysLeft < 0)  return 'expired';
    if (daysLeft <= 7) return 'critical';
    if (daysLeft <= 30) return 'soon';
    return 'upcoming';
  },

  /**
   * مدة الفترة الجديدة: تبدأ اليوم التالي لانتهاء الحالية وبنفس طولها.
   *
   * الحساب تقويمي لا بالأيام: الأشهر مختلفة الأطوال، فالطرح بالأيام يُزيح
   * التواريخ (عقد يناير–يونيو كان يُجدَّد حتى 28 ديسمبر بدل 31). إذا كانت المدة
   * أشهراً كاملة نُضيفها كأشهر تقويمية، وإلا نعود إلى حساب الأيام.
   */
  nextTerm(startDate: string, endDate: string): { startDate: string; endDate: string } {
    const s = dayNum(startDate);
    const e = dayNum(endDate);
    if (isNaN(s) || isNaN(e) || e < s) return { startDate, endDate };

    const newStart = isoFromDayNum(e + 1);
    // المدة تُقاس من البداية إلى اليوم التالي للنهاية (عقد سنة = 12 شهراً بالضبط)
    const months = wholeMonthsBetween(startDate, newStart);
    if (months !== null) {
      return { startDate: newStart, endDate: isoFromDayNum(dayNum(addMonths(newStart, months)) - 1) };
    }
    return { startDate: newStart, endDate: isoFromDayNum(e + 1 + (e - s)) };
  },

  /**
   * توليد جدول أقساط لفترة: القسط الأول يستحق في تاريخ البداية، والباقي موزّع
   * بالتساوي حتى النهاية (إيجار مقدَّم — نفس قاعدة إنشاء العقد الأصلي).
   * الكسور تُجمَع كلها في القسط الأخير فيساوي المجموع قيمة العقد بالضبط.
   */
  generateSchedule(term: {
    startDate: string; endDate: string; annualValue: number;
    installmentsCount: number; startingNumber?: number;
  }): ScheduledInstallment[] {
    const count = Math.max(1, Math.floor(term.installmentsCount || 1));
    const start = dayNum(term.startDate);
    const end   = dayNum(term.endDate);
    if (isNaN(start) || isNaN(end)) return [];

    const value     = Math.max(0, Math.round(term.annualValue || 0));
    const baseAmt   = Math.floor(value / count);
    const remainder = value - baseAmt * count;
    const span      = Math.max(0, end - start);
    const from      = term.startingNumber ?? 1;

    return Array.from({ length: count }, (_, i) => ({
      installmentNumber: from + i,
      amount:            i === count - 1 ? baseAmt + remainder : baseAmt,
      dueDate:           isoFromDayNum(start + Math.round((i / count) * span)),
    }));
  },

  /**
   * صفوف العقود التي تستحق المتابعة: المنتهية + التي تنتهي خلال `windowDays`.
   * مرتّبة بالإلحاح — المنتهي أولاً ثم الأقرب انتهاءً.
   */
  buildRows(
    data: {
      contracts:  ContractLike[];
      tenants:    TenantLike[];
      units:      UnitLike[];
      properties: PropertyLike[];
    },
    opts: { today?: string; windowDays?: number } = {},
  ): RenewalRow[] {
    const today      = opts.today ?? todayIso();
    const windowDays = opts.windowDays ?? 30;
    const byId = <T extends { id: string }>(arr: T[]) => new Map(arr.map(x => [x.id, x]));
    const tenantById   = byId(data.tenants);
    const unitById     = byId(data.units);
    const propertyById = byId(data.properties);

    const rows: RenewalRow[] = [];
    for (const c of data.contracts) {
      // الملغى والمُنهى قراراً لا يُجدَّدان — المنتهي بالمدة فقط هو المرشّح
      if (c.status !== 'active' && c.status !== 'expired') continue;
      const daysLeft = RenewalService.daysUntilExpiry(c.endDate, today);
      if (daysLeft > windowDays) continue;

      const tenant = tenantById.get(c.tenantId);
      if (!tenant) continue;
      const unit     = unitById.get(c.unitId);
      const property = unit ? propertyById.get(unit.propertyId) : undefined;

      rows.push({
        contractId:     c.id,
        contractNumber: c.contractNumber ?? c.id,
        tenantId:       tenant.id,
        tenantName:     tenant.name,
        tenantPhone:    tenant.phone,
        propertyName:   property?.name ?? '',
        unitNumber:     unit?.number ?? '',
        currency:       c.currency ?? unit?.currency ?? property?.currency ?? 'SAR',
        startDate:      c.startDate,
        endDate:        c.endDate,
        annualValue:    c.annualValue,
        daysLeft,
        urgency:        RenewalService.urgency(daysLeft),
        status:         c.status,
        lastRemindedAt: c.renewalRemindedAt,
      });
    }

    return rows.sort((a, b) => a.daysLeft - b.daysLeft || b.annualValue - a.annualValue);
  },

  /**
   * رسالة عرض التجديد — نبرتان: استفسار قبل الانتهاء، ومتابعة بعده.
   */
  buildReminder(row: RenewalRow, today: string = todayIso()): string {
    const symbol = CURRENCY_MAP[(row.currency ?? 'SAR') as CurrencyCode]?.symbol ?? row.currency ?? '';
    const money  = `${row.annualValue.toLocaleString('en-US')} ${symbol}`.trim();
    const days   = RenewalService.daysUntilExpiry(row.endDate, today);
    const place  = [row.propertyName, row.unitNumber ? `وحدة ${row.unitNumber}` : '']
      .filter(Boolean).join(' — ');

    const dayWord = (n: number) => `${n} ${n === 1 ? 'يوم' : 'يوماً'}`;
    const timing =
      days > 0  ? `ينتهي بتاريخ ${formatDate(row.endDate)} (بعد ${dayWord(days)})`
    : days === 0 ? `ينتهي اليوم ${formatDate(row.endDate)}`
    :              `قد انتهى بتاريخ ${formatDate(row.endDate)} (منذ ${dayWord(-days)})`;

    const ask = days >= 0
      ? 'نرجو إفادتنا برغبتكم في التجديد قبل تاريخ الانتهاء لترتيب الإجراءات اللازمة.'
      : 'نرجو التواصل معنا لترتيب التجديد أو تسليم الوحدة.';

    return [
      `السيد/ة ${row.tenantName}،`,
      '',
      'تحية طيبة،',
      `نودّ إحاطتكم بأن عقد الإيجار${place ? ` الخاص بـ${place}` : ''} ${timing}.`,
      '',
      `رقم العقد: ${row.contractNumber}`,
      `القيمة السنوية الحالية: ${money}`,
      '',
      ask,
      'شاكرين لكم حُسن تعاونكم.',
      'إدارة العقارات',
    ].join('\n');
  },

  /** ملخّص أعلى الشاشة. */
  summarize(rows: RenewalRow[]): {
    expired: number; critical: number; soon: number;
    totalValue: number; notRemindedRows: number;
  } {
    let expired = 0, critical = 0, soon = 0, totalValue = 0, notRemindedRows = 0;
    for (const r of rows) {
      if (r.urgency === 'expired')       expired++;
      else if (r.urgency === 'critical') critical++;
      else if (r.urgency === 'soon')     soon++;
      totalValue += r.annualValue;
      if (!r.lastRemindedAt) notRemindedRows++;
    }
    return { expired, critical, soon, totalValue, notRemindedRows };
  },
};
