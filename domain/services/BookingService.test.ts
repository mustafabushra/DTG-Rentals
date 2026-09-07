import { describe, it, expect } from 'vitest';
import { BookingService } from './BookingService';
import type { Booking } from '../../data/mockData';

const bk = (o: Partial<Booking> = {}): Booking => ({
  id: 'b1', unitId: 'u1', propertyId: 'p1', guestName: 'ضيف',
  checkIn: '2026-09-01', checkOut: '2026-09-05', nights: 4,
  nightlyRate: 100, totalAmount: 400, paidAmount: 0, status: 'confirmed',
  createdAt: '', ...o,
});

describe('حساب الليالي', () => {
  it('checkOut حصري: 1→5 = أربع ليالٍ', () => {
    expect(BookingService.nights('2026-09-01', '2026-09-05')).toBe(4);
  });
  it('نفس اليوم = صفر ليالٍ', () => {
    expect(BookingService.nights('2026-09-01', '2026-09-01')).toBe(0);
  });
  it('تاريخ معطوب لا يُسقِط الحساب', () => {
    expect(BookingService.nights('غير-صالح', '2026-09-05')).toBe(0);
  });
  it('عبر حدود الشهر يُحسب صحيحاً', () => {
    expect(BookingService.nights('2026-08-30', '2026-09-03')).toBe(4);
  });
});

describe('التعارض بين الحجوزات', () => {
  const existing = [bk({ id: 'b1', checkIn: '2026-09-01', checkOut: '2026-09-05' })];

  it('التسليم بنفس اليوم ليس تعارضاً (خروج = دخول)', () => {
    expect(BookingService.hasConflict(existing, 'u1', '2026-09-05', '2026-09-08')).toBeNull();
  });
  it('التداخل الجزئي تعارض', () => {
    expect(BookingService.hasConflict(existing, 'u1', '2026-09-04', '2026-09-08')).not.toBeNull();
  });
  it('الحجز الملغى لا يمنع', () => {
    const cancelled = [bk({ status: 'cancelled' })];
    expect(BookingService.hasConflict(cancelled, 'u1', '2026-09-02', '2026-09-04')).toBeNull();
  });
  it('وحدة أخرى لا تتعارض', () => {
    expect(BookingService.hasConflict(existing, 'u2', '2026-09-01', '2026-09-05')).toBeNull();
  });
  it('excludeId يمنع تعارض الحجز مع نفسه عند التعديل', () => {
    expect(BookingService.hasConflict(existing, 'u1', '2026-09-01', '2026-09-05', 'b1')).toBeNull();
  });
});

describe('احتساب الإيراد بالإشغال', () => {
  it('حجز داخل الشهر بالكامل', () => {
    expect(BookingService.revenueForPeriod([bk()], '2026-09-01', '2026-10-01')).toBe(400);
  });
  it('يُقسَّم على حدود الشهر بحسب الليالي الواقعة فيه', () => {
    const crossing = bk({ checkIn: '2026-08-30', checkOut: '2026-09-03', nights: 4, totalAmount: 400 });
    expect(BookingService.revenueForPeriod([crossing], '2026-09-01', '2026-10-01')).toBe(200);
    expect(BookingService.revenueForPeriod([crossing], '2026-08-01', '2026-09-01')).toBe(200);
  });
  it('مجموع الشهرين = إجمالي الحجز (لا ازدواج ولا فقدان)', () => {
    const crossing = bk({ checkIn: '2026-08-30', checkOut: '2026-09-03', nights: 4, totalAmount: 400 });
    const aug = BookingService.revenueForPeriod([crossing], '2026-08-01', '2026-09-01');
    const sep = BookingService.revenueForPeriod([crossing], '2026-09-01', '2026-10-01');
    expect(aug + sep).toBe(crossing.totalAmount);
  });
  it('الملغى لا يُنتج إيراداً', () => {
    expect(BookingService.revenueForPeriod([bk({ status: 'cancelled' })], '2026-09-01', '2026-10-01')).toBe(0);
  });
  it('لا حجز = صفر إيراد (جوهر نموذج المصيف)', () => {
    expect(BookingService.revenueForPeriod([], '2026-09-01', '2026-10-01')).toBe(0);
  });
  it('يحترم الإجمالي المُدخل يدوياً بدل سعر الليلة', () => {
    const discounted = bk({ nights: 4, totalAmount: 300, nightlyRate: 100 });
    expect(BookingService.revenueForPeriod([discounted], '2026-09-01', '2026-10-01')).toBe(300);
  });
});

describe('نسبة الإشغال', () => {
  it('حجز 4 ليالٍ لوحدة واحدة في سبتمبر (30 ليلة) ≈ 13%', () => {
    expect(BookingService.occupancyRate([bk()], ['u1'], '2026-09-01', '2026-10-01')).toBe(13);
  });
  it('بلا وحدات مصيف = صفر لا قسمة على صفر', () => {
    expect(BookingService.occupancyRate([bk()], [], '2026-09-01', '2026-10-01')).toBe(0);
  });
  it('لا تتجاوز 100% مهما تراكمت الحجوزات', () => {
    const many = [bk({ id: 'a' }), bk({ id: 'b' }), bk({ id: 'c' }), bk({ id: 'd' }),
                  bk({ id: 'e', checkIn: '2026-09-05', checkOut: '2026-09-30' })];
    expect(BookingService.occupancyRate(many, ['u1'], '2026-09-01', '2026-10-01')).toBeLessThanOrEqual(100);
  });
});

describe('الحجوزات القائمة والقادمة (حارس تبديل النموذج)', () => {
  const today = '2026-09-07';
  const all = [
    bk({ id: 'past',    checkIn: '2026-08-01', checkOut: '2026-08-05' }),
    bk({ id: 'current', checkIn: '2026-09-05', checkOut: '2026-09-10' }),
    bk({ id: 'future',  checkIn: '2026-10-01', checkOut: '2026-10-04' }),
    bk({ id: 'cancelledFuture', checkIn: '2026-11-01', checkOut: '2026-11-03', status: 'cancelled' }),
    bk({ id: 'otherUnit', unitId: 'u2', checkIn: '2026-10-01', checkOut: '2026-10-04' }),
  ];

  it('يستبعد الماضي والملغى ووحدة أخرى', () => {
    expect(BookingService.activeOrFuture(all, 'u1', today).map(b => b.id)).toEqual(['current', 'future']);
  });
  it('حجز ينتهي اليوم لا يَحجب (لياليه انتهت)', () => {
    const endsToday = [bk({ checkIn: '2026-09-03', checkOut: today })];
    expect(BookingService.activeOrFuture(endsToday, 'u1', today)).toHaveLength(0);
  });
});

describe('حارس تبديل نموذج التأجير', () => {
  it('لا تغيير = مسموح دائماً', () => {
    expect(BookingService.modeSwitchBlockReason('lease', 'lease',
      { hasActiveContract: true, activeOrFutureBookings: 5 })).toBeNull();
  });
  it('lease→nightly محجوب مع عقد نشط', () => {
    expect(BookingService.modeSwitchBlockReason('lease', 'nightly',
      { hasActiveContract: true, activeOrFutureBookings: 0 })).toContain('عقد');
  });
  it('nightly→lease محجوب مع حجز قائم أو قادم', () => {
    expect(BookingService.modeSwitchBlockReason('nightly', 'lease',
      { hasActiveContract: false, activeOrFutureBookings: 2 })).toContain('حجز');
  });
  it('وحدة قديمة بلا rentalModel تُعامَل كـ lease', () => {
    expect(BookingService.modeSwitchBlockReason(undefined, 'nightly',
      { hasActiveContract: true, activeOrFutureBookings: 0 })).not.toBeNull();
    expect(BookingService.modeSwitchBlockReason(undefined, 'lease',
      { hasActiveContract: false, activeOrFutureBookings: 3 })).toBeNull();
  });
});

describe('التحقق من نموذج الحجز', () => {
  const existing = [bk({ id: 'b1', checkIn: '2026-09-01', checkOut: '2026-09-05' })];
  const base = { unitId: 'u1', guestName: 'أحمد', checkIn: '2026-09-01', checkOut: '2026-09-05', nightlyRate: 100 };

  it('تعديل الحجز نفسه لا يتعارض مع نفسه', () => {
    expect(BookingService.validate(base, existing, 'b1')).toEqual({});
  });
  it('حجز جديد بنفس التواريخ يُرفض', () => {
    expect(BookingService.validate(base, existing).checkOut).toMatch(/متعارض/);
  });
  it('المغادرة قبل الوصول تُرفض', () => {
    expect(BookingService.validate({ ...base, checkOut: '2026-08-30' }, []).checkOut).toBeTruthy();
  });
  it('المحصّل أكبر من الإجمالي يُرفض', () => {
    expect(BookingService.validate({ ...base, paidAmount: 500, totalAmount: 400 }, existing, 'b1').paidAmount)
      .toBeTruthy();
  });
  it('المحصّل = الإجمالي مقبول', () => {
    expect(BookingService.validate({ ...base, paidAmount: 400, totalAmount: 400 }, existing, 'b1')).toEqual({});
  });
  it('المحصّل السالب يُرفض', () => {
    expect(BookingService.validate({ ...base, paidAmount: -1, totalAmount: 400 }, existing, 'b1').paidAmount)
      .toBeTruthy();
  });
  it('الحقول المطلوبة كلها مُتحقَّق منها', () => {
    const errors = BookingService.validate({}, []);
    expect(Object.keys(errors).sort()).toEqual(['checkIn', 'checkOut', 'guestName', 'nightlyRate', 'unitId']);
  });
});
