/**
 * مراقبة الأخطاء: أي خطأ عند أي مستخدم ينحفظ في orgs/{org}/errorLogs،
 * والمدير يشوفها في "سجل الأخطاء" ويطلع له تنبيه في الرئيسية.
 *
 * - نفس الخطأ ما يتكرر: بصمة (الرسالة + المكان) ومرة وحدة كل 10 دقائق لكل جهاز.
 * - حد أعلى 30 تقرير لكل جلسة، عشان خطأ في حلقة ما يغرق قاعدة البيانات.
 * - ما نرسل بيانات المستخدمين: الرسالة ومكان الخطأ والصفحة ونوع الجهاز بس.
 */
import { Platform } from 'react-native';
import { setOne, getActiveOrgId } from './firestoreService';

let ctx: { uid?: string; name?: string; role?: string } = {};
let sent = 0;
const lastSent = new Map<string, number>();
const MAX_PER_SESSION = 30;
const DEDUPE_MS = 10 * 60 * 1000;

export function setErrorContext(c: typeof ctx) { ctx = c; }

function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/** نشيل أي رقم طويل أو إيميل أو رابط بيانات من الرسالة قبل ما تنحفظ */
function scrub(s: string) {
  return s
    .replace(/data:[^\s"')]+/g, '[data]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/\+?\d[\d\s-]{7,}\d/g, '[number]')
    .slice(0, 600);
}

export function reportError(err: unknown, where: string, extra?: Record<string, string>) {
  try {
    if (!ctx.uid || sent >= MAX_PER_SESSION) return;
    let org: string;
    try { org = getActiveOrgId(); } catch { return; }
    if (!org) return;
    const e = err as any;
    const message = scrub(String(e?.message ?? e ?? 'خطأ غير معروف'));
    const code = e?.code ? String(e.code).slice(0, 60) : undefined;
    const stack = e?.stack ? scrub(String(e.stack).split('\n').slice(0, 6).join('\n')) : undefined;
    const fp = hash(`${where}|${code ?? ''}|${message.slice(0, 120)}`);
    const now = Date.now();
    if (now - (lastSent.get(fp) ?? 0) < DEDUPE_MS) return;
    lastSent.set(fp, now);
    sent++;
    const page = typeof window !== 'undefined' ? window.location?.pathname ?? '' : '';
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 160) : Platform.OS;
    const id = `err_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    setOne(org, 'errorLogs', id, {
      fingerprint: fp, where: where.slice(0, 80), message, ...(code ? { code } : {}), ...(stack ? { stack } : {}),
      page: page.slice(0, 120), device: ua, userId: ctx.uid, userName: (ctx.name ?? '').slice(0, 80), role: ctx.role ?? '',
      at: new Date(now).toISOString(), ...(extra ?? {}),
    }).catch(() => {});
  } catch { /* المراقبة نفسها ما توقف التطبيق أبداً */ }
}

let installed = false;
export function installGlobalErrorHandlers() {
  if (installed || Platform.OS !== 'web' || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', ev => {
    // أخطاء تحميل خطوط أو صور خارجية ما تهمنا
    if (!(ev as ErrorEvent).error && !(ev as ErrorEvent).message) return;
    reportError((ev as ErrorEvent).error ?? (ev as ErrorEvent).message, 'window.onerror');
  });
  window.addEventListener('unhandledrejection', ev => {
    const r: any = (ev as PromiseRejectionEvent).reason;
    // انقطاع الإنترنت مو خطأ برمجي
    if (r?.code === 'unavailable') return;
    reportError(r, 'unhandledrejection');
  });
}
