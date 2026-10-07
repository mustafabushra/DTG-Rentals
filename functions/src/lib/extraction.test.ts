import { describe, it, expect } from 'vitest';
import {
  validateRequest, parseModelJson, sanitizeExtraction, createRateLimiter, MAX_IMAGE_BYTES,
} from './extraction';

describe('التحقق من الطلب قبل أي استدعاء مدفوع', () => {
  const img = 'A'.repeat(100);

  it('طلب سليم يُقبل', () => {
    expect(validateRequest({ imageBase64: img, mimeType: 'image/jpeg' })).toMatchObject({ ok: true });
  });

  it.each([
    [null, 'BAD_BODY'],
    ['نص', 'BAD_BODY'],
    [{}, 'NO_IMAGE'],
    [{ imageBase64: '', mimeType: 'image/jpeg' }, 'NO_IMAGE'],
    [{ imageBase64: img, mimeType: 'application/pdf' }, 'BAD_MIME'],
    [{ imageBase64: img }, 'BAD_MIME'],
  ])('يرفض الطلب غير الصالح (%#)', (body, code) => {
    expect(validateRequest(body)).toMatchObject({ ok: false, code });
  });

  it('صورة أكبر من الحد تُرفض قبل الإنفاق', () => {
    const huge = 'A'.repeat(Math.ceil(((MAX_IMAGE_BYTES + 1024) * 4) / 3));
    const r = validateRequest({ imageBase64: huge, mimeType: 'image/jpeg' });
    expect(r).toMatchObject({ ok: false, code: 'IMAGE_TOO_LARGE' });
    if (!r.ok) expect(r.message).toContain('ميجابايت');
  });
});

describe('تحليل جواب النموذج', () => {
  const obj = { tenantName: 'أسامة', annualValue: '65,000' };

  it('JSON خالص', () => {
    expect(parseModelJson(JSON.stringify(obj))).toEqual(obj);
  });
  it('محاط بأسوار شيفرة', () => {
    expect(parseModelJson('```json\n' + JSON.stringify(obj) + '\n```')).toEqual(obj);
  });
  it('محاط بنثر قبله وبعده', () => {
    expect(parseModelJson(`هذا ما قرأته:\n${JSON.stringify(obj)}\nانتهى.`)).toEqual(obj);
  });
  it('يتحمّل أقواساً داخل النصوص', () => {
    const tricky = { tenantName: 'شركة {الزاهية} للتطوير' };
    expect(parseModelJson(JSON.stringify(tricky))).toEqual(tricky);
  });
  it('يتحمّل كائنات متداخلة', () => {
    expect(parseModelJson(JSON.stringify({ a: { b: { c: 1 } } }))).toEqual({ a: { b: { c: 1 } } });
  });
  it('مصفوفة ليست كائناً ⇒ null', () => {
    expect(parseModelJson('[1,2,3]')).toBeNull();
  });
  it('نصّ بلا JSON يرجع null بدل تخمين', () => {
    for (const bad of ['لا أستطيع قراءة الصورة', '', null, '{ غير مكتمل', 123]) {
      expect(parseModelJson(bad)).toBeNull();
    }
  });
});

describe('تنقية القراءة', () => {
  it('يُبقي الحقول المعروفة ويُسقط الدخيلة', () => {
    const out = sanitizeExtraction({ tenantName: 'أسامة', hacked: 'x', annualValue: 65000 })!;
    expect(out.tenantName).toBe('أسامة');
    expect(out.annualValue).toBe('65000');
    expect('hacked' in out).toBe(false);
  });

  it('الفراغات تصير null', () => {
    expect(sanitizeExtraction({ tenantName: '   ' })!.tenantName).toBeNull();
  });

  it('كل حقل غائب يصير null — لا حقول ناقصة في العقد', () => {
    const out = sanitizeExtraction({})!;
    expect(out.tenantName).toBeNull();
    expect(out.startDate).toBeNull();
    expect(out.confidence).toBeNull();
  });

  it('الثقة تُقصّ بين صفر وواحد', () => {
    expect(sanitizeExtraction({ confidence: 1.7 })!.confidence).toBe(1);
    expect(sanitizeExtraction({ confidence: -3 })!.confidence).toBe(0);
    expect(sanitizeExtraction({ confidence: 'abc' })!.confidence).toBeNull();
  });

  it('قيمة ليست نصاً ولا رقماً تصير null', () => {
    expect(sanitizeExtraction({ tenantName: { x: 1 } })!.tenantName).toBeNull();
  });

  it('مدخل ليس كائناً يرجع null', () => {
    expect(sanitizeExtraction(null)).toBeNull();
    expect(sanitizeExtraction('نص')).toBeNull();
    expect(sanitizeExtraction([1])).toBeNull();
  });
});

describe('حدّ المعدل', () => {
  it('يسمح حتى الحد ثم يمنع', () => {
    const l = createRateLimiter({ max: 3, windowMs: 1000 });
    expect([l.check('u', 0), l.check('u', 10), l.check('u', 20)].every(r => r.allowed)).toBe(true);
    expect(l.check('u', 30).allowed).toBe(false);
  });

  it('النافذة تتجدد بمرور الوقت', () => {
    const l = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(l.check('u', 0).allowed).toBe(true);
    expect(l.check('u', 500).allowed).toBe(false);
    expect(l.check('u', 1500).allowed).toBe(true);
  });

  it('الحدّ لكل مستخدم لا مشترك', () => {
    const l = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(l.check('a', 0).allowed).toBe(true);
    expect(l.check('b', 0).allowed).toBe(true);
  });

  it('مفتاح فارغ يُمنع — لا تجاوز بلا هوية', () => {
    expect(createRateLimiter({ max: 5 }).check('', 0).allowed).toBe(false);
  });

  it('يبلّغ المدة المتبقية للمحاولة', () => {
    const l = createRateLimiter({ max: 1, windowMs: 1000 });
    l.check('u', 0);
    expect(l.check('u', 400).retryAfterMs).toBe(600);
  });
});
