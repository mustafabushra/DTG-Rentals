/**
 * بناء طلب القراءة وتحليل جواب النموذج.
 *
 * النموذج يُسأل أن يُرجع JSON فقط، لكن النماذج قد تُحيط الجواب بنصّ أو بأسوار
 * ```json. فالتحليل هنا متسامح في الشكل وصارم في المحتوى: ما لا يُقرأ يُرجَع null
 * بدل تخمين قيمة — والقيم الناقصة يطلبها التطبيق من المستخدم.
 */

/** حدّ حجم الصورة المقبول (بايت، قبل base64). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

/** الحقول التي نطلبها — أي حقل غيرها يُهمَل عند التحليل. */
export const EXTRACTION_FIELDS = [
  'contractNumber', 'tenantName', 'tenantNationalId', 'tenantPhone',
  'propertyName', 'unitNumber', 'startDate', 'endDate',
  'annualValue', 'installmentsCount', 'currency', 'confidence',
];

export const SYSTEM_PROMPT = [
  'أنت تقرأ صورة عقد إيجار عربي وتُرجع بياناته منظَّمة.',
  '',
  'أرجِع **JSON فقط** بلا أي نص قبله أو بعده، بهذا الشكل:',
  '{',
  '  "contractNumber": string|null,',
  '  "tenantName": string|null,',
  '  "tenantNationalId": string|null,',
  '  "tenantPhone": string|null,',
  '  "propertyName": string|null,',
  '  "unitNumber": string|null,',
  '  "startDate": string|null,',
  '  "endDate": string|null,',
  '  "annualValue": string|null,',
  '  "installmentsCount": string|null,',
  '  "currency": string|null,',
  '  "confidence": number',
  '}',
  '',
  'قواعد صارمة:',
  '- انقل القيم **كما هي مكتوبة في العقد** بلا تحويل: لا تحوّل التاريخ الهجري إلى',
  '  ميلادي، ولا الأرقام العربية إلى لاتينية، ولا تُنسّق المبالغ. التطبيق يتولّى ذلك.',
  '- الحقل الذي لا تجده أو لا تقرؤه بثقة ⇒ null. **لا تخمّن ولا تستنتج.**',
  '- annualValue هي قيمة الإيجار **السنوي** كما هي مكتوبة. إن لم يذكر العقد إلا',
  '  إيجاراً شهرياً، أرجِع annualValue: null — لا تضربه في 12، فالضرب استنتاج لا قراءة.',
  '- confidence رقم بين 0 و1 يعبّر عن وضوح الصورة وثقتك في القراءة ككل.',
  '- لا تُضف حقولاً غير المذكورة أعلاه.',
].join('\n');

/**
 * يتحقق من صحة الطلب الوارد من التطبيق قبل إنفاق أي استدعاء مدفوع.
 * يرجع { ok: true, image } أو { ok: false, code, message }.
 */
export function validateRequest(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, code: 'BAD_BODY', message: 'صيغة الطلب غير صالحة.' };
  }
  const { imageBase64, mimeType } = body;
  if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
    return { ok: false, code: 'NO_IMAGE', message: 'لم تُرسل صورة.' };
  }
  if (!ALLOWED_MIME.includes(mimeType)) {
    return { ok: false, code: 'BAD_MIME', message: 'نوع الصورة غير مدعوم. استخدم JPEG أو PNG.' };
  }
  // طول base64 ≈ 4/3 من البايتات الأصلية
  const approxBytes = Math.floor((imageBase64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return {
      ok: false, code: 'IMAGE_TOO_LARGE',
      message: `حجم الصورة يتجاوز الحد (${Math.round(MAX_IMAGE_BYTES / 1048576)} ميجابايت). صوّرها بجودة أقل.`,
    };
  }
  return { ok: true, image: { data: imageBase64, mimeType } };
}

/**
 * يستخرج أول كائن JSON من نصّ قد يكون محاطاً بأسوار أو نثر.
 * يرجع null إن لم يوجد JSON صالح — لا يخمّن.
 */
export function parseModelJson(text) {
  if (typeof text !== 'string') return null;

  // أزل أسوار الشيفرة إن وُجدت
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;

  // أول كائن متوازن الأقواس
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
        try { return JSON.parse(candidate.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

/** يُبقي الحقول المعروفة فقط ويطبّع الفراغ إلى null. */
export function sanitizeExtraction(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const key of EXTRACTION_FIELDS) {
    const v = raw[key];
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
