import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, browserLocalPersistence, Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

// During `expo export` static rendering runs in Node.js — Firebase Auth cannot
// initialize there (no DOM, no persistence). Skip auth in that context.
const isSSR = typeof window === 'undefined';

const app = getApps().find(a => a.name === '[DEFAULT]') ?? initializeApp(firebaseConfig);

function createAuth(): Auth | null {
  if (isSSR) return null;
  if (getApps().length > 1) return getAuth(app);
  try {
    if (Platform.OS === 'web') {
      return initializeAuth(app, { persistence: browserLocalPersistence });
    }
    return getAuth(app);
  } catch {
    return getAuth(app);
  }
}

export const auth    = createAuth();
export const db      = getFirestore(app);
export const storage = getStorage(app);
export default app;

export function getSecondaryAuth(): Auth | null {
  if (isSSR) return null;
  const SECONDARY = 'secondary-user-creation';
  const existing  = getApps().find(a => a.name === SECONDARY);
  const secondApp = existing ?? initializeApp(firebaseConfig, SECONDARY);
  return getAuth(secondApp);
}
