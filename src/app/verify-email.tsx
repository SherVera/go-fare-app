import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  clearBackendJwt,
  createBackendUser,
  createFareAccount,
  resolveRoleUuid,
  syncWithBackend,
  updateBackendProfile,
} from '@/lib/api';
import { refreshAuthSessionPhase } from '@/lib/auth-session';
import { auth, sendVerificationEmail, sigOutAccount } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    email?: string;
    fullName?: string;
    phoneNumber?: string;
    idNumber?: string;
  }>();
  const [loading, setLoading] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<{
    fullName?: string;
    phoneNumber?: string;
    idNumber?: string;
  } | null>(null);

  const registeredEmail =
    params.email || auth.currentUser?.email || 'tu correo';

  // Al montar, recuperar el perfil pendiente de AsyncStorage como fallback por si se recarga la app
  useEffect(() => {
    const loadPendingProfile = async () => {
      try {
        const stored = await AsyncStorage.getItem('gofare_pending_profile');
        if (stored) {
          setPendingProfile(JSON.parse(stored));
        }
      } catch (err) {
        console.warn('[Verify Email] Error loading pending profile:', err);
      }
    };
    loadPendingProfile();
  }, []);

  // Polling para verificar si el correo ya ha sido confirmado
  useEffect(() => {
    let intervalId: any;
    let isActive = true;

    const checkVerification = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          await currentUser.reload();
          if (currentUser.emailVerified && isActive) {
            clearInterval(intervalId);

            const finalFullName =
              params.fullName || pendingProfile?.fullName || '';
            const finalPhoneNumber =
              params.phoneNumber || pendingProfile?.phoneNumber || '';
            const finalIdNumber =
              params.idNumber || pendingProfile?.idNumber || '';

            // 1. Sincronizar el usuario verificado con el backend para crearlo en PostgreSQL (users / user_roles)
            let backendUser: any = null;
            try {
              // Si tenemos el teléfono del registro, intentar crear el usuario local primero
              // para asegurar que el phoneNumber quede registrado en PostgreSQL (ya que PUT /users no lo permite)
              if (finalPhoneNumber) {
                try {
                  const roleUuid = await resolveRoleUuid('passenger');
                  const parts = finalFullName.split(/\s+/);
                  const firstName = parts[0] || '';
                  const lastName = parts.slice(1).join(' ') || '';

                  await createBackendUser({
                    provider: 'local',
                    providerId: currentUser.uid,
                    email: currentUser.email || undefined,
                    phoneNumber: finalPhoneNumber || undefined,
                    firstName,
                    lastName,
                    displayName: finalFullName,
                    roleIds: roleUuid ? [roleUuid] : [],
                  });
                  console.log(
                    '[Verify Email Polling] Usuario creado preventivamente en PostgreSQL con teléfono.',
                  );
                } catch (createErr) {
                  // Conflicto (409) es normal si ya fue creado en la pantalla de registro
                  console.log(
                    '[Verify Email Polling] Creación preventiva saltada o ya existente:',
                    createErr,
                  );
                }
              }

              const res = await syncWithBackend(currentUser);
              backendUser = res.user;
            } catch (syncErr) {
              console.warn(
                '[Verify Email Polling] Error syncing with backend:',
                syncErr,
              );
            }

            // 1b. Si tenemos parámetros locales de registro, actualizar el perfil del backend de inmediato
            if (
              backendUser &&
              (finalFullName || finalPhoneNumber || finalIdNumber)
            ) {
              try {
                const parts = finalFullName.split(/\s+/);
                const firstName = parts[0] || undefined;
                const lastName = parts.slice(1).join(' ') || undefined;

                await updateBackendProfile(backendUser.id, {
                  displayName: finalFullName || undefined,
                  firstName,
                  lastName,
                  phoneNumber: finalPhoneNumber || undefined,
                  nationalId: finalIdNumber || undefined,
                });
              } catch (profileUpdateErr) {
                console.warn(
                  '[Verify Email Polling] Error updating backend profile:',
                  profileUpdateErr,
                );
              }

              try {
                await createFareAccount(backendUser.id);
              } catch (fareAccErr) {
                console.warn(
                  '[Verify Email Polling] Error creating fare account:',
                  fareAccErr,
                );
              }
            }

            // 1c. Guardar caché local para pasar validaciones del layout y onboarding de inmediato
            try {
              const cachePayload = {
                displayName: finalFullName || backendUser?.displayName || '',
                fullName: finalFullName || backendUser?.displayName || '',
                idNumber: finalIdNumber || backendUser?.nationalId || '',
                nationalId: finalIdNumber || backendUser?.nationalId || '',
                phoneNumber: finalPhoneNumber || backendUser?.phoneNumber || '',
                email: currentUser.email || '',
                onboardingCompleted: true,
              };
              await AsyncStorage.setItem(
                'gofare_cached_user_profile',
                JSON.stringify(cachePayload),
              );
              await SecureStore.setItemAsync('user_role', 'passenger');
              // Limpiar perfil pendiente ya que se completó el flujo
              await AsyncStorage.removeItem('gofare_pending_profile');
            } catch (storageErr) {
              console.warn(
                '[Verify Email Polling] Error writing local cache:',
                storageErr,
              );
            }

            // 2. Forzar actualización del token para disparar eventos en RootLayout
            await currentUser.getIdToken(true);

            // 3. Re-evaluar fase de sesión en _layout.tsx para asignar el rol y phase='signed_in'
            await refreshAuthSessionPhase();

            Alert.alert(
              '¡Cuenta Verificada!',
              'Tu correo electrónico ha sido verificado con éxito. Redireccionando...',
              [
                {
                  text: 'Aceptar',
                  onPress: () => {
                    router.replace('/(tabs)' as any);
                  },
                },
              ],
            );

            setTimeout(() => {
              if (isActive) {
                router.replace('/(tabs)' as any);
              }
            }, 2000);
          }
        }
      } catch (err) {
        console.warn(
          '[Verify Email Polling] Error checking verification:',
          err,
        );
      }
    };

    checkVerification();
    intervalId = setInterval(checkVerification, 3000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [router, params, pendingProfile]);

  const handleBack = async () => {
    try {
      await sigOutAccount();
      await clearBackendJwt();
      try {
        await AsyncStorage.removeItem('gofare_pending_profile');
      } catch {}
    } catch (err) {
      console.warn('[Verify Email] Error signing out on back:', err);
    }
    router.replace('/landing');
  };

  const handleResendEmail = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        setLoading(true);
        await sendVerificationEmail(currentUser);
        Alert.alert(
          'Correo Reenviado',
          'Se ha enviado un nuevo enlace de verificación a tu correo electrónico. Por favor, revisa tu bandeja de entrada o carpeta de spam.',
        );
      } else {
        Alert.alert(
          'Error',
          'No se pudo encontrar la sesión activa. Por favor, inicia sesión para reenviar.',
        );
      }
    } catch (err: any) {
      console.warn('[Verify Email] Error resending email:', err);
      Alert.alert(
        'Error',
        'No se pudo reenviar el correo de verificación. Inténtalo de nuevo más tarde.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      await sigOutAccount();
      await clearBackendJwt();
      try {
        await AsyncStorage.removeItem('gofare_pending_profile');
      } catch {}
      router.replace('/login' as any);
    } catch (err) {
      console.warn('[Verify Email] Error signing out:', err);
      Alert.alert('Error', 'No se pudo cerrar la sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.blob} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScreenHeader title="Verifica tu Correo" onBack={handleBack} />
        <ScrollView
          contentContainerStyle={[styles.scroll, { justifyContent: 'center' }]}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* ── ÍCONO DE CORREO ── */}
          <View style={styles.iconSection}>
            <View style={styles.fakeShadow} />
            <View style={styles.iconCard}>
              <View style={styles.topShine} />
              <MaterialCommunityIcons
                name="email-check-outline"
                size={96}
                color={tokens.colors.primary}
              />
            </View>
          </View>

          {/* ── TÍTULOS ── */}
          <View style={[styles.titleBlock, { alignItems: 'center' }]}>
            <Text style={[styles.titleDark, { textAlign: 'center' }]}>
              Revisa tu
            </Text>
            <Text style={[styles.titleBlue, { textAlign: 'center' }]}>
              Bandeja de Entrada
            </Text>
            <Text style={[styles.subtitle, { textAlign: 'center' }]}>
              {`Hemos enviado un enlace de verificación a:\n`}
              <Text
                style={{
                  fontFamily: tokens.typography.fontFamily.bold,
                  color: '#18243E',
                }}
              >
                {registeredEmail}
              </Text>
              {`\n\nHaz clic en el enlace del correo para activar\ntu cuenta. La app detectará la confirmación automáticamente.`}
            </Text>
          </View>

          {/* ── INSTRUCCIONES ANTI-SPAM ── */}
          <View style={styles.spamCard}>
            <View style={styles.spamRow}>
              <Ionicons
                name="warning-outline"
                size={18}
                color="#B45309"
                style={{ marginRight: 10 }}
              />
              <Text style={styles.spamTitle}>¿No llega el correo?</Text>
            </View>
            <Text style={styles.spamText}>
              1. Revisa tu carpeta{' '}
              <Text style={styles.spamBold}>Spam / Correo no deseado</Text>.
              {'\n'}
              2. Busca también en{' '}
              <Text style={styles.spamBold}>Promociones</Text> (Gmail).{'\n'}
              3. Agrega{' '}
              <Text style={styles.spamBold}>
                noreply@go-fare-dev-e7501.firebaseapp.com
              </Text>{' '}
              a tus contactos.{'\n'}
              4. Si sigue sin llegar, espera 1 minuto y presiona reenviar.
            </Text>
          </View>

          {/* ── BOTÓN — Cerrar Sesión ── */}
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              loading && { opacity: 0.7 },
            ]}
            onPress={handleLogout}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>Cerrar Sesión</Text>
                <Ionicons
                  name="log-out-outline"
                  size={20}
                  color="#fff"
                  style={{ marginLeft: 10 }}
                />
              </>
            )}
          </Pressable>

          {/* ── REENVIAR CORREO ── */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>¿Aún nada? </Text>
            <Pressable onPress={handleResendEmail} disabled={loading}>
              <Text style={styles.registerLink}>
                {loading ? 'Enviando...' : 'Reenviar correo'}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.footerLegal}>CARACAS MOVE • REGISTRO SEGURO</Text>
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
    marginBottom: 32,
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
  titleBlock: { marginBottom: 24 },
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#6B7A93',
    lineHeight: 22,
  },
  spamCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  spamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  spamTitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#92400E',
  },
  spamText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#B45309',
    lineHeight: 18,
  },
  spamBold: {
    fontFamily: tokens.typography.fontFamily.bold,
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
    marginBottom: 24,
  },
  registerText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#8594AB',
  },
  registerLink: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  footerLegal: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#A0AEC0',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 12,
  },
});
