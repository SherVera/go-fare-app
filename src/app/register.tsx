import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
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
import type { RegisterFormState } from '@/interfaces';
import {
  createFareAccount,
  loginWithFirebaseToken,
  registerWithEmail,
  sendFirebaseVerificationEmail,
} from '@/lib/api';
import {
  createUser,
  sendVerificationEmail,
  setDocument,
  signIn,
  sigOutAccount,
  updateUser,
} from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

export default function RegisterScreen() {
  const router = useRouter();
  // Estado del formulario — tipado por RegisterFormState
  const [fullName, setFullName] = useState<RegisterFormState['fullName']>('');
  const registrationRole = 'passenger';
  const [idNumber, setIdNumber] = useState<RegisterFormState['idNumber']>('');
  const [email, setEmail] = useState<RegisterFormState['email']>('');
  const [password, setPassword] = useState<RegisterFormState['password']>('');
  const [phoneNumber, setPhoneNumber] =
    useState<RegisterFormState['phoneNumber']>('');
  const [showPassword, setShowPassword] =
    useState<RegisterFormState['showPassword']>(false);
  const [loading, setLoading] = useState<RegisterFormState['loading']>(false);
  const [verificationSent, setVerificationSent] =
    useState<RegisterFormState['verificationSent']>(false);
  const [registeredEmail, setRegisteredEmail] =
    useState<RegisterFormState['registeredEmail']>('');
  const registerInFlightRef = useRef(false);

  // Estado para los errores de validación de campos
  const [errors, setErrors] = useState<{
    fullName?: string;
    idNumber?: string;
    phoneNumber?: string;
    email?: string;
    password?: string;
  }>({});

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/landing');
    }
  };

  const handleRegister = async () => {
    if (registerInFlightRef.current) return;

    const trimmedFullName = fullName.trim();
    const trimmedIdNumber = idNumber.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedPhoneNumber = phoneNumber.trim();

    // Validaciones básicas de frontend
    const newErrors: typeof errors = {};

    if (trimmedFullName.length < 3) {
      newErrors.fullName = 'El nombre debe tener al menos 3 caracteres.';
    }
    if (!/^\d{5,10}$/.test(trimmedIdNumber)) {
      newErrors.idNumber = 'La cédula debe contener entre 5 y 10 dígitos.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = 'Por favor, ingresa un correo electrónico válido.';
    }
    if (!/^(0412|0414|0424|0416|0426|0212)\d{7}$/.test(trimmedPhoneNumber)) {
      newErrors.phoneNumber =
        'Por favor, ingresa un número de teléfono válido (ej. 04120000000).';
    }
    if (trimmedPassword.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    registerInFlightRef.current = true;
    setLoading(true);

    try {
      // 1. Registrar usuario en Firebase Auth via el backend.
      // El backend crea el usuario, asigna el rol solicitado y devuelve idToken + refreshToken.
      const credentials = await registerWithEmail({
        email: trimmedEmail,
        password: trimmedPassword,
        registrationRole,
        displayName: trimmedFullName,
        phoneNumber: trimmedPhoneNumber,
        nationalId: trimmedIdNumber,
      });

      // 2. Firmar sesión local temporalmente para poder escribir a Firestore
      const userCredential = await signIn({
        email: trimmedEmail,
        password: trimmedPassword,
      });
      const { user: firebaseUser } = userCredential;

      // 3. Escribir perfil en Firestore para pasar la validación de onboarding
      const profilePayload = {
        fullName: trimmedFullName,
        idNumber: trimmedIdNumber,
        email: trimmedEmail,
        phoneNumber: trimmedPhoneNumber,
        balance: 0,
        carnetId: `GO-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
        onboardingCompleted: true,
      };

      try {
        await setDocument(`users/${firebaseUser.uid}`, profilePayload);
      } catch (fsErr: any) {
        console.warn('[Register] Error writing firestore document:', fsErr);
      }

      // 4. Sincronizar o crear cuenta de tarifa
      try {
        const { user: backendUser } = await loginWithFirebaseToken(
          credentials.idToken,
        );
        await createFareAccount(backendUser.id);
      } catch (backendError: any) {
        console.error(
          '[Register] Error al sincronizar usuario/cuenta con el backend:',
          backendError,
        );
      }

      // 5. Enviar el correo de verificación via el backend (usa el idToken ya obtenido).
      try {
        await sendFirebaseVerificationEmail(credentials.idToken);
      } catch (emailError: any) {
        console.warn('Verification email error:', emailError);
      }

      // 6. Cerrar sesión local
      try {
        await sigOutAccount();
      } catch (signOutError) {
        console.warn('[register] signOut:', signOutError);
      }

      // 7. Mostrar la pantalla de verificación pendiente
      setRegisteredEmail(trimmedEmail);
      setVerificationSent(true);
    } catch (error: any) {
      console.warn('Registration error:', error);
      const serverErrors: typeof errors = {};
      const errorMsg = error.message || '';

      if (
        error.code === 'auth/email-already-in-use' ||
        errorMsg.toLowerCase().includes('email') ||
        errorMsg.toLowerCase().includes('correo')
      ) {
        serverErrors.email = 'El correo electrónico ya está registrado.';
      } else if (error.code === 'auth/invalid-email') {
        serverErrors.email =
          'El correo electrónico tiene un formato incorrecto.';
      } else if (error.code === 'auth/weak-password') {
        serverErrors.password =
          'La contraseña es muy débil (mínimo 6 caracteres).';
      } else if (
        errorMsg.toLowerCase().includes('teléfono') ||
        errorMsg.toLowerCase().includes('phone') ||
        errorMsg.toLowerCase().includes('telef')
      ) {
        serverErrors.phoneNumber = 'El número de teléfono ya está registrado.';
      } else if (error.code === 'auth/network-request-failed') {
        Alert.alert('Error', 'Error de red. Revisa tu conexión a internet.');
      } else if (error.code === 'auth/internal-error') {
        if (__DEV__) {
          console.error('[register] auth/internal-error:', error);
        }
        Alert.alert(
          'Error de registro',
          'Firebase devolvió un error interno al crear la cuenta.',
        );
      } else {
        Alert.alert(
          'Error',
          error.message || 'Ocurrió un error durante el registro.',
        );
      }
      setErrors(serverErrors);
    } finally {
      setLoading(false);
      registerInFlightRef.current = false;
    }
  };

  // Redirige al login para reenviar el correo, ya que cerramos sesión tras el registro
  const handleResendEmail = () => {
    Alert.alert(
      'Inicia sesión para reenviar',
      'Para reenviar el correo de verificación, por favor inicia sesión con tus credenciales.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Ir al Login', onPress: () => router.replace('/login' as any) },
      ],
    );
  };

  // Pantalla de verificación pendiente — se muestra tras registrarse exitosamente
  if (verificationSent) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.blob} />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScreenHeader title="Verifica tu Correo" onBack={handleBack} />
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              { justifyContent: 'center' },
            ]}
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
                {`\n\nHaz clic en el enlace del correo para activar\ntu cuenta y luego inicia sesión.`}
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

            {/* ── BOTÓN — Ir a Login ── */}
            <Pressable
              style={({ pressed }) => [
                styles.cta,
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => router.replace('/login' as any)}
            >
              <Text style={styles.ctaText}>Ir al Login</Text>
              <Ionicons
                name="arrow-forward-circle-outline"
                size={20}
                color="#fff"
                style={{ marginLeft: 10 }}
              />
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

            <Text style={styles.footerLegal}>
              CARACAS MOVE • REGISTRO SEGURO
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Forma decorativa */}
      <View style={styles.blob} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScreenHeader title="Crear Cuenta" onBack={handleBack} />

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
                name="account-plus-outline"
                size={96}
                color={tokens.colors.primary}
              />
            </View>
          </View>

          {/* ── TÍTULOS ── */}
          <View style={styles.titleBlock}>
            <Text style={styles.titleDark}>Únete a</Text>
            <Text style={styles.titleBlue}>GoFair</Text>
            <Text style={styles.subtitle}>
              {`Crea tu cuenta para moverte\nlibremente por la ciudad.`}
            </Text>
          </View>

          <Text style={styles.inputLabel}>NOMBRE COMPLETO</Text>
          <View
            style={[styles.inputCard, errors.fullName && styles.inputCardError]}
          >
            <Ionicons
              name="person-outline"
              size={20}
              color={errors.fullName ? '#EF4444' : '#3072ffe7'}
            />
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="ej. Carlos Pérez"
              placeholderTextColor="#B8C4D4"
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                if (errors.fullName) {
                  setErrors((prev) => ({ ...prev, fullName: undefined }));
                }
              }}
              selectionColor={tokens.colors.primary}
              editable={!loading}
            />
          </View>
          {errors.fullName && (
            <Text style={styles.errorText}>{errors.fullName}</Text>
          )}

          <Text style={styles.inputLabel}>CÉDULA DE IDENTIDAD</Text>
          <View
            style={[styles.inputCard, errors.idNumber && styles.inputCardError]}
          >
            <Text
              style={[styles.prefix, errors.idNumber && { color: '#EF4444' }]}
            >
              V-
            </Text>
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="00000000"
              placeholderTextColor="#B8C4D4"
              keyboardType="number-pad"
              value={idNumber}
              onChangeText={(text) => {
                setIdNumber(text);
                if (errors.idNumber) {
                  setErrors((prev) => ({ ...prev, idNumber: undefined }));
                }
              }}
              maxLength={10}
              selectionColor={tokens.colors.primary}
              editable={!loading}
            />
          </View>
          {errors.idNumber && (
            <Text style={styles.errorText}>{errors.idNumber}</Text>
          )}

          <Text style={styles.inputLabel}>TELÉFONO</Text>
          <View
            style={[
              styles.inputCard,
              errors.phoneNumber && styles.inputCardError,
            ]}
          >
            <Ionicons
              name="call-outline"
              size={20}
              color={errors.phoneNumber ? '#EF4444' : '#3072ffe7'}
            />
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="04120000000"
              placeholderTextColor="#B8C4D4"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={(text) => {
                setPhoneNumber(text);
                if (errors.phoneNumber) {
                  setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
                }
              }}
              maxLength={11}
              selectionColor={tokens.colors.primary}
              editable={!loading}
            />
          </View>
          {errors.phoneNumber && (
            <Text style={styles.errorText}>{errors.phoneNumber}</Text>
          )}

          <Text style={styles.inputLabel}>CORREO ELECTRÓNICO</Text>
          <View
            style={[styles.inputCard, errors.email && styles.inputCardError]}
          >
            <Ionicons
              name="mail-outline"
              size={20}
              color={errors.email ? '#EF4444' : '#3072ffe7'}
            />
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="email@example.com"
              placeholderTextColor="#B8C4D4"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) {
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              selectionColor={tokens.colors.primary}
              editable={!loading}
            />
          </View>
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

          <Text style={styles.inputLabel}>CONTRASEÑA</Text>
          <View
            style={[styles.inputCard, errors.password && styles.inputCardError]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={errors.password ? '#EF4444' : '#3072ffe7'}
            />
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="******"
              placeholderTextColor="#B8C4D4"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) {
                  setErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              selectionColor={tokens.colors.primary}
              editable={!loading}
            />
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
          {errors.password && (
            <Text style={styles.errorText}>{errors.password}</Text>
          )}

          <View style={styles.secureRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={13}
              color={tokens.colors.primary}
              style={{ marginTop: 1, marginRight: 6 }}
            />
            <Text style={styles.secureText}>
              Tu información será validada de forma segura.
            </Text>
          </View>

          <View style={{ flex: 1, minHeight: 32 }} />

          {/* ── BOTÓN ── */}
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              loading && { opacity: 0.7 },
            ]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>Crear Cuenta</Text>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#fff"
                  style={{ marginLeft: 10 }}
                />
              </>
            )}
          </Pressable>

          {/* ── LINK A LOGIN ── */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>¿Ya tienes una cuenta? </Text>
            <Pressable onPress={() => router.push('/login' as any)}>
              <Text style={styles.registerLink}>Inicia sesión</Text>
            </Pressable>
          </View>

          {/* ── FOOTER ── */}
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
  inputLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 60,
    marginBottom: 16,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  prefix: {
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#3072ffe7',
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
    marginBottom: 10,
  },
  secureText: {
    flex: 1,
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#8594AB',
    lineHeight: 17,
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
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#6B7A93',
  },
  registerLink: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  spamCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 28,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
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
    color: '#92400E',
    lineHeight: 18,
  },
  spamBold: {
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#78350F',
  },
  footerLegal: {
    textAlign: 'center',
    fontSize: 9.5,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#B0BCCC',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  inputCardError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
    shadowColor: '#EF4444',
    shadowOpacity: 0.15,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    marginTop: -8,
    marginBottom: 16,
    paddingLeft: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 6,
    marginBottom: 20,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  roleButtonActive: {
    backgroundColor: tokens.colors.primary,
  },
  roleButtonText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#8594AB',
    marginLeft: 6,
  },
  roleButtonTextActive: {
    color: '#FFFFFF',
  },
});
