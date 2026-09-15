import { describe, it, expect } from 'vitest';
import { derivePreview, canWriteDuringPreview } from './ownerPreview';

const base = {
  isAdmin: true, previewOwnerId: null as string | null,
  isOwnerRole: false, ownerDataIsolation: true, currentUserOwnerId: null as string | null,
};

describe('من يملك المعاينة', () => {
  it('المدير يعاين', () => {
    expect(derivePreview({ ...base, previewOwnerId: 'own1' }).previewing).toBe(true);
  });

  it('غير المدير لا يعاين ولو ضُبط المعرّف', () => {
    const r = derivePreview({ ...base, isAdmin: false, previewOwnerId: 'own1' });
    expect(r.previewing).toBe(false);
    expect(r.effectiveOwnerId).toBeNull();          // لا تسرّب هوية
  });
});

describe('الفلترة أثناء المعاينة', () => {
  it('تنطبق دائماً — وهذا غرضها', () => {
    const r = derivePreview({ ...base, previewOwnerId: 'own1' });
    expect(r.applyOwnerFilter).toBe(true);
    expect(r.effectiveOwnerId).toBe('own1');
  });

  it('تنطبق حتى لو كان عزل بيانات المالك معطّلاً في الإعدادات', () => {
    // الإعداد يحكم عزل المالك المسجَّل دخوله، لا معاينة المدير الاختيارية
    const r = derivePreview({ ...base, previewOwnerId: 'own1', ownerDataIsolation: false });
    expect(r.applyOwnerFilter).toBe(true);
  });

  it('بلا معاينة: المدير يرى كل شيء', () => {
    expect(derivePreview(base).applyOwnerFilter).toBe(false);
  });

  it('المالك المسجَّل دخوله يبقى معزولاً كما كان', () => {
    const r = derivePreview({ ...base, isAdmin: false, isOwnerRole: true, currentUserOwnerId: 'own9' });
    expect(r.applyOwnerFilter).toBe(true);
    expect(r.effectiveOwnerId).toBe('own9');
  });

  it('المعاينة تتجاوز هوية المستخدم نفسه في العرض', () => {
    const r = derivePreview({ ...base, previewOwnerId: 'own1', currentUserOwnerId: 'own9' });
    expect(r.effectiveOwnerId).toBe('own1');
  });
});

describe('المعاينة قراءة فقط', () => {
  it('تُلغي الكتابة والحذف مهما كانت الصلاحية', () => {
    expect(canWriteDuringPreview(true, true)).toBe(false);
  });
  it('خارج المعاينة الصلاحية الأصلية كما هي', () => {
    expect(canWriteDuringPreview(false, true)).toBe(true);
    expect(canWriteDuringPreview(false, false)).toBe(false);
  });
  it('الخروج من المعاينة يعيد الكتابة', () => {
    const seq = [true, true, false].map(p => canWriteDuringPreview(p, true));
    expect(seq).toEqual([false, false, true]);
  });
});
