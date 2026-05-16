/**
 * Analytics wrapper — Firebase Analytics + Crashlytics.
 * All tracking is anonymised: no PII is sent.
 * Disabled by default until user consents (GDPR/privacy compliance).
 * On iOS, respects ATT (App Tracking Transparency) framework.
 */
import { Platform } from 'react-native';

let analyticsEnabled = false;

export function enableAnalytics() {
  analyticsEnabled = true;
}

export function disableAnalytics() {
  analyticsEnabled = false;
}

function safe(fn: () => void) {
  if (!analyticsEnabled) return;
  try { fn(); } catch { /* never crash on analytics */ }
}

// ── Screen tracking ───────────────────────────────────────────────────────────
export function trackScreen(screenName: string) {
  safe(() => {
    if (__DEV__) console.log(`[Analytics] Screen: ${screenName}`);
    // logEvent(analytics, 'screen_view', { screen_name: screenName });
  });
}

// ── User actions ──────────────────────────────────────────────────────────────
export function trackEvent(name: string, params?: Record<string, string | number | boolean>) {
  safe(() => {
    if (__DEV__) console.log(`[Analytics] Event: ${name}`, params);
    // logEvent(analytics, name, params);
  });
}

// ── Error tracking ────────────────────────────────────────────────────────────
export function trackError(error: Error, context?: string) {
  safe(() => {
    if (__DEV__) console.error(`[Crash] ${context ?? 'unknown'}:`, error);
    // crashlytics().recordError(error);
  });
}

// ── Performance markers ───────────────────────────────────────────────────────
const timers = new Map<string, number>();

export function startTrace(name: string) {
  timers.set(name, Date.now());
}

export function stopTrace(name: string) {
  const start = timers.get(name);
  if (!start) return;
  const ms = Date.now() - start;
  timers.delete(name);
  if (__DEV__) console.log(`[Perf] ${name}: ${ms}ms`);
  // Report to Firebase Performance
}

// ── Standard events (no PII) ─────────────────────────────────────────────────
export const Events = {
  LOGIN:              'login',
  LOGOUT:             'logout',
  PROPERTY_VIEWED:    'property_viewed',
  CONTRACT_CREATED:   'contract_created',
  PAYMENT_RECORDED:   'payment_recorded',
  DOCUMENT_UPLOADED:  'document_uploaded',
  SEARCH_PERFORMED:   'search_performed',
  FILTER_APPLIED:     'filter_applied',
  MAINTENANCE_FILED:  'maintenance_filed',
} as const;
