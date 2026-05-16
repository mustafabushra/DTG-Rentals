import {
  collection, doc, getDocs, getDoc,
  addDoc, setDoc, deleteDoc,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';

export const ORG_ID = 'main';

function stripUndefined(obj: DocumentData): DocumentData {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

function normalizeTimestamps(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj?.toDate === 'function') return obj.toDate().toISOString();
  if (Array.isArray(obj)) return obj.map(normalizeTimestamps);
  if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, normalizeTimestamps(v)])
    );
  }
  return obj;
}

function orgCol(orgId: string, col: string) {
  return collection(db, 'orgs', orgId, col);
}
function orgDoc(orgId: string, col: string, id: string) {
  return doc(db, 'orgs', orgId, col, id);
}

export async function getAll(orgId: string, col: string): Promise<DocumentData[]> {
  const snap = await getDocs(orgCol(orgId, col));
  // id: d.id يجب أن يأتي آخراً ليكون دائماً هو الأولوية بغض النظر عن الحقول المخزّنة داخل المستند
  return snap.docs.map(d => ({ ...normalizeTimestamps(d.data()), id: d.id }));
}

export async function getOne(orgId: string, col: string, id: string) {
  const snap = await getDoc(orgDoc(orgId, col, id));
  return snap.exists() ? { ...normalizeTimestamps(snap.data()), id: snap.id } : null;
}

export async function addOne(orgId: string, col: string, data: DocumentData) {
  const ref = await addDoc(orgCol(orgId, col), stripUndefined({
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  return ref.id;
}

export async function setOne(orgId: string, col: string, id: string, data: DocumentData) {
  await setDoc(orgDoc(orgId, col, id), stripUndefined({
    ...data,
    // Preserve existing createdAt (e.g. from backup import); only set if missing
    ...(data.createdAt == null ? { createdAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  }));
  console.log(`[Firestore] Data written to Firebase: ${col}/${id}`);
}

export async function updateOne(orgId: string, col: string, id: string, data: Partial<DocumentData>) {
  await setDoc(orgDoc(orgId, col, id), stripUndefined({
    ...data,
    updatedAt: serverTimestamp(),
  }), { merge: true });
}

export async function deleteOne(orgId: string, col: string, id: string) {
  await deleteDoc(orgDoc(orgId, col, id));
}

export async function deleteAll(orgId: string, col: string): Promise<void> {
  const snap = await getDocs(orgCol(orgId, col));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}
