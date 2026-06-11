import { initializeApp, getApps } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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

export function getSecondaryAuth(): Auth | null {
  if (typeof window === 'undefined') return null;
  const SECONDARY = 'secondary-user-creation';
  const existing  = getApps().find(a => a.name === SECONDARY);
  const secondApp = existing ?? initializeApp(firebaseConfig, SECONDARY);
  return getAuth(secondApp);
}
