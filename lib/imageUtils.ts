import { Platform } from 'react-native';

// Firestore document hard limit is 1 MB.
// We target ≤ 200 KB per compressed image so multiple photos fit in one document.
const MAX_DIMENSION = 900;   // px — longest edge after resize
const JPEG_QUALITY  = 0.72;  // 0–1 JPEG quality

/**
 * Convert a local image URI to a compressed, persistent data: URI.
 *
 * Now we NO LONGER use this for attachments — instead we upload to Firebase Storage.
 * This is kept for property/unit photos which are small enough for Firestore.
 */
export async function toPersistentUri(uri: string): Promise<string> {
  if (!uri) return uri;
  if (uri.startsWith('data:')) return uri;

  try {
    if (Platform.OS === 'web') {
      // 1. Fetch the data
      const blob = await fetchBlob(uri);

      // 2. If it's an image, try to compress it to stay under 1MB limit
      if (blob.type.startsWith('image/')) {
        try {
          const blobUrl = URL.createObjectURL(blob);
          const dataUri = await compressViaCanvas(blobUrl);
          URL.revokeObjectURL(blobUrl);
          return dataUri;
        } catch (err) {
          console.warn('[imageUtils] Image compression failed, using raw base64:', err);
        }
      }

      // 3. Fallback for PDFs or failed image compression: raw Base64
      return await blobToDataUri(blob);
    } else {
      // Native: Fetch then convert to base64 fallback
      return await rawToDataUri(uri);
    }
  } catch (e) {
    console.error('[imageUtils] conversion failed entirely:', e);
    return uri; // Last resort fallback
  }
}

/** Internal: Convert Blob to Data URI (Base64) */
function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror   = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert any URI (blob:, data:, file:) to a Blob for Firebase Storage upload.
 *
 * ✅ FIX: On native, `file://` URIs cannot be fetched directly (Not allowed to load local resource).
 *   Instead we use expo-file-system to read the file as base64 then convert to Blob.
 *   On web, regular fetch() works for blob:/data: URIs.
 */
export async function toBlob(uri: string): Promise<Blob> {
  if (Platform.OS !== 'web') {
    // Native path: use expo-file-system to read the file
    const normalizedUri = uri.startsWith('file://') ? uri : `file://${uri}`;
    try {
      // Use the legacy API from expo-file-system/legacy
      const { readAsStringAsync } = await import('expo-file-system/legacy');
      const base64 = await readAsStringAsync(normalizedUri, {
        encoding: 'base64' as any,
      });
      // Determine MIME type from extension (default to octet-stream)
      const ext = uri.split('.').pop()?.toLowerCase() ?? '';
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        pdf: 'application/pdf', gif: 'image/gif', webp: 'image/webp',
        doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
      const mimeType = mimeMap[ext] || 'application/octet-stream';
      return base64ToBlob(base64, mimeType);
    } catch (err) {
      console.error('[toBlob: native] Failed, falling back to fetch:', err);
      // Fallback to fetch (may fail on some devices)
      const res = await fetch(uri);
      if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
      return res.blob();
    }
  }

  // Web: blob:/data: URIs work fine with fetch
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
  return res.blob();
}

/** Convert a base64 string to a Blob */
function base64ToBlob(base64: string, mimeType: string): Blob {
  // Remove data: URL prefix if present
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const byteChars = atob(clean);
  const byteArrays: Uint8Array[] = [];
  for (let offset = 0; offset < byteChars.length; offset += 512) {
    const slice = byteChars.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type: mimeType });
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