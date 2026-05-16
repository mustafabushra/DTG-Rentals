import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, browserLocalPersistence } from 'firebase/auth';
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

function createAuth() {
  if (getApps().length > 1) return getAuth(app);
  try {
    // On web: force browserLocalPersistence so the token survives page reloads
    // On native: fall back to getAuth (AsyncStorage persistence is handled by the RN SDK)
    if (Platform.OS === 'web') {
      return initializeAuth(app, { persistence: browserLocalPersistence });
    }
    return getAuth(app);
  } catch {
    // initializeAuth throws if auth was already created for this app
    return getAuth(app);
  }
}

export const auth    = createAuth();
export const db      = getFirestore(app);
export const storage = getStorage(app);
export default app;

export function getSecondaryAuth() {
  const SECONDARY = 'secondary-user-creation';
  const existing  = getApps().find(a => a.name === SECONDARY);
  const secondApp = existing ?? initializeApp(firebaseConfig, SECONDARY);
  return getAuth(secondApp);
}
