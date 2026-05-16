/**
 * Secure storage layer backed by iOS Keychain / Android Keystore via expo-secure-store.
 * Sensitive tokens are NEVER stored in AsyncStorage or localStorage.
 * Falls back to in-memory cache on web (tokens are lost on refresh — by design).
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  AUTH_TOKEN:      'dtg_auth_token',
  REFRESH_TOKEN:   'dtg_refresh_token',
  SESSION_UID:     'dtg_session_uid',
  BIOMETRIC_OPT:   'dtg_biometric_opt',
} as const;

type SecureKey = typeof KEYS[keyof typeof KEYS];

// In-memory fallback for web
const memStore = new Map<string, string>();

async function set(key: SecureKey, value: string): Promise<void> {
  if (Platform.OS === 'web') { memStore.set(key, value); return; }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function get(key: SecureKey): Promise<string | null> {
  if (Platform.OS === 'web') return memStore.get(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function remove(key: SecureKey): Promise<void> {
  if (Platform.OS === 'web') { memStore.delete(key); return; }
  await SecureStore.deleteItemAsync(key);
}

async function clearAll(): Promise<void> {
  await Promise.allSettled(Object.values(KEYS).map(k => remove(k as SecureKey)));
  memStore.clear();
}

export const secureStorage = { set, get, remove, clearAll, KEYS };
