import { describe, it, expect } from 'vitest';
import { pickModel, describeError, readAnswer } from './assistantClient';

/**
 * هذه الاختبارات تحرس ما يُبقي المساعد حيّاً: Google تُوقف النماذج دورياً
 * (2.0-flash في 1 يونيو 2026، و1.5 قبلها) وترجع 404. فمنطق اختيار البديل
 * هو الفرق بين ميزة تُصلح نفسها وميزة تتعطّل كل بضعة أشهر.
 */
describe('اختيار النموذج يُفضّل الأحدث والمجاني', () => {
  it('يختار أعلى إصدار من عائلة flash', () => {
    expect(pickModel(['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.6-flash']))
      .toBe('gemini-3.8-flash');
  });

  it('يُفضّل flash على pro — حصّته المجانية أسخى', () => {
    expect(pickModel(['gemini-3.8-pro', 'gemini-3.8-flash'])).toBe('gemini-3.8-flash');
  });

  it('يُفضّل الكامل على lite عند تساوي الإصدار', () => {
    expect(pickModel(['gemini-3.5-flash-lite', 'gemini-3.5-flash'])).toBe('gemini-3.5-flash');
  });

  it('لكن إصداراً أحدث يسبق كونه كاملاً', () => {
    expect(pickModel(['gemini-3.5-flash', 'gemini-3.8-flash-lite'])).toBe('gemini-3.8-flash-lite');
  });

  it('يتجنّب preview — تطلب فاتورة مفعَّلة غالباً', () => {
    expect(pickModel(['gemini-4.1-pro-preview', 'gemini-3.8-flash'])).toBe('gemini-3.8-flash');
  });

  it('يقبل preview إن لم يوجد غيره — جوابٌ أفضل من عطل', () => {
    expect(pickModel(['gemini-4.1-pro-preview'])).toBe('gemini-4.1-pro-preview');
  });

  it('يُقصي ما لا يُجيب نصاً', () => {
    expect(pickModel([
      'gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-embedding-001',
      'gemini-2.5-flash-tts', 'gemini-3.8-flash',
    ])).toBe('gemini-3.8-flash');
  });

  it('يُفضّل الاسم المتجدّد على نسخة مثبَّتة بتاريخ', () => {
    expect(pickModel(['gemini-3.8-flash-001', 'gemini-3.8-flash'])).toBe('gemini-3.8-flash');
  });

  it('يتجاهل البادئة models/ كما ترجعها واجهة السرد', () => {
    expect(pickModel(['models/gemini-3.8-flash'])).toBe('gemini-3.8-flash');
  });

  it('يرجع null بلا مرشَّح صالح — فلا يُختلق اسم', () => {
    expect(pickModel([])).toBeNull();
    expect(pickModel(['gemini-embedding-001', 'imagen-4.0'])).toBeNull();
    expect(pickModel(['text-bison-001'])).toBeNull();
  });
});

describe('رسائل الأخطاء تُسمّي السبب', () => {
  it('404 يُفسَّر بإيقاف النموذج لا بخطأ غامض', () => {
    const msg = describeError(404);
    expect(msg).toContain('النموذج');
    expect(msg).not.toContain('أعد المحاولة.');
  });

  it('الحصّة والمفتاح والتعطّل لكلٍّ سببه', () => {
    expect(describeError(429)).toContain('الحصّة');
    expect(describeError(403)).toContain('مفتاح المساعد');
    expect(describeError(503)).toContain('متعطّلة');
  });
});

describe('قراءة الجواب لا تنكسر بشكل غير متوقَّع', () => {
  it('تجمع الأجزاء', () => {
    expect(readAnswer({ candidates: [{ content: { parts: [{ text: 'أ' }, { text: 'ب' }] } }] }))
      .toBe('أب');
  });

  it('ترجع نصاً فارغاً لا تَرمي', () => {
    expect(readAnswer(null)).toBe('');
    expect(readAnswer({})).toBe('');
    expect(readAnswer({ candidates: [] })).toBe('');
    expect(readAnswer({ candidates: [{ content: {} }] })).toBe('');
  });
});
