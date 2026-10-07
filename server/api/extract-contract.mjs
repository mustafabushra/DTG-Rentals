/**
 * نقطة النهاية: صورة عقد ← بيانات منظَّمة.
 *
 * تحمل مفتاح Anthropic الذي **لا يجوز** أن يسكن التطبيق (حزمة الويب يقرؤها أي
 * أحد). ولأنها تحمل مفتاحاً مدفوعاً، تتحقق من هوية Firebase وتحدّ المعدل قبل أي
 * استدعاء — بلا ذلك تصير بوّابة مفتوحة يستنزفها من يجد رابطها.
 *
 * متغيّرات البيئة المطلوبة:
 *   ANTHROPIC_API_KEY      مفتاحك
 *   FIREBASE_PROJECT_ID    dtg-rentals
 *   ALLOWED_ORIGIN         https://dtg-rentals.web.app (اختياري، لإحكام CORS)
 *
 * التوقيع: POST { imageBase64, mimeType }  +  Authorization: Bearer <firebase id token>
 * الجواب:  { ok: true, extraction }  |  { ok: false, code, message }
 */
import { verifyFirebaseToken } from '../lib/verifyFirebaseToken.mjs';
import { createRateLimiter } from '../lib/rateLimit.mjs';
import {
  SYSTEM_PROMPT, validateRequest, parseModelJson, sanitizeExtraction,
} from '../lib/extraction.mjs';

const MODEL = 'claude-sonnet-5';
const limiter = createRateLimiter({ max: 30, windowMs: 60 * 60_000 });

function send(res, status, payload, origin) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  const allowed = process.env.ALLOWED_ORIGIN || '*';
  const origin  = allowed === '*' ? '*' : allowed;

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') {
    return send(res, 405, { ok: false, code: 'METHOD', message: 'POST فقط.' }, origin);
  }

  const apiKey    = process.env.ANTHROPIC_API_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    console.error('[extract] missing env: ANTHROPIC_API_KEY or FIREBASE_PROJECT_ID');
    return send(res, 500, { ok: false, code: 'NOT_CONFIGURED', message: 'الخدمة غير مهيّأة.' }, origin);
  }

  // ① الهوية
  const auth  = req.headers?.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const who   = await verifyFirebaseToken(token, { projectId });
  if (!who.ok) {
    console.warn('[extract] auth rejected:', who.code);
    return send(res, 401, { ok: false, code: 'UNAUTHORIZED', message: 'الجلسة غير صالحة. أعد تسجيل الدخول.' }, origin);
  }

  // ② حدّ المعدل لكل مستخدم
  const gate = limiter.check(who.uid);
  if (!gate.allowed) {
    return send(res, 429, {
      ok: false, code: 'RATE_LIMITED',
      message: `تجاوزت الحد المسموح. أعد المحاولة بعد ${Math.ceil(gate.retryAfterMs / 60000)} دقيقة.`,
    }, origin);
  }

  // ③ صحة الطلب — قبل إنفاق أي استدعاء مدفوع
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const check = validateRequest(body);
  if (!check.ok) {
    return send(res, 400, { ok: false, code: check.code, message: check.message }, origin);
  }

  // ④ القراءة
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: check.image.mimeType, data: check.image.data } },
            { type: 'text', text: 'اقرأ هذا العقد وأرجِع JSON فقط.' },
          ],
        }],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      console.error('[extract] upstream', upstream.status, detail.slice(0, 400));
      const message = upstream.status === 429
        ? 'الخدمة مزدحمة حالياً. أعد المحاولة بعد قليل.'
        : 'تعذّرت قراءة الصورة. أعد المحاولة أو أدخل البيانات يدوياً.';
      return send(res, 502, { ok: false, code: 'UPSTREAM', message }, origin);
    }

    const data = await upstream.json();
    const text = (data?.content ?? []).filter(b => b?.type === 'text').map(b => b.text).join('\n');
    const extraction = sanitizeExtraction(parseModelJson(text));
    if (!extraction) {
      console.warn('[extract] unparseable model output');
      return send(res, 422, {
        ok: false, code: 'UNREADABLE',
        message: 'لم تُقرأ الصورة بوضوح. صوّر العقد مستوياً بإضاءة أفضل، أو أدخل البيانات يدوياً.',
      }, origin);
    }

    console.log('[extract] ok uid=%s remaining=%d', who.uid, gate.remaining);
    return send(res, 200, { ok: true, extraction }, origin);
  } catch (e) {
    console.error('[extract] failed', e);
    return send(res, 500, {
      ok: false, code: 'FAILED',
      message: 'تعذّر إتمام القراءة. تحقّق من الاتصال وأعد المحاولة.',
    }, origin);
  }
}
