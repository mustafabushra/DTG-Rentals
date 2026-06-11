import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

export interface NetworkStatus {
  isOnline: boolean;
  isWeak: boolean;
  type: string | null;
}

function getWebStatus(): NetworkStatus {
  const online = navigator.onLine;
  const conn = (navigator as any).connection ?? (navigator as any).mozConnection ?? (navigator as any).webkitConnection;
  const weakTypes = new Set(['slow-2g', '2g']);
  const isWeak = online && conn != null && (
    weakTypes.has(conn.effectiveType) ||
    (conn.downlink != null && conn.downlink < 0.5)
  );
  return { isOnline: online, isWeak, type: conn?.effectiveType ?? null };
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,
    isWeak: false,
    type: null,
  });

  useEffect(() => {
    if (Platform.OS === 'web') {
      const update = () => setStatus(getWebStatus());
      update();

      window.addEventListener('online', update);
      window.addEventListener('offline', update);

      const conn = (navigator as any).connection ?? (navigator as any).mozConnection ?? (navigator as any).webkitConnection;
      conn?.addEventListener('change', update);

      return () => {
        window.removeEventListener('online', update);
        window.removeEventListener('offline', update);
        conn?.removeEventListener('change', update);
      };
    }

    // Native only
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
