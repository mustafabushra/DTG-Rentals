import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import { toBlob } from './imageUtils';

/**
 * Upload an image URI to Firebase Storage and return the permanent download URL.
 * Works on both web (blob: / data: URIs) and React Native (file: URIs).
 */
export async function uploadPhoto(
  path: string,   // e.g. "orgs/main/photos/properties/prop1/ph_123"
  uri:  string,
): Promise<string> {
  const blob = await toBlob(uri);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/jpeg' });
  return getDownloadURL(storageRef);
}

/** Delete a file from Storage by path (silently ignores if already deleted) */
export async function deletePhoto(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch (e: any) {
    if (e?.code !== 'storage/object-not-found') throw e;
  }
}

/** Resolve the Storage path for a photo given entity type, id, and photo id */
export function photoStoragePath(
  entityType: 'property' | 'unit',
  entityId:   string,
  photoId:    string,
): string {
  const folder = entityType === 'property' ? 'properties' : 'units';
  return `orgs/main/photos/${folder}/${entityId}/${photoId}`;
}

