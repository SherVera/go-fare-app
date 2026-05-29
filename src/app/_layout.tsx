import '@/lib/notifications-background';

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';

import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_700Bold,
  Outfit_900Black,
  useFonts,
} from '@expo-google-fonts/outfit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { getGoFareToken, loginWithFirebaseToken, clearGoFareToken, getBackendProfile } from '@/lib/api';
import { auth, listenToAuthState, sigOutAccount } from '@/lib/firebase';
import { AppState, AppStateStatus, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  getFcmToken,
  getInitialNotification,
  registerNotificationHandlers,
} from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const router = useRouter();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
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
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
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
      await clearGoFareToken();
      setIsAuthenticated(false);
      setIsLocked(false);
    } catch (err) {
      console.warn('[Layout] Error logging out from lock screen:', err);
    }
  };

  // Escuchar cambios de estado de autenticación y cargar preferencia de biometría
  useEffect(() => {
    if (isAuthenticated === null) return;

    if (!isAuthenticated) {
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
  }, [isAuthenticated, triggerBiometricUnlock, setIsLocked]);

  // Cargar el rol del usuario desde AsyncStorage y verificar con el backend
  useEffect(() => {
    let active = true;
    const loadAndVerifyRole = async () => {
      try {
        // 1. Primero, intentar cargar el rol guardado en caché para un inicio rápido
        const cachedRole = await AsyncStorage.getItem('user_role');
        if (active) {
          setUserRole(cachedRole);
        }

        // 2. Luego, consultar al backend en segundo plano para verificar si el rol cambió
        try {
          const backendUser = await getBackendProfile();
          if (backendUser && active) {
            const roles = (backendUser as any).roles || [];
            const isOwner = roles.some((role: any) => role.name === 'transport_owner');
            const isDriver = roles.some((role: any) => role.name === 'driver');
            const newRole = isOwner ? 'transport_owner' : isDriver ? 'driver' : 'passenger';
            
            if (newRole !== cachedRole) {
              console.log('[Layout] User role updated from backend:', newRole);
              await AsyncStorage.setItem('user_role', newRole);
              if (active) {
                setUserRole(newRole);
              }
            }
          }
        } catch (backendErr: any) {
          console.warn('[Layout] Error verifying role with backend in background:', backendErr.message || backendErr);
        }
      } catch (e) {
        console.warn('[Layout] Error loading role from storage:', e);
      }
    };

    if (isAuthenticated) {
      loadAndVerifyRole();
    } else {
      setUserRole(null);
    }

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  // Escuchar si la app vuelve de segundo plano
  useEffect(() => {
    if (isAuthenticated === null || !isAuthenticated) return;

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
          console.log('[Layout] Active transition ignored: currently authenticating');
          return;
        }

        const savedPref = await AsyncStorage.getItem('isBiometricsEnabled');
        if (savedPref === 'true') {
          if (wasInBackground.current || isLockedRef.current) {
            console.log(
              '[Layout] Triggering biometric lock. wasInBackground:',
              wasInBackground.current,
              'isLocked:',
              isLockedRef.current
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
  }, [isAuthenticated, triggerBiometricUnlock, setIsLocked]);

  const [loaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_700Bold,
    Outfit_900Black,
  });

  // 1. Escuchar el estado de autenticación de Firebase Nativo y sincronizar con backend
  useEffect(() => {
    try {
      console.log('[Layout] Setting up auth state listener...');
      const unsubscribe = listenToAuthState(
        auth,
        async (user: FirebaseAuthTypes.User | null) => {
          console.log('[Layout] Auth state changed, user exists:', !!user);
          try {
            if (user) {
              console.log('[Layout] User is verified:', user.emailVerified);
              if (user.emailVerified) {
                try {
                  // Obtener token JWT local de GoFare
                  const localToken = await getGoFareToken();
                  console.log(
                    '[Layout] Local GoFare token exists:',
                    !!localToken,
                  );
                  if (!localToken) {
                    // Intercambiar token de Firebase por JWT de GoFare si no existe localmente
                    console.log(
                      '[Layout] Exchanging Firebase token for GoFare JWT...',
                    );
                    const idToken = await user.getIdToken();
                    await loginWithFirebaseToken(idToken);
                  }
                  setIsAuthenticated(true);
                } catch (error: any) {
                  console.warn(
                    '[Layout] Error syncing auth with GoFare backend:',
                    error,
                  );
                  // Si el error es de autorización (Unauthorized), no permitimos el ingreso.
                  // Forzamos el cierre de sesión en Firebase y revocamos el estado.
                  if (error?.message === 'Unauthorized') {
                    setIsAuthenticated(false);
                    try {
                      sigOutAccount();
                    } catch (logoutError) {
                      console.warn('[Layout] Error logging out:', logoutError);
                    }
                  } else {
                    // Permitimos la navegación para resiliencia offline o fallas transitorias de API
                    setIsAuthenticated(true);
                  }
                }
              } else {
                setIsAuthenticated(false);
              }
            } else {
              // 🚧 Modo temporal: verificar si hay sesión por cédula guardada
              console.log('[Layout] No user session. Checking temp_auth...');
              const tempAuth = await AsyncStorage.getItem('temp_auth');
              console.log('[Layout] temp_auth:', tempAuth);
              setIsAuthenticated(tempAuth === 'true');
            }
          } catch (error) {
            console.warn(
              '[Layout] Error in auth state listener callback:',
              error,
            );
            setIsAuthenticated(false);
          }
        },
      );
      return unsubscribe;
    } catch (error) {
      console.warn('[Layout] Error setting up auth state listener:', error);
      setIsAuthenticated(false);
    }
  }, []);

  // 2. Notificaciones FCM: registrar handlers + obtener token al iniciar sesión.
  // Solo se ejecuta cuando hay sesión, para evitar pedir permisos en el landing.
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    (async () => {
      try {
        const token = await getFcmToken();
        if (!cancelled && token && __DEV__) {
          console.log('[fcm:token]', token);
        }
        // TODO: enviar `token` al backend asociado al usuario actual.

        const initial = await getInitialNotification();
        if (!cancelled && initial && __DEV__) {
          console.log('[fcm:cold-start]', initial.data);
        }
        // TODO: navegar según `initial.data` (deep link).
      } catch (error) {
        console.error('[Layout] Error in FCM initialization:', error);
      }
    })();

    const unsubscribe = registerNotificationHandlers({
      onForegroundMessage: (message) => {
        if (__DEV__)
          console.log('[fcm:foreground]', message.notification, message.data);
        // TODO: mostrar toast/in-app banner con `message.notification`.
      },
      onOpened: (message) => {
        if (__DEV__) console.log('[fcm:opened]', message.data);
        // TODO: navegar según `message.data`.
      },
      onTokenChange: (token) => {
        if (__DEV__) console.log('[fcm:token-refresh]', token);
        // TODO: re-enviar `token` al backend.
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isAuthenticated]);

  // 3. Guardián Global de Rutas (Auth Guard de Expo Router)
  // biome-ignore lint/correctness/useExhaustiveDependencies: router is stable; adding router.replace avoids intentional redirects loop noise
  useEffect(() => {
    // Esperamos a que las fuentes carguen y Firebase responda si hay sesión
    if (!loaded || isAuthenticated === null) return;
    // Si el usuario está autenticado, esperamos a que cargue su rol para evitar desvíos incorrectos
    if (isAuthenticated && userRole === null) return;

    const publicRoutes = ['landing', 'login', 'register', 'forgot-password', 'register-vehicle-owner'];
    const isPublicRoute = publicRoutes.includes(segments[0]);

    console.log('[Layout] Auth Guard evaluation:', {
      isAuthenticated,
      isPublicRoute,
      currentSegment: segments[0],
      userRole,
    });

    if (isAuthenticated) {
      if (isPublicRoute) {
        // Si tiene sesión activa pero intenta acceder a pantallas públicas, forzar redirección
        if (userRole === 'transport_owner') {
          console.log('[Layout] Redirecting to owner dashboard...');
          router.replace('/vehicle-owner/dashboard' as any);
        } else if (userRole === 'driver') {
          console.log('[Layout] Redirecting to driver dashboard...');
          router.replace('/driver/dashboard' as any);
        } else {
          console.log('[Layout] Redirecting to (tabs)...');
          router.replace('/(tabs)' as any);
        }
      } else {
        // Si tiene sesión activa y está en pantallas privadas, verificar correspondencia de rol
        if (userRole === 'transport_owner') {
          if ((segments[0] as string) === '(tabs)' || (segments[0] as string) === 'driver') {
            console.log('[Layout] Owner trying to access other panels, redirecting to dashboard...');
            router.replace('/vehicle-owner/dashboard' as any);
          }
        } else if (userRole === 'driver') {
          if ((segments[0] as string) === '(tabs)' || (segments[0] as string) === 'vehicle-owner') {
            console.log('[Layout] Driver trying to access other panels, redirecting to dashboard...');
            router.replace('/driver/dashboard' as any);
          }
        } else {
          // Passenger
          if ((segments[0] as string) === 'vehicle-owner' || (segments[0] as string) === 'driver') {
            console.log('[Layout] Passenger trying to access restricted panels, redirecting to (tabs)...');
            router.replace('/(tabs)' as any);
          }
        }
      }
    } else if (!isPublicRoute) {
      // Si no tiene sesión pero intenta entrar a pantallas privadas, expulsarlo al Landing
      console.log('[Layout] Redirecting to landing...');
      router.replace('/landing');
    }
  }, [isAuthenticated, loaded, segments, userRole]);

  // 4. Ocultar la pantalla de carga solo cuando tengamos fuentes y sesión verificada
  useEffect(() => {
    console.log('[Layout] Ready state check:', { loaded, isAuthenticated });
    if (loaded && isAuthenticated !== null) {
      console.log('[Layout] Hiding splash screen...');
      SplashScreen.hideAsync().catch((err) => {
        console.error('[Layout] Error hiding splash screen:', err);
      });
    }
  }, [loaded, isAuthenticated]);

  // 5. Timeout de seguridad para evitar que la app se quede colgada si Firebase/fuentes tardan
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isAuthenticated === null) {
        console.warn(
          '[Layout] Auth state resolution timed out (4s). Falling back to false.',
        );
        setIsAuthenticated(false);
      }
    }, 4000);

    return () => clearTimeout(timeoutId);
  }, [isAuthenticated]);

  if (!loaded || isAuthenticated === null) {
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
          <Text style={styles.lockAppName}>GoFair</Text>
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
