import { httpsCallable, getFunctions } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';
import app, { getFirebaseAuth } from './firebase';

// منطقة الدوال — يجب أن تطابق REGION في functions/src/index.ts
const FUNCTIONS_REGION = 'us-central1';

// أبجدية بلا أحرف ملتبسة (0/O/1/I/L) لتسهيل النطق والكتابة
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** الشكل القانوني المخزَّن/المستعلَم: 6 أحرف بلا فواصل، حروف كبيرة. */
export function generateInviteCode(): string {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }
  return out;
}

/** عرض الكود بشكل مقروء: ABC-7K9 */
export function formatInviteCode(code: string): string {
  const c = normalizeInviteCode(code);
  return c.length === 6 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
}

/** توحيد مدخلات المستخدم: إزالة كل ما عدا الحروف/الأرقام + حروف كبيرة. */
export function normalizeInviteCode(input: string): string {
  return (input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * استبدال كود دعوة: تستدعي Cloud Function آمنة تُنشئ الحساب وتربطه بالمؤسسة الصحيحة،
 * ثم تسجّل الدخول فوراً عبر الرمز المخصّص الذي تعيده الدالة.
 */
export async function redeemInviteCode(code: string, email: string, password: string): Promise<void> {
  const functions = getFunctions(app, FUNCTIONS_REGION);
  const callable = httpsCallable<
    { code: string; email: string; password: string },
    { token: string }
  >(functions, 'redeemInvite');

  const res   = await callable({
    code:     normalizeInviteCode(code),
    email:    email.trim().toLowerCase(),
    password,
  });
  const token = res.data?.token;
  if (!token) throw new Error('تعذّر إكمال التسجيل');

  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Auth not available');
  await signInWithCustomToken(auth, token);
}
