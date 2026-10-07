import { describe, it, expect } from 'vitest';
import {
  pickProvider, buildVisionRequest, readVisionText, describeUpstreamError, DEFAULT_MODELS,
} from './vision';

const image = { data: 'BASE64DATA', mimeType: 'image/jpeg' };
const args = { apiKey: 'KEY', systemPrompt: 'SYS', userPrompt: 'USER', image };

describe('اختيار المزوّد', () => {
  it('المجاني أولاً بلا إعداد صريح', () => {
    expect(pickProvider({ hasGemini: true, hasAnthropic: true })).toBe('gemini');
  });
  it('يحترم الإعداد الصريح', () => {
    expect(pickProvider({ configured: 'anthropic', hasGemini: true, hasAnthropic: true })).toBe('anthropic');
  });
  it('يتجاهل إعداداً لا مفتاح له بدل أن يفشل', () => {
    expect(pickProvider({ configured: 'anthropic', hasGemini: true, hasAnthropic: false })).toBe('gemini');
  });
  it('يستعمل المتوفّر وحده', () => {
    expect(pickProvider({ hasGemini: false, hasAnthropic: true })).toBe('anthropic');
  });
  it('بلا أي مفتاح يرجع null — لا تخمين', () => {
    expect(pickProvider({ hasGemini: false, hasAnthropic: false })).toBeNull();
  });
  it('لا يتأثر بحالة الأحرف أو المسافات', () => {
    expect(pickProvider({ configured: ' Anthropic ', hasGemini: true, hasAnthropic: true })).toBe('anthropic');
  });
});

describe('بناء طلب Gemini', () => {
  const req = buildVisionRequest('gemini', args);

  it('المفتاح في ترويسة لا في المسار — فلا يظهر في سجلات الوسطاء', () => {
    expect(req.headers['x-goog-api-key']).toBe('KEY');
    expect(req.url).not.toContain('KEY');
  });
  it('يستخدم النموذج الافتراضي ويقبل تجاوزه', () => {
    expect(req.url).toContain(DEFAULT_MODELS.gemini);
    expect(buildVisionRequest('gemini', { ...args, model: 'gemini-x' }).url).toContain('gemini-x');
  });
  it('الصورة والنصّ في الأجزاء، والتوجيه في systemInstruction', () => {
    const body = JSON.parse(req.body);
    expect(body.contents[0].parts[0].inline_data).toEqual({ mime_type: 'image/jpeg', data: 'BASE64DATA' });
    expect(body.contents[0].parts[1].text).toBe('USER');
    expect(body.systemInstruction.parts[0].text).toBe('SYS');
  });
  it('حرارة صفر وJSON مطلوب — القراءة نقل لا إبداع', () => {
    const body = JSON.parse(req.body);
    expect(body.generationConfig.temperature).toBe(0);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });
});

describe('بناء طلب Anthropic', () => {
  const req = buildVisionRequest('anthropic', args);

  it('المفتاح والإصدار في الترويسات', () => {
    expect(req.headers['x-api-key']).toBe('KEY');
    expect(req.headers['anthropic-version']).toBeTruthy();
  });
  it('الصورة base64 والتوجيه في system', () => {
    const body = JSON.parse(req.body);
    expect(body.messages[0].content[0].source).toEqual({
      type: 'base64', media_type: 'image/jpeg', data: 'BASE64DATA',
    });
    expect(body.system).toBe('SYS');
    expect(body.temperature).toBe(0);
  });
});

describe('قراءة جواب المزوّد', () => {
  it('Gemini: يجمع أجزاء النصّ', () => {
    const payload = { candidates: [{ content: { parts: [{ text: '{"a":' }, { text: '1}' }] } }] };
    expect(readVisionText('gemini', payload)).toBe('{"a":\n1}');
  });
  it('Anthropic: يجمع كتل النصّ ويُسقط غيرها', () => {
    const payload = { content: [{ type: 'text', text: 'A' }, { type: 'thinking', text: 'X' }, { type: 'text', text: 'B' }] };
    expect(readVisionText('anthropic', payload)).toBe('A\nB');
  });
  it('شكل غير متوقَّع يرجع فراغاً — يُعامَل كقراءة غير مفهومة لا كعطل', () => {
    for (const bad of [null, undefined, 'نص', {}, { candidates: [] }, { content: 'x' }]) {
      expect(readVisionText('gemini', bad)).toBe('');
      expect(readVisionText('anthropic', bad)).toBe('');
    }
  });
  it('حجب الأمان في Gemini (بلا أجزاء) يرجع فراغاً', () => {
    expect(readVisionText('gemini', { candidates: [{ finishReason: 'SAFETY' }] })).toBe('');
  });
});

describe('وصف أخطاء المزوّد', () => {
  it('429 قابل للإعادة ويذكر الحدّ المجاني', () => {
    const d = describeUpstreamError(429);
    expect(d.retryable).toBe(true);
    expect(d.message).toContain('المجاني');
  });
  it('مفتاح غير صالح ليس قابلاً للإعادة ويوجّه للإعداد', () => {
    for (const s of [401, 403]) {
      const d = describeUpstreamError(s);
      expect(d.retryable).toBe(false);
      expect(d.message).toContain('مفتاح');
    }
  });
  it('أعطال الخادم قابلة للإعادة', () => {
    expect(describeUpstreamError(503).retryable).toBe(true);
  });
  it('غير ذلك: رسالة عامة بخيار الإدخال اليدوي', () => {
    expect(describeUpstreamError(400).message).toContain('يدوياً');
  });
});
