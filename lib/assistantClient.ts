/**
 * عميل المساعد — ينادي Gemini من المتصفح مباشرة.
 *
 * **أين يسكن المفتاح ولماذا:** لا خادم في المشروع (Spark بلا Cloud Functions)،
 * فالنداء من المتصفح هو السبيل الوحيد. ولأن `EXPO_PUBLIC_*` تُحزَم في ملف
 * JavaScript يُخدَم علناً على dtg-rentals.web.app — أي أن **أي زائر مجهول**
 * يقرؤها — فالمفتاح لا يوضع هناك.
 *
 * بدلاً من ذلك يسكن مستنداً في Firestore تحرسه قاعدة تقصر قراءته على المدير.
 * فلا يصل إلا إلى متصفّح مديرٍ مسجَّل دخوله في مؤسستك.
 *
 * **الخطر المتبقي (صريح):** المفتاح يصل إلى متصفّح المدير، فمن يملك وصولاً
 * لجهازه أو حساب مدير يستطيع استخراجه. استخدم مفتاحاً من حساب منفصل بلا
 * فاتورة — فأقصى الضرر استهلاك حصّة مجانية لا مال.
 */
import { getOne } from './firestoreService';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.0-flash';

/** إعداد المساعد كما يُقرأ من Firestore. */
export interface AssistantConfig {
  apiKey?: string;
  model?:  string;
  enabled?: boolean;
}

export type AskResult =
  | { ok: true; answer: string }
  | { ok: false; code: string; message: string };

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

/** يقرأ الإعداد من settings/assistant. يرجع null إن لم يُضبط أو مُنع. */
export async function loadAssistantConfig(orgId: string): Promise<AssistantConfig | null> {
  try {
    const doc = await getOne(orgId, 'settings', 'assistant');
    if (!doc) return null;
    const cfg = doc as AssistantConfig;
    if (cfg.enabled === false) return null;
    return typeof cfg.apiKey === 'string' && cfg.apiKey.trim().length > 0 ? cfg : null;
  } catch {
    // قاعدة تمنع القراءة (مستخدم ليس مديراً) ⇒ الميزة غير متاحة له، لا خطأ
    return null;
  }
}

/** يستخرج نصّ الجواب من بنية Gemini. يرجع '' إن كان الشكل غير متوقَّع. */
export function readAnswer(payload: unknown): string {
  const parts = (payload as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  })?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map(p => (typeof p?.text === 'string' ? p.text : '')).join('').trim();
}

/** رسالة عربية لحالة HTTP من المزوّد. */
export function describeError(status: number): string {
  if (status === 429) {
    return 'تجاوزت الحصّة المجانية لهذه الساعة أو اليوم. أعد المحاولة لاحقاً.';
  }
  if (status === 400) {
    return 'رُفض الطلب. قد يكون اسم النموذج في الإعدادات غير صحيح.';
  }
  if (status === 401 || status === 403) {
    return 'مفتاح المساعد غير صالح أو غير مصرَّح. راجعه في إعدادات النظام.';
  }
  if (status >= 500) return 'خدمة المساعد متعطّلة حالياً. أعد المحاولة بعد قليل.';
  return 'تعذّر الحصول على جواب. أعد المحاولة.';
}

/**
 * يسأل المساعد. `context` هو معرفة التطبيق، و`history` الأدوار السابقة.
 * لا يرمي استثناءات — كل فشل يرجع برسالة عربية جاهزة للعرض.
 */
export async function askAssistant(args: {
  config: AssistantConfig;
  system: string;
  context: string;
  question: string;
  history?: ChatTurn[];
}): Promise<AskResult> {
  const key = args.config.apiKey?.trim();
  if (!key) {
    return { ok: false, code: 'NO_KEY', message: 'لم يُضبط مفتاح المساعد.' };
  }
  const model = args.config.model?.trim() || DEFAULT_MODEL;

  // السياق يُرسَل كأول دور لا داخل التوجيه: يُبقي التوجيه ثابتاً ويسمح بالمحادثة
  const contents = [
    { role: 'user',  parts: [{ text: `بيانات التطبيق الحالية:\n\n${args.context}` }] },
    { role: 'model', parts: [{ text: 'تلقّيت البيانات. اسأل.' }] },
    ...(args.history ?? []).map(t => ({ role: t.role, parts: [{ text: t.text }] })),
    { role: 'user',  parts: [{ text: args.question }] },
  ];

  try {
    const res = await fetch(`${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: args.system }] },
        contents,
        generationConfig: { temperature: 0.2, maxOutputTokens: 1536 },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[assistant] upstream', res.status, detail.slice(0, 300));
      return { ok: false, code: `HTTP_${res.status}`, message: describeError(res.status) };
    }

    const answer = readAnswer(await res.json().catch(() => null));
    if (!answer) {
      return {
        ok: false, code: 'EMPTY',
        message: 'لم يُرجع المساعد جواباً. أعد صياغة السؤال.',
      };
    }
    return { ok: true, answer };
  } catch {
    return {
      ok: false, code: 'NETWORK',
      message: 'تعذّر الوصول إلى خدمة المساعد. تحقّق من الإنترنت.',
    };
  }
}
