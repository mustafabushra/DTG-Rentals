import { Platform } from 'react-native';

// Firestore document hard limit is 1 MB.
// We target ≤ 200 KB per compressed image so multiple photos fit in one document.
const MAX_DIMENSION = 900;   // px — longest edge after resize
const JPEG_QUALITY  = 0.72;  // 0–1 JPEG quality

/**
 * Convert a local image URI to a compressed, persistent data: URI.
 *
 * On web  : blob: URLs from expo-image-picker are temporary and revoked after use.
 *           We compress via Canvas → JPEG data: URI (~30–150 KB) that survives
 *           Firestore's 1 MB document limit and persists across sessions.
 * Native  : file: URIs are stable — return as-is (Firebase Storage handles persistence).
 */
export async function toPersistentUri(uri: string): Promise<string> {
  if (!uri) return uri;
  if (Platform.OS !== 'web') return uri;          // native: file:// URIs are stable

  // Already a compressed data URI — return as-is
  if (uri.startsWith('data:')) return uri;

  // Must be a blob: or http: URI on web
  try {
    const blob      = await fetchBlob(uri);
    const blobUrl   = URL.createObjectURL(blob);   // stable within this function scope
    const dataUri   = await compressViaCanvas(blobUrl);
    URL.revokeObjectURL(blobUrl);
    return dataUri;
  } catch (e) {
    console.warn('[imageUtils] compression failed, falling back to raw fetch:', e);
    // Last resort: raw base64 (may be large but better than nothing)
    return rawToDataUri(uri);
  }
}

/**
 * Convert any URI (blob:, data:, file:) to a Blob for Firebase Storage upload.
 */
export async function toBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  return res.blob();
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function fetchBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return res.blob();
}

/** Resize + compress image using an off-screen Canvas element */
function compressViaCanvas(blobUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new (globalThis as any).Image() as HTMLImageElement;
    img.onload = () => {
      let w = img.naturalWidth  || img.width;
      let h = img.naturalHeight || img.height;

      // Scale down so longest edge ≤ MAX_DIMENSION
      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        if (w >= h) { h = Math.round(h * MAX_DIMENSION / w); w = MAX_DIMENSION; }
        else        { w = Math.round(w * MAX_DIMENSION / h); h = MAX_DIMENSION; }
      }

      const canvas  = (globalThis as any).document.createElement('canvas') as HTMLCanvasElement;
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no canvas ctx')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = blobUrl;
  });
}

/** Raw fallback: blob → FileReader base64 (no resizing) */
async function rawToDataUri(uri: string): Promise<string> {
  const blob = await fetchBlob(uri);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror   = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

