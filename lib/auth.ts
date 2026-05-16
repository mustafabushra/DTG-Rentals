import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseAuth, db } from './firebase';
import { sanitizeEmail, sanitizeText } from '../utils/sanitize';
import { validateEmail, validatePassword } from '../utils/validation';
import {
  checkRateLimit, recordFailure, recordSuccess, formatRetryAfter,
} from '../utils/rateLimiter';

// ─── تسجيل مستخدم جديد ───────────────────────────────────────────────────────
export async function registerUser(name: string, email: string, password: string) {
  const cleanEmail = sanitizeEmail(email);
  const cleanName  = sanitizeText(name);

  const emailCheck = validateEmail(cleanEmail);
  if (!emailCheck.valid) throw new Error(emailCheck.error);

  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) throw new Error(pwCheck.error);

  const limit = checkRateLimit('register', cleanEmail);
  if (!limit.allowed) {
    throw new Error(`تجاوزت الحد المسموح. حاول بعد ${formatRetryAfter(limit.retryAfterMs)}`);
  }

  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Auth not available');
  try {
    const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    await updateProfile(credential.user, { displayName: cleanName });

    await setDoc(doc(db, 'users', credential.user.uid), {
      name:      cleanName,
      email:     cleanEmail,
      role:      'admin',
      orgId:     'main',
      status:    'active',
      createdAt: serverTimestamp(),
    });

    recordSuccess('register', cleanEmail);
    return credential.user;
  } catch (err) {
    recordFailure('register', cleanEmail);
    throw err;
  }
}

// ─── تسجيل الدخول ────────────────────────────────────────────────────────────
export async function loginUser(email: string, password: string) {
  const cleanEmail = sanitizeEmail(email);

  const emailCheck = validateEmail(cleanEmail);
  if (!emailCheck.valid) throw new Error(emailCheck.error);

  if (!password) throw new Error('كلمة المرور مطلوبة');

  const limit = checkRateLimit('login', cleanEmail);
  if (!limit.allowed) {
    throw new Error(`تم تجاوز عدد المحاولات. حاول بعد ${formatRetryAfter(limit.retryAfterMs)}`);
  }

  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Auth not available');
  try {
    const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    recordSuccess('login', cleanEmail);
    return credential.user;
  } catch (err) {
    recordFailure('login', cleanEmail);
    throw err;
  }
}

// ─── تسجيل الخروج ────────────────────────────────────────────────────────────
export async function logoutUser() {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
}

// ─── جلب بيانات المستخدم ─────────────────────────────────────────────────────
export async function getUserProfile(uid: string) {
  if (!uid || typeof uid !== 'string') return null;
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

// ─── إعادة تعيين كلمة المرور ─────────────────────────────────────────────────
export async function resetPassword(email: string) {
  const cleanEmail = sanitizeEmail(email);

  const emailCheck = validateEmail(cleanEmail);
  if (!emailCheck.valid) throw new Error(emailCheck.error);

  const limit = checkRateLimit('passwordReset', cleanEmail);
  if (!limit.allowed) {
    throw new Error(`حاول بعد ${formatRetryAfter(limit.retryAfterMs)}`);
  }

  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Auth not available');
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
    recordSuccess('passwordReset', cleanEmail);
  } catch (err) {
    recordFailure('passwordReset', cleanEmail);
    throw err;
  }
}

// ─── تغيير كلمة المرور ───────────────────────────────────────────────────────
export async function changePassword(currentPassword: string, newPassword: string) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Auth not available');
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('no-user');

  if (!currentPassword) throw new Error('كلمة المرور الحالية مطلوبة');

  const pwCheck = validatePassword(newPassword);
  if (!pwCheck.valid) throw new Error(pwCheck.error);

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

// ─── تحديث بيانات المستخدم ───────────────────────────────────────────────────
export async function updateUserProfile(uid: string, data: {
  name?: string;
  phone?: string;
  role?: string;
  theme?: string;
  notificationPrefs?: Record<string, boolean>;
}) {
  if (!uid || typeof uid !== 'string') throw new Error('invalid-uid');

  const clean: typeof data = {};
  if (data.name  !== undefined) clean.name  = sanitizeText(data.name);
  if (data.phone !== undefined) clean.phone = sanitizeText(data.phone);
  if (data.role  !== undefined) clean.role  = sanitizeText(data.role);
  if (data.theme !== undefined) clean.theme = data.theme;
  if (data.notificationPrefs !== undefined) clean.notificationPrefs = data.notificationPrefs;

  const auth = getFirebaseAuth();
  const user = auth?.currentUser ?? null;
  if (user && clean.name) await updateProfile(user, { displayName: clean.name });

  const { setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'users', uid), { ...clean, updatedAt: new Date() }, { merge: true });
}

// ─── مراقبة حالة الدخول ──────────────────────────────────────────────────────
export function onAuthChange(callback: (user: User | null) => void) {
  const auth = getFirebaseAuth();
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
}
