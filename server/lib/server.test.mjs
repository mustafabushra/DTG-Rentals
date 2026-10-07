import { describe, it, expect } from 'vitest';
import { decodeJwt, validateClaims, verifyFirebaseToken } from './verifyFirebaseToken.mjs';
import { createRateLimiter } from './rateLimit.mjs';
import { validateRequest, parseModelJson, sanitizeExtraction, MAX_IMAGE_BYTES } from './extraction.mjs';

const PROJECT = 'dtg-rentals';
const NOW = 1_760_000_000_000;              // توقيت ثابت للاختبار
const nowSec = Math.floor(NOW / 1000);

const b64url = obj =>
  Buffer.from(JSON.stringify(obj)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const makeToken = (header = {}, payload = {}) => [
  b64url({ alg: 'RS256', kid: 'k1', ...header }),
  b64url({
    aud: PROJECT,
    iss: `https://securetoken.google.com/${PROJECT}`,
    sub: 'uid-123',
    iat: nowSec - 60,
    exp: nowSec + 3600,
    auth_time: nowSec - 120,
    ...payload,
  }),
  'c2lnbmF0dXJl',
].join('.');

describe('فكّ ترميز الرمز', () => {
  it('يفكّ رمزاً صالحاً', () => {
    const d = decodeJwt(makeToken());
    expect(d?.payload.sub).toBe('uid-123');
    expect(d?.header.kid).toBe('k1');
  });
  it('يرجع null لشكل غير صالح بدل أن يرمي', () => {
    for (const bad of ['', 'abc', 'a.b', 'a.b.c.d', null, 123, '....']) {
      expect(decodeJwt(bad)).toBeNull();
    }
  });
  it('يرجع null لحمولة ليست JSON', () => {
    expect(decodeJwt(`${b64url({ alg: 'RS256' })}.bm90anNvbg.sig`)).toBeNull();
  });
});

describe('التحقق من المُطالبات', () => {
  const ok = t => validateClaims(decodeJwt(t), { projectId: PROJECT, now: NOW });

  it('رمز سليم يُقبل ويُعيد المعرّف', () => {
    expect(ok(makeToken())).toEqual({ ok: true, uid: 'uid-123' });
  });

  it.each([
    ['خوارزمية غير RS256', { alg: 'HS256' }, {}, 'BAD_ALG'],
    ['بلا kid',            { kid: undefined }, {}, 'NO_KID'],
  ])('%s يُرفض', (_, header, payload, code) => {
    expect(ok(makeToken(header, payload))).toMatchObject({ ok: false, code });
  });

  it.each([
    ['جمهور خاطئ',      { aud: 'other-project' }, 'BAD_AUDIENCE'],
    ['مُصدِر خاطئ',      { iss: 'https://evil.example/x' }, 'BAD_ISSUER'],
    ['منتهي',           { exp: nowSec - 3600 }, 'EXPIRED'],
    ['صادر في المستقبل', { iat: nowSec + 3600 }, 'ISSUED_IN_FUTURE'],
    ['بلا موضوع',       { sub: '' }, 'NO_SUBJECT'],
  ])('%s يُرفض', (_, payload, code) => {
    expect(ok(makeToken({}, payload))).toMatchObject({ ok: false, code });
  });

  it('يتحمّل فرق ساعة بسيطاً (دقيقة)', () => {
    expect(ok(makeToken({}, { exp: nowSec - 30 }))).toMatchObject({ ok: true });
  });
});

describe('التحقق الكامل مع التوقيع', () => {
  const deps = {
    projectId: PROJECT,
    now: () => NOW,
    getCertForKid: async kid => (kid === 'k1' ? 'CERT' : null),
    verifySignature: () => true,
  };

  it('رمز سليم بتوقيع صحيح يُقبل', async () => {
    await expect(verifyFirebaseToken(makeToken(), deps)).resolves.toEqual({ ok: true, uid: 'uid-123' });
  });

  it('توقيع فاسد يُرفض', async () => {
    const r = await verifyFirebaseToken(makeToken(), { ...deps, verifySignature: () => false });
    expect(r).toMatchObject({ ok: false, code: 'BAD_SIGNATURE' });
  });

  it('kid غير معروف يُرفض', async () => {
    const r = await verifyFirebaseToken(makeToken({ kid: 'zz' }), deps);
    expect(r).toMatchObject({ ok: false, code: 'UNKNOWN_KID' });
  });

  it('تعذّر جلب الشهادات يُرفض ولا يرمي', async () => {
    const r = await verifyFirebaseToken(makeToken(), {
      ...deps, getCertForKid: async () => { throw new Error('network'); },
    });
    expect(r).toMatchObject({ ok: false, code: 'CERTS_UNAVAILABLE' });
  });

  it('استثناء في التحقق من التوقيع يُعامَل كتوقيع فاسد', async () => {
    const r = await verifyFirebaseToken(makeToken(), {
      ...deps, verifySignature: () => { throw new Error('bad cert'); },
    });
    expect(r).toMatchObject({ ok: false, code: 'BAD_SIGNATURE' });
  });

  it('بلا رمز أو بلا معرّف مشروع يُرفض', async () => {
    await expect(verifyFirebaseToken('', deps)).resolves.toMatchObject({ ok: false, code: 'MALFORMED' });
    await expect(verifyFirebaseToken(makeToken(), { ...deps, projectId: undefined }))
      .resolves.toMatchObject({ ok: false, code: 'NO_PROJECT_ID' });
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

describe('التحقق من الطلب', () => {
  const img = 'A'.repeat(100);

  it('طلب سليم يُقبل', () => {
    expect(validateRequest({ imageBase64: img, mimeType: 'image/jpeg' })).toMatchObject({ ok: true });
  });

  it.each([
    [null, 'BAD_BODY'],
    [{}, 'NO_IMAGE'],
    [{ imageBase64: '', mimeType: 'image/jpeg' }, 'NO_IMAGE'],
    [{ imageBase64: img, mimeType: 'application/pdf' }, 'BAD_MIME'],
    [{ imageBase64: img }, 'BAD_MIME'],
  ])('يرفض الطلب غير الصالح (%#)', (body, code) => {
    expect(validateRequest(body)).toMatchObject({ ok: false, code });
  });

  it('صورة أكبر من الحد تُرفض قبل أي استدعاء مدفوع', () => {
    const huge = 'A'.repeat(Math.ceil((MAX_IMAGE_BYTES + 1024) * 4 / 3));
    const r = validateRequest({ imageBase64: huge, mimeType: 'image/jpeg' });
    expect(r).toMatchObject({ ok: false, code: 'IMAGE_TOO_LARGE' });
    expect(r.message).toContain('ميجابايت');
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
    const nested = { a: { b: { c: 1 } } };
    expect(parseModelJson(JSON.stringify(nested))).toEqual(nested);
  });
  it('نصّ بلا JSON يرجع null بدل تخمين', () => {
    for (const bad of ['لا أستطيع قراءة الصورة', '', null, '{ غير مكتمل']) {
      expect(parseModelJson(bad)).toBeNull();
    }
  });
});

describe('تنقية القراءة', () => {
  it('يُبقي الحقول المعروفة ويُسقط الدخيلة', () => {
    const out = sanitizeExtraction({ tenantName: 'أسامة', hacked: 'x', annualValue: 65000 });
    expect(out.tenantName).toBe('أسامة');
    expect(out.annualValue).toBe('65000');       // الأرقام تُحوَّل نصاً للتطبيع في التطبيق
    expect('hacked' in out).toBe(false);
  });

  it('الفراغات تصير null', () => {
    expect(sanitizeExtraction({ tenantName: '   ' }).tenantName).toBeNull();
  });

  it('كل حقل غائب يصير null — لا حقول ناقصة', () => {
    const out = sanitizeExtraction({});
    expect(out.tenantName).toBeNull();
    expect(out.startDate).toBeNull();
    expect(out.confidence).toBeNull();
  });

  it('الثقة تُقصّ بين صفر وواحد', () => {
    expect(sanitizeExtraction({ confidence: 1.7 }).confidence).toBe(1);
    expect(sanitizeExtraction({ confidence: -3 }).confidence).toBe(0);
    expect(sanitizeExtraction({ confidence: 'abc' }).confidence).toBeNull();
  });

  it('قيمة ليست نصاً ولا رقماً تصير null', () => {
    expect(sanitizeExtraction({ tenantName: { x: 1 } }).tenantName).toBeNull();
  });

  it('مدخل ليس كائناً يرجع null', () => {
    expect(sanitizeExtraction(null)).toBeNull();
    expect(sanitizeExtraction('نص')).toBeNull();
  });
});
