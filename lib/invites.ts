import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  deleteUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseAuth, getSecondary } from './firebase';

// أبجدية بلا أحرف ملتبسة (0/O/1/I/L) لتسهيل النطق والكتابة
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const OWNER_ROLES = ['owner', 'مالك'];

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
 * استبدال كود دعوة — client-side بالكامل (يعمل على خطة Spark المجانية، بلا Cloud Functions).
 *
 * الأمان: ينشئ المستخدم حسابه ومستنده، لكن قواعد Firestore (inviteMatches) تتحقق أن
 * orgId/role/ownerId التي يدّعيها تساوي تماماً ما حدّده المدير في دعوة pending — فلا
 * يقدر ينتحل مؤسسة أو يصعّد دوره. الكود هو "السر" الذي يصرّح بالانضمام.
 *
 * يُنفَّذ عبر تطبيق Firebase ثانوي حتى تكتمل كتابة البروفايل قبل تسجيل الدخول في
 * التطبيق الأساسي — وإلا سبق onAuthChange كتابةَ المستند فحمّل بروفايلاً فارغاً.
 */
export async function redeemInviteCode(code: string, email: string, password: string): Promise<void> {
  const norm      = normalizeInviteCode(code);
  const cleanEmail = email.trim().toLowerCase();
  if (!norm) throw new Error('كود الدعوة مطلوب');

  const primaryAuth = getFirebaseAuth();
  const secondary   = getSecondary();
  if (!primaryAuth || !secondary) throw new Error('Auth not available');

  // 1) إنشاء حساب المصادقة عبر التطبيق الثانوي (لا يلمس جلسة التطبيق الأساسي)
  let newUid: string;
  try {
    const cred = await createUserWithEmailAndPassword(secondary.auth, cleanEmail, password);
    newUid = cred.user.uid;
  } catch (e: any) {
    if (e?.code === 'auth/email-already-in-use') throw new Error('هذا البريد مسجّل مسبقاً — استخدم تسجيل الدخول');
    if (e?.code === 'auth/weak-password')        throw new Error('كلمة المرور ضعيفة (6 أحرف على الأقل)');
    if (e?.code === 'auth/invalid-email')        throw new Error('بريد إلكتروني غير صحيح');
    throw e;
  }

  try {
    // 2) قراءة الدعوة بالكود (مصادقًا كالمستخدم الجديد عبر firestore الثانوي)
    const snap = await getDoc(doc(secondary.db, 'inviteCodes', norm));
    if (!snap.exists()) throw new Error('الكود غير صحيح');
    const invite = snap.data() as any;
    if (invite.status !== 'pending') throw new Error('الكود استُخدم مسبقاً');
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
      throw new Error('انتهت صلاحية الكود — اطلب كوداً جديداً من المدير');
    }
    if (OWNER_ROLES.includes(invite.role) && !invite.ownerId) {
      throw new Error('الدعوة غير مكتملة (مالك بلا ربط) — راجع المدير');
    }

    const orgId   = invite.orgId as string;
    const ownerId = invite.ownerId as string | undefined;
    const name    = (invite.name as string) ?? 'مستخدم';

    // 3) مستند المستخدم (تتحقق القواعد أنه يطابق الدعوة)
    await setDoc(doc(secondary.db, 'users', newUid), {
      name, email: cleanEmail, role: invite.role, orgId,
      ...(ownerId ? { ownerId } : {}),
      status: 'active', inviteCode: norm, createdAt: serverTimestamp(),
    });

    // 4) سجل المستخدم في قائمة المدير
    await setDoc(doc(secondary.db, 'orgs', orgId, 'managedUsers', newUid), {
      name, email: cleanEmail, role: invite.role,
      ...(ownerId ? { ownerId } : {}),
      status: 'active', createdAt: serverTimestamp(),
    });

    // 5) استهلاك الكود (pending → used)
    await updateDoc(doc(secondary.db, 'inviteCodes', norm), {
      status: 'used', usedBy: newUid, usedAt: serverTimestamp(),
    });
  } catch (e) {
    // فشل بعد إنشاء الحساب → احذف الحساب اليتيم حتى تكون إعادة المحاولة نظيفة
    try { if (secondary.auth.currentUser) await deleteUser(secondary.auth.currentUser); } catch { /* تجاهل */ }
    throw e;
  } finally {
    try { await signOut(secondary.auth); } catch { /* تجاهل */ }
  }

  // 6) تسجيل الدخول في التطبيق الأساسي — البروفايل جاهز الآن، فيُحمّل صحيحاً ويوجّه onAuthChange
  await signInWithEmailAndPassword(primaryAuth, cleanEmail, password);
}
