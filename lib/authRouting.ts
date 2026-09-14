/**
 * قرار التوجيه بعد المصادقة — منطق نقي مستخرج من app/_layout.tsx ليكون مختبَراً.
 *
 * البق الذي يعالجه: كان الانتقال بعد تسجيل الدخول لقطة واحدة داخل مشترك
 * onAuthStateChanged تقارن المسار بقائمة ثابتة. لو وقعت تلك اللحظة والمسار لم
 * يستقر بعد، يُقرَّر "لا تنقّل" ولا يُعاد النظر أبداً — فيبقى المستخدم على شاشة
 * الدخول حتى يحدّث الصفحة يدوياً. القرار الآن يُعاد تقييمه كلما تغيّر أيّ طرف.
 */

/** الشاشات العامة التي يجب مغادرتها فور نجاح تسجيل الدخول. */
export const AUTH_SCREENS = ['/login', '/register-code', '/about'];

/** الشاشات التي يجوز البقاء فيها بلا تسجيل دخول. */
export const PUBLIC_ROUTES = [
  '/login', '/register-code', '/about',
  '/privacy-policy', '/terms-of-service', '/contact-us',
];

/**
 * هل ننتقل إلى داخل التطبيق الآن؟
 * `signedIn === null` تعني أن حالة المصادقة لم تُحسم بعد.
 * لا ينطلق إلا من الشاشات العامة، فلا يُعاد تركيب الجذر عندما يكون المستخدم
 * داخل التطبيق أصلاً (المسار '/').
 */
export function shouldEnterApp(signedIn: boolean | null, pathname: string): boolean {
  if (signedIn !== true) return false;
  return AUTH_SCREENS.includes(pathname);
}

/** وجهة إعادة التوجيه عند عدم وجود جلسة، أو null إن كانت الشاشة عامة. */
export function signedOutRedirect(pathname: string): string | null {
  if (PUBLIC_ROUTES.includes(pathname)) return null;
  return pathname === '/' ? '/about' : '/login';
}
