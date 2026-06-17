import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import { toBlob } from './imageUtils';

/**
 * Upload any file (image or document) to Firebase Storage and return the download URL.
 */
export async function uploadFile(
  path: string,
  uri: string,
  mimeType: string = 'application/octet-stream'
): Promise<string> {
  const blob = await toBlob(uri);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: mimeType || blob.type });
  return getDownloadURL(storageRef);
}

/**
 * Upload an image URI to Firebase Storage and return the permanent download URL.
 */
export async function uploadPhoto(
  path: string,
  uri:  string,
): Promise<string> {
  return uploadFile(path, uri, 'image/jpeg');
}

/** Delete a file from Storage by path (silently ignores if already deleted) */
export async function deleteFile(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch (e: any) {
    if (e?.code !== 'storage/object-not-found') throw e;
  }
}

/** @deprecated Use deleteFile */
export const deletePhoto = deleteFile;

/** Resolve the Storage path for a photo given entity type, id, and photo id */
export function photoStoragePath(
  entityType: 'property' | 'unit',
  entityId:   string,
  photoId:    string,
): string {
  const folder = entityType === 'property' ? 'properties' : 'units';
  return `orgs/main/photos/${folder}/${entityId}/${photoId}`;
}

/** Resolve the Storage path for an attachment */
export function attachmentStoragePath(
  entityType: string,
  entityId:   string,
  attachmentId: string,
): string {
  return `orgs/main/attachments/${entityType}/${entityId}/${attachmentId}`;
}

