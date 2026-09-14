/**
 * CollectionService — منطق تحصيل الإيجار.
 *
 * التطبيق يعرف من تأخّر وكم وعن أي وحدة، لكن التحصيل كان يدوياً بالكامل:
 * تفتح واتساب، تبحث عن المستأجر، تكتب الرسالة من الذاكرة. هذه الخدمة تبني
 * صفوف التحصيل والرسائل الجاهزة من البيانات الموجودة أصلاً.
 *
 * دوال نقية فقط (بلا React أو Firestore) — كل التواريخ 'YYYY-MM-DD'.
 */
import type { Payment } from '../../data/mockData';
import { formatDate } from '../../data/mockData';
import { CURRENCY_MAP, type CurrencyCode } from '../../utils/currency';

/**
 * الأشكال الأدنى التي تحتاجها هذه الخدمة فعلاً — لا الواجهات الكاملة.
 * المشروع فيه تعريفان متوازيان للعقار/الوحدة (data/mockData وdomain/models)،
 * والإعلان البنيوي هنا يجعل الخدمة تقبل الاثنين بلا ارتباط بأيّهما.
 */
export interface ContractLike { id: string; tenantId: string; unitId: string; currency?: string }
export interface TenantLike   { id: string; name: string; phone: string }
export interface UnitLike     { id: string; propertyId: string; number: string; currency?: string }
export interface PropertyLike { id: string; name: string; currency?: string }

/** مفاتيح الاتصال الدولية مشتقة من عملة العقار — التطبيق متعدد الدول. */
const DIAL_CODES: Record<CurrencyCode, string> = {
  SAR: '966', AED: '971', EGP: '20',  KWD: '965', QAR: '974',
  BHD: '973', OMR: '968', USD: '1',   GBP: '44',  EUR: '',
};

/** يوم رقمي (UTC) من 'YYYY-MM-DD' — NaN إن كان التاريخ معطوباً. */
function dayNum(date: string): number {
  const parts = date?.split('-');
  if (!parts || parts.length !== 3) return NaN;
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12) return NaN;
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export interface CollectionItem {
  paymentId:         string;
  amount:            number;
  dueDate:           string;
  installmentNumber: number;
  /** موجب = متأخر بهذا العدد من الأيام، سالب = يستحق بعد هذا العدد. */
  daysOverdue:       number;
  status:            Payment['status'];
}

export interface CollectionRow {
  key:            string;   // معرّف الصف = tenantId + contractId (مستأجر بعقدين = صفّان)
  tenantId:       string;
  tenantName:     string;
  tenantPhone:    string;
  contractId:     string;
  propertyName:   string;
  unitNumber:     string;
  currency:       string;
  items:          CollectionItem[];
  totalDue:       number;
  maxDaysOverdue: number;
  /** آخر تذكير أُرسل لأي دفعة في هذا الصف (ISO كامل). */
  lastRemindedAt?: string;
}

export const CollectionService = {

  /** فرق الأيام بين تاريخ الاستحقاق واليوم: موجب = متأخر. */
  daysOverdue(dueDate: string, today: string = todayIso()): number {
    const due = dayNum(dueDate);
    const now = dayNum(today);
    if (isNaN(due) || isNaN(now)) return 0;
    return now - due;
  },

  /**
   * تحويل الرقم المحلي إلى صيغة دولية صالحة لرابط واتساب.
   * يتحمّل المسافات والشرطات والأقواس و+ و00 والصفر البادئ.
   * يرجع '' إن لم يبقَ رقم صالح — المتصل يمتنع عن الإرسال حينها.
   */
  normalizePhone(phone?: string | null, currency?: string | null): string {
    if (!phone) return '';
    let p = String(phone).replace(/[\s\-().‏‎]/g, '');
    if (p.startsWith('+'))  p = p.slice(1);
    if (p.startsWith('00')) p = p.slice(2);
    p = p.replace(/\D/g, '');
    if (!p) return '';

    const dial = DIAL_CODES[(currency ?? 'SAR') as CurrencyCode] ?? DIAL_CODES.SAR;
    if (!dial) return p;                       // عملة بلا مفتاح واحد (اليورو) — يُترك كما هو
    if (p.startsWith(dial)) return p;          // دولي أصلاً
    if (p.startsWith('0'))  return dial + p.slice(1);
    return dial + p;
  },

  /** رابط واتساب جاهز — wa.me يعمل على الويب والجوال معاً. */
  whatsappUrl(phone: string, message: string): string {
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  },

  /** رابط احتياطي للتطبيق المثبَّت (يُجرَّب إذا فشل فتح wa.me). */
  whatsappAppUrl(phone: string, message: string): string {
    return `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
  },

  /** رابط رسالة نصية — للمستأجر بلا واتساب. */
  smsUrl(phone: string, message: string): string {
    return `sms:${phone}?body=${encodeURIComponent(message)}`;
  },

  /**
   * رسالة التذكير — تغطي كل دفعات الصف في رسالة واحدة لا رسالة لكل قسط.
   * اللهجة رسمية مهذّبة، والنبرة تتغيّر بين "تذكير قبل الاستحقاق" و"مطالبة بمتأخر".
   */
  buildReminder(row: CollectionRow, today: string = todayIso()): string {
    const symbol = CURRENCY_MAP[(row.currency ?? 'SAR') as CurrencyCode]?.symbol ?? row.currency ?? '';
    const money  = (n: number) => `${n.toLocaleString('en-US')} ${symbol}`.trim();
    const late   = row.maxDaysOverdue > 0;

    const place = [row.propertyName, row.unitNumber ? `وحدة ${row.unitNumber}` : '']
      .filter(Boolean).join(' — ');

    const lines = row.items.map(it => {
      const d = CollectionService.daysOverdue(it.dueDate, today);
      const when = d > 0 ? ` (متأخر ${d} ${d === 1 ? 'يوم' : 'يوماً'})`
                 : d === 0 ? ' (يستحق اليوم)'
                 : ` (بعد ${-d} ${-d === 1 ? 'يوم' : 'يوماً'})`;
      return `• القسط ${it.installmentNumber} — ${money(it.amount)} — استحقاق ${formatDate(it.dueDate)}${when}`;
    });

    const head = late
      ? `نفيدكم بوجود ${row.items.length === 1 ? 'دفعة مستحقة' : `${row.items.length} دفعات مستحقة`} لم تُسدَّد بعد`
      : `نودّ تذكيركم ${row.items.length === 1 ? 'بدفعة تستحق قريباً' : `بـ${row.items.length} دفعات تستحق قريباً`}`;

    return [
      `السيد/ة ${row.tenantName}،`,
      '',
      'تحية طيبة،',
      `${head}${place ? ` بخصوص ${place}` : ''}:`,
      '',
      ...lines,
      '',
      `الإجمالي المستحق: ${money(row.totalDue)}`,
      '',
      late ? 'نرجو التكرّم بالسداد في أقرب وقت ممكن.' : 'نرجو التكرّم بالسداد في موعده.',
      'شاكرين لكم حُسن تعاونكم.',
      'إدارة العقارات',
    ].join('\n');
  },

  /**
   * بناء صفوف التحصيل: كل صف = مستأجر × عقد، يجمع دفعاته غير المسدَّدة.
   * `upcomingDays` يحدّد كم يوماً مستقبلياً يُضمّ (0 = المتأخر فقط).
   */
  buildRows(
    data: {
      payments:   Payment[];
      contracts:  ContractLike[];
      tenants:    TenantLike[];
      units:      UnitLike[];
      properties: PropertyLike[];
    },
    opts: { today?: string; upcomingDays?: number } = {},
  ): CollectionRow[] {
    const today        = opts.today ?? todayIso();
    const upcomingDays = opts.upcomingDays ?? 0;
    const byId = <T extends { id: string }>(arr: T[]) => new Map(arr.map(x => [x.id, x]));
    const contractById = byId(data.contracts);
    const tenantById   = byId(data.tenants);
    const unitById     = byId(data.units);
    const propertyById = byId(data.properties);

    const rows = new Map<string, CollectionRow>();

    for (const p of data.payments) {
      if (p.status === 'paid') continue;
      const days = CollectionService.daysOverdue(p.dueDate, today);
      if (days < -upcomingDays) continue;           // أبعد من النافذة المستقبلية

      const contract = contractById.get(p.contractId);
      if (!contract) continue;                      // دفعة يتيمة — لا وجهة تذكير لها
      const tenant = tenantById.get(contract.tenantId);
      if (!tenant) continue;

      const unit     = unitById.get(contract.unitId);
      const property = unit ? propertyById.get(unit.propertyId) : undefined;
      const currency = p.currency ?? contract.currency ?? unit?.currency ?? property?.currency ?? 'SAR';
      const key      = `${tenant.id}::${contract.id}`;

      const item: CollectionItem = {
        paymentId:         p.id,
        amount:            p.amount,
        dueDate:           p.dueDate,
        installmentNumber: p.installmentNumber,
        daysOverdue:       days,
        status:            p.status,
      };

      const existing = rows.get(key);
      if (existing) {
        existing.items.push(item);
        existing.totalDue       += p.amount;
        existing.maxDaysOverdue  = Math.max(existing.maxDaysOverdue, days);
        existing.lastRemindedAt  = maxIso(existing.lastRemindedAt, p.remindedAt);
      } else {
        rows.set(key, {
          key,
          tenantId:       tenant.id,
          tenantName:     tenant.name,
          tenantPhone:    tenant.phone,
          contractId:     contract.id,
          propertyName:   property?.name ?? '',
          unitNumber:     unit?.number ?? '',
          currency,
          items:          [item],
          totalDue:       p.amount,
          maxDaysOverdue: days,
          lastRemindedAt: p.remindedAt,
        });
      }
    }

    // الأقساط داخل كل صف بترتيب الاستحقاق، والصفوف بالأولوية:
    // الأكثر تأخراً أولاً، ثم الأكبر مبلغاً عند تساوي التأخير.
    const list = Array.from(rows.values());
    list.forEach(r => r.items.sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
    list.sort((a, b) =>
      b.maxDaysOverdue - a.maxDaysOverdue ||
      b.totalDue - a.totalDue ||
      a.tenantName.localeCompare(b.tenantName, 'ar'));
    return list;
  },

  /** ملخّص لأعلى الشاشة: كم صفاً متأخراً وكم المبلغ المتأخر مقابل القادم. */
  summarize(rows: CollectionRow[]): {
    overdueRows: number; overdueAmount: number;
    upcomingRows: number; upcomingAmount: number;
    notRemindedRows: number;
  } {
    let overdueRows = 0, overdueAmount = 0, upcomingRows = 0, upcomingAmount = 0, notRemindedRows = 0;
    for (const r of rows) {
      const overdueItems  = r.items.filter(i => i.daysOverdue > 0);
      const upcomingItems = r.items.filter(i => i.daysOverdue <= 0);
      if (overdueItems.length)  { overdueRows++;  overdueAmount  += sum(overdueItems); }
      if (upcomingItems.length) { upcomingRows++; upcomingAmount += sum(upcomingItems); }
      if (!r.lastRemindedAt && r.maxDaysOverdue > 0) notRemindedRows++;
    }
    return { overdueRows, overdueAmount, upcomingRows, upcomingAmount, notRemindedRows };
  },

  /** وصف عربي مختصر لآخر تذكير — '' إن لم يُرسل تذكير قط. */
  reminderLabel(lastRemindedAt?: string, today: string = todayIso()): string {
    if (!lastRemindedAt) return '';
    const d = CollectionService.daysOverdue(lastRemindedAt.split('T')[0], today);
    if (d <= 0) return 'ذُكِّر اليوم';
    if (d === 1) return 'ذُكِّر أمس';
    return `ذُكِّر قبل ${d} ${d === 1 ? 'يوم' : 'يوماً'}`;
  },
};

function sum(items: CollectionItem[]): number {
  return items.reduce((s, i) => s + i.amount, 0);
}

function maxIso(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}
