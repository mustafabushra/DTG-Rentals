import { describe, it, expect } from 'vitest';
import { buildContext, ASSISTANT_SYSTEM, type AssistantData } from './AssistantContext';
import type { Payment, Contract, Tenant, Unit, Property, Booking } from '../../data/mockData';

const TODAY = '2026-10-07';

const property = (o: Partial<Property> = {}): Property =>
  ({ id: 'p1', name: 'عمارة الزاهية', location: 'الرياض', ...o } as Property);
const unit = (o: Partial<Unit> = {}): Unit =>
  ({ id: 'u1', propertyId: 'p1', number: '101', annualRent: 60000, ...o } as Unit);
const contract = (o: Partial<Contract> = {}): Contract =>
  ({ id: 'c1', contractNumber: 'CNT-1', unitId: 'u1', tenantId: 't1',
     startDate: '2026-01-01', endDate: '2026-12-31', annualValue: 60000,
     installmentsCount: 4, status: 'active', createdAt: '', ...o } as Contract);
const tenant = (o: Partial<Tenant> = {}): Tenant =>
  ({ id: 't1', name: 'أحمد العمري', phone: '0551234567', email: 'a@b.c',
     nationalId: '1012345678', nationality: 'سعودي', contractIds: ['c1'], createdAt: '', ...o });
const pay = (o: Partial<Payment> = {}): Payment =>
  ({ id: 'pay1', receiptNumber: 'R1', contractId: 'c1', amount: 15000,
     dueDate: '2026-01-01', status: 'paid', installmentNumber: 1, ...o });

const data = (o: Partial<AssistantData> = {}): AssistantData => ({
  properties: [property()],
  units:      [unit({ currentContractId: 'c1' })],
  contracts:  [contract()],
  tenants:    [tenant()],
  payments:   [pay()],
  bookings:   [],
  ...o,
});

describe('الأرقام المحسوبة تُسلَّم جاهزة', () => {
  it('يُصرّح للنموذج أن الأرقام لا تُعاد حسابها', () => {
    const ctx = buildContext(data(), { today: TODAY });
    expect(ctx).toContain('أرقام محسوبة');
    expect(ctx).toContain('لا تُعِد حسابها');
  });

  it('يحسب الإشغال من الوحدات المرتبطة بعقود', () => {
    const ctx = buildContext(data({
      units: [unit({ id: 'u1', currentContractId: 'c1' }), unit({ id: 'u2', number: '102' })],
    }), { today: TODAY });
    expect(ctx).toContain('مؤجَّرة: 1');
    expect(ctx).toContain('شاغرة: 1');
    expect(ctx).toContain('الإشغال: 50%');
  });

  it('يفصل المحصَّل عن غير المسدَّد', () => {
    const ctx = buildContext(data({
      payments: [pay({ amount: 15000, status: 'paid' }), pay({ id: 'p2', amount: 45000, status: 'overdue', dueDate: '2026-04-01' })],
    }), { today: TODAY });
    expect(ctx).toContain('محصَّل (كل التاريخ): 15,000');
    expect(ctx).toContain('غير مسدَّد: 45,000');
  });

  it('يُدرج المتأخرات بمبلغها وعددها', () => {
    const ctx = buildContext(data({
      payments: [pay({ id: 'late', amount: 20000, status: 'overdue', dueDate: '2026-05-01' })],
    }), { today: TODAY });
    expect(ctx).toContain('متأخرات: 1 حالة بمبلغ 20,000');
  });

  it('يُدرج العقود المقاربة للانتهاء وقيمتها المعرّضة', () => {
    const ctx = buildContext(data({
      contracts: [contract({ endDate: '2026-10-20' })],
    }), { today: TODAY });
    expect(ctx).toContain('خلال 30 يوماً: 1');
    expect(ctx).toContain('قيمة العقود المعرّضة');
  });

  it('بيوت المصيف تظهر فقط إن وُجدت', () => {
    const without = buildContext(data(), { today: TODAY });
    expect(without).not.toContain('بيوت المصيف');

    const booking: Booking = {
      id: 'b1', unitId: 'u2', propertyId: 'p1', guestName: 'ضيف',
      checkIn: '2026-10-01', checkOut: '2026-10-05', nights: 4,
      nightlyRate: 500, totalAmount: 2000, paidAmount: 2000,
      status: 'confirmed', createdAt: '',
    };
    const withNightly = buildContext(data({
      units: [unit({ id: 'u2', number: '201', rentalModel: 'nightly' })],
      bookings: [booking],
    }), { today: TODAY });
    expect(withNightly).toContain('بيوت المصيف: 1 وحدة');
    expect(withNightly).toContain('حجوزات بيوت المصيف');
  });
});

describe('الخصوصية: لا تُرسَل بيانات لا تخدم السؤال', () => {
  const ctx = buildContext(data(), { today: TODAY, detail: 'named' });

  it('رقم الهوية الوطنية لا يُرسَل', () => {
    expect(ctx).not.toContain('1012345678');
  });

  it('رقم الهاتف لا يُرسَل', () => {
    expect(ctx).not.toContain('0551234567');
  });

  it('البريد لا يُرسَل', () => {
    expect(ctx).not.toContain('a@b.c');
  });

  it('الاسم يُرسَل في وضع التفصيل فقط', () => {
    expect(ctx).toContain('أحمد العمري');
  });
});

describe('قصّ القوائم', () => {
  it('يقصّ عند الحد ويُعلِم النموذج بما حُجب', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      property({ id: `p${i}`, name: `عقار ${i}` }));
    const ctx = buildContext(data({ properties: many, units: [] }),
      { today: TODAY, maxRows: 3, detail: 'named' });
    expect(ctx).toContain('عقار 0');
    expect(ctx).toContain('عقار 2');
    expect(ctx).not.toContain('عقار 5');
    expect(ctx).toContain('و7 صفاً آخر غير معروض');
    expect(ctx).toContain('الإجمالي 10');
  });

  it('بلا قصّ لا يُذكر حجب', () => {
    expect(buildContext(data(), { today: TODAY, maxRows: 50 })).not.toContain('غير معروض');
  });
});

describe('السياق يصف الواقع لا يختلقه', () => {
  it('بيانات فارغة تماماً تُنتج سياقاً صالحاً بأصفار', () => {
    const ctx = buildContext({
      properties: [], units: [], contracts: [], tenants: [], payments: [], bookings: [],
    }, { today: TODAY });
    expect(ctx).toContain('العقارات: 0');
    expect(ctx).toContain('الإشغال: 0%');
    expect(ctx).not.toContain('undefined');
    expect(ctx).not.toContain('NaN');
  });

  it('الوحدة الشاغرة تُذكر بإيجارها المطلوب', () => {
    const ctx = buildContext(data({ units: [unit({ annualRent: 72000 })] }), { today: TODAY, detail: 'named' });
    expect(ctx).toContain('الوحدات الشاغرة');
    expect(ctx).toContain('72,000');
  });

  it('الرصيد المُرحَّل يظهر على العقد', () => {
    const ctx = buildContext(data({
      contracts: [contract({ openingCredit: 54160 })],
    }), { today: TODAY, detail: 'named' });
    expect(ctx).toContain('رصيد مُرحَّل 54,160');
  });

  it('لا تواريخ أو مبالغ معطوبة مع بيانات ناقصة', () => {
    const ctx = buildContext(data({
      contracts: [contract({ annualValue: 0, installmentsCount: 0 })],
      tenants: [],
    }), { today: TODAY });
    expect(ctx).not.toContain('NaN');
    expect(ctx).not.toContain('Infinity');
  });
});

describe('توجيه المساعد', () => {
  it('يمنع الحساب الذاتي والاختراع', () => {
    expect(ASSISTANT_SYSTEM).toContain('لا تحسب أرقاماً بنفسك');
    expect(ASSISTANT_SYSTEM).toContain('لا تخترع بيانات');
  });
  it('يُصرّح أنه للقراءة فقط ويحدّد مكان التنفيذ', () => {
    expect(ASSISTANT_SYSTEM).toContain('للقراءة والتحليل فقط');
    expect(ASSISTANT_SYSTEM).toContain('مركز التحصيل');
  });
  it('ينبّه على القوائم المقصوصة', () => {
    expect(ASSISTANT_SYSTEM).toContain('غير معروض');
  });
});

describe('وضع الخصوصية (الافتراضي): لا اسم يخرج إلى الإنترنت', () => {
  const ctx = buildContext(data({
    payments: [pay({ id: 'late', amount: 20000, status: 'overdue', dueDate: '2026-05-01' })],
  }), { today: TODAY });

  it('اسم المستأجر لا يُرسَل', () => {
    expect(ctx).not.toContain('أحمد العمري');
  });

  it('اسم العقار لا يُرسَل', () => {
    expect(ctx).not.toContain('عمارة الزاهية');
    expect(ctx).not.toContain('الرياض');
  });

  it('رقم العقد لا يُرسَل', () => {
    expect(ctx).not.toContain('CNT-1');
  });

  it('المعرّفات المستعارة تحلّ محلّها فيبقى التمييز ممكناً', () => {
    expect(ctx).toMatch(/مستأجر \d/);
    expect(ctx).toMatch(/عقار \d/);
  });

  it('النموذج يُعلَم بالاستبدال فلا يخمّن الأسماء', () => {
    expect(ctx).toContain('مُعرِّفات مستعارة');
    expect(ctx).toContain('لا تحاول تخمين الأسماء');
  });

  it('الأرقام والمجاميع تبقى كاملة — الخصوصية لا تُفقد التحليل', () => {
    expect(ctx).toContain('متأخرات: 1 حالة بمبلغ 20,000');
    expect(ctx).toContain('الإشغال:');
  });

  it('وضع التفصيل يُظهر الأسماء بقرار صريح', () => {
    const detailed = buildContext(data(), { today: TODAY, detail: 'named' });
    expect(detailed).toContain('أحمد العمري');
    expect(detailed).not.toContain('مُعرِّفات مستعارة');
  });
});
