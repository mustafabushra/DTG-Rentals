/**
 * تخزين محلي مشفّر (AES-GCM 256).
 *
 * النسخة المحلية من البيانات (عشان التطبيق يفتح بسرعة وبدون نت) كانت محفوظة نص مكشوف في
 * localStorage، فأي أحد يفتح أدوات المطوّر أو أي إضافة في المتصفح يقرأها كاملة.
 * الحين تنحفظ مشفّرة. مفتاح التشفير يتولّد على الجهاز داخل المتصفح، ونوعه "غير قابل للاستخراج"
 * (non-extractable)، يعني حتى الكود نفسه ما يقدر يطلع المفتاح كنص — يقدر بس يستخدمه للفك.
 *
 * الواجهة متزامنة للقراءة (من نسخة مفكوكة في الذاكرة) — لازم unlock(uid) بعد تسجيل الدخول.
 */
const ENC = 'enc1:';
const DB = 'dtg-secure';
const STORE = 'keys';

let key: CryptoKey | null = null;
let unlockedFor: string | null = null;
const mem = new Map<string, string>();
const pending = new Map<string, any>();

const hasCrypto = () => typeof window !== 'undefined' && !!window.crypto?.subtle && typeof indexedDB !== 'undefined';

function idb<T>(fn: (s: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(STORE, mode);
      const r = fn(tx.objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    };
  });
}

async function getKey(uid: string): Promise<CryptoKey> {
  const id = `k:${uid}`;
  const existing = await idb<CryptoKey | undefined>(s => s.get(id) as any, 'readonly').catch(() => undefined);
  if (existing) return existing;
  const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await idb(s => s.put(k, id), 'readwrite');
  return k;
}

const b64 = (buf: ArrayBuffer) => { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); };
const unb64 = (s: string) => { const bin = atob(s); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; };

async function encrypt(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key!, new TextEncoder().encode(plain));
  return ENC + b64(iv.buffer) + '.' + b64(ct);
}
async function decrypt(stored: string): Promise<string | null> {
  try {
    const [ivs, cts] = stored.slice(ENC.length).split('.');
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivs) }, key!, unb64(cts));
    return new TextDecoder().decode(pt);
  } catch { return null; }
}

/** يفك كل المفاتيح اللي تبدأ بالبادئات المعطاة لهذا المستخدم، ويحوّل أي نص مكشوف قديم لمشفّر */
let inflight: { uid: string; p: Promise<boolean> } | null = null;

export function unlock(uid: string, prefixes: string[]): Promise<boolean> {
  // نداء واحد بس في نفس الوقت: لو نادوها مكانين مع بعض، كل واحد كان يولّد مفتاح مختلف
  // فالثاني ما يقدر يفك اللي شفّره الأول ويمسحه
  if (inflight && inflight.uid === uid) return inflight.p;
  const p = doUnlock(uid, prefixes).finally(() => { if (inflight?.p === p) inflight = null; });
  inflight = { uid, p };
  return p;
}

async function doUnlock(uid: string, prefixes: string[]): Promise<boolean> {
  if (!uid || !hasCrypto()) return false;
  if (unlockedFor === uid && key) return true;
  try {
    key = await getKey(uid);
    unlockedFor = uid;
    mem.clear();
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && prefixes.some(p => k.startsWith(p))) keys.push(k);
    }
    for (const k of keys) {
      const raw = localStorage.getItem(k); if (raw == null) continue;
      if (raw.startsWith(ENC)) {
        const pt = await decrypt(raw);
        if (pt != null) mem.set(k, pt); // ما ينفك (مفتاح جهاز ثاني) ⇒ نتجاهله وينكتب فوقه من الخادم
      } else {
        mem.set(k, raw);
        localStorage.setItem(k, await encrypt(raw)); // ترحيل: النص المكشوف القديم ينشفّر
      }
    }
    return true;
  } catch (e) {
    console.warn('[secureCache] unlock failed', e);
    key = null; unlockedFor = null;
    return false;
  }
}

export function isUnlocked(uid?: string) { return !!key && (!uid || unlockedFor === uid); }

export function secureGet(k: string): string | null {
  return mem.get(k) ?? null;
}

/** يحدّث الذاكرة فوراً، ويكتب نسخة مشفّرة في الخلفية. بدون مفتاح ما نكتب شي مكشوف أبداً */
export function secureSet(k: string, value: string) {
  mem.set(k, value);
  if (!key) return;
  clearTimeout(pending.get(k));
  pending.set(k, setTimeout(async () => {
    pending.delete(k);
    try { localStorage.setItem(k, await encrypt(mem.get(k) ?? value)); } catch {}
  }, 400));
}

export function secureRemove(k: string) {
  mem.delete(k);
  clearTimeout(pending.get(k)); pending.delete(k);
  try { localStorage.removeItem(k); } catch {}
}

/** عند تسجيل الخروج: نمسح النسخة المفكوكة من الذاكرة (المشفّرة تبقى على الجهاز) */
export function lock() {
  mem.clear(); key = null; unlockedFor = null;
  pending.forEach(t => clearTimeout(t)); pending.clear();
}
