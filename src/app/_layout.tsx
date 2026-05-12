import '@/lib/notifications-background';

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';

import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_700Bold,
  Outfit_900Black,
  useFonts,
} from '@expo-google-fonts/outfit';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { clearBackendJwt, syncWithBackend } from '@/lib/api';
import { registerAuthSessionResolver } from '@/lib/auth-session';
import {
  auth,
  isProfileOnboardingComplete,
  listenToAuthState,
} from '@/lib/firebase';
import {
  getFcmToken,
  getInitialNotification,
  registerNotificationHandlers,
} from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

type SessionPhase =
  | 'initializing'
  | 'signed_out'
  | 'needs_onboarding'
  | 'signed_in';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const router = useRouter();

  const [phase, setPhase] = useState<SessionPhase>('initializing');

  const [loaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_700Bold,
    Outfit_900Black,
  });

  // 1. Firebase Auth + perfil Firestore (onboarding)
  useEffect(() => {
    let cancelled = false;

    const applyPhase = async (user: FirebaseAuthTypes.User | null) => {
      if (!user) {
        await clearBackendJwt();
        if (!cancelled) setPhase('signed_out');
        return;
      }

      const isPhoneUser = !!user.phoneNumber;
      const isVerified = user.emailVerified || isPhoneUser;

      if (!isVerified) {
        if (!cancelled) setPhase('signed_out');
        return;
      }

      syncWithBackend(user).catch((err) =>
        console.warn('[backend] token refresh failed:', err),
      );

      let complete = false;
      try {
        complete = await isProfileOnboardingComplete(user.uid);
      } catch (e) {
        console.warn('[onboarding] could not read profile:', e);
      }

      if (cancelled) return;
      setPhase(complete ? 'signed_in' : 'needs_onboarding');
    };

    registerAuthSessionResolver(applyPhase);

    const unsubscribe = listenToAuthState(auth, (user) => {
      void applyPhase(user);
    });

    return () => {
      cancelled = true;
      registerAuthSessionResolver(async (_user) => {});
      unsubscribe();
    };
  }, []);

  // 2. FCM solo con sesión completa (tabs)
  useEffect(() => {
    if (phase !== 'signed_in') return;

    let cancelled = false;

    (async () => {
      const token = await getFcmToken();
      if (!cancelled && token && __DEV__) {
        console.log('[fcm:token]', token);
      }

      const initial = await getInitialNotification();
      if (!cancelled && initial && __DEV__) {
        console.log('[fcm:cold-start]', initial.data);
      }
    })();

    const unsubscribe = registerNotificationHandlers({
      onForegroundMessage: (message) => {
        if (__DEV__)
          console.log('[fcm:foreground]', message.notification, message.data);
      },
      onOpened: (message) => {
        if (__DEV__) console.log('[fcm:opened]', message.data);
      },
      onTokenChange: (token) => {
        if (__DEV__) console.log('[fcm:token-refresh]', token);
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [phase]);

  // 3. Guardián: signed_in → tabs; needs_onboarding → /onboarding; signed_out → fuera de tabs
  useEffect(() => {
    if (!loaded || phase === 'initializing') return;

    const s0 = segments[0] as string | undefined;
    const publicAuthRoutes = new Set([
      'login',
      'landing',
      'register',
      'forgot-password',
      'phone-login',
    ]);

    if (phase === 'signed_in') {
      const onGate = !s0 || publicAuthRoutes.has(s0) || s0 === 'onboarding';
      if (onGate) {
        router.replace('/(tabs)' as any);
      }
      return;
    }

    if (phase === 'needs_onboarding') {
      if (s0 !== 'onboarding') {
        router.replace('/onboarding' as any);
      }
      return;
    }

    if (s0 === '(tabs)' || s0 === 'onboarding') {
      router.replace('/login');
    }
  }, [phase, loaded, segments, router]);

  useEffect(() => {
    if (loaded && phase !== 'initializing') {
      SplashScreen.hideAsync();
    }
  }, [loaded, phase]);

  if (!loaded || phase === 'initializing') {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
