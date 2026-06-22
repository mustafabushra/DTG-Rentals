import { initializeApp, getApps } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

const app = getApps().find(a => a.name === '[DEFAULT]') ?? initializeApp(firebaseConfig);

export function getFirebaseAuth(): Auth | null {
  if (typeof window === 'undefined') return null;
  return getAuth(app);
}

export const auth    = getFirebaseAuth();
export const db      = getFirestore(app);
export const storage = getStorage(app);
export default app;

function getSecondaryApp() {
  const SECONDARY = 'secondary-user-creation';
  const existing  = getApps().find(a => a.name === SECONDARY);
  return existing ?? initializeApp(firebaseConfig, SECONDARY);
}

export function getSecondaryAuth(): Auth | null {
  if (typeof window === 'undefined') return null;
  return getAuth(getSecondaryApp());
}

// التطبيق الثانوي مع Firestore الخاص به — يُمكّن إنشاء حساب وكتابة بياناته
// مصادقًا كالمستخدم الجديد دون لمس جلسة التطبيق الأساسي (لاستبدال كود الدعوة).
export function getSecondary(): { auth: Auth; db: Firestore } | null {
  if (typeof window === 'undefined') return null;
  const secondApp = getSecondaryApp();
  return { auth: getAuth(secondApp), db: getFirestore(secondApp) };
}
