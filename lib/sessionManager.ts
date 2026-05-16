/**
 * Session manager — handles token refresh, expiry, and biometric re-auth.
 * Firebase Auth auto-refreshes tokens, but we add an application-level
 * idle timeout for security (sensitive financial data).
 */
import { AppState, AppStateStatus, Platform } from 'react-native';
import { auth } from './firebase';
import { secureStorage } from './secureStorage';
import { logger } from './logger';

const IDLE_TIMEOUT_MS = 30 * 60_000; // 30 minutes
const SESSION_KEY     = secureStorage.KEYS.SESSION_UID;

export function initSessionManager(onExpired: () => void) {
  // Each call creates its own isolated state — no module-level globals that bleed across instances
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let active = true;

  function resetIdleTimer() {
    if (!active) return;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!active) return;
      logger.warn('SessionManager', 'Idle timeout — signing out');
      onExpired();
    }, IDLE_TIMEOUT_MS);
  }

  function clearIdleTimer() {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  }

  // Track app foreground/background transitions
  const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (!active) return;
    if (state === 'active') {
      resetIdleTimer();
      // Verify Firebase token is still valid on resume
      auth?.currentUser?.getIdToken(true).catch(() => {
        if (!active) return;
        logger.warn('SessionManager', 'Token refresh failed on resume');
        onExpired();
      });
    } else if (state === 'background' || state === 'inactive') {
      const uid = auth?.currentUser?.uid;
      if (uid) secureStorage.set(SESSION_KEY, uid).catch(() => {});
    }
  });

  resetIdleTimer();

  return () => {
    active = false;
    sub.remove();
    clearIdleTimer();
  };
}

export function touchSession() {
  if (auth?.currentUser) resetIdleTimer();
}

// ── Firebase error code → Arabic message ────────────────────────────────────
export function authErrorMessage(code: string): string {
  const map: Record<string, string> = {
    'auth/user-not-found':       'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    'auth/wrong-password':       'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    'auth/invalid-credential':   'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    'auth/email-already-in-use': 'البريد الإلكتروني مستخدم بالفعل',
    'auth/too-many-requests':    'محاولات كثيرة، انتظر قليلاً ثم حاول مجدداً',
    'auth/network-request-failed': 'لا يوجد اتصال بالإنترنت',
    'auth/user-disabled':        'هذا الحساب موقوف. تواصل مع المدير',
    'auth/weak-password':        'كلمة المرور ضعيفة جداً (8 أحرف على الأقل)',
    'auth/invalid-email':        'صيغة البريد الإلكتروني غير صحيحة',
    'auth/requires-recent-login':'يرجى تسجيل الدخول مجدداً لتأكيد هويتك',
  };
  return map[code] ?? 'حدث خطأ غير متوقع. حاول مجدداً';
}
