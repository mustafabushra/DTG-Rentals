/**
 * عميل قراءة العقود — يقرأ صورة العقد بـ Gemini من المتصفح مباشرة.
 *
 * **لماذا بلا خادم:** المشروع على خطة Spark فلا Cloud Functions تُنشر. وكانت
 * الميزة معطّلة لذلك. لكن Gemini متعدّد الوسائط ويقبل الصورة في الطلب نفسه،
 * ويسمح بالنداء من المتصفح (CORS) — فالقراءة تصير ممكنة بالمفتاح المضبوط
 * للمساعد نفسه، بلا خادم ولا ترقية ولا تكلفة تتجاوز الحصّة المجانية.
 *
 * **السرّ:** المفتاح لا يُحزَم في التطبيق (الحزمة تُخدَم علناً). يُقرأ من
 * settings/assistant الذي تحرسه قاعدة تقصر قراءته على المدير — فالمسح متاح
 * للمدير فقط، وهو المناسب: إنشاء العقود عمله.
 *
 * **ما يخرج إلى الإنترنت:** صورة العقد تُرسَل إلى Google لتُقرأ. هذا جوهر
 * الميزة لا عَرَض منها، فالشاشة تُفصح عنه قبل الالتقاط.
 *
 * النموذج يُقرأ منه نصّ خام فقط؛ كل تطبيع وتحقّق ومطابقة يحدث محلياً في
 * ContractExtractionService — فالنموذج لا يُحتسب عليه حسابٌ ولا قرار.
 */
import { loadAssistantConfig, generateText } from './assistantClient';
import { getActiveOrgId } from './firestoreService';
import type { RawExtraction } from '../domain/services/ContractExtractionService';

/** حدّ الحجم. أكبر من هذا يُبطئ الرفع بلا تحسّن في القراءة. */
export const MAX_SCAN_BYTES = 5 * 1024 * 1024;

export type ScanResult =
  | { ok: true; extraction: RawExtraction; usedModel: string }
  | { ok: false; code: string; message: string };

/**
 * التوجيه: ينسخ ما هو مكتوب ولا يحسب ولا يحوّل.
 *
 * التواريخ تُنقَل **كما طُبعت**: التحويل الهجري↔الميلادي يقع محلياً حيث
 * `looksHijri` يكشفه وتسأل الشاشة المستخدم. ولو حوّل النموذج لأخطأ بصمت
 * ولَما عرفنا أنه حوّل.
 */
const SCAN_SYSTEM = `أنت قارئ عقود إيجار عربية. مهمتك نسخ ما هو مكتوب في الصورة حرفياً.

قواعد ملزمة:
- انسخ القيم كما هي مكتوبة. لا تحسب، ولا تُقرّب، ولا تُعِد صياغة.
- التواريخ: انسخها كما طُبعت بالضبط. لا تحوّل بين الهجري والميلادي أبداً.
- المبالغ: انسخ الرقم كما كُتب بلا رمز العملة. العملة في حقلها.
- إن كان حقل غير مذكور في الصورة أو غير مقروء، اجعله null. لا تخمّن ولا تخترع.
- إن كانت الصورة ليست عقد إيجار، اجعل كل الحقول null وconfidence صفراً.
- confidence: ثقتك في القراءة كاملةً بين 0 و1.`;

/** مخطَّط يُلزم النموذج بـ JSON صالح — أوثق كثيراً من تحليل نصّ حرّ. */
const SCAN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    // المبالغ والأعداد نصوصٌ عن قصد: العقود تكتبها بصيغ شتّى وبأرقام عربية،
    // و parseAmount محلياً يتولّى ذلك وهو مُختبَر.
    contractNumber:    { type: 'STRING', nullable: true },
    tenantName:        { type: 'STRING', nullable: true },
    tenantNationalId:  { type: 'STRING', nullable: true },
    tenantPhone:       { type: 'STRING', nullable: true },
    propertyName:      { type: 'STRING', nullable: true },
    unitNumber:        { type: 'STRING', nullable: true },
    startDate:         { type: 'STRING', nullable: true },
    endDate:           { type: 'STRING', nullable: true },
    annualValue:       { type: 'STRING', nullable: true },
    installmentsCount: { type: 'STRING', nullable: true },
    currency:          { type: 'STRING', nullable: true },
    confidence:        { type: 'NUMBER', nullable: true },
  },
} as const;

const FIELDS: (keyof RawExtraction)[] = [
  'contractNumber', 'tenantName', 'tenantNationalId', 'tenantPhone',
  'propertyName', 'unitNumber', 'startDate', 'endDate',
  'annualValue', 'installmentsCount', 'currency',
];

/**
 * يحوّل ردّ النموذج إلى `RawExtraction`. دالة نقية.
 *
 * تُسقِط ما ليس حقلاً معروفاً وتُحوّل الفراغ إلى null، فما يصل إلى طبقة
 * الاستخراج شكلٌ واحد مضمون. ترجع null إن لم يكن الردّ JSON صالحاً.
 */
export function parseScanJson(text: string): RawExtraction | null {
  const t = text.trim();
  if (!t) return null;

  // النموذج قد يُحيط الـ JSON بسياج ```json رغم responseMimeType
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(t);
  const body = (fenced ? fenced[1] : t).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const src = parsed as Record<string, unknown>;
  const out: RawExtraction = {};

  for (const f of FIELDS) {
    const v = src[f];
    if (typeof v === 'string') {
      const s = v.trim();
      (out as Record<string, unknown>)[f] = s.length > 0 ? s : null;
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      (out as Record<string, unknown>)[f] = String(v);
    } else {
      (out as Record<string, unknown>)[f] = null;
    }
  }

  const c = src.confidence;
  out.confidence = typeof c === 'number' && Number.isFinite(c)
    ? Math.min(1, Math.max(0, c))
    : null;

  return out;
}

/** هل القراءة خالية تماماً؟ صورةٌ ليست عقداً تُنتج هذا. */
export function isEmptyExtraction(e: RawExtraction): boolean {
  return FIELDS.every(f => {
    const v = e[f];
    return v == null || (typeof v === 'string' && v.trim().length === 0);
  });
}

/**
 * يقرأ صورة العقد ويُرجع القراءة الخام.
 * لا يرمي استثناءات — كل فشل يرجع برسالة عربية جاهزة للعرض.
 */
export async function scanContractImage(
  imageBase64: string,
  mimeType: string,
): Promise<ScanResult> {
  const approxBytes = Math.floor((imageBase64.length * 3) / 4);
  if (approxBytes > MAX_SCAN_BYTES) {
    return {
      ok: false, code: 'IMAGE_TOO_LARGE',
      message: `حجم الصورة يتجاوز ${Math.round(MAX_SCAN_BYTES / 1048576)} ميجابايت. صوّرها بجودة أقل.`,
    };
  }

  let config;
  try {
    config = await loadAssistantConfig(getActiveOrgId());
  } catch {
    config = null;
  }
  if (!config?.apiKey) {
    return {
      ok: false, code: 'NO_KEY',
      message: 'قراءة العقود تحتاج مفتاح Gemini — نفس مفتاح المساعد. اضبطه ثم أعد المحاولة.',
    };
  }

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SCAN_SYSTEM }] },
    contents: [{
      role: 'user',
      parts: [
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
        { text: 'اقرأ هذا العقد وأعِد الحقول المطلوبة.' },
      ],
    }],
    generationConfig: {
      temperature: 0,               // نسخٌ لا إبداع
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      responseSchema: SCAN_SCHEMA,
    },
  });

  const res = await generateText(config.apiKey, config.model ?? '', body);
  if (!res.ok) {
    if (res.code === 'EMPTY') {
      return {
        ok: false, code: 'EMPTY',
        message: 'لم تُقرأ أي بيانات من الصورة. صوّر العقد كاملاً بإضاءة أفضل، أو أدخله يدوياً.',
      };
    }
    return res;
  }

  const extraction = parseScanJson(res.text);
  if (!extraction) {
    return {
      ok: false, code: 'BAD_JSON',
      message: 'جاء ردّ غير مفهوم من خدمة القراءة. أعد المحاولة أو أدخل العقد يدوياً.',
    };
  }
  if (isEmptyExtraction(extraction)) {
    return {
      ok: false, code: 'NOT_A_CONTRACT',
      message: 'لم يُعرَف في الصورة أي حقل من حقول العقد. تأكّد أنها صورة عقد واضحة.',
    };
  }

  return { ok: true, extraction, usedModel: res.usedModel };
}
