import '@/lib/notifications-background';

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_700Bold,
  Outfit_900Black,
  useFonts,
} from '@expo-google-fonts/outfit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  AppState,
  AppStateStatus,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  clearBackendJwt,
  clearGoFareToken,
  getBackendProfile,
  getGoFareToken,
  syncWithBackend,
} from '@/lib/api';
import { registerAuthSessionResolver } from '@/lib/auth-session';
import { auth, listenToAuthState, sigOutAccount } from '@/lib/firebase';
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
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLocked, _setIsLocked] = useState(false);
  const isLockedRef = useRef(false);
  const setIsLocked = useCallback((val: boolean) => {
    isLockedRef.current = val;
    _setIsLocked(val);
  }, []);

  const [biometricsType, setBiometricsType] = useState<string>('Biometría');
  const isAuthenticatingRef = useRef(false);
  const wasInBackground = useRef(false);

  const triggerBiometricUnlock = useCallback(async () => {
    if (isAuthenticatingRef.current) return;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const types =
          await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (
          types.includes(
            LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
          )
        ) {
          setBiometricsType(
            Platform.OS === 'ios' ? 'FaceID' : 'Reconocimiento Facial',
          );
        } else if (
          types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        ) {
          setBiometricsType('Huella Dactilar');
        }

        isAuthenticatingRef.current = true;
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Desbloquear GoFare',
          fallbackLabel: 'Ingresar con contraseña',
          disableDeviceFallback: false,
        });

        if (result.success) {
          setIsLocked(false);
        }
      } else {
        setIsLocked(false);
      }
    } catch (err) {
      console.warn('[Layout] Error during biometric unlock:', err);
      setIsLocked(false);
    } finally {
      // Retrasar el reinicio de isAuthenticatingRef.current permite que las transiciones
      // tardías del AppState del OS al cerrar el modal (que activan 'active') se ignoren correctamente.
      setTimeout(() => {
        isAuthenticatingRef.current = false;
        console.log('[Layout] isAuthenticatingRef reset to false');
      }, 1000);
    }
  }, [setIsLocked]);

  const handleBiometricLogout = async () => {
    try {
      await sigOutAccount();
      await clearBackendJwt();
      setIsLocked(false);
    } catch (err) {
      console.warn('[Layout] Error logging out from lock screen:', err);
    }
  };

  // Escuchar cambios de estado de autenticación y cargar preferencia de biometría
  useEffect(() => {
    if (phase === 'initializing') return;

    if (phase !== 'signed_in') {
      setIsLocked(false);
      return;
    }

    const initBiometricLock = async () => {
      try {
        const savedPref = await AsyncStorage.getItem('isBiometricsEnabled');
        if (savedPref === 'true') {
          setIsLocked(true);
          setTimeout(() => {
            triggerBiometricUnlock();
          }, 300);
        }
      } catch (err) {
        console.warn('[Layout] Error reading biometric preference:', err);
      }
    };

    initBiometricLock();
  }, [phase, triggerBiometricUnlock, setIsLocked]);

  // Escuchar si la app vuelve de segundo plano
  useEffect(() => {
    if (phase !== 'signed_in') return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      console.log('[Layout] AppState change:', nextAppState, {
        isAuthenticating: isAuthenticatingRef.current,
        isLocked: isLockedRef.current,
        wasInBackground: wasInBackground.current,
      });

      if (nextAppState === 'background') {
        if (!isAuthenticatingRef.current) {
          wasInBackground.current = true;
        }
        return;
      }

      if (nextAppState === 'active') {
        if (isAuthenticatingRef.current) {
          console.log(
            '[Layout] Active transition ignored: currently authenticating',
          );
          return;
        }

        const savedPref = await AsyncStorage.getItem('isBiometricsEnabled');
        if (savedPref === 'true') {
          if (wasInBackground.current || isLockedRef.current) {
            console.log(
              '[Layout] Triggering biometric lock. wasInBackground:',
              wasInBackground.current,
              'isLocked:',
              isLockedRef.current,
            );
            wasInBackground.current = false;
            setIsLocked(true);
            setTimeout(() => {
              triggerBiometricUnlock();
            }, 300);
          }
        }
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => {
      subscription.remove();
    };
  }, [phase, triggerBiometricUnlock, setIsLocked]);

  const [loaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_700Bold,
    Outfit_900Black,
  });

  // 1. Firebase Auth + perfil(onboarding) + sincronización de rol
  useEffect(() => {
    let cancelled = false;

    const applyPhase = async (user: FirebaseAuthTypes.User | null) => {
      if (!user) {
        await clearBackendJwt();
        if (!cancelled) setPhase('signed_out');
        return;
      }

      // Intentar recargar el usuario para obtener el estado más reciente de emailVerified
      try {
        await user.reload();
      } catch (reloadErr) {
        console.warn('[Layout] Error al recargar el usuario:', reloadErr);
      }

      const currentUser = auth.currentUser || user;
      const isPhoneUser = !!currentUser.phoneNumber;
      const isVerified = currentUser.emailVerified || isPhoneUser;

      if (!isVerified) {
        if (!cancelled) setPhase('signed_out');
        return;
      }

      let backendUser;
      try {
        const response = await syncWithBackend(currentUser);
        backendUser = response.user;
      } catch (err) {
        console.warn('[backend] token refresh failed:', err);
      }

      let role = null;
      if (backendUser) {
        const roles = (backendUser as any).roles || [];
        const isAdmin = roles.some((r: any) => r.name === 'platform_admin');
        const isOwner = roles.some((r: any) => r.name === 'transport_owner');
        const isDriver = roles.some((r: any) => r.name === 'driver');
        role = isAdmin
          ? 'platform_admin'
          : isOwner
            ? 'transport_owner'
            : isDriver
              ? 'driver'
              : 'passenger';
        await AsyncStorage.setItem('user_role', role);
      } else {
        role = await AsyncStorage.getItem('user_role');
      }

      let complete = false;
      if (
        role === 'driver' ||
        role === 'transport_owner' ||
        role === 'platform_admin'
      ) {
        complete = true;
      } else {
        let userToCheck = backendUser;
        if (!userToCheck) {
          try {
            const cached = await AsyncStorage.getItem(
              'gofare_cached_user_profile',
            );
            if (cached) {
              userToCheck = JSON.parse(cached);
            }
          } catch (cacheErr) {
            console.warn(
              '[Layout] Error al cargar caché del perfil para onboarding check:',
              cacheErr,
            );
          }
        }

        if (userToCheck) {
          const checkObj = userToCheck as any;
          const name = (
            checkObj.displayName ||
            `${checkObj.firstName || ''} ${checkObj.lastName || ''}`.trim() ||
            checkObj.fullName ||
            ''
          ).trim();
          const nameOk = name.length >= 3;

          const rawId = checkObj.nationalId || checkObj.idNumber || '';
          const cleanId =
            typeof rawId === 'string' ? rawId.replace('V-', '').trim() : '';
          const idOk = /^\d{5,10}$/.test(cleanId);

          const phone = checkObj.phoneNumber || '';
          const phoneOk = /^(0412|0414|0424|0416|0426|0212|\+58)\d{7,11}$/.test(
            phone.trim(),
          );

          complete = Boolean(nameOk && idOk && phoneOk);
        }
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

  // Cargar el rol del usuario desde AsyncStorage y verificar con el backend
  useEffect(() => {
    let active = true;
    const loadAndVerifyRole = async () => {
      try {
        const cachedRole = await AsyncStorage.getItem('user_role');
        if (active) {
          setUserRole(cachedRole);
        }

        try {
          const backendUser = await getBackendProfile();
          if (backendUser && active) {
            const roles = (backendUser as any).roles || [];
            const isAdmin = roles.some((r: any) => r.name === 'platform_admin');
            const isOwner = roles.some(
              (r: any) => r.name === 'transport_owner',
            );
            const isDriver = roles.some((r: any) => r.name === 'driver');
            const newRole = isAdmin
              ? 'platform_admin'
              : isOwner
                ? 'transport_owner'
                : isDriver
                  ? 'driver'
                  : 'passenger';

            if (newRole !== cachedRole) {
              console.log('[Layout] User role updated from backend:', newRole);
              await AsyncStorage.setItem('user_role', newRole);
              if (active) {
                setUserRole(newRole);
              }
            }
          }
        } catch (backendErr: any) {
          console.warn(
            '[Layout] Error verifying role with backend in background:',
            backendErr.message || backendErr,
          );
          if (!cachedRole && active) {
            setUserRole('passenger');
          }
        }
      } catch (e) {
        console.warn('[Layout] Error loading role from storage:', e);
      }
    };

    if (phase === 'signed_in') {
      loadAndVerifyRole();
    } else {
      setUserRole(null);
    }

    return () => {
      active = false;
    };
  }, [phase]);

  // 2. FCM solo con sesión completa (tabs)
  useEffect(() => {
    if (phase !== 'signed_in') return;

    let cancelled = false;

    (async () => {
      try {
        const token = await getFcmToken();
        if (!cancelled && token && __DEV__) {
          console.log('[fcm:token]', token);
        }

        const initial = await getInitialNotification();
        if (!cancelled && initial && __DEV__) {
          console.log('[fcm:cold-start]', initial.data);
        }
      } catch (error) {
        console.error('[Layout] Error in FCM initialization:', error);
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

  // 3. Guardián: signed_in → dashboard según rol; needs_onboarding → /onboarding; signed_out → fuera de tabs
  useEffect(() => {
    if (!loaded || phase === 'initializing') return;

    if (phase === 'signed_in' && userRole === null) return; // esperar a tener el rol

    const s0 = segments[0] as string | undefined;
    const publicAuthRoutes = new Set([
      'login',
      'landing',
      'register',
      'forgot-password',
      'phone-login',
      'register-vehicle-owner',
    ]);

    if (phase === 'signed_in') {
      const onGate = !s0 || publicAuthRoutes.has(s0) || s0 === 'onboarding';

      if (onGate) {
        if (userRole === 'platform_admin') {
          router.replace('/admin/dashboard' as any);
        } else if (userRole === 'transport_owner') {
          router.replace('/vehicle-owner/dashboard' as any);
        } else if (userRole === 'driver') {
          router.replace('/driver/dashboard' as any);
        } else {
          router.replace('/(tabs)' as any);
        }
      } else {
        // Verificar correspondencia de rol si intenta navegar
        if (userRole === 'platform_admin') {
          if (s0 !== 'admin') {
            router.replace('/admin/dashboard' as any);
          }
        } else if (userRole === 'transport_owner') {
          if (s0 === '(tabs)' || s0 === 'driver' || s0 === 'admin') {
            router.replace('/vehicle-owner/dashboard' as any);
          }
        } else if (userRole === 'driver') {
          if (s0 === '(tabs)' || s0 === 'vehicle-owner' || s0 === 'admin') {
            router.replace('/driver/dashboard' as any);
          }
        } else {
          // Passenger
          if (s0 === 'vehicle-owner' || s0 === 'driver' || s0 === 'admin') {
            router.replace('/(tabs)' as any);
          }
        }
      }
      return;
    }

    if (phase === 'needs_onboarding') {
      if (s0 !== 'onboarding') {
        router.replace('/onboarding' as any);
      }
      return;
    }

    if (phase === 'signed_out') {
      const isPublic = s0 && publicAuthRoutes.has(s0);
      if (!isPublic) {
        router.replace('/landing');
      }
    }
  }, [phase, loaded, segments, router, userRole]);

  useEffect(() => {
    console.log('[Layout] Ready state check:', { loaded, phase });
    if (loaded && phase !== 'initializing') {
      console.log('[Layout] Hiding splash screen...');
      SplashScreen.hideAsync().catch((err) => {
        console.error('[Layout] Error hiding splash screen:', err);
      });
    }
  }, [loaded, phase]);

  // Timeout de seguridad para evitar que la app se quede colgada si Firebase/fuentes tardan
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (phase === 'initializing') {
        console.warn(
          '[Layout] Auth state resolution timed out (4s). Falling back to signed_out.',
        );
        setPhase('signed_out');
      }
    }, 4000);

    return () => clearTimeout(timeoutId);
  }, [phase]);

  if (!loaded || phase === 'initializing') {
    return null;
  }

  if (isLocked) {
    return (
      <SafeAreaView style={styles.lockContainer}>
        <StatusBar style="light" />
        <View style={styles.lockHeader}>
          <Ionicons
            name="navigate"
            size={48}
            color="#0EA5E9"
            style={styles.lockLogo}
          />
          <Text style={styles.lockAppName}>GoFare</Text>
        </View>

        <View style={styles.lockBody}>
          <Pressable
            onPress={triggerBiometricUnlock}
            style={styles.fingerprintBtn}
          >
            <Ionicons name="finger-print" size={80} color="#0EA5E9" />
          </Pressable>
          <Text style={styles.lockTitle}>Desbloqueo con {biometricsType}</Text>
          <Text style={styles.lockSubtitle}>
            Toca el sensor o escanea tu rostro para acceder a GoFare.
          </Text>

          <Pressable
            style={styles.unlockActionBtn}
            onPress={triggerBiometricUnlock}
          >
            <Text style={styles.unlockActionText}>Desbloquear</Text>
          </Pressable>
        </View>

        <View style={styles.lockFooter}>
          <Pressable
            style={styles.switchAccountBtn}
            onPress={handleBiometricLogout}
          >
            <Text style={styles.switchAccountText}>Cerrar Sesión</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  lockContainer: {
    flex: 1,
    backgroundColor: '#0F172A', // Slate 900 (Fondo oscuro premium)
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 48,
  },
  lockHeader: {
    alignItems: 'center',
    marginTop: 40,
  },
  lockLogo: {
    marginBottom: 8,
  },
  lockAppName: {
    fontSize: 24,
    fontFamily: 'Outfit_700Bold',
    color: '#F8FAFC',
    letterSpacing: 1.5,
  },
  lockBody: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  fingerprintBtn: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#1E293B', // Slate 800
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#38BDF8', // Sky 400
    // Sombras
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  lockTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  lockSubtitle: {
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    color: '#94A3B8', // Slate 400
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  unlockActionBtn: {
    backgroundColor: '#0EA5E9', // Sky 500
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  unlockActionText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
  },
  lockFooter: {
    marginBottom: 20,
  },
  switchAccountBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  switchAccountText: {
    color: '#EF4444', // Red 500
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
  },
});
