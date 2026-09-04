import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useRef, useState } from 'react';
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
import {
  clearBackendJwt,
  createBackendUser,
  createFareAccount,
  resolveRoleUuid,
  syncWithBackend,
  updateBackendProfile,
} from '@/lib/api';
import { refreshAuthSessionPhase } from '@/lib/auth-session';
import { auth, sigOutAccount } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    email?: string;
    fullName?: string;
    phoneNumber?: string;
    idNumber?: string;
  }>();

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const otpInputRef = useRef<TextInput>(null);

  const registeredEmail = params.email || auth.currentUser?.email || '';
  const finalFullName = params.fullName || '';
  const finalPhoneNumber = params.phoneNumber || '';
  const finalIdNumber = params.idNumber || '';

  const handleVerify = async () => {
    if (otp.trim().length < 6) {
      Alert.alert(
        'Código inválido',
        'El código de verificación debe tener 6 dígitos.',
      );
      return;
    }

    if (otp !== '123456') {
      Alert.alert(
        'Código incorrecto',
        'El código ingresado no es válido para la verificación de desarrollo.',
      );
      return;
    }

    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No se encontró sesión de usuario activa.');
      }

      const parts = finalFullName.split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';

      // 1. Crear el usuario en PostgreSQL con su número de teléfono
      try {
        const roleUuid = await resolveRoleUuid('passenger');
        await createBackendUser({
          provider: 'local',
          providerId: currentUser.uid,
          email: registeredEmail || undefined,
          phoneNumber: finalPhoneNumber || undefined,
          phone_number: finalPhoneNumber || undefined,
          firstName,
          lastName,
          displayName: finalFullName,
          roleIds: roleUuid ? [roleUuid] : [],
        });
      } catch (createErr) {
        console.log(
          '[Verify Phone] createBackendUser ya existente o saltado:',
          createErr,
        );
      }

      // 2. Sincronizar JWT e iniciar sesión en el backend (usará el token mockeado)
      let backendUser: any = null;
      try {
        const res = await syncWithBackend(currentUser);
        backendUser = res.user;
      } catch (syncErr) {
        console.warn('[Verify Phone] Error al sincronizar backend:', syncErr);
      }

      // 3. Guardar el perfil en PostgreSQL e inicializar cuenta de saldo
      if (backendUser) {
        try {
          await updateBackendProfile(backendUser.id, {
            displayName: finalFullName || undefined,
            firstName,
            lastName,
            phoneNumber: finalPhoneNumber || undefined,
            nationalId: finalIdNumber || undefined,
          });
        } catch (profileUpdateErr) {
          console.warn(
            '[Verify Phone] Error updating backend profile:',
            profileUpdateErr,
          );
        }

        try {
          await createFareAccount(backendUser.id);
        } catch (fareAccErr) {
          console.warn(
            '[Verify Phone] Error creating fare account:',
            fareAccErr,
          );
        }
      }

      // 4. Escribir datos del caché local para el layout
      const cachePayload = {
        displayName: finalFullName || backendUser?.displayName || '',
        fullName: finalFullName || backendUser?.displayName || '',
        idNumber: finalIdNumber || backendUser?.nationalId || '',
        nationalId: finalIdNumber || backendUser?.nationalId || '',
        phoneNumber: finalPhoneNumber || backendUser?.phoneNumber || '',
        email: registeredEmail,
        onboardingCompleted: true,
      };
      await AsyncStorage.setItem(
        'gofare_cached_user_profile',
        JSON.stringify(cachePayload),
      );
      await SecureStore.setItemAsync('user_role', 'passenger');
      await AsyncStorage.setItem('phone_verified_bypass', 'true');
      await AsyncStorage.removeItem('gofare_pending_profile');

      // 5. Actualizar la fase de sesión y redirigir
      await refreshAuthSessionPhase();

      Alert.alert(
        '¡Cuenta Verificada!',
        'Tu número de teléfono ha sido verificado con éxito.',
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
        router.replace('/(tabs)' as any);
      }, 1500);
    } catch (err: any) {
      console.error('[Verify Phone] Error en verificación:', err);
      Alert.alert(
        'Error',
        err.message || 'Ocurrió un error al verificar tu cuenta.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBack = async () => {
    try {
      await sigOutAccount();
      await clearBackendJwt();
      await AsyncStorage.removeItem('gofare_pending_profile');
    } catch (err) {
      console.warn('[Verify Phone] Error al cerrar sesión al regresar:', err);
    }
    router.replace('/landing');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.blob} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title="Verificar Teléfono" onBack={handleBack} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── ÍCONO ── */}
          <View style={styles.iconSection}>
            <View style={styles.fakeShadow} />
            <View style={styles.iconCard}>
              <View style={styles.topShine} />
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={96}
                color={tokens.colors.primary}
              />
            </View>
          </View>

          {/* ── TÍTULOS ── */}
          <View style={styles.titleBlock}>
            <Text style={styles.titleDark}>Verificar</Text>
            <Text style={styles.titleBlue}>Teléfono</Text>
            <Text style={styles.subtitle}>
              {`Enviamos un código de verificación al número ${
                finalPhoneNumber
                  ? `+58 ${finalPhoneNumber.slice(3, 6)} ${finalPhoneNumber.slice(6, 9)} ${finalPhoneNumber.slice(9)}`
                  : 'ingresado'
              }.\nIntroduce el código OTP a continuación.`}
            </Text>
          </View>

          {/* ── SECCIÓN DE OTP ── */}
          <Text style={styles.inputLabel}>CÓDIGO DE 6 DÍGITOS</Text>

          <TextInput
            ref={otpInputRef}
            style={styles.hiddenOtpInput}
            keyboardType="number-pad"
            value={otp}
            onChangeText={(text) => {
              const cleaned = text.replace(/[^0-9]/g, '');
              if (cleaned.length <= 6) {
                setOtp(cleaned);
              }
            }}
            maxLength={6}
            editable={!loading}
          />

          <Pressable
            style={styles.otpBoxesContainer}
            onPress={() => otpInputRef.current?.focus()}
          >
            {Array.from({ length: 6 }).map((_, index) => {
              const char = otp[index] || '';
              const isFocused = otp.length === index;
              return (
                <View
                  key={index}
                  style={[
                    styles.otpBox,
                    char ? styles.otpBoxFilled : null,
                    isFocused ? styles.otpBoxFocused : null,
                  ]}
                >
                  <Text style={styles.otpBoxText}>{char}</Text>
                </View>
              );
            })}
          </Pressable>

          <View style={{ flex: 1, minHeight: 40 }} />

          <Pressable
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              loading && { opacity: 0.7 },
            ]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>Verificar Cuenta</Text>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#fff"
                  style={{ marginLeft: 10 }}
                />
              </>
            )}
          </Pressable>

          <Text style={styles.footerLegal}>
            CARACAS MOVE • VERIFICACIÓN DE SEGURIDAD
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ECF1F9' },
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
  iconSection: { alignItems: 'center', marginBottom: 44 },
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
  hiddenOtpInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  otpBoxesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 2,
    marginBottom: 20,
    marginTop: 8,
  },
  otpBox: {
    width: 44,
    height: 56,
    borderWidth: 1.5,
    borderColor: '#D4DEEC',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1.5,
  },
  otpBoxFilled: {
    borderColor: '#B0C5E5',
    backgroundColor: '#F5F9FF',
  },
  otpBoxFocused: {
    borderColor: tokens.colors.primary,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  otpBoxText: {
    fontSize: 22,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
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
  footerLegal: {
    textAlign: 'center',
    fontSize: 9.5,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#B0BCCC',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});
