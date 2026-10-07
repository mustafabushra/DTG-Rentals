import { describe, it, expect } from 'vitest';
import { parseScanJson, isEmptyExtraction } from './contractScanClient';

/**
 * ردّ النموذج مصدرٌ غير موثوق: قد يُحيط JSON بسياج، أو يرسل أنواعاً غير
 * متوقَّعة، أو حقولاً لم نسألها. هذه الحدود تمنع ذلك من الوصول إلى طبقة
 * الاستخراج فيُبنى عقدٌ على قراءة معطوبة.
 */
describe('تحليل ردّ القراءة', () => {
  it('يقرأ JSON نظيفاً', () => {
    const e = parseScanJson(JSON.stringify({
      contractNumber: 'CNT-2026-007992',
      tenantName: 'أسامة',
      annualValue: '65,000',
      startDate: '1447/03/01',
      confidence: 0.86,
    }));
    expect(e?.contractNumber).toBe('CNT-2026-007992');
    expect(e?.tenantName).toBe('أسامة');
    expect(e?.annualValue).toBe('65,000');
    expect(e?.startDate).toBe('1447/03/01');
    expect(e?.confidence).toBe(0.86);
  });

  it('يقشّر سياج ```json إن أحاط به النموذج', () => {
    const e = parseScanJson('```json\n{"tenantName":"أحمد"}\n```');
    expect(e?.tenantName).toBe('أحمد');
  });

  it('يُحوّل الرقم إلى نصّ — طبقة الاستخراج تتولّى التطبيع', () => {
    expect(parseScanJson('{"annualValue":65000}')?.annualValue).toBe('65000');
    expect(parseScanJson('{"installmentsCount":4}')?.installmentsCount).toBe('4');
  });

  it('الفراغ والمسافات يصيران null — لا حقل كاذب', () => {
    const e = parseScanJson('{"tenantName":"","unitNumber":"   "}');
    expect(e?.tenantName).toBeNull();
    expect(e?.unitNumber).toBeNull();
  });

  it('الحقول الغائبة تصير null صريحاً فالشكل واحد دائماً', () => {
    const e = parseScanJson('{"tenantName":"أحمد"}');
    expect(e?.contractNumber).toBeNull();
    expect(e?.endDate).toBeNull();
    expect(e?.currency).toBeNull();
  });

  it('يُسقِط ما لم نسأله — لا يمرّ حقل مخترع', () => {
    const e = parseScanJson('{"tenantName":"أحمد","totalDue":"99999","notes":"x"}');
    expect(e).not.toHaveProperty('totalDue');
    expect(e).not.toHaveProperty('notes');
  });

  it('الأنواع الغريبة تُهمَل لا تُمرَّر', () => {
    const e = parseScanJson('{"tenantName":{"a":1},"annualValue":[1,2],"endDate":true}');
    expect(e?.tenantName).toBeNull();
    expect(e?.annualValue).toBeNull();
    expect(e?.endDate).toBeNull();
  });

  it('الثقة تُحصر بين صفر وواحد', () => {
    expect(parseScanJson('{"confidence":5}')?.confidence).toBe(1);
    expect(parseScanJson('{"confidence":-2}')?.confidence).toBe(0);
    expect(parseScanJson('{"confidence":"عالية"}')?.confidence).toBeNull();
    expect(parseScanJson('{"confidence":null}')?.confidence).toBeNull();
  });

  it('يرجع null لردٍّ ليس JSON — فيُعرض خطأ مفهوم لا انهيار', () => {
    expect(parseScanJson('')).toBeNull();
    expect(parseScanJson('عذراً، لا أستطيع قراءة الصورة.')).toBeNull();
    expect(parseScanJson('{ناقص')).toBeNull();
  });

  it('يرجع null لمصفوفة أو قيمة مفردة — المتوقَّع كائن', () => {
    expect(parseScanJson('[{"tenantName":"أحمد"}]')).toBeNull();
    expect(parseScanJson('"نص"')).toBeNull();
    expect(parseScanJson('null')).toBeNull();
  });
});

describe('كشف القراءة الفارغة', () => {
  it('صورة ليست عقداً: كل الحقول null', () => {
    const e = parseScanJson('{"confidence":0}');
    expect(e).not.toBeNull();
    expect(isEmptyExtraction(e!)).toBe(true);
  });

  it('حقل واحد يكفي لعدّها قراءة', () => {
    const e = parseScanJson('{"unitNumber":"101"}');
    expect(isEmptyExtraction(e!)).toBe(false);
  });

  it('الثقة وحدها لا تُعدّ قراءة', () => {
    const e = parseScanJson('{"confidence":0.9}');
    expect(isEmptyExtraction(e!)).toBe(true);
  });
});
