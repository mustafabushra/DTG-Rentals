/**
 * التحقق من رمز هوية Firebase على الخادم — بلا أي تبعية خارجية.
 *
 * ضروري لأن نقطة النهاية تحمل مفتاح API مدفوعاً: بلا تحقق تصير بوّابة مفتوحة
 * يستنزف حصّتك أي من يجد رابطها. والتحقق هنا يثبت أن الطلب من مستخدم مسجَّل
 * دخوله في مؤسستك فعلاً.
 *
 * التبعيات مُمرَّرة (getCertForKid, verifySignature, now) ليكون المنطق مختبَراً
 * بلا شبكة ولا تشفير حقيقي.
 */
import { createVerify } from 'node:crypto';

const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

/** فكّ ترميز base64url إلى نص UTF-8. */
function b64urlToString(part) {
  const padded = part.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf8');
}

/**
 * يفكّ الرمز إلى أجزائه بلا تحقق من التوقيع.
 * يرجع null إن كان الشكل غير صالح — ولا يرمي.
 */
export function decodeJwt(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header  = JSON.parse(b64urlToString(parts[0]));
    const payload = JSON.parse(b64urlToString(parts[1]));
    if (!header || !payload || typeof payload !== 'object') return null;
    return { header, payload, signedData: `${parts[0]}.${parts[1]}`, signature: parts[2] };
  } catch {
    return null;
  }
}

/**
 * يتحقق من مُطالبات رمز Firebase وفق وثائق Google.
 * يرجع { ok: true, uid } أو { ok: false, code }.
 */
export function validateClaims({ header, payload }, { projectId, now, leewaySec = 60 }) {
  if (header?.alg !== 'RS256')            return { ok: false, code: 'BAD_ALG' };
  if (!header?.kid)                       return { ok: false, code: 'NO_KID' };
  if (payload.aud !== projectId)          return { ok: false, code: 'BAD_AUDIENCE' };
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    return { ok: false, code: 'BAD_ISSUER' };
  }
  const nowSec = Math.floor(now / 1000);
  if (typeof payload.exp !== 'number' || payload.exp + leewaySec < nowSec) {
    return { ok: false, code: 'EXPIRED' };
  }
  if (typeof payload.iat !== 'number' || payload.iat - leewaySec > nowSec) {
    return { ok: false, code: 'ISSUED_IN_FUTURE' };
  }
  // auth_time يثبت أن المستخدم صادق فعلاً لا أن الرمز مُصطنع
  if (typeof payload.auth_time === 'number' && payload.auth_time - leewaySec > nowSec) {
    return { ok: false, code: 'BAD_AUTH_TIME' };
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    return { ok: false, code: 'NO_SUBJECT' };
  }
  return { ok: true, uid: payload.sub };
}

/** يجلب شهادات Google العامة، بذاكرة مؤقتة تتبع رأس max-age. */
function makeCertFetcher() {
  let cache = { certs: null, expiresAt: 0 };
  return async function getCertForKid(kid, now = Date.now()) {
    if (!cache.certs || now >= cache.expiresAt) {
      const res = await fetch(CERTS_URL);
      if (!res.ok) throw new Error(`certs fetch failed: ${res.status}`);
      const certs = await res.json();
      const cc = res.headers.get('cache-control') ?? '';
      const maxAge = Number(/max-age=(\d+)/.exec(cc)?.[1] ?? 3600);
      cache = { certs, expiresAt: now + maxAge * 1000 };
    }
    return cache.certs[kid] ?? null;
  };
}

/** يتحقق من توقيع RS256 بشهادة X.509. */
function verifyWithCert(signedData, signatureB64url, certPem) {
  const sig = Buffer.from(signatureB64url.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const v = createVerify('RSA-SHA256');
  v.update(signedData);
  v.end();
  return v.verify(certPem, sig);
}

const defaultDeps = {
  getCertForKid: makeCertFetcher(),
  verifySignature: verifyWithCert,
  now: () => Date.now(),
};

/**
 * التحقق الكامل: الشكل ثم المُطالبات ثم التوقيع.
 * يرجع { ok: true, uid } أو { ok: false, code } — بلا رمي استثناءات.
 */
export async function verifyFirebaseToken(token, { projectId, ...deps } = {}) {
  const d = { ...defaultDeps, ...deps };
  if (!projectId) return { ok: false, code: 'NO_PROJECT_ID' };

  const decoded = decodeJwt(token);
  if (!decoded) return { ok: false, code: 'MALFORMED' };

  const now = d.now();
  const claims = validateClaims(decoded, { projectId, now });
  if (!claims.ok) return claims;

  let cert;
  try {
    cert = await d.getCertForKid(decoded.header.kid, now);
  } catch {
    return { ok: false, code: 'CERTS_UNAVAILABLE' };
  }
  if (!cert) return { ok: false, code: 'UNKNOWN_KID' };

  let valid = false;
  try {
    valid = d.verifySignature(decoded.signedData, decoded.signature, cert);
  } catch {
    valid = false;
  }
  return valid ? { ok: true, uid: claims.uid } : { ok: false, code: 'BAD_SIGNATURE' };
}
