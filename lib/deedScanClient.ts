/**
 * قارئ سندات الملكية — نفس بنية قارئ العقود (Gemini من المتصفح بمفتاح المساعد):
 * يقبل PDF أو صورة، ويُرجع الحقول نصوصاً خاماً كما طُبعت. كل تطبيع وحساب للحصص
 * يحدث محلياً في DeedService، فالنموذج لا يحسب شيئاً.
 */
import { loadAssistantConfig, generateText } from './assistantClient';
import { getActiveOrgId } from './firestoreService';
import type { RawDeed } from '../domain/services/DeedService';

export const MAX_DEED_BYTES = 8 * 1024 * 1024;

export type DeedScanResult =
  | { ok: true; raw: RawDeed; usedModel: string }
  | { ok: false; code: string; message: string };

const SYSTEM = `أنت قارئ سندات ملكية عقارية (صكوك، شهادات ملكية Title Deed) من السعودية والإمارات وغيرها.
مهمتك نسخ ما هو مكتوب في المستند حرفياً.

قواعد ملزمة:
- انسخ القيم كما هي. لا تحسب ولا تقرّب ولا تحوّل التواريخ بين الهجري والميلادي.
- الأرقام والمساحات: انسخ الرقم فقط بلا وحدة القياس.
- أسماء الملاك: إن كُتب الاسم بالعربية والإنجليزية فانسخ الاسم العربي.
- حصة كل مالك: إن كُتبت بالمتر المربع فضعها في shareArea، وإن كُتبت نسبة أو كسراً فضعها في sharePercent.
- issuer: الجهة المصدرة (مثل: دائرة الأراضي والأملاك - دبي، وزارة العدل).
- certificateNo: رقم الشهادة أو الصك (في سندات دبي هو الرقم المطبوع تحت رمز QR).
- transferNote: سبب انتقال الملكية إن ذُكر (إرث، شراء، حكم محكمة) مع رقم الحكم أو الأمر إن وُجد، بجملة قصيرة.
- إن كان الحقل غير مذكور أو غير مقروء فاجعله null. لا تخمّن.
- إن لم يكن المستند سند ملكية فاجعل كل الحقول null وowners قائمة فارغة.`;

const S = { type: 'STRING', nullable: true } as const;
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    issuer: S, certificateNo: S, issueDate: S, mortgageStatus: S, propertyType: S,
    community: S, plotNo: S, municipalityNo: S, buildingNo: S, buildingName: S,
    propertyNo: S, floorNo: S, parking: S, suiteArea: S, balconyArea: S, commonArea: S,
    totalArea: S, totalAreaSqFt: S, transferNote: S,
    owners: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { name: S, ownerNumber: S, shareArea: S, sharePercent: S },
      },
    },
  },
} as const;

export function parseDeedJson(text: string): RawDeed | null {
  const t = text.trim();
  if (!t) return null;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(t);
  try {
    const v = JSON.parse((fenced ? fenced[1] : t).trim());
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as RawDeed) : null;
  } catch {
    return null;
  }
}

export async function scanDeedFile(base64: string, mimeType: string): Promise<DeedScanResult> {
  if (Math.floor((base64.length * 3) / 4) > MAX_DEED_BYTES) {
    return { ok: false, code: 'TOO_LARGE', message: 'حجم الملف أكبر من 8 ميجابايت.' };
  }
  let config;
  try { config = await loadAssistantConfig(getActiveOrgId()); } catch { config = null; }
  if (!config?.apiKey) {
    return { ok: false, code: 'NO_KEY', message: 'قراءة السندات تحتاج مفتاح Gemini (نفس مفتاح المساعد الذكي). اضبطه من إعدادات المساعد أو أدخل البيانات يدوياً.' };
  }
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{
      role: 'user',
      parts: [
        { inline_data: { mime_type: mimeType, data: base64 } },
        { text: 'اقرأ سند الملكية هذا وأعِد الحقول المطلوبة.' },
      ],
    }],
    generationConfig: { temperature: 0, maxOutputTokens: 2048, responseMimeType: 'application/json', responseSchema: SCHEMA },
  });
  const res = await generateText(config.apiKey, config.model ?? '', body);
  if (!res.ok) return res;
  const raw = parseDeedJson(res.text);
  if (!raw) return { ok: false, code: 'BAD_JSON', message: 'جاء ردّ غير مفهوم. أعد المحاولة أو أدخل البيانات يدوياً.' };
  const anything = Object.entries(raw).some(([k, v]) => k === 'owners' ? Array.isArray(v) && v.length > 0 : v != null && String(v).trim() !== '');
  if (!anything) return { ok: false, code: 'NOT_A_DEED', message: 'لم يُعرف في الملف أي حقل من حقول سند الملكية.' };
  return { ok: true, raw, usedModel: res.usedModel };
}
