/**
 * تخزين الملفات الكبيرة على خطة Spark (بدون Firebase Storage).
 *
 * مستند Firestore حدّه ~1MB، فالصك أو العقد الممسوح PDF كان يُرفض.
 * نقسم الملف (base64) لقطع ~700KB، كل قطعة مستند في مجموعة fileChunks،
 * والمرفق نفسه يحفظ عدد القطع فقط. القطع ما تنحمّل إلا لما تفتح الملف.
 */
import { setOne, getOne, deleteOne } from './firestoreService';

export const CHUNK_CHARS = 700_000;
/** أقصى حجم لملف واحد (بعد التحويل لـ base64 تقريباً 15MB) */
export const MAX_FILE_CHARS = 20_000_000;

export function splitIntoChunks(dataUri: string, size = CHUNK_CHARS): string[] {
  const out: string[] = [];
  for (let i = 0; i < dataUri.length; i += size) out.push(dataUri.slice(i, i + size));
  return out;
}

const chunkId = (fileId: string, i: number) => `${fileId}_${i}`;

export async function saveChunks(orgId: string, fileId: string, dataUri: string, ownerContext?: string, ownerId?: string): Promise<number> {
  const parts = splitIntoChunks(dataUri);
  // بالتسلسل: أوضح في الأخطاء وأخف على الاتصال الضعيف
  for (let i = 0; i < parts.length; i++) {
    await setOne(orgId, 'fileChunks', chunkId(fileId, i), {
      fileId, index: i, data: parts[i],
      ...(ownerContext ? { ownerContext } : {}),
      ...(ownerId ? { ownerId } : {}),
    });
  }
  return parts.length;
}

const cache = new Map<string, string>();

export async function loadChunks(orgId: string, fileId: string, count: number): Promise<string> {
  const hit = cache.get(fileId);
  if (hit) return hit;
  const docs = await Promise.all(
    Array.from({ length: count }, (_, i) => getOne(orgId, 'fileChunks', chunkId(fileId, i))),
  );
  if (docs.some(d => !d)) throw new Error('جزء من الملف مفقود');
  const full = docs.map(d => (d as any).data as string).join('');
  cache.set(fileId, full);
  return full;
}

export async function deleteChunks(orgId: string, fileId: string, count: number): Promise<void> {
  cache.delete(fileId);
  await Promise.all(Array.from({ length: count }, (_, i) => deleteOne(orgId, 'fileChunks', chunkId(fileId, i)).catch(() => {})));
}
