import { describe, it, expect } from 'vitest';
import { shouldEnterApp, signedOutRedirect, AUTH_SCREENS } from './authRouting';

describe('قرار الدخول بعد المصادقة', () => {
  it('مسجَّل دخول وما زال على شاشة عامة ⇒ ينتقل', () => {
    for (const screen of AUTH_SCREENS) expect(shouldEnterApp(true, screen)).toBe(true);
  });

  it('لا ينتقل من داخل التطبيق — يمنع إعادة تركيب الجذر', () => {
    for (const inside of ['/', '/payments', '/collections', '/renewals', '/contract/c1']) {
      expect(shouldEnterApp(true, inside)).toBe(false);
    }
  });

  it('غير مسجَّل أو حالة لم تُحسم ⇒ لا ينتقل', () => {
    expect(shouldEnterApp(false, '/login')).toBe(false);
    expect(shouldEnterApp(null,  '/login')).toBe(false);
  });

  /** جوهر البق: المسار يصل متأخراً عن حالة المصادقة. */
  it('انحدار: استقرار المسار بعد المصادقة يُعيد التقييم وينتقل', () => {
    const seq: Array<[boolean | null, string]> = [[null, '/'], [true, '/'], [true, '/login']];
    const decisions = seq.map(([s, p]) => shouldEnterApp(s, p));
    expect(decisions).toEqual([false, false, true]);
  });

  it('انحدار: الترتيب المعاكس (المصادقة بعد المسار) ينتقل أيضاً', () => {
    const seq: Array<[boolean | null, string]> = [[null, '/login'], [false, '/login'], [true, '/login']];
    expect(seq.map(([s, p]) => shouldEnterApp(s, p))).toEqual([false, false, true]);
  });

  it('خروج ثم دخول في نفس الجلسة ينتقل من جديد', () => {
    expect(shouldEnterApp(true, '/login')).toBe(true);
    expect(shouldEnterApp(false, '/login')).toBe(false);
    expect(shouldEnterApp(true, '/login')).toBe(true);
  });
});

describe('إعادة التوجيه عند غياب الجلسة', () => {
  it('الشاشات العامة تبقى كما هي', () => {
    for (const p of ['/login', '/about', '/privacy-policy', '/terms-of-service', '/contact-us', '/register-code']) {
      expect(signedOutRedirect(p)).toBeNull();
    }
  });
  it('الجذر ⇒ صفحة التعريف، وغيره ⇒ الدخول', () => {
    expect(signedOutRedirect('/')).toBe('/about');
    expect(signedOutRedirect('/payments')).toBe('/login');
  });
});
