import { describe, it, expect } from 'vitest';
import {
  toLatinDigits, normalizeArabic, parseAmount, parseDate, parseCurrency,
  matchTenants, matchUnits, buildDraft, isReadyToSave,
  type RawExtraction,
} from './ContractExtractionService';

const tenants = [
  { id: 't1', name: 'د. أسامة الزهراني', nationalId: '1012345678', phone: '0551234567' },
  { id: 't2', name: 'محمد العتيبي',       nationalId: '1087654321' },
  { id: 't3', name: 'أسامة القحطاني',     nationalId: '1055555555' },
];
const units = [
  { id: 'u1', number: '101', propertyId: 'p1' },
  { id: 'u2', number: '201', propertyId: 'p1' },
  { id: 'u3', number: '101', propertyId: 'p2' },
];
const properties = [{ id: 'p1', name: 'عمارة الزاهية' }, { id: 'p2', name: 'برج المروج' }];
const ctx = { tenants, units, properties };

const good: RawExtraction = {
  contractNumber: 'CNT-2026-007992',
  tenantName: 'د. أسامة الزهراني', tenantNationalId: '1012345678',
  propertyName: 'عمارة الزاهية', unitNumber: '201',
  startDate: '01/01/2026', endDate: '31/12/2026',
  annualValue: '65,000 ريال', installmentsCount: '4', currency: 'ريال سعودي',
};

describe('تطبيع الأرقام والنص العربي', () => {
  it('الأرقام العربية تتحول لاتينية', () => {
    expect(toLatinDigits('٦٥٠٠٠')).toBe('65000');
    expect(toLatinDigits('۱۲۳')).toBe('123');
  });
  it('يوحّد الألف والياء والتاء المربوطة', () => {
    expect(normalizeArabic('أسامه')).toBe(normalizeArabic('اسامة'));
    expect(normalizeArabic('مصطفى')).toBe(normalizeArabic('مصطفي'));
  });
  it('يُسقط التشكيل والتطويل ويضغط المسافات', () => {
    expect(normalizeArabic('مُحَمَّــد   العتيبي')).toBe('محمد العتيبي');
  });
});

describe('قراءة المبالغ', () => {
  it.each([
    ['65,000 ريال', 65000], ['٦٥٠٠٠', 65000], ['65000', 65000],
    ['100,000.00', 100000], [45840, 45840],
  ])('%s ⇒ %i', (input, expected) => {
    expect(parseAmount(input as string | number)).toBe(expected);
  });
  it('الفراغ أو النص بلا أرقام يعطي null', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('غير محدد')).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });
});

describe('قراءة التواريخ', () => {
  it('يقبل الصيغ الشائعة', () => {
    expect(parseDate('2026-01-01').iso).toBe('2026-01-01');
    expect(parseDate('01/01/2026').iso).toBe('2026-01-01');
    expect(parseDate('31-12-2026').iso).toBe('2026-12-31');
    expect(parseDate('1 يناير 2026').iso).toBe('2026-01-01');
    expect(parseDate('٣١/١٢/٢٠٢٦').iso).toBe('2026-12-31');
  });
  it('يرفض تاريخاً غير موجود بدل أن يخمّن', () => {
    expect(parseDate('30/02/2026').iso).toBeNull();
    expect(parseDate('كلام').iso).toBeNull();
  });
  it('يكشف الهجري ولا يحوّله', () => {
    const r = parseDate('1447-06-01');
    expect(r.hijri).toBe(true);
    expect(r.iso).toBeNull();
  });
});

describe('استنتاج العملة', () => {
  it.each([['ريال سعودي', 'SAR'], ['ر.س', 'SAR'], ['درهم', 'AED'], ['SAR', 'SAR'], ['USD', 'USD']])(
    '%s يعطي %s', (input, expected) => expect(parseCurrency(input)).toBe(expected));
  it('غير معروف يعطي null', () => {
    expect(parseCurrency('xyz!')).toBeNull();
  });
});

describe('مطابقة المستأجر', () => {
  it('الهوية الوطنية تفصل حتى لو اختلف الاسم', () => {
    const m = matchTenants({ tenantName: 'اسم مختلف تماماً', tenantNationalId: '1012345678' }, tenants);
    expect(m.map(t => t.id)).toEqual(['t1']);
  });
  it('يطابق رغم اختلاف الهمزة والتاء', () => {
    expect(matchTenants({ tenantName: 'د. اسامه الزهراني' }, tenants).map(t => t.id)).toEqual(['t1']);
  });
  it('اسم ناقص اللقب يُطابق جزئياً', () => {
    expect(matchTenants({ tenantName: 'أسامة الزهراني' }, tenants).map(t => t.id)).toEqual(['t1']);
  });
  it('اسم غير مسجَّل لا يعطي مرشّحين — لا يختار عشوائياً', () => {
    expect(matchTenants({ tenantName: 'سالم الدوسري' }, tenants)).toEqual([]);
  });
});

describe('مطابقة الوحدة', () => {
  it('رقم الوحدة مع اسم العقار يفصل بين المتشابهين', () => {
    const m = matchUnits({ unitNumber: '101', propertyName: 'برج المروج' }, units, properties);
    expect(m.map(u => u.id)).toEqual(['u3']);
  });
  it('رقم مكرر بلا اسم عقار يعطي مرشّحين للاختيار', () => {
    expect(matchUnits({ unitNumber: '101' }, units, properties)).toHaveLength(2);
  });
  it('رقم غير موجود لا يعطي مرشّحين', () => {
    expect(matchUnits({ unitNumber: '999' }, units, properties)).toEqual([]);
  });
});

describe('بناء المسوّدة', () => {
  it('قراءة سليمة تعطي مسوّدة كاملة جاهزة للحفظ', () => {
    const r = buildDraft(good, ctx);
    expect(r.issues.filter(i => i.level === 'blocking')).toEqual([]);
    expect(isReadyToSave(r)).toBe(true);
    expect(r.draft).toMatchObject({
      tenantId: 't1', unitId: 'u2',
      startDate: '2026-01-01', endDate: '2026-12-31',
      annualValue: 65000, installmentsCount: 4, currency: 'SAR',
    });
  });

  it('مستأجر غير مسجَّل يمنع الحفظ برسالة تسميه', () => {
    const r = buildDraft({ ...good, tenantName: 'سالم الدوسري', tenantNationalId: null }, ctx);
    expect(isReadyToSave(r)).toBe(false);
    expect(r.issues.find(i => i.field === 'tenantId')?.message).toContain('سالم الدوسري');
  });

  it('وحدة ملتبسة تمنع الحفظ وتعرض المرشّحين', () => {
    const r = buildDraft({ ...good, unitNumber: '101', propertyName: null }, ctx);
    expect(isReadyToSave(r)).toBe(false);
    expect(r.unitCandidates).toHaveLength(2);
  });

  it('تاريخ هجري يمنع الحفظ ولا يُحوَّل', () => {
    const r = buildDraft({ ...good, startDate: '1447-06-01' }, ctx);
    expect(isReadyToSave(r)).toBe(false);
    expect(r.issues.find(i => i.field === 'dates')?.message).toContain('هجرية');
    expect(r.draft.startDate).toBeUndefined();
  });

  it('نهاية قبل بداية تُكشف', () => {
    const r = buildDraft({ ...good, endDate: '01/01/2025' }, ctx);
    expect(r.issues.some(i => i.field === 'endDate' && i.level === 'blocking')).toBe(true);
  });

  it('قيمة غير مقروءة تمنع الحفظ', () => {
    const r = buildDraft({ ...good, annualValue: 'غير واضح' }, ctx);
    expect(isReadyToSave(r)).toBe(false);
  });

  /** الحارس الأهم: صفر زائد في القراءة لا يمرّ بلا تنبيه. */
  it('قيمة خارج النطاق المعتاد تُنبِّه على عدد الأصفار', () => {
    const r = buildDraft({ ...good, annualValue: '650000000' }, ctx);
    const w = r.issues.find(i => i.field === 'annualValue' && i.level === 'warning');
    expect(w?.message).toContain('الأصفار');
    expect(isReadyToSave(r)).toBe(true);
  });

  it('عدد أقساط غير منطقي يُترك للاختيار اليدوي', () => {
    const r = buildDraft({ ...good, installmentsCount: '99' }, ctx);
    expect(r.draft.installmentsCount).toBeUndefined();
    expect(r.issues.some(i => i.field === 'installmentsCount')).toBe(true);
  });

  it('ثقة منخفضة تُنبِّه بمراجعة كل الحقول', () => {
    const r = buildDraft({ ...good, confidence: 0.4 }, ctx);
    expect(r.issues.some(i => i.field === 'overall')).toBe(true);
  });

  it('قراءة فارغة تماماً تحجب الحفظ ولا تبني مسوّدة وهمية', () => {
    const r = buildDraft({}, ctx);
    expect(isReadyToSave(r)).toBe(false);
    const blocked = r.issues.filter(i => i.level === 'blocking').map(i => i.field);
    expect(blocked).toContain('tenantId');
    expect(blocked).toContain('unitId');
    expect(blocked).toContain('annualValue');
  });
});
