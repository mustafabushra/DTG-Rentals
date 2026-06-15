import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../context/AppProvider';
import { SidebarProvider } from '../context/SidebarContext';
import { useColorScheme, Platform, View, ActivityIndicator, I18nManager } from 'react-native';
import { Colors } from '../constants/Colors';
import { useEffect, useRef, useState } from 'react';
import { onAuthChange } from '../lib/auth';
import { useScreenSize } from '../hooks/useScreenSize';
import { WebSidebar, WebDrawer } from '../components/navigation/WebSidebar';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { OfflineBanner } from '../components/ui/OfflineBanner';
import { PWAInstallPrompt } from '../components/ui/PWAInstallPrompt';
import { OnboardingTour } from '../components/ui/OnboardingTour';
import { initSessionManager } from '../lib/sessionManager';

SplashScreen.preventAutoHideAsync();


if (Platform.OS !== 'web' && !I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

function StackContent() {
  const { isDesktop } = useScreenSize();
  const pathname = usePathname();
  // '/' هو مسار home tab للمستخدم المسجل — لا يُدرج هنا
  const NO_SIDEBAR_PATHS = ['/login', '/about', '/privacy-policy', '/terms-of-service', '/contact-us'];
  const isLogin = NO_SIDEBAR_PATHS.includes(pathname);
  const { theme } = useApp();
  const systemScheme = useColorScheme();
  const resolvedScheme = theme === 'system' ? (systemScheme ?? 'light') : theme;
  const colors = Colors[resolvedScheme];

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_left',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="property/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="owner/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="tenant/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="contract/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="unit/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="payment/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="maintenance/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="add-property" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="add-owner" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="add-tenant" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="add-contract" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="add-unit" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="add-maintenance" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="edit-property/[id]" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="edit-owner/[id]" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="edit-tenant/[id]" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="edit-contract/[id]" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="edit-unit/[id]" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
      <Stack.Screen name="record-payment" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="audit-log" options={{ headerShown: false }} />
      <Stack.Screen name="calendar" options={{ headerShown: false }} />
      <Stack.Screen name="tenants" options={{ headerShown: false }} />
      <Stack.Screen name="units" options={{ headerShown: false }} />
      <Stack.Screen name="payments" options={{ headerShown: false }} />
      <Stack.Screen name="maintenance" options={{ headerShown: false }} />
      <Stack.Screen name="filter-properties" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="financial-reports" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="change-password" options={{ headerShown: false }} />
      <Stack.Screen name="help-center" options={{ headerShown: false }} />
      <Stack.Screen name="contact-us" options={{ headerShown: false }} />
      <Stack.Screen name="privacy-policy"   options={{ headerShown: false }} />
      <Stack.Screen name="terms-of-service" options={{ headerShown: false }} />
      <Stack.Screen name="about"            options={{ headerShown: false }} />
      <Stack.Screen name="user-management" options={{ headerShown: false }} />
      <Stack.Screen name="backup" options={{ headerShown: false }} />
      <Stack.Screen name="attachments" options={{ headerShown: false }} />
      <Stack.Screen name="ledger" options={{ headerShown: false }} />
      <Stack.Screen name="system-settings" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard"    options={{ headerShown: false }} />
      <Stack.Screen name="reports"      options={{ headerShown: false }} />
      <Stack.Screen name="action-log"   options={{ headerShown: false }} />
      <Stack.Screen name="payment-log"  options={{ headerShown: false }} />
    </Stack>
  );

  if (Platform.OS === 'web' && !isLogin) {
    if (isDesktop) {
      return (
        <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
          <WebSidebar />
          <View style={{ flex: 1 }}>{stack}</View>
        </View>
      );
    }
    return (
      <View style={{ flex: 1 }}>
        {stack}
        <WebDrawer />
      </View>
    );
  }

  return stack;
}

function AuthWatcher({ onReady }: { onReady: () => void }) {
  const pathname = usePathname();
  // Keep a ref so the onAuthChange closure always reads the current pathname
  // without needing to re-subscribe every time the URL changes.
  const pathnameRef = useRef(pathname);
  // Track the session manager cleanup so we never stack listeners across logins.
  const sessionCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  useEffect(() => {
    console.log('[APP_START] AuthWatcher mounted');
    let lastState: boolean | null = null;

    const navigate = (user: import('firebase/auth').User | null) => {
      if (user) {
        // Ensure session manager is running
        if (!sessionCleanupRef.current) {
          sessionCleanupRef.current = initSessionManager(() => router.replace('/login'));
        }
        // Only navigate to tabs when explicitly on the login screen.
        // If pathname is '/' we are already inside the app (tabs index) — do NOT navigate
        // because router.replace('/(tabs)') from '/' causes Expo Router to remount the root.
        if (pathnameRef.current === '/login' || pathnameRef.current === '/about') {
          console.log('[AUTH_STATE_CHANGED] user=signed-in → navigating to tabs');
          // في وضع PWA standalone نحتاج reload كامل عشان يتحدث الـ view بعد تسجيل الدخول
          const isStandalone = typeof window !== 'undefined' &&
            (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
          if (isStandalone) {
            window.location.replace('/');
          } else {
            router.replace('/(tabs)');
          }
        } else {
          console.log('[AUTH_STATE_CHANGED] user=signed-in → already in app, no navigation');
        }
      } else {
        sessionCleanupRef.current?.();
        sessionCleanupRef.current = null;
        const PUBLIC_ROUTES = ['/login', '/about', '/privacy-policy', '/terms-of-service', '/contact-us'];
        if (!PUBLIC_ROUTES.includes(pathnameRef.current)) {
          console.log('[AUTH_STATE_CHANGED] user=signed-out → navigating to about/login');
          // Root path → about page (public landing), all others → login
          router.replace(pathnameRef.current === '/' ? '/about' : '/login');
        }
      }
    };

    // Fallback: if Firebase never calls back (offline + no cached token), unblock UI after 5s
    // We do NOT call navigate(null) here — we let the user stay on whatever screen they're on
    // and only redirect if we know for certain there is no user.
    const fallbackTimeout = setTimeout(() => {
      console.warn('[AUTH_STATE_CHANGED] fallback timeout — unblocking UI without redirect');
      onReady();
    }, 5000);

    const unsub = onAuthChange(user => {
      console.log('[AUTH_STATE_CHANGED]', user ? `uid=${user.uid}` : 'signed-out');
      // Always clear fallback on first real Firebase callback
      clearTimeout(fallbackTimeout);
      onReady();

      const loggedIn = !!user;
      // Only act when auth state actually changes (prevents double-navigate on rapid events)
      if (lastState !== loggedIn) {
        lastState = loggedIn;
        navigate(user);
      }
    });

    return () => {
      clearTimeout(fallbackTimeout);
      unsub();
      sessionCleanupRef.current?.();
      sessionCleanupRef.current = null;
    };
  }, []);
  return null;
}

function ThemedApp() {
  const { theme } = useApp();
  const systemScheme = useColorScheme();
  const resolvedScheme = theme === 'system' ? (systemScheme ?? 'light') : theme;

  return (
    <>
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
      <StackContent />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = Font.useFonts({ ...Ionicons.font });
  const [authReady, setAuthReady] = useState(false);
  const ready = Platform.OS === 'web' ? true : fontsLoaded;

  useEffect(() => {
    // On web, fonts are already loaded via CSS @font-face — don't block the splash on the JS font loader
    if (Platform.OS === 'web' || fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AppProvider>
            <SidebarProvider>
              <AuthWatcher onReady={() => setAuthReady(true)} />
              {authReady ? (
                <>
                  <ThemedApp />
                  <OfflineBanner />
                  <PWAInstallPrompt />
                  <OnboardingTour />
                </>
              ) : (
                // شاشة انتظار Auth — تمنع الشاشة البيضاء والـ touch warnings
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#021C36' }}>
                  <ActivityIndicator size="large" color="#C3AF76" />
                </View>
              )}
            </SidebarProvider>
          </AppProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
