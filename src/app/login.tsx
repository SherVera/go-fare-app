import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { LoginFormState } from '@/interfaces';
import {
  createFareAccount,
  getFareAccountByUserId,
  loginWithFirebaseToken,
  syncWithBackend,
} from '@/lib/api';
import {
  auth,
  sendVerificationEmail,
  signIn,
  signInWithGoogle,
  sigOutAccount,
} from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

export default function LoginScreen() {
  const router = useRouter();
  // Estado del formulario — tipado por LoginFormState
  const [email, setEmail] = useState<LoginFormState['email']>('');
  const [password, setPassword] = useState<LoginFormState['password']>('');
  const [showPassword, setShowPassword] =
    useState<LoginFormState['showPassword']>(false);
  const [loading, setLoading] = useState<LoginFormState['loading']>(false);

  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const [biometricsType, setBiometricsType] = useState('Biometría');

  useEffect(() => {
    const checkSavedCredentials = async () => {
      try {
        const savedEmail = await SecureStore.getItemAsync('savedEmail');
        const savedPassword = await SecureStore.getItemAsync('savedPassword');
        const savedPref = await AsyncStorage.getItem('isBiometricsEnabled');
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (
          savedEmail &&
          savedPassword &&
          savedPref === 'true' &&
          hasHardware &&
          isEnrolled
        ) {
          setHasSavedCredentials(true);
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
        }
      } catch (err) {
        console.warn('[Login] Error checking saved credentials:', err);
      }
    };
    checkSavedCredentials();
  }, []);

  const handleBiometricLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Inicia sesión con tu ${biometricsType}`,
        fallbackLabel: 'Usar contraseña',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setLoading(true);
        const savedEmail = await SecureStore.getItemAsync('savedEmail');
        const savedPassword = await SecureStore.getItemAsync('savedPassword');

        if (savedEmail && savedPassword) {
          setEmail(savedEmail);
          setPassword(savedPassword);

          const userCredential = await signIn({
            email: savedEmail,
            password: savedPassword,
          });

          const idToken = await userCredential.user.getIdToken();
          const { user: backendUser } = await loginWithFirebaseToken(idToken);

          try {
            await getFareAccountByUserId(backendUser.id);
          } catch {
            try {
              await createFareAccount(backendUser.id);
            } catch (createError) {
              console.warn(
                '[Login] Error al crear la cuenta de tarifa:',
                createError,
              );
            }
          }

          const roles = (backendUser as any).roles || [];
          const isAdmin = roles.some(
            (role: any) =>
              role.name === 'platform_admin' || role.name === 'admin',
          );
          const isOwner = roles.some(
            (role: any) => role.name === 'transport_owner',
          );
          const isDriver = roles.some((role: any) => role.name === 'driver');

          let biometricRole = isAdmin
            ? 'platform_admin'
            : isOwner
              ? 'transport_owner'
              : isDriver
                ? 'driver'
                : 'passenger';

          // Fallback a Firebase Custom Claims si el backend devuelve 'passenger'
          if (biometricRole === 'passenger') {
            try {
              const fbUser = auth.currentUser;
              if (fbUser) {
                const idTokenResult = await fbUser.getIdTokenResult(false);
                const claimRole = (idTokenResult.claims as any)?.role as
                  | string
                  | undefined;
                const PRIVILEGED_ROLES = [
                  'platform_admin',
                  'admin',
                  'transport_owner',
                  'driver',
                ];
                if (claimRole && PRIVILEGED_ROLES.includes(claimRole)) {
                  biometricRole = claimRole;
                }
              }
            } catch {}
          }

          await AsyncStorage.setItem('user_role', biometricRole);
          if (biometricRole === 'platform_admin' || biometricRole === 'admin') {
            router.replace('/admin/dashboard' as any);
          } else if (biometricRole === 'transport_owner') {
            router.replace('/vehicle-owner/dashboard' as any);
          } else if (biometricRole === 'driver') {
            router.replace('/driver/dashboard' as any);
          } else {
            router.replace('/(tabs)' as any);
          }
        }
      }
    } catch (err) {
      console.warn('[Login] Error during biometric login:', err);
      Alert.alert(
        'Error',
        'Hubo un error al intentar autenticar con biometría.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/landing');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const credential = await signInWithGoogle();
      if (credential.user) {
        try {
          await syncWithBackend(credential.user);
        } catch (backendErr) {
          console.warn('[google] backend sync failed:', backendErr);
          try {
            await sigOutAccount();
          } catch {}
          Alert.alert(
            'Error de Conexión',
            'No se pudo conectar con el servidor para sincronizar tu cuenta. Por favor, verifica tu conexión a internet e inténtalo de nuevo.',
          );
          setLoading(false);
          return;
        }
      }
    } catch (error: any) {
      if (error?.code === 'auth/cancelled') return;
      if (error?.code === 'auth/internal-error' && __DEV__) {
        console.error('[google] auth/internal-error:', error);
      }
      const msg =
        error?.code === 'auth/internal-error'
          ? 'Error interno de Firebase (en Android suele faltar SHA-1/SHA-256 en la consola, o hace falta rebuild tras cambiar google-services).'
          : (error?.message ?? 'No se pudo iniciar sesión con Google.');
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    // Validaciones básicas de formato
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert(
        'Atención',
        'Por favor, ingresa un correo electrónico válido.',
      );
      return;
    }
    if (trimmedPassword.length < 6) {
      Alert.alert(
        'Atención',
        'La contraseña debe tener al menos 6 caracteres.',
      );
      return;
    }

    try {
      setLoading(true);

      // Autenticar con Firebase
      const userCredential = await signIn({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      // Recargar el usuario para asegurarnos de tener el estado de verificación más reciente
      try {
        await userCredential.user.reload();
      } catch (reloadErr) {
        console.warn('[Login] Error al recargar el usuario:', reloadErr);
      }

      const currentUser = auth.currentUser || userCredential.user;

      // Bloquear acceso si el correo no ha sido verificado
      if (!currentUser.emailVerified) {
        // Cerrar sesión para no dejar al usuario en un estado intermedio
        try {
          await sigOutAccount();
        } catch {
          /* Ignorar errores de cierre de sesión; el guardián de rutas ya maneja el estado */
        }
        Alert.alert(
          'Correo No Verificado',
          'Por favor, verifica tu correo antes de iniciar sesión.\n\nSi no ves el correo, revisa tu carpeta de Spam o Promociones y agrega noreply@go-fare-dev-e7501.firebaseapp.com a tus contactos.',
          [
            { text: 'Cerrar', style: 'cancel' },
            {
              text: 'Reenviar Correo',
              onPress: async () => {
                try {
                  // Necesitamos volver a autenticar brevemente para enviar el correo
                  const temp = await signIn({
                    email: trimmedEmail,
                    password: trimmedPassword,
                  });
                  if (temp.user) {
                    await sendVerificationEmail(temp.user);
                    await sigOutAccount();
                    Alert.alert(
                      'Correo Enviado',
                      'Se ha enviado un nuevo correo de verificación.',
                    );
                  }
                } catch {
                  Alert.alert(
                    'Error',
                    'No se pudo enviar el correo. Intenta de nuevo más tarde.',
                  );
                }
              },
            },
          ],
        );
        return;
      }

      // Correo verificado — sincronizar con backend y permitir acceso
      let backendUser;
      try {
        const response = await syncWithBackend(currentUser);
        backendUser = response.user;
      } catch (backendError) {
        console.warn('[backend] sync failed:', backendError);
        // Cerrar sesión localmente en Firebase para mantener consistencia
        try {
          await sigOutAccount();
        } catch {}
        Alert.alert(
          'Error de Conexión',
          'No se pudo conectar con el servidor para sincronizar tu cuenta. Por favor, verifica tu conexión a internet e inténtalo de nuevo.',
        );
        setLoading(false);
        return; // Detener flujo de inicio de sesión!
      }

      // Guardar credenciales encriptadas para inicio rápido
      try {
        const savedPref = await AsyncStorage.getItem('isBiometricsEnabled');
        if (savedPref === 'true') {
          await SecureStore.setItemAsync('savedEmail', trimmedEmail);
          await SecureStore.setItemAsync('savedPassword', trimmedPassword);
        }
      } catch (storeError) {
        console.warn(
          '[Login] Error saving credentials to SecureStore:',
          storeError,
        );
      }

      // Sincronizar o crear la cuenta de tarifa (Fare Account) del usuario
      try {
        await getFareAccountByUserId(backendUser.id);
      } catch {
        try {
          await createFareAccount(backendUser.id);
        } catch (createError) {
          console.warn(
            '[Login] Error al crear la cuenta de tarifa:',
            createError,
          );
        }
      }

      const roles = (backendUser as any).roles || [];
      const isAdmin = roles.some(
        (role: any) => role.name === 'platform_admin' || role.name === 'admin',
      );
      const isOwner = roles.some(
        (role: any) => role.name === 'transport_owner',
      );
      const isDriver = roles.some((role: any) => role.name === 'driver');
      let userRole = isAdmin
        ? 'platform_admin'
        : isOwner
          ? 'transport_owner'
          : isDriver
            ? 'driver'
            : 'passenger';

      // Fallback a Firebase Custom Claims si el backend devuelve 'passenger'
      if (userRole === 'passenger') {
        try {
          const fbUser = auth.currentUser;
          if (fbUser) {
            const idTokenResult = await fbUser.getIdTokenResult(false);
            const claimRole = (idTokenResult.claims as any)?.role as
              | string
              | undefined;
            const PRIVILEGED_ROLES = [
              'platform_admin',
              'admin',
              'transport_owner',
              'driver',
            ];
            if (claimRole && PRIVILEGED_ROLES.includes(claimRole)) {
              console.log('[Login] Usando Custom Claim para rol:', claimRole);
              userRole = claimRole;
            }
          }
        } catch (claimErr) {
          console.warn('[Login] Error leyendo custom claims:', claimErr);
        }
      }

      await AsyncStorage.setItem('user_role', userRole);

      if (userRole === 'platform_admin' || userRole === 'admin') {
        router.replace('/admin/dashboard' as any);
      } else if (userRole === 'transport_owner') {
        router.replace('/vehicle-owner/dashboard' as any);
      } else if (userRole === 'driver') {
        router.replace('/driver/dashboard' as any);
      } else {
        router.replace('/(tabs)' as any);
      }
    } catch (error: any) {
      console.warn('Login error:', error);
      // Manejar errores comunes de Firebase Auth con mensajes claros
      if (
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/user-not-found'
      ) {
        Alert.alert(
          'Error',
          'Correo o contraseña inválidos. Intenta de nuevo.',
        );
      } else if (error.code === 'auth/too-many-requests') {
        Alert.alert(
          'Error',
          'Demasiados intentos fallidos. Intenta de nuevo más tarde.',
        );
      } else if (error.code === 'auth/network-request-failed') {
        Alert.alert('Error', 'Error de red. Revisa tu conexión a internet.');
      } else if (error.code === 'auth/internal-error') {
        if (__DEV__) {
          console.error(
            '[login] auth/internal-error (revisa Logcat / Xcode):',
            error,
          );
        }
        Alert.alert(
          'Error de autenticación',
          'Firebase devolvió un error interno. Lo más habitual en desarrollo:\n\n' +
            '• Android: registra las huellas SHA-1 y SHA-256 del keystore de debug en Firebase Console (Ajustes del proyecto → tu app Android).\n' +
            '• Tras cambiar google-services.json o GoogleService-Info.plist, haz un rebuild nativo (npx expo run:android / run:ios).\n' +
            '• Confirma que el proveedor Email/contraseña está activado en Authentication.\n\n' +
            'Si usas Google, revisa también EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.',
        );
      } else {
        Alert.alert(
          'Error',
          error.message || 'Ocurrió un error al iniciar sesión.',
        );
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Blob decorativo */}
      <View style={styles.blob} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScreenHeader title="Iniciar Sesión" onBack={handleBack} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── SECCIÓN DEL ÍCONO ── */}
          <View style={styles.iconSection}>
            <View style={styles.fakeShadow} />
            <View style={styles.iconCard}>
              <View style={styles.topShine} />
              <MaterialCommunityIcons
                name="shield-account"
                size={96}
                color={tokens.colors.primary}
              />
            </View>
          </View>

          {/* ── TÍTULOS ── */}
          <View style={styles.titleBlock}>
            <Text style={styles.titleDark}>Bienvenido</Text>
            <Text style={styles.titleBlue}>de Nuevo</Text>
            <Text style={styles.subtitle}>
              {`Inicia sesión en tu cuenta para\ncontinuar tu viaje.`}
            </Text>
          </View>

          {/* ── INPUT EMAIL ── */}
          <Text style={styles.inputLabel}>CORREO ELECTRÓNICO</Text>
          <View style={styles.inputCard}>
            <Ionicons name="mail-outline" size={20} color="#3072ffe7" />
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="email@example.com"
              placeholderTextColor="#B8C4D4"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              selectionColor={tokens.colors.primary}
              editable={!loading}
            />
          </View>

          {/* ── INPUT PASSWORD ── */}
          <Text style={styles.inputLabel}>CONTRASEÑA</Text>
          <View style={styles.inputCard}>
            <Ionicons name="lock-closed-outline" size={20} color="#3072ffe7" />
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="******"
              placeholderTextColor="#B8C4D4"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              selectionColor={tokens.colors.primary}
              editable={!loading}
            />
            {/* Botón para mostrar u ocultar la contraseña */}
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={10}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#8594AB"
              />
            </Pressable>
          </View>

          {/* ── OLVIDÉ MI CONTRASEÑA ── */}
          <View style={styles.forgotRow}>
            <Pressable
              onPress={() => router.push('/forgot-password' as any)}
              hitSlop={10}
            >
              <Text style={styles.forgotLink}>¿Olvidaste tu contraseña?</Text>
            </Pressable>
          </View>

          {/* ── NOTA DE SEGURIDAD ── */}
          <View style={styles.secureRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={13}
              color={tokens.colors.primary}
              style={{ marginTop: 1, marginRight: 6 }}
            />
            <Text style={styles.secureText}>
              Tu cuenta está protegida por Firebase Authentication.
            </Text>
          </View>

          <View style={{ flex: 1, minHeight: 48 }} />

          {/* ── BOTONES DE ACCESO ── */}
          <View style={hasSavedCredentials ? styles.ctaRow : null}>
            <Pressable
              style={({ pressed }) => [
                styles.cta,
                hasSavedCredentials && {
                  flex: 1,
                  marginRight: 12,
                  marginBottom: 0,
                },
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                loading && { opacity: 0.7 },
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.ctaText}>Iniciar Sesión</Text>
                  <Ionicons
                    name="arrow-forward-circle-outline"
                    size={20}
                    color="#fff"
                    style={{ marginLeft: 10 }}
                  />
                </>
              )}
            </Pressable>

            {hasSavedCredentials && (
              <Pressable
                style={({ pressed }) => [
                  styles.biometricCtaBtn,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
                  loading && { opacity: 0.7 },
                ]}
                onPress={handleBiometricLogin}
                disabled={loading}
              >
                <Ionicons
                  name="finger-print"
                  size={28}
                  color={tokens.colors.primary}
                />
              </Pressable>
            )}
          </View>

          {/* ── SEPARADOR ── */}
          <View style={styles.separatorRow}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>o continuar con</Text>
            <View style={styles.separatorLine} />
          </View>

          {/* ── BOTÓN TELÉFONO ── */}
          <Pressable
            style={({ pressed }) => [
              styles.socialBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              loading && { opacity: 0.6 },
            ]}
            onPress={() => router.push('/phone-login' as any)}
            disabled={loading}
          >
            <Ionicons
              name="call-outline"
              size={22}
              color={tokens.colors.primary}
            />
            <Text style={styles.socialBtnText}>Continuar con Teléfono</Text>
          </Pressable>

          {/* ── BOTÓN GOOGLE (solo si está configurado) ── */}
          {!!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID && (
            <Pressable
              style={({ pressed }) => [
                styles.socialBtn,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                loading && { opacity: 0.6 },
              ]}
              onPress={handleGoogleLogin}
              disabled={loading}
            >
              <MaterialCommunityIcons name="google" size={22} color="#DB4437" />
              <Text style={styles.socialBtnText}>Continuar con Google</Text>
            </Pressable>
          )}

          {/* ── LINK A REGISTRO ── */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>¿No tienes una cuenta? </Text>
            <Pressable onPress={() => router.push('/register' as any)}>
              <Text style={styles.registerLink}>Regístrate</Text>
            </Pressable>
          </View>

          {/* ── LINK REGISTRO DUEÑO VEHÍCULO ── */}
          <View
            style={[
              styles.registerContainer,
              { marginTop: -20, marginBottom: 28 },
            ]}
          >
            <Text style={styles.registerText}>¿Eres dueño de vehículo? </Text>
            <Pressable
              onPress={() => router.push('/register-vehicle-owner' as any)}
            >
              <Text style={styles.registerLink}>Envía tu solicitud aquí</Text>
            </Pressable>
          </View>

          {/* ── FOOTER ── */}
          <View style={styles.footerRow}>
            <Text style={styles.footerHelp}>¿Necesitas ayuda?</Text>
            <Text style={styles.footerBullet}> • </Text>
            <Text style={styles.footerSupport}>Soporte Técnico</Text>
          </View>
          <Text style={styles.footerLegal}>
            CARACAS MOVE • VERIFICACIÓN SEGURA
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ECF1F9',
  },
  blob: {
    position: 'absolute',
    top: 90,
    right: 24,
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#B8C8DF',
    opacity: 0.6,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 4,
    paddingBottom: 36,
  },
  iconSection: {
    alignItems: 'center',
    marginBottom: 44,
  },
  fakeShadow: {
    position: 'absolute',
    width: 148,
    height: 136,
    borderRadius: 30,
    backgroundColor: '#91B4E0',
    opacity: 0.3,
    top: 18,
    transform: [{ scaleX: 0.9 }],
  },
  iconCard: {
    width: 160,
    height: 148,
    backgroundColor: '#D6E5F8',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#5080C0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  topShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: '#EBF4FF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    opacity: 0.75,
  },
  titleBlock: { marginBottom: 32 },
  titleDark: {
    fontSize: 38,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#18243E',
    lineHeight: 44,
  },
  titleBlue: {
    fontSize: 38,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
    lineHeight: 44,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#6B7A93',
    lineHeight: 22,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 1.1,
    marginBottom: 10,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 60,
    marginBottom: 14,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#D4DEEC',
    marginHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#18243E',
    includeFontPadding: false,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  secureText: {
    flex: 1,
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#8594AB',
    lineHeight: 17,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  forgotLink: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  cta: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: 16,
    height: 60,
    marginBottom: 28,
    shadowColor: '#1D5BD9',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 28,
  },
  biometricCtaBtn: {
    width: 60,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: tokens.colors.primary,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  ctaText: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 36,
  },
  registerText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#6B7A93',
  },
  registerLink: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  footerHelp: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#6B7A93',
  },
  footerBullet: {
    fontSize: 13,
    color: '#B0BCCC',
  },
  footerSupport: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  footerLegal: {
    textAlign: 'center',
    fontSize: 9.5,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#B0BCCC',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D4DEEC',
  },
  separatorText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
    marginHorizontal: 12,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    height: 56,
    marginBottom: 12,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2EAF4',
  },
  socialBtnText: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
    marginLeft: 10,
  },
});
