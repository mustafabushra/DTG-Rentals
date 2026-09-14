import { describe, it, expect } from 'vitest';
import { CollectionService, type CollectionRow } from './CollectionService';
import type { Payment, Contract, Tenant, Unit, Property } from '../../data/mockData';

const TODAY = '2026-09-14';

const pay = (o: Partial<Payment> = {}): Payment => ({
  id: 'pay1', receiptNumber: 'RCP-1', contractId: 'c1', amount: 19000,
  dueDate: '2026-08-23', status: 'overdue', installmentNumber: 2, ...o,
});
const contract = (o: Partial<Contract> = {}): Contract => ({
  id: 'c1', contractNumber: 'CT-1', unitId: 'u1', tenantId: 't1',
  startDate: '2026-01-01', endDate: '2026-12-31', annualValue: 76000,
  installmentsCount: 4, status: 'active', createdAt: '2026-01-01', ...o,
} as Contract);
const tenant = (o: Partial<Tenant> = {}): Tenant => ({
  id: 't1', name: 'أحمد العمري', phone: '0551234567', email: '', nationalId: '',
  nationality: '', contractIds: ['c1'], createdAt: '', ...o,
});
const unit = (o: Partial<Unit> = {}): Unit => ({
  id: 'u1', propertyId: 'p1', number: '106', ...o,
} as Unit);
const property = (o: Partial<Property> = {}): Property => ({
  id: 'p1', name: 'مشروع الزاهية - B1', ...o,
} as Property);

const base = {
  payments: [pay()], contracts: [contract()], tenants: [tenant()],
  units: [unit()], properties: [property()],
};

describe('حساب التأخير', () => {
  it('موجب للمتأخر', () => {
    expect(CollectionService.daysOverdue('2026-08-23', TODAY)).toBe(22);
  });
  it('صفر لِما يستحق اليوم', () => {
    expect(CollectionService.daysOverdue(TODAY, TODAY)).toBe(0);
  });
  it('سالب لِما لم يستحق بعد', () => {
    expect(CollectionService.daysOverdue('2026-09-20', TODAY)).toBe(-6);
  });
  it('تاريخ معطوب لا يُسقِط الحساب', () => {
    expect(CollectionService.daysOverdue('xx', TODAY)).toBe(0);
  });
});

describe('تطبيع رقم الهاتف للواتساب', () => {
  it('صفر بادئ ← مفتاح الدولة', () => {
    expect(CollectionService.normalizePhone('0551234567', 'SAR')).toBe('966551234567');
  });
  it('يتحمّل المسافات والشرطات والأقواس', () => {
    expect(CollectionService.normalizePhone('055 123-4567', 'SAR')).toBe('966551234567');
  });
  it('صيغة +966 تبقى كما هي', () => {
    expect(CollectionService.normalizePhone('+966551234567', 'SAR')).toBe('966551234567');
  });
  it('صيغة 00966 تُقصّ', () => {
    expect(CollectionService.normalizePhone('00966551234567', 'SAR')).toBe('966551234567');
  });
  it('رقم بلا صفر بادئ يُسبَق بالمفتاح', () => {
    expect(CollectionService.normalizePhone('551234567', 'SAR')).toBe('966551234567');
  });
  it('المفتاح يتبع عملة العقار لا السعودية دائماً', () => {
    expect(CollectionService.normalizePhone('0501234567', 'AED')).toBe('971501234567');
    expect(CollectionService.normalizePhone('01012345678', 'EGP')).toBe('201012345678');
  });
  it('رقم فارغ أو بلا أرقام ⇒ سلسلة فارغة (لا يُرسَل شيء)', () => {
    expect(CollectionService.normalizePhone('')).toBe('');
    expect(CollectionService.normalizePhone('غير معروف')).toBe('');
    expect(CollectionService.normalizePhone(undefined)).toBe('');
  });
});

describe('بناء صفوف التحصيل', () => {
  it('يستبعد المسدَّد', () => {
    const rows = CollectionService.buildRows(
      { ...base, payments: [pay({ status: 'paid' })] }, { today: TODAY });
    expect(rows).toHaveLength(0);
  });

  it('يستبعد المستقبلي خارج النافذة، ويضمّه داخلها', () => {
    const future = [pay({ id: 'p2', status: 'pending', dueDate: '2026-09-20' })];
    expect(CollectionService.buildRows({ ...base, payments: future }, { today: TODAY })).toHaveLength(0);
    expect(CollectionService.buildRows({ ...base, payments: future },
      { today: TODAY, upcomingDays: 7 })).toHaveLength(1);
  });

  it('يجمع دفعات المستأجر نفسه في صف واحد بإجمالي صحيح', () => {
    const rows = CollectionService.buildRows({
      ...base,
      payments: [pay({ id: 'a', amount: 19000 }), pay({ id: 'b', amount: 9250, dueDate: '2026-08-31' })],
    }, { today: TODAY });
    expect(rows).toHaveLength(1);
    expect(rows[0].items).toHaveLength(2);
    expect(rows[0].totalDue).toBe(28250);
    expect(rows[0].maxDaysOverdue).toBe(22);   // الأقدم استحقاقاً
  });

  it('مستأجر بعقدين ⇒ صفّان منفصلان', () => {
    const rows = CollectionService.buildRows({
      ...base,
      payments:  [pay({ id: 'a' }), pay({ id: 'b', contractId: 'c2' })],
      contracts: [contract(), contract({ id: 'c2', unitId: 'u2' })],
      units:     [unit(), unit({ id: 'u2', number: '207' })],
    }, { today: TODAY });
    expect(rows).toHaveLength(2);
  });

  it('يرتّب بالأولوية: الأكثر تأخراً أولاً', () => {
    const rows = CollectionService.buildRows({
      ...base,
      payments:  [pay({ id: 'a', contractId: 'c1', dueDate: '2026-09-10' }),
                  pay({ id: 'b', contractId: 'c2', dueDate: '2026-07-01' })],
      contracts: [contract(), contract({ id: 'c2', tenantId: 't2', unitId: 'u2' })],
      tenants:   [tenant(), tenant({ id: 't2', name: 'سالم' })],
      units:     [unit(), unit({ id: 'u2' })],
    }, { today: TODAY });
    expect(rows[0].items[0].dueDate).toBe('2026-07-01');
  });

  it('الأقساط داخل الصف مرتّبة بالاستحقاق', () => {
    const rows = CollectionService.buildRows({
      ...base,
      payments: [pay({ id: 'a', dueDate: '2026-09-01' }), pay({ id: 'b', dueDate: '2026-07-01' })],
    }, { today: TODAY });
    expect(rows[0].items.map(i => i.dueDate)).toEqual(['2026-07-01', '2026-09-01']);
  });

  it('دفعة بلا عقد أو بلا مستأجر تُتجاهَل (لا وجهة تذكير لها)', () => {
    expect(CollectionService.buildRows({ ...base, contracts: [] }, { today: TODAY })).toHaveLength(0);
    expect(CollectionService.buildRows({ ...base, tenants: [] },   { today: TODAY })).toHaveLength(0);
  });

  it('العملة تُورَّث من الدفعة ثم العقد ثم الوحدة ثم العقار', () => {
    const rows = CollectionService.buildRows({
      ...base,
      payments:   [pay({ currency: undefined })],
      contracts:  [contract({ currency: undefined } as Partial<Contract>)],
      units:      [unit({ currency: undefined })],
      properties: [property({ currency: 'AED' } as Partial<Property>)],
    }, { today: TODAY });
    expect(rows[0].currency).toBe('AED');
  });

  it('آخر تذكير في الصف = الأحدث بين دفعاته', () => {
    const rows = CollectionService.buildRows({
      ...base,
      payments: [pay({ id: 'a', remindedAt: '2026-09-01T10:00:00Z' }),
                 pay({ id: 'b', remindedAt: '2026-09-10T10:00:00Z', dueDate: '2026-08-31' })],
    }, { today: TODAY });
    expect(rows[0].lastRemindedAt).toBe('2026-09-10T10:00:00Z');
  });
});

describe('رسالة التذكير', () => {
  const row = (): CollectionRow => CollectionService.buildRows(base, { today: TODAY })[0];

  it('تحتوي الاسم والمكان والمبلغ والتأخير', () => {
    const msg = CollectionService.buildReminder(row(), TODAY);
    expect(msg).toContain('أحمد العمري');
    expect(msg).toContain('مشروع الزاهية - B1');
    expect(msg).toContain('وحدة 106');
    expect(msg).toContain('19,000');
    expect(msg).toContain('متأخر 22 يوماً');
  });

  it('نبرة المطالبة للمتأخر ونبرة التذكير لِما لم يستحق', () => {
    expect(CollectionService.buildReminder(row(), TODAY)).toContain('لم تُسدَّد بعد');
    const upcoming = CollectionService.buildRows(
      { ...base, payments: [pay({ status: 'pending', dueDate: '2026-09-20' })] },
      { today: TODAY, upcomingDays: 10 })[0];
    expect(CollectionService.buildReminder(upcoming, TODAY)).toContain('تستحق قريباً');
  });

  it('رسالة واحدة تغطي كل الأقساط لا رسالة لكل قسط', () => {
    const multi = CollectionService.buildRows({
      ...base,
      payments: [pay({ id: 'a', amount: 19000 }), pay({ id: 'b', amount: 9250, dueDate: '2026-08-31' })],
    }, { today: TODAY })[0];
    const msg = CollectionService.buildReminder(multi, TODAY);
    expect(msg).toContain('19,000');
    expect(msg).toContain('9,250');
    expect(msg).toContain('28,250');   // الإجمالي
  });

  it('تستعمل رمز عملة العقار', () => {
    const aed = CollectionService.buildRows(
      { ...base, payments: [pay({ currency: 'AED' })] }, { today: TODAY })[0];
    expect(CollectionService.buildReminder(aed, TODAY)).toContain('د.إ');
  });
});

describe('روابط الإرسال', () => {
  it('رابط واتساب يُرمّز الرسالة', () => {
    const url = CollectionService.whatsappUrl('966551234567', 'مرحبا أحمد');
    expect(url.startsWith('https://wa.me/966551234567?text=')).toBe(true);
    expect(url).not.toContain(' ');
  });
  it('رابط الرسائل النصية يحمل النص', () => {
    expect(CollectionService.smsUrl('966551234567', 'نص')).toContain('sms:966551234567?body=');
  });
});

describe('الملخّص ووسم التذكير', () => {
  it('يفصل المتأخر عن القادم', () => {
    const rows = CollectionService.buildRows({
      ...base,
      payments: [pay({ id: 'a', amount: 19000 }),
                 pay({ id: 'b', amount: 5000, status: 'pending', dueDate: '2026-09-20' })],
    }, { today: TODAY, upcomingDays: 10 });
    const s = CollectionService.summarize(rows);
    expect(s.overdueAmount).toBe(19000);
    expect(s.upcomingAmount).toBe(5000);
  });

  it('يعدّ المتأخرين الذين لم يُذكَّروا بعد', () => {
    const rows = CollectionService.buildRows(base, { today: TODAY });
    expect(CollectionService.summarize(rows).notRemindedRows).toBe(1);
    const reminded = CollectionService.buildRows(
      { ...base, payments: [pay({ remindedAt: '2026-09-13T10:00:00Z' })] }, { today: TODAY });
    expect(CollectionService.summarize(reminded).notRemindedRows).toBe(0);
  });

  it('وسم التذكير بالعربية', () => {
    expect(CollectionService.reminderLabel(undefined, TODAY)).toBe('');
    expect(CollectionService.reminderLabel('2026-09-14T08:00:00Z', TODAY)).toBe('ذُكِّر اليوم');
    expect(CollectionService.reminderLabel('2026-09-13T08:00:00Z', TODAY)).toBe('ذُكِّر أمس');
    expect(CollectionService.reminderLabel('2026-09-04T08:00:00Z', TODAY)).toBe('ذُكِّر قبل 10 يوماً');
  });
});
