import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type InstallPlatform = 'ios' | 'android' | 'other';
export type InstallState    = 'installed' | 'installable' | 'dismissed' | 'unsupported';

const STORAGE_KEY_DISMISSED  = 'dtg-pwa-dismissed';
const STORAGE_KEY_INSTALLED  = 'dtg-pwa-installed';

function safeLocalStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetLocalStorage(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
}

function detectPlatform(): InstallPlatform {
  if (Platform.OS !== 'web') return 'other';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream) return 'ios';
  return 'other';
}

function isStandalone(): boolean {
  if (Platform.OS !== 'web') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

export interface PWAInstallHook {
  installState:   InstallState;
  platform:       InstallPlatform;
  /** Show the main onboarding modal */
  showModal:      boolean;
  /** Show the compact floating button (after modal dismissed) */
  showFloating:   boolean;
  openModal:      () => void;
  closeModal:     (permanent?: boolean) => void;
  triggerInstall: () => Promise<boolean>;
}

export function usePWAInstall(): PWAInstallHook {
  const [installState, setInstallState] = useState<InstallState>('unsupported');
  const [platform,     setPlatform]     = useState<InstallPlatform>('other');
  const [showModal,    setShowModal]    = useState(false);
  const [showFloating, setShowFloating] = useState(false);
  const deferredPrompt = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const plt = detectPlatform();
    setPlatform(plt);

    if (isStandalone() || safeLocalStorage(STORAGE_KEY_INSTALLED)) {
      setInstallState('installed');
      return;
    }

    if (safeLocalStorage(STORAGE_KEY_DISMISSED)) {
      setInstallState('dismissed');
      // Show floating button for dismissed-but-not-installed users
      if (plt === 'ios' || plt === 'android') setShowFloating(true);
      return;
    }

    if (plt === 'ios') {
      setInstallState('installable');
      // Auto-show modal after 2.5 s
      const t = setTimeout(() => setShowModal(true), 2500);
      return () => clearTimeout(t);
    }

    // Android: wait for browser event
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setInstallState('installable');
      const t = setTimeout(() => setShowModal(true), 2500);
      return () => clearTimeout(t);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => {
      setInstallState('installed');
      setShowModal(false);
      setShowFloating(false);
      safeSetLocalStorage(STORAGE_KEY_INSTALLED, '1');
      deferredPrompt.current = null;
    });
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const openModal = useCallback(() => setShowModal(true), []);

  const closeModal = useCallback((permanent = false) => {
    setShowModal(false);
    if (permanent) {
      safeSetLocalStorage(STORAGE_KEY_DISMISSED, '1');
      setInstallState('dismissed');
    }
    // Show floating button after closing (unless already installed)
    if (installState !== 'installed') setShowFloating(true);
  }, [installState]);

  const triggerInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt.current) return false;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    if (outcome === 'accepted') {
      setInstallState('installed');
      setShowModal(false);
      setShowFloating(false);
      safeSetLocalStorage(STORAGE_KEY_INSTALLED, '1');
    }
    return outcome === 'accepted';
  }, []);

  return { installState, platform, showModal, showFloating, openModal, closeModal, triggerInstall };
}
