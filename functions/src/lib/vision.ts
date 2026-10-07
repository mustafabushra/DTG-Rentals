/**
 * طبقة المزوّد البصري — قابلة للتبديل بين خدمة مجانية ومدفوعة.
 *
 * السبب: تكلفة الميزة شيئان منفصلان — استضافة المفتاح، والنموذج الذي يقرأ.
 * الاستضافة على Cloud Functions ضمن الطبقة المجانية، والنموذج يمكن أن يكون
 * Gemini (طبقة مجانية) أو Anthropic (مدفوع بدقة أعلى). فالاختيار إعداد لا
 * إعادة كتابة، ويمكن تغييره بمتغيّر واحد.
 *
 * بناء الطلب وتحليل الجواب نقيّان ومختبَران؛ الشبكة وحدها غير مختبَرة.
 */

export type VisionProvider = 'gemini' | 'anthropic';

export interface VisionImage {
  data: string;      // base64 بلا بادئة data:
  mimeType: string;
}

export interface VisionRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** أسماء النماذج الافتراضية — تُجاوَز بمتغيّر بيئة لأن الأسماء تتغيّر مع الإصدارات. */
export const DEFAULT_MODELS: Record<VisionProvider, string> = {
  gemini:    'gemini-2.0-flash',
  anthropic: 'claude-sonnet-5',
};

/** يختار المزوّد من الإعداد، أو من المفتاح المتوفّر فعلاً. */
export function pickProvider(opts: {
  configured?: string | null;
  hasGemini: boolean;
  hasAnthropic: boolean;
}): VisionProvider | null {
  const c = (opts.configured ?? '').trim().toLowerCase();
  if (c === 'gemini'    && opts.hasGemini)    return 'gemini';
  if (c === 'anthropic' && opts.hasAnthropic) return 'anthropic';
  // بلا إعداد صريح: المجاني أولاً
  if (opts.hasGemini)    return 'gemini';
  if (opts.hasAnthropic) return 'anthropic';
  return null;
}

/** يبني طلب القراءة بصيغة المزوّد المختار. */
export function buildVisionRequest(
  provider: VisionProvider,
  args: { apiKey: string; model?: string; systemPrompt: string; userPrompt: string; image: VisionImage },
): VisionRequest {
  const model = args.model?.trim() || DEFAULT_MODELS[provider];

  if (provider === 'gemini') {
    return {
      // المفتاح في ترويسة لا في المسار، فلا يظهر في سجلات الوسطاء
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': args.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: args.systemPrompt }] },
        contents: [{
          role: 'user',
          parts: [
            { inline_data: { mime_type: args.image.mimeType, data: args.image.data } },
            { text: args.userPrompt },
          ],
        }],
        generationConfig: {
          temperature: 0,              // القراءة نقل لا إبداع
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    };
  }

  return {
    url: 'https://api.anthropic.com/v1/messages',
    headers: {
      'content-type': 'application/json',
      'x-api-key': args.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 0,
      system: args.systemPrompt,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: args.image.mimeType, data: args.image.data } },
          { type: 'text', text: args.userPrompt },
        ],
      }],
    }),
  };
}

/**
 * يستخرج النصّ من جواب المزوّد.
 * يرجع '' إن كان الشكل غير متوقَّع — فيُعامَل كقراءة غير مفهومة لا كعطل.
 */
export function readVisionText(provider: VisionProvider, payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';

  if (provider === 'gemini') {
    const parts = (payload as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    }).candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map(p => (typeof p?.text === 'string' ? p.text : '')).join('\n').trim();
  }

  const blocks = (payload as { content?: { type?: string; text?: string }[] }).content;
  if (!Array.isArray(blocks)) return '';
  return blocks
    .filter(b => b?.type === 'text')
    .map(b => (typeof b.text === 'string' ? b.text : ''))
    .join('\n')
    .trim();
}

/** رسالة عربية مناسبة لحالة HTTP من المزوّد. */
export function describeUpstreamError(status: number): { retryable: boolean; message: string } {
  if (status === 429) {
    return {
      retryable: true,
      message: 'خدمة القراءة مزدحمة أو تجاوزت حدّها المجاني اليوم. أعد المحاولة لاحقاً أو أدخل البيانات يدوياً.',
    };
  }
  if (status === 401 || status === 403) {
    return {
      retryable: false,
      message: 'مفتاح خدمة القراءة غير صالح. راجع إعداد السرّ في المشروع.',
    };
  }
  if (status >= 500) {
    return { retryable: true, message: 'خدمة القراءة متعطّلة حالياً. أعد المحاولة بعد قليل.' };
  }
  return {
    retryable: false,
    message: 'تعذّرت قراءة الصورة. أعد المحاولة أو أدخل البيانات يدوياً.',
  };
}
