import { describe, it, expect } from 'vitest';
import { RenewalService, type ContractLike } from './RenewalService';

const TODAY = '2026-09-14';

const contract = (o: Partial<ContractLike> = {}): ContractLike => ({
  id: 'c1', contractNumber: 'CT-100', tenantId: 't1', unitId: 'u1',
  startDate: '2026-01-01', endDate: '2026-12-31',
  annualValue: 76000, installmentsCount: 4, status: 'active', ...o,
});
const base = {
  contracts:  [contract()],
  tenants:    [{ id: 't1', name: 'أحمد العمري', phone: '0551234567' }],
  units:      [{ id: 'u1', propertyId: 'p1', number: '106' }],
  properties: [{ id: 'p1', name: 'مشروع الزاهية - B1' }],
};

describe('الأيام حتى الانتهاء', () => {
  it('موجب للعقد القائم', () => {
    expect(RenewalService.daysUntilExpiry('2026-10-14', TODAY)).toBe(30);
  });
  it('صفر لِما ينتهي اليوم', () => {
    expect(RenewalService.daysUntilExpiry(TODAY, TODAY)).toBe(0);
  });
  it('سالب للمنتهي', () => {
    expect(RenewalService.daysUntilExpiry('2026-09-01', TODAY)).toBe(-13);
  });
});

describe('درجة الإلحاح', () => {
  it.each([
    [-1, 'expired'], [0, 'critical'], [7, 'critical'],
    [8, 'soon'], [30, 'soon'], [31, 'upcoming'],
  ] as const)('%i يوماً ⇒ %s', (days, tier) => {
    expect(RenewalService.urgency(days)).toBe(tier);
  });
});

describe('مدة الفترة الجديدة', () => {
  it('تبدأ اليوم التالي للانتهاء وبنفس الطول', () => {
    expect(RenewalService.nextTerm('2026-01-01', '2026-12-31'))
      .toEqual({ startDate: '2027-01-01', endDate: '2027-12-31' });
  });
  it('عقد ستة أشهر يُنتج ستة أشهر تقويمية لا 180 يوماً', () => {
    expect(RenewalService.nextTerm('2026-01-01', '2026-06-30'))
      .toEqual({ startDate: '2026-07-01', endDate: '2026-12-31' });
  });
  it('يعبر السنة الكبيسة بلا انزياح', () => {
    // 2028 كبيسة: الحساب بالأيام كان سيُنهي العقد في 30 ديسمبر
    expect(RenewalService.nextTerm('2027-01-01', '2027-12-31'))
      .toEqual({ startDate: '2028-01-01', endDate: '2028-12-31' });
  });
  it('بداية في آخر الشهر تُقصّ لآخر يوم متاح', () => {
    expect(RenewalService.nextTerm('2026-01-31', '2026-07-30').endDate).toBe('2027-01-30');
  });
  it('مدة ليست أشهراً كاملة تعود لحساب الأيام', () => {
    const t = RenewalService.nextTerm('2026-01-01', '2026-03-15');
    expect(t.startDate).toBe('2026-03-16');
    expect(t.endDate).toBe('2026-05-28');
  });
  it('تواريخ معطوبة تُرجع المدخلات كما هي بدل قيم عشوائية', () => {
    expect(RenewalService.nextTerm('xx', 'yy')).toEqual({ startDate: 'xx', endDate: 'yy' });
  });
});

describe('توليد جدول الأقساط', () => {
  const term = { startDate: '2027-01-01', endDate: '2027-12-31', annualValue: 76000, installmentsCount: 4 };

  it('العدد الصحيح من الأقساط', () => {
    expect(RenewalService.generateSchedule(term)).toHaveLength(4);
  });

  it('المجموع يساوي قيمة العقد بالضبط رغم الكسور', () => {
    const odd = RenewalService.generateSchedule({ ...term, annualValue: 100000, installmentsCount: 3 });
    expect(odd.reduce((s, i) => s + i.amount, 0)).toBe(100000);
    expect(odd.map(i => i.amount)).toEqual([33333, 33333, 33334]);   // الكسر في الأخير
  });

  it('القسط الأول يستحق في تاريخ البداية (إيجار مقدَّم)', () => {
    expect(RenewalService.generateSchedule(term)[0].dueDate).toBe('2027-01-01');
  });

  it('الأقساط موزّعة تصاعدياً داخل المدة ولا تتجاوز النهاية', () => {
    const s = RenewalService.generateSchedule(term);
    const dates = s.map(i => i.dueDate);
    expect([...dates].sort()).toEqual(dates);
    expect(dates[dates.length - 1] <= term.endDate).toBe(true);
  });

  it('الترقيم يكمل من رقم البداية — لا يصطدم بأقساط الفترة السابقة', () => {
    const s = RenewalService.generateSchedule({ ...term, startingNumber: 5 });
    expect(s.map(i => i.installmentNumber)).toEqual([5, 6, 7, 8]);
  });

  it('قسط واحد ⇒ كامل القيمة في تاريخ البداية', () => {
    const s = RenewalService.generateSchedule({ ...term, installmentsCount: 1 });
    expect(s).toEqual([{ installmentNumber: 1, amount: 76000, dueDate: '2027-01-01' }]);
  });

  it('عدد أقساط غير صالح يُعامَل كقسط واحد بدل أن يُنتج جدولاً فارغاً', () => {
    expect(RenewalService.generateSchedule({ ...term, installmentsCount: 0 })).toHaveLength(1);
  });

  it('تواريخ معطوبة ⇒ جدول فارغ لا أقساط بتواريخ NaN', () => {
    expect(RenewalService.generateSchedule({ ...term, startDate: 'xx' })).toEqual([]);
  });
});

describe('صفوف التجديد', () => {
  it('يستبعد العقد البعيد عن نافذة المتابعة', () => {
    expect(RenewalService.buildRows(base, { today: TODAY, windowDays: 30 })).toHaveLength(0);
  });

  it('يضمّ ما ينتهي داخل النافذة', () => {
    const soon = { ...base, contracts: [contract({ endDate: '2026-10-01' })] };
    expect(RenewalService.buildRows(soon, { today: TODAY, windowDays: 30 })).toHaveLength(1);
  });

  it('يضمّ المنتهي فعلاً (ما زال يحتاج قراراً)', () => {
    const expired = { ...base, contracts: [contract({ endDate: '2026-08-01', status: 'expired' })] };
    const rows = RenewalService.buildRows(expired, { today: TODAY });
    expect(rows).toHaveLength(1);
    expect(rows[0].urgency).toBe('expired');
  });

  it('يستبعد الملغى والمُنهى قراراً — لا يُجدَّدان', () => {
    for (const status of ['cancelled', 'terminated']) {
      const c = { ...base, contracts: [contract({ endDate: '2026-09-20', status })] };
      expect(RenewalService.buildRows(c, { today: TODAY })).toHaveLength(0);
    }
  });

  it('يرتّب بالإلحاح: المنتهي أولاً ثم الأقرب انتهاءً', () => {
    const many = {
      ...base,
      contracts: [
        contract({ id: 'a', endDate: '2026-10-10' }),
        contract({ id: 'b', endDate: '2026-09-01', status: 'expired' }),
        contract({ id: 'c', endDate: '2026-09-20' }),
      ],
    };
    expect(RenewalService.buildRows(many, { today: TODAY }).map(r => r.contractId))
      .toEqual(['b', 'c', 'a']);
  });

  it('عقد بلا مستأجر يُتجاهَل (لا وجهة تذكير له)', () => {
    expect(RenewalService.buildRows({ ...base, tenants: [], contracts: [contract({ endDate: '2026-09-20' })] },
      { today: TODAY })).toHaveLength(0);
  });

  it('العملة تُورَّث من العقد ثم الوحدة ثم العقار', () => {
    const rows = RenewalService.buildRows({
      ...base,
      contracts:  [contract({ endDate: '2026-09-20', currency: undefined })],
      units:      [{ id: 'u1', propertyId: 'p1', number: '106' }],
      properties: [{ id: 'p1', name: 'برج', currency: 'AED' }],
    }, { today: TODAY });
    expect(rows[0].currency).toBe('AED');
  });
});

describe('رسالة التجديد', () => {
  const rowFor = (endDate: string, status = 'active') =>
    RenewalService.buildRows({ ...base, contracts: [contract({ endDate, status })] },
      { today: TODAY, windowDays: 60 })[0];

  it('تحتوي المكان ورقم العقد والقيمة والمهلة', () => {
    const msg = RenewalService.buildReminder(rowFor('2026-10-12'), TODAY);
    expect(msg).toContain('أحمد العمري');
    expect(msg).toContain('مشروع الزاهية - B1');
    expect(msg).toContain('وحدة 106');
    expect(msg).toContain('CT-100');
    expect(msg).toContain('76,000');
    expect(msg).toContain('بعد 28 يوماً');
  });

  it('نبرة استفسار قبل الانتهاء', () => {
    expect(RenewalService.buildReminder(rowFor('2026-10-12'), TODAY)).toContain('رغبتكم في التجديد');
  });

  it('نبرة متابعة بعد الانتهاء', () => {
    const msg = RenewalService.buildReminder(rowFor('2026-09-01', 'expired'), TODAY);
    expect(msg).toContain('قد انتهى');
    expect(msg).toContain('منذ 13 يوماً');
    expect(msg).toContain('تسليم الوحدة');
  });

  it('صيغة خاصة لِما ينتهي اليوم', () => {
    expect(RenewalService.buildReminder(rowFor(TODAY), TODAY)).toContain('ينتهي اليوم');
  });
});

describe('الملخّص', () => {
  it('يعدّ كل درجة إلحاح ويجمع القيمة', () => {
    const rows = RenewalService.buildRows({
      ...base,
      contracts: [
        contract({ id: 'a', endDate: '2026-09-01', status: 'expired', annualValue: 10000 }),
        contract({ id: 'b', endDate: '2026-09-18', annualValue: 20000 }),
        contract({ id: 'c', endDate: '2026-10-10', annualValue: 30000 }),
      ],
    }, { today: TODAY });
    const s = RenewalService.summarize(rows);
    expect(s).toMatchObject({ expired: 1, critical: 1, soon: 1, totalValue: 60000, notRemindedRows: 3 });
  });

  it('لا يعدّ من ذُكِّر ضمن "لم يُذكَّروا"', () => {
    const rows = RenewalService.buildRows({
      ...base,
      contracts: [contract({ endDate: '2026-09-20', renewalRemindedAt: '2026-09-13T10:00:00Z' })],
    }, { today: TODAY });
    expect(RenewalService.summarize(rows).notRemindedRows).toBe(0);
  });
});
