import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

export interface NetworkStatus {
  isOnline: boolean;
  isWeak: boolean;
  type: string | null;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,
    isWeak: false,
    type: null,
  });

  useEffect(() => {
    if (Platform.OS === 'web') {
      const update = () => setStatus({ isOnline: navigator.onLine, isWeak: false, type: null });
      update();
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
      return () => {
        window.removeEventListener('online', update);
        window.removeEventListener('offline', update);
      };
    }

    // Native only — lazy-load NetInfo to avoid web bundle issues
    let unsub: (() => void) | undefined;
    import('@react-native-community/netinfo').then(({ default: NetInfo }) => {
      unsub = NetInfo.addEventListener((state: any) => {
        setStatus({
          isOnline: state.isConnected ?? false,
          isWeak:   (state.isConnected ?? false) && !(state.isInternetReachable ?? true),
          type:     state.type,
        });
      });
      NetInfo.fetch().then((state: any) => {
        setStatus({
          isOnline: state.isConnected ?? false,
          isWeak:   (state.isConnected ?? false) && !(state.isInternetReachable ?? true),
          type:     state.type,
        });
      });
    });

    return () => { unsub?.(); };
  }, []);

  return status;
}

// Exponential backoff retry for API calls
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 500, label = 'request' } = options;
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const isRetryable = !err?.code?.startsWith('auth/') && attempt < maxAttempts;
      if (!isRetryable) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
