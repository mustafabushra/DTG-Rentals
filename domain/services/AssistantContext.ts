/**
 * AssistantContext — يبني «معرفة» المساعد من بيانات التطبيق.
 *
 * المبدأ الحاكم: **الأرقام تُحسَب هنا، لا في النموذج.** النماذج تُخطئ في الحساب
 * على صفوف خام، فتُعطي مجاميع خاطئة بثقة. لذا كل رقم مهم (الإيراد، المتأخرات،
 * الإشغال، القيمة المعرّضة) يُحسَب بالخدمات المختبَرة ويُسلَّم للنموذج **جاهزاً**،
 * ودور النموذج أن يشرح ويربط لا أن يجمع.
 *
 * والخصوصية مقصودة: **أرقام الهويات والهواتف لا تُرسَل** — لا تُجيب سؤالاً
 * إدارياً، وإرسالها خارج النظام بلا داعٍ مخاطرة بلا مقابل.
 *
 * دوال نقية — بلا شبكة ولا React.
 */
import type { Payment, Contract, Tenant, Booking } from '../../data/mockData';

/**
 * الأشكال الأدنى للعقار والوحدة — المشروع فيه تعريفان متوازيان
 * (data/mockData و domain/models)، والإعلان البنيوي يجعل الخدمة تقبل الاثنين.
 */
export interface PropertyLike {
  id: string; name: string; location?: string;
}
export interface UnitLike {
  id: string; propertyId: string; number: string;
  currentContractId?: string; annualRent?: number; rentalModel?: string;
}
import { CollectionService } from './CollectionService';
import { RenewalService } from './RenewalService';
import { BookingService } from './BookingService';
import { ContractScheduleService } from './ContractScheduleService';

export interface AssistantData {
  properties: PropertyLike[];
  units:      UnitLike[];
  contracts:  Contract[];
  tenants:    Tenant[];
  payments:   Payment[];
  bookings:   Booking[];
}

export interface ContextOptions {
  today?: string;
  /** أقصى عدد صفوف لكل قائمة تفصيلية — يمنع تضخّم السياق. */
  maxRows?: number;
  currency?: string;
  /**
   * `aggregates`: أرقام ومجاميع فقط — **لا اسم ولا رقم عقد يُرسَل خارج النظام.**
   * `named`: يضيف الأسماء وأرقام العقود فتصير الإجابات محددة.
   * الافتراضي `aggregates`: الأقل تسريباً هو الافتراضي، والتوسيع قرار واعٍ.
   */
  detail?: 'aggregates' | 'named';
}

const DEFAULT_MAX_ROWS = 40;

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function money(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** يقصّ قائمة ويُعلِم النموذج بما حُجب حتى لا يستنتج أن هذا كل شيء. */
function capped<T>(rows: T[], max: number, render: (r: T) => string): string[] {
  const shown = rows.slice(0, max).map(render);
  if (rows.length > max) {
    shown.push(`… و${rows.length - max} صفاً آخر غير معروض (الإجمالي ${rows.length})`);
  }
  return shown;
}

/**
 * يبني ملخّصاً نصّياً للبيانات: أرقام محسوبة أولاً، ثم تفاصيل مقصوصة.
 * النتيجة تُرسَل كسياق مع سؤال المستخدم.
 */
export function buildContext(data: AssistantData, opts: ContextOptions = {}): string {
  const today   = opts.today ?? todayIso();
  const maxRows = opts.maxRows ?? DEFAULT_MAX_ROWS;
  const cur     = opts.currency ?? '';

  const { properties, units, contracts, tenants, payments, bookings } = data;
  const named = (opts.detail ?? 'aggregates') === 'named';

  // في وضع المجاميع تُستبدل كل هوية بمُعرِّف مُستعار ثابت داخل الجواب الواحد،
  // فيبقى المساعد قادراً على التمييز والمقارنة بلا أن يخرج اسمٌ إلى الإنترنت.
  const alias = new Map<string, string>();
  const anon = (prefix: string, id?: string): string => {
    if (!id) return `${prefix}?`;
    if (!alias.has(id)) alias.set(id, `${prefix}${alias.size + 1}`);
    return alias.get(id)!;
  };

  const propertyName = (id?: string) =>
    named ? (properties.find(p => p.id === id)?.name ?? '—') : anon('عقار ', id);
  const unitLabel = (id?: string) => {
    const u = units.find(x => x.id === id);
    return u ? `${propertyName(u.propertyId)} / وحدة ${u.number}` : '—';
  };
  const tenantName = (id?: string) =>
    named ? (tenants.find(t => t.id === id)?.name ?? '—') : anon('مستأجر ', id);

  // ── أرقام محسوبة بالخدمات المختبَرة ──────────────────────────────────────
  const activeContracts = contracts.filter(c => c.status === 'active');
  const rentedUnits     = units.filter(u => !!u.currentContractId);
  const vacantUnits     = units.filter(u => !u.currentContractId);
  const occupancy       = units.length ? Math.round((rentedUnits.length / units.length) * 100) : 0;

  const collectionRows = CollectionService.buildRows(
    { payments, contracts, tenants, units, properties }, { today, upcomingDays: 30 });
  const collections = CollectionService.summarize(collectionRows);

  const renewalRows = RenewalService.buildRows(
    { contracts, tenants, units, properties }, { today, windowDays: 90 });
  const renewals = RenewalService.summarize(renewalRows);

  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd   = `${today.slice(0, 7)}-31`;
  const nightlyUnitIds = units.filter(u => u.rentalModel === 'nightly').map(u => u.id);
  const holidayRevenue = BookingService.revenueForPeriod(bookings, monthStart, monthEnd);
  const holidayOccupancy = nightlyUnitIds.length
    ? BookingService.occupancyRate(bookings, nightlyUnitIds, monthStart, monthEnd)
    : null;

  const leaseAnnual = activeContracts.reduce((s, c) => s + (c.annualValue || 0), 0);
  const paidTotal   = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const unsettled   = payments.filter(p => p.status !== 'paid').reduce((s, p) => s + p.amount, 0);

  const lines: string[] = [];

  lines.push(`التاريخ اليوم: ${today}`);
  if (!named) {
    lines.push('ملاحظة: الأسماء مُستبدلة بمُعرِّفات مستعارة حمايةً للخصوصية.');
    lines.push('أجب بالمُعرِّفات كما هي، ولا تحاول تخمين الأسماء الحقيقية.');
  }
  lines.push('');
  lines.push('## أرقام محسوبة (استخدمها كما هي — لا تُعِد حسابها)');
  lines.push(`- العقارات: ${properties.length} | الوحدات: ${units.length}`);
  lines.push(`- مؤجَّرة: ${rentedUnits.length} | شاغرة: ${vacantUnits.length} | الإشغال: ${occupancy}%`);
  lines.push(`- عقود نشطة: ${activeContracts.length} | مجموع قيمها السنوية: ${money(leaseAnnual)} ${cur}`);
  lines.push(`- محصَّل (كل التاريخ): ${money(paidTotal)} ${cur} | غير مسدَّد: ${money(unsettled)} ${cur}`);
  lines.push(`- متأخرات: ${collections.overdueRows} حالة بمبلغ ${money(collections.overdueAmount)} ${cur}`);
  lines.push(`- تستحق خلال 30 يوماً: ${collections.upcomingRows} حالة بمبلغ ${money(collections.upcomingAmount)} ${cur}`);
  lines.push(`- متأخرون لم يُذكَّروا بعد: ${collections.notRemindedRows}`);
  lines.push(`- عقود منتهية: ${renewals.expired} | تنتهي خلال أسبوع: ${renewals.critical} | خلال 30 يوماً: ${renewals.soon}`);
  lines.push(`- قيمة العقود المعرّضة (تنتهي خلال 90 يوماً): ${money(renewals.totalValue)} ${cur}`);
  if (nightlyUnitIds.length) {
    lines.push(`- بيوت المصيف: ${nightlyUnitIds.length} وحدة | إيراد الشهر: ${money(holidayRevenue)} ${cur}`
      + (holidayOccupancy !== null ? ` | الإشغال: ${holidayOccupancy}%` : ''));
  }

  // ── العقارات ──
  lines.push('');
  lines.push('## العقارات');
  lines.push(...capped(properties, maxRows, p => {
    const pu = units.filter(u => u.propertyId === p.id);
    const pr = pu.filter(u => !!u.currentContractId).length;
    const label = named ? `${p.name} | ${p.location ?? '—'}` : anon('عقار ', p.id);
    return `- ${label} | وحدات: ${pu.length} (مؤجَّرة ${pr}، شاغرة ${pu.length - pr})`;
  }));

  // ── الوحدات الشاغرة ──
  if (vacantUnits.length) {
    lines.push('');
    lines.push('## الوحدات الشاغرة');
    lines.push(...capped(vacantUnits, maxRows, u =>
      `- ${propertyName(u.propertyId)} / وحدة ${u.number}`
      + (u.annualRent ? ` | إيجار سنوي مطلوب: ${money(u.annualRent)} ${cur}` : '')
      + (u.rentalModel === 'nightly' ? ' | تأجير يومي' : '')));
  }

  // ── العقود النشطة ──
  lines.push('');
  lines.push('## العقود النشطة');
  lines.push(...capped(activeContracts, maxRows, c => {
    const un = ContractScheduleService.unsettledTotal(payments, { contractId: c.id });
    return `- ${named ? c.contractNumber : anon('عقد ', c.id)} | ${tenantName(c.tenantId)} | ${unitLabel(c.unitId)}`
      + ` | ${c.startDate} ← ${c.endDate} | سنوي ${money(c.annualValue)} ${cur}`
      + ` | أقساط ${c.installmentsCount} | غير مسدَّد ${money(un)} ${cur}`
      + (c.openingCredit ? ` | رصيد مُرحَّل ${money(c.openingCredit)}` : '');
  }));

  // ── المتأخرات ──
  if (collectionRows.length) {
    lines.push('');
    lines.push('## المستحقات (الأكثر تأخراً أولاً)');
    lines.push(...capped(collectionRows, maxRows, r =>
      `- ${named ? r.tenantName : anon('مستأجر ', r.tenantId)} | ${named ? r.propertyName : anon('عقار ', r.contractId)} / وحدة ${r.unitNumber}`
      + ` | ${r.items.length} قسطاً | ${money(r.totalDue)} ${r.currency}`
      + ` | ${r.maxDaysOverdue > 0 ? `متأخر ${r.maxDaysOverdue} يوماً` : 'لم يستحق بعد'}`
      + (r.lastRemindedAt ? ` | ذُكِّر ${r.lastRemindedAt.split('T')[0]}` : ' | لم يُذكَّر')));
  }

  // ── العقود المقاربة ──
  if (renewalRows.length) {
    lines.push('');
    lines.push('## عقود تنتهي قريباً أو منتهية');
    lines.push(...capped(renewalRows, maxRows, r =>
      `- ${named ? r.contractNumber : anon('عقد ', r.contractId)} | ${named ? r.tenantName : anon('مستأجر ', r.tenantId)} | ${named ? r.propertyName : anon('عقار ', r.contractId)} / وحدة ${r.unitNumber}`
      + ` | ينتهي ${r.endDate} | ${r.daysLeft < 0 ? `انتهى منذ ${-r.daysLeft} يوماً` : `باقٍ ${r.daysLeft} يوماً`}`
      + ` | سنوي ${money(r.annualValue)} ${r.currency}`));
  }

  // ── الحجوزات ──
  const confirmed = bookings.filter(b => b.status === 'confirmed');
  if (confirmed.length) {
    lines.push('');
    lines.push('## حجوزات بيوت المصيف المؤكَّدة');
    lines.push(...capped(confirmed, maxRows, b =>
      `- ${unitLabel(b.unitId)} | ${named ? b.guestName : anon('ضيف ', b.id)} | ${b.checkIn} ← ${b.checkOut}`
      + ` | ${b.nights} ليلة | ${money(b.totalAmount)} ${b.currency ?? cur}`
      + ` | محصَّل ${money(b.paidAmount)}`));
  }

  return lines.join('\n');
}

/** توجيه المساعد — يحدّد دوره وحدوده. */
export const ASSISTANT_SYSTEM = [
  'أنت مساعد تحليلي داخل تطبيق «DTG Rentals» لإدارة العقارات والإيجارات.',
  'تُجيب مالك التطبيق ومديريه عن بياناتهم بالعربية الفصحى الواضحة.',
  '',
  'قواعد لا تُخالَف:',
  '1. **لا تحسب أرقاماً بنفسك.** الأرقام المحسوبة مُسلَّمة إليك في قسم «أرقام',
  '   محسوبة» — انقلها كما هي. ولو احتجت رقماً غير موجود، قل إنه غير متاح بدل',
  '   أن تجمع الصفوف بنفسك: حسابك عليها يُخطئ.',
  '2. **لا تخترع بيانات.** ما ليس في السياق لا تعرفه. قل «لا يظهر في البيانات»',
  '   بدل التخمين.',
  '3. القوائم مقصوصة: السطر الذي يذكر «صفاً آخر غير معروض» يعني أن ما تراه ليس',
  '   كل شيء — فلا تقل «هؤلاء كل المتأخرين» إن كانت القائمة مقصوصة.',
  '4. **أنت للقراءة والتحليل فقط.** لا تملك تنفيذ أي إجراء: لا إضافة عقد ولا',
  '   تأكيد دفعة ولا إرسال تذكير. إن طُلب منك إجراء، اشرح أين يُنفَّذ في التطبيق',
  '   (مثال: «مركز التحصيل» للتذكير، «نقل» في صفحة العقد لنقل مستأجر).',
  '5. أجب مختصراً ومباشراً. استخدم جدولاً أو قائمة عند المقارنة. لا مقدمات.',
  '6. المبالغ بفواصل الآلاف، والتواريخ كما هي في البيانات.',
].join('\n');
