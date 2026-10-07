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
// الجيل الحالي من flash وقت الكتابة. أسماء النماذج تتعفّن — Google أوقفت
// 2.0-flash في 1 يونيو 2026 و1.5 قبلها — فهذا مبدأ لا عقد: عند 404 يُكتشف
// بديل متاح من المفتاح نفسه (انظر askAssistant)، فلا يتعطّل المساعد بالتعفّن.
const DEFAULT_MODEL = 'gemini-3.8-flash';

// نماذج لا تُجيب نصاً فلا تصلح للمساعد
const NOT_TEXT = /image|imagen|tts|audio|embedding|aqa|live/;

/** إعداد المساعد كما يُقرأ من Firestore. */
export interface AssistantConfig {
  apiKey?: string;
  model?:  string;
  enabled?: boolean;
}

export type AskResult =
  | { ok: true; answer: string; usedModel: string; switchedFrom?: string }
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
  if (status === 404) {
    return 'النموذج المحفوظ غير موجود — غالباً أُوقِف. افتح ضبط المساعد واكتشف النماذج المتاحة.';
  }
  if (status === 401 || status === 403) {
    return 'مفتاح المساعد غير صالح أو غير مصرَّح. راجعه في ضبط المساعد.';
  }
  if (status >= 500) return 'خدمة المساعد متعطّلة حالياً. أعد المحاولة بعد قليل.';
  return 'تعذّر الحصول على جواب. أعد المحاولة.';
}

/**
 * يسرد النماذج التي يصلح معها `generateContent` لهذا المفتاح.
 * يُستخدَم للتشخيص في شاشة الضبط، ولإيجاد بديل تلقائي عند 404.
 */
export async function listModels(
  key: string,
): Promise<{ ok: true; models: string[] } | { ok: false; code: string; message: string }> {
  const k = key.trim();
  if (!k) return { ok: false, code: 'NO_KEY', message: 'لم يُضبط مفتاح المساعد.' };
  try {
    const res = await fetch(`${GEMINI_URL}?pageSize=200`, {
      headers: { 'x-goog-api-key': k },
    });
    if (!res.ok) {
      return { ok: false, code: `HTTP_${res.status}`, message: describeError(res.status) };
    }
    const data = (await res.json().catch(() => null)) as {
      models?: { name?: string; supportedGenerationMethods?: string[] }[];
    } | null;
    const models = (data?.models ?? [])
      .filter(m => Array.isArray(m?.supportedGenerationMethods)
        && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => (m.name ?? '').replace(/^models\//, ''))
      .filter(Boolean);
    return { ok: true, models };
  } catch {
    return {
      ok: false, code: 'NETWORK',
      message: 'تعذّر الوصول إلى خدمة المساعد. تحقّق من الإنترنت.',
    };
  }
}

/**
 * يختار أنسب نموذج من المتاح. الترتيب مقصود: الأحدث أولاً، و`flash` مُفضَّل
 * لأن حصّته المجانية أسخى — وهذا مشروع بلا فاتورة. وتُقصى نماذج الصور والصوت
 * لأنها لا تُجيب نصاً، و`preview` لأنها تطلب فاتورة مفعَّلة غالباً.
 */
export function pickModel(ids: string[]): string | null {
  let best: string | null = null;
  let bestScore = -Infinity;

  for (const raw of ids) {
    const id = raw.replace(/^models\//, '');
    if (NOT_TEXT.test(id)) continue;
    const v = /gemini-(\d+(?:\.\d+)?)/.exec(id);
    if (!v) continue;

    let score = parseFloat(v[1]) * 100;
    if (/flash/.test(id))         score += 50;
    if (/lite/.test(id))          score -= 10;
    if (/preview|-exp\b|-exp-/.test(id)) score -= 300;
    if (/-\d{3,}$/.test(id))      score -= 5;  // نسخة مثبَّتة بتاريخ: تُهجَر أسرع

    if (score > bestScore) { bestScore = score; best = id; }
  }
  return best;
}

type CallOutcome =
  | { ok: true; answer: string }
  | { ok: false; status: number }
  | { ok: false; empty: true };

async function callModel(model: string, key: string, body: string): Promise<CallOutcome> {
  const res = await fetch(`${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[assistant] upstream', model, res.status, detail.slice(0, 300));
    return { ok: false, status: res.status };
  }

  const answer = readAnswer(await res.json().catch(() => null));
  return answer ? { ok: true, answer } : { ok: false, empty: true };
}

export type GenResult =
  | { ok: true; text: string; usedModel: string; switchedFrom?: string }
  | { ok: false; code: string; message: string };

/**
 * ينادي Gemini بجسم جاهز، ويُرجع النصّ الخام.
 *
 * عند 404 (النموذج أُوقِف — Google تُنهي النماذج دورياً) يكتشف بديلاً متاحاً
 * بالمفتاح نفسه ويعيد المحاولة مرة واحدة. هذا ما يُبقي الميزات حيّة بلا
 * تعديل كود كلما تغيّر كتالوج النماذج.
 *
 * لا يرمي استثناءات — كل فشل يرجع برسالة عربية جاهزة للعرض.
 */
export async function generateText(
  key: string,
  wantedModel: string,
  body: string,
): Promise<GenResult> {
  const k = key.trim();
  if (!k) return { ok: false, code: 'NO_KEY', message: 'لم يُضبط مفتاح المساعد.' };
  const wanted = wantedModel.trim() || DEFAULT_MODEL;

  const empty = {
    ok: false as const, code: 'EMPTY',
    message: 'لم يُرجع النموذج نصاً. أعد المحاولة.',
  };

  try {
    const first = await callModel(wanted, k, body);
    if (first.ok) return { ok: true, text: first.answer, usedModel: wanted };
    if ('empty' in first) return empty;
    if (first.status !== 404) {
      return { ok: false, code: `HTTP_${first.status}`, message: describeError(first.status) };
    }

    const listed = await listModels(k);
    if (!listed.ok) return { ok: false, code: 'HTTP_404', message: describeError(404) };

    const alt = pickModel(listed.models);
    if (!alt || alt === wanted) {
      return {
        ok: false, code: 'NO_MODEL',
        message: 'لا يوجد نموذج متاح لهذا المفتاح. تحقّق من تفعيل Gemini API للمفتاح.',
      };
    }

    const second = await callModel(alt, k, body);
    if (second.ok) {
      return { ok: true, text: second.answer, usedModel: alt, switchedFrom: wanted };
    }
    if ('empty' in second) return empty;
    return { ok: false, code: `HTTP_${second.status}`, message: describeError(second.status) };
  } catch {
    return {
      ok: false, code: 'NETWORK',
      message: 'تعذّر الوصول إلى خدمة المساعد. تحقّق من الإنترنت.',
    };
  }
}

/**
 * يسأل المساعد. `context` هو معرفة التطبيق، و`history` الأدوار السابقة.
 * لا يرمي استثناءات — كل فشل يرجع برسالة عربية جاهزة للعرض.
 *
 * عند 404 يُكتشف نموذج بديل ويُخبَر المُنادي به في `switchedFrom`.
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

  // السياق يُرسَل كأول دور لا داخل التوجيه: يُبقي التوجيه ثابتاً ويسمح بالمحادثة
  const contents = [
    { role: 'user',  parts: [{ text: `بيانات التطبيق الحالية:\n\n${args.context}` }] },
    { role: 'model', parts: [{ text: 'تلقّيت البيانات. اسأل.' }] },
    ...(args.history ?? []).map(t => ({ role: t.role, parts: [{ text: t.text }] })),
    { role: 'user',  parts: [{ text: args.question }] },
  ];
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: args.system }] },
    contents,
    generationConfig: { temperature: 0.2, maxOutputTokens: 1536 },
  });

  const res = await generateText(key, args.config.model ?? '', body);
  if (!res.ok) {
    // «لم يُرجع النموذج نصاً» عامّة؛ في المحادثة سببها غالباً صياغة السؤال
    if (res.code === 'EMPTY') {
      return { ok: false, code: 'EMPTY', message: 'لم يُرجع المساعد جواباً. أعد صياغة السؤال.' };
    }
    return res;
  }
  return {
    ok: true, answer: res.text,
    usedModel: res.usedModel,
    ...(res.switchedFrom ? { switchedFrom: res.switchedFrom } : {}),
  };
}
