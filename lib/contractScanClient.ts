/**
 * عميل قراءة العقود — ينادي نقطة النهاية التي تحمل المفتاح.
 *
 * الرابط يأتي من متغيّر بيئة. بلا ضبطه تبقى الميزة **معطّلة بوضوح** لا مكسورة:
 * `isScanConfigured()` تُخبر الشاشة فتعرض سبباً مفهوماً بدل خطأ شبكة غامض.
 */
import { getFirebaseAuth } from './firebase';
import type { RawExtraction } from '../domain/services/ContractExtractionService';

const ENDPOINT = process.env.EXPO_PUBLIC_CONTRACT_SCAN_URL ?? '';

/** حجم الصورة المقبول عند الخادم — نفحصه هنا أيضاً فلا نرسل ما سيُرفض. */
export const MAX_SCAN_BYTES = 5 * 1024 * 1024;

export function isScanConfigured(): boolean {
  return ENDPOINT.length > 0;
}

export type ScanResult =
  | { ok: true; extraction: RawExtraction }
  | { ok: false; code: string; message: string };

/**
 * يرسل صورة العقد ويُرجع القراءة الخام.
 * لا يرمي استثناءات — كل فشل يرجع برسالة عربية جاهزة للعرض.
 */
export async function scanContractImage(
  imageBase64: string,
  mimeType: string,
): Promise<ScanResult> {
  if (!isScanConfigured()) {
    return {
      ok: false, code: 'NOT_CONFIGURED',
      message: 'قراءة العقود غير مهيّأة بعد. راجع server/README.md لنشر نقطة النهاية.',
    };
  }

  const approxBytes = Math.floor((imageBase64.length * 3) / 4);
  if (approxBytes > MAX_SCAN_BYTES) {
    return {
      ok: false, code: 'IMAGE_TOO_LARGE',
      message: `حجم الصورة يتجاوز ${Math.round(MAX_SCAN_BYTES / 1048576)} ميجابايت. صوّرها بجودة أقل.`,
    };
  }

  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) {
    return { ok: false, code: 'NO_SESSION', message: 'جلستك غير نشطة. أعد تسجيل الدخول.' };
  }

  let token: string;
  try {
    token = await user.getIdToken();
  } catch {
    return { ok: false, code: 'NO_TOKEN', message: 'تعذّر التحقق من جلستك. أعد تسجيل الدخول.' };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ imageBase64, mimeType }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        code: data?.code ?? `HTTP_${res.status}`,
        message: data?.message ?? 'تعذّرت قراءة الصورة. أعد المحاولة أو أدخل البيانات يدوياً.',
      };
    }
    return { ok: true, extraction: data.extraction as RawExtraction };
  } catch {
    return {
      ok: false, code: 'NETWORK',
      message: 'تعذّر الوصول إلى خدمة القراءة. تحقّق من الإنترنت وأعد المحاولة.',
    };
  }
}
