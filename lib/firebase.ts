import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth as fbGetAuth, browserLocalPersistence, Auth } from 'firebase/auth';
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

const app = getApps().find(a => a.name === '[DEFAULT]') ?? initializeApp(firebaseConfig);

let _auth: Auth | null = null;

// Returns Auth lazily — safe to call during SSR (returns null) and in browser (returns real instance).
export function getFirebaseAuth(): Auth | null {
  if (typeof window === 'undefined') return null;
  if (_auth) return _auth;
  try {
    _auth = Platform.OS === 'web'
      ? initializeAuth(app, { persistence: browserLocalPersistence })
      : fbGetAuth(app);
  } catch {
    _auth = fbGetAuth(app);
  }
  return _auth;
}

// Eagerly resolved at module load — null during SSR build, real Auth in browser.
export const auth    = getFirebaseAuth();
export const db      = getFirestore(app);
export const storage = getStorage(app);
export default app;

export function getSecondaryAuth(): Auth | null {
  if (typeof window === 'undefined') return null;
  const SECONDARY = 'secondary-user-creation';
  const existing  = getApps().find(a => a.name === SECONDARY);
  const secondApp = existing ?? initializeApp(firebaseConfig, SECONDARY);
  return fbGetAuth(secondApp);
}
