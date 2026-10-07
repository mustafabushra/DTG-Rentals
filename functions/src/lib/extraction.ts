/**
 * منطق قراءة العقد — نقي ومختبَر، بلا Firebase ولا شبكة.
 *
 * النموذج يُسأل أن يُرجع JSON فقط، لكن النماذج قد تُحيط الجواب بنصّ أو بأسوار
 * ```json. فالتحليل متسامح في الشكل وصارم في المحتوى: ما لا يُقرأ يُرجَع null بدل
 * تخمين قيمة — والقيم الناقصة يطلبها التطبيق من المستخدم.
 */

/** حدّ حجم الصورة المقبول (بايت، قبل ترميز base64). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;

/** الحقول التي نطلبها — أي حقل غيرها يُهمَل. */
export const EXTRACTION_FIELDS = [
  'contractNumber', 'tenantName', 'tenantNationalId', 'tenantPhone',
  'propertyName', 'unitNumber', 'startDate', 'endDate',
  'annualValue', 'installmentsCount', 'currency', 'confidence',
] as const;

export type ExtractionField = (typeof EXTRACTION_FIELDS)[number];
export type Extraction = Record<ExtractionField, string | number | null>;

export const SYSTEM_PROMPT = [
  'أنت تقرأ صورة عقد إيجار عربي وتُرجع بياناته منظَّمة.',
  '',
  'أرجِع **JSON فقط** بلا أي نص قبله أو بعده، بهذه الحقول:',
  'contractNumber, tenantName, tenantNationalId, tenantPhone, propertyName,',
  'unitNumber, startDate, endDate, annualValue, installmentsCount, currency,',
  'confidence (رقم بين 0 و1).',
  '',
  'قواعد صارمة:',
  '- انقل القيم **كما هي مكتوبة في العقد** بلا تحويل: لا تحوّل التاريخ الهجري إلى',
  '  ميلادي، ولا الأرقام العربية إلى لاتينية، ولا تُنسّق المبالغ. التطبيق يتولّى ذلك.',
  '- الحقل الذي لا تجده أو لا تقرؤه بثقة ⇒ null. **لا تخمّن ولا تستنتج.**',
  '- annualValue هي قيمة الإيجار **السنوي** كما هي مكتوبة. إن لم يذكر العقد إلا',
  '  إيجاراً شهرياً، أرجِع annualValue: null — لا تضربه في 12، فالضرب استنتاج لا قراءة.',
  '- confidence يعبّر عن وضوح الصورة وثقتك في القراءة ككل.',
  '- لا تُضف حقولاً غير المذكورة أعلاه.',
].join('\n');

export type RequestCheck =
  | { ok: true; image: { data: string; mimeType: string } }
  | { ok: false; code: string; message: string };

/**
 * يتحقق من الطلب **قبل** إنفاق أي استدعاء مدفوع.
 * فالصورة الضخمة أو النوع غير المدعوم لا يكلّفانك شيئاً.
 */
export function validateRequest(body: unknown): RequestCheck {
  if (!body || typeof body !== 'object') {
    return { ok: false, code: 'BAD_BODY', message: 'صيغة الطلب غير صالحة.' };
  }
  const { imageBase64, mimeType } = body as { imageBase64?: unknown; mimeType?: unknown };
  if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
    return { ok: false, code: 'NO_IMAGE', message: 'لم تُرسل صورة.' };
  }
  if (typeof mimeType !== 'string' || !(ALLOWED_MIME as readonly string[]).includes(mimeType)) {
    return { ok: false, code: 'BAD_MIME', message: 'نوع الصورة غير مدعوم. استخدم JPEG أو PNG.' };
  }
  // طول base64 ≈ 4/3 من البايتات الأصلية
  const approxBytes = Math.floor((imageBase64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return {
      ok: false, code: 'IMAGE_TOO_LARGE',
      message: `حجم الصورة يتجاوز ${Math.round(MAX_IMAGE_BYTES / 1048576)} ميجابايت. صوّرها بجودة أقل.`,
    };
  }
  return { ok: true, image: { data: imageBase64, mimeType } };
}

/**
 * يستخرج أول كائن JSON متوازن الأقواس من نصّ قد يكون محاطاً بأسوار أو نثر.
 * يرجع null إن لم يوجد JSON صالح — لا يخمّن.
 */
export function parseModelJson(text: unknown): Record<string, unknown> | null {
  if (typeof text !== 'string') return null;

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;

  const start = candidate.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(candidate.slice(start, i + 1));
          return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
        } catch { return null; }
      }
    }
  }
  return null;
}

/** يُبقي الحقول المعروفة فقط، ويطبّع الفراغ إلى null، ويقصّ الثقة بين 0 و1. */
export function sanitizeExtraction(raw: unknown): Extraction | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const out = {} as Extraction;
  for (const key of EXTRACTION_FIELDS) {
    const v = src[key];
    if (key === 'confidence') {
      const n = Number(v);
      out.confidence = Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
      continue;
    }
    if (v === null || v === undefined) { out[key] = null; continue; }
    if (typeof v === 'number') { out[key] = String(v); continue; }
    if (typeof v !== 'string') { out[key] = null; continue; }
    const t = v.trim();
    out[key] = t.length ? t : null;
  }
  return out;
}

/**
 * حدّ معدل في الذاكرة — طبقة أولى تحمي الحصّة المدفوعة.
 *
 * **حدّ معروف:** الذاكرة لكل نسخة من الدالة، وCloud Functions تُشغّل نسخاً متعددة،
 * فالحدّ الفعلي قد يصل إلى (الحد × عدد النسخ). مقبول مع التحقق من الهوية وحدّ
 * الحجم؛ الحدّ الصارم يلزمه مخزن مشترك وهو تعقيد لا يستحقه الاستخدام الحالي.
 */
export function createRateLimiter({ max = 30, windowMs = 60 * 60_000, maxKeys = 5000 } = {}) {
  const hits = new Map<string, number[]>();

  return {
    check(key: string, now = Date.now()) {
      if (!key) return { allowed: false, remaining: 0, retryAfterMs: windowMs };

      if (hits.size > maxKeys) {
        for (const [k, stamps] of hits) {
          const fresh = stamps.filter(t => now - t < windowMs);
          if (fresh.length === 0) hits.delete(k); else hits.set(k, fresh);
        }
      }

      const stamps = (hits.get(key) ?? []).filter(t => now - t < windowMs);
      if (stamps.length >= max) {
        const oldest = Math.min(...stamps);
        return { allowed: false, remaining: 0, retryAfterMs: windowMs - (now - oldest) };
      }
      stamps.push(now);
      hits.set(key, stamps);
      return { allowed: true, remaining: max - stamps.length, retryAfterMs: 0 };
    },
    size() { return hits.size; },
  };
}
