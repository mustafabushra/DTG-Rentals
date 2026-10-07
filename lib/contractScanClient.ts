/**
 * عميل قراءة العقود — ينادي دالة Cloud Function القابلة للنداء.
 *
 * اختيار `httpsCallable` على نقطة نهاية علنية مقصود: الهوية تُرسَل وتُتحقَّق
 * تلقائياً، فلا رموز نُديرها بأيدينا ولا CORS ولا رابط علني يُستنزف. والسرّ
 * (مفتاح الخدمة) يسكن Secret Manager في مشروعك لا في حزمة الويب.
 *
 * الدالة تحتاج خطة Blaze لتُنشر. قبل نشرها تبقى الميزة **معطّلة بوضوح** لا
 * مكسورة: الشاشة تعرض سبباً مفهوماً وخياراً للإدخال اليدوي.
 */
import { getFunctions, httpsCallable, type FunctionsError } from 'firebase/functions';
import app, { getFirebaseAuth } from './firebase';
import type { RawExtraction } from '../domain/services/ContractExtractionService';

const REGION = 'us-central1';
const FN_NAME = 'extractContract';

/** حدّ الحجم المطبَّق على الخادم — نفحصه هنا أيضاً فلا نرسل ما سيُرفض. */
export const MAX_SCAN_BYTES = 5 * 1024 * 1024;

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
  const approxBytes = Math.floor((imageBase64.length * 3) / 4);
  if (approxBytes > MAX_SCAN_BYTES) {
    return {
      ok: false, code: 'IMAGE_TOO_LARGE',
      message: `حجم الصورة يتجاوز ${Math.round(MAX_SCAN_BYTES / 1048576)} ميجابايت. صوّرها بجودة أقل.`,
    };
  }

  if (!getFirebaseAuth()?.currentUser) {
    return { ok: false, code: 'NO_SESSION', message: 'جلستك غير نشطة. أعد تسجيل الدخول.' };
  }

  try {
    const fn = httpsCallable<
      { imageBase64: string; mimeType: string },
      { extraction: RawExtraction }
    >(getFunctions(app, REGION), FN_NAME);

    const res = await fn({ imageBase64, mimeType });
    const extraction = res.data?.extraction;
    if (!extraction) {
      return {
        ok: false, code: 'EMPTY',
        message: 'لم تُقرأ أي بيانات من الصورة. أدخل البيانات يدوياً.',
      };
    }
    return { ok: true, extraction };
  } catch (e) {
    const err = e as FunctionsError;
    // الدالة غير منشورة بعد — نميّزها عن أعطال الشبكة لأن علاجها مختلف
    if (err?.code === 'functions/not-found') {
      return {
        ok: false, code: 'NOT_DEPLOYED',
        message: 'خدمة القراءة غير منشورة بعد. راجع functions/README-scan.md لنشرها.',
      };
    }
    if (err?.code === 'functions/unauthenticated') {
      return { ok: false, code: 'NO_SESSION', message: 'جلستك غير صالحة. أعد تسجيل الدخول.' };
    }
    // رسائل الدالة عربية أصلاً، فتُعرض كما هي
    if (typeof err?.message === 'string' && err.message.trim().length > 0 && err.code) {
      return { ok: false, code: err.code, message: err.message };
    }
    return {
      ok: false, code: 'NETWORK',
      message: 'تعذّر الوصول إلى خدمة القراءة. تحقّق من الإنترنت وأعد المحاولة.',
    };
  }
}
