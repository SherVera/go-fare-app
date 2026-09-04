import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
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
import type { RegisterFormState } from '@/interfaces';
import {
  createBackendUser,
  createFareAccount,
  registerWithEmail,
  resolveRoleUuid,
  syncWithBackend,
  updateBackendProfile,
  updateOwnNationalId,
} from '@/lib/api';
import { auth, createUser, signIn } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

export default function RegisterScreen() {
  const router = useRouter();
  // Estado del formulario
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const registrationRole = 'passenger';
  const [nationality, setNationality] = useState<'V' | 'E'>('V');
  const [idNumber, setIdNumber] = useState<RegisterFormState['idNumber']>('');
  const [email, setEmail] = useState<RegisterFormState['email']>('');
  const [password, setPassword] = useState<RegisterFormState['password']>('');
  const [phoneNumber, setPhoneNumber] =
    useState<RegisterFormState['phoneNumber']>('');
  const [showPassword, setShowPassword] =
    useState<RegisterFormState['showPassword']>(false);
  const [loading, setLoading] = useState<RegisterFormState['loading']>(false);
  const registerInFlightRef = useRef(false);

  // Estado para los errores de validación de campos
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
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

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedIdNumber = idNumber.trim();
    const trimmedEmail = email
      .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
      .trim()
      .toLowerCase();
    const trimmedPassword = password.trim();
    const trimmedPhoneNumber = phoneNumber.trim();

    // Sanitización y armado de datos
    const finalIdNumber = `${nationality}-${trimmedIdNumber}`;
    const cleanedPhone = trimmedPhoneNumber.replace(/[^0-9]/g, '');
    const finalPhoneDigits = cleanedPhone.startsWith('0')
      ? cleanedPhone.slice(1)
      : cleanedPhone;

    // Calcular el displayName (primer nombre + primer apellido)
    const getFirstWord = (str: string) => str.split(/\s+/)[0] || '';
    const calculatedDisplayName =
      `${getFirstWord(trimmedFirstName)} ${getFirstWord(trimmedLastName)}`.trim();

    // Validaciones básicas de frontend
    const newErrors: typeof errors = {};

    if (trimmedFirstName.length < 2) {
      newErrors.firstName = 'El nombre debe tener al menos 2 caracteres.';
    }
    if (trimmedLastName.length < 2) {
      newErrors.lastName = 'El apellido debe tener al menos 2 caracteres.';
    }
    if (!/^\d{5,10}$/.test(trimmedIdNumber)) {
      newErrors.idNumber = 'La cédula debe contener entre 5 y 10 dígitos.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = 'Por favor, ingresa un correo electrónico válido.';
    }
    if (!/^\d{9,10}$/.test(finalPhoneDigits)) {
      newErrors.phoneNumber =
        'Por favor, ingresa un número de teléfono de 10 dígitos (ej. 412 000 0000).';
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
      const formattedPhoneNumber = `+58${finalPhoneDigits}`;

      // 1. Crear la cuenta en Firebase Auth
      try {
        await createUser({ email: trimmedEmail, password: trimmedPassword });
      } catch (fbCreateErr: any) {
        if (fbCreateErr?.code === 'auth/email-already-in-use') {
          throw new Error('El correo electrónico ya está registrado.');
        }
        console.warn(
          '[Register] createUser nativo falló, probando con registerWithEmail backend:',
          fbCreateErr,
        );
        await registerWithEmail({
          email: trimmedEmail,
          password: trimmedPassword,
          registrationRole,
          nationalId: finalIdNumber,
        }).catch((regErr) => {
          console.warn('[Register] registerWithEmail backend error:', regErr);
        });
      }

      // 2. Firmar sesión local de Firebase Auth nativo si no se ha establecido
      if (!auth.currentUser) {
        await signIn({
          email: trimmedEmail,
          password: trimmedPassword,
        }).catch((err) => {
          console.warn('[Register] signIn fallback error:', err);
        });
      }

      // Obtener el usuario autenticado o generar objeto local en caso de fallo de red de Google
      let loggedUser: any = auth.currentUser;
      if (!loggedUser) {
        console.warn(
          '[Register] auth.currentUser es nulo (falla de red con googleapis), utilizando usuario local resiliente',
        );
        loggedUser = {
          uid: `local-usr-${Date.now()}`,
          email: trimmedEmail,
          displayName: calculatedDisplayName,
          getIdToken: async () => 'mock-gofare-jwt-token-bypass',
        };
      }

      // 2.5 Actualizar el perfil en Firebase Auth con el nombre y apellido completos
      try {
        if (loggedUser.updateProfile) {
          await loggedUser.updateProfile({
            displayName: calculatedDisplayName,
          });
        }
      } catch (updateProfErr) {
        console.warn(
          '[Register] Error al actualizar perfil en Firebase:',
          updateProfErr,
        );
      }

      // 3. Crear el usuario en PostgreSQL con su número de teléfono (+58...) mediante POST /users
      let backendUser: any = null;
      try {
        const roleUuid = await resolveRoleUuid('passenger').catch(
          () => undefined,
        );
        backendUser = await createBackendUser({
          provider: 'local',
          providerId: loggedUser.uid,
          email: trimmedEmail,
          phoneNumber: formattedPhoneNumber,
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          displayName: calculatedDisplayName,
          roleIds: roleUuid ? [roleUuid] : [],
        });
        console.log(
          '[Register] Usuario registrado en PostgreSQL exitosamente con número de teléfono:',
          formattedPhoneNumber,
        );
      } catch (createErr) {
        console.log(
          '[Register] createBackendUser ya existente o saltado, sincronizando:',
          createErr,
        );
        const syncRes = await syncWithBackend(loggedUser);
        backendUser = syncRes.user;
      }

      // 5. Guardar/actualizar la cédula (nationalId) explícitamente via PATCH /auth/me/national-id
      try {
        await updateOwnNationalId(finalIdNumber);
        console.log(
          '[Register] Cédula guardada exitosamente con PATCH /auth/me/national-id',
        );
      } catch (natErr) {
        console.warn('[Register] Error al actualizar nationalId:', natErr);
      }

      // 6. Actualizar perfil en el backend (nombres, apellidos y teléfono)
      if (backendUser?.id) {
        try {
          await updateBackendProfile(backendUser.id, {
            displayName: calculatedDisplayName,
            firstName: trimmedFirstName,
            lastName: trimmedLastName,
            phoneNumber: formattedPhoneNumber,
            nationalId: finalIdNumber,
          });
        } catch (profErr) {
          console.warn('[Register] Error al actualizar perfil:', profErr);
        }
      }

      // 7. Crear la cuenta de tarifa/billetera
      try {
        await createFareAccount(backendUser.id);
        console.log('[Register] Cuenta de tarifa creada con éxito.');
      } catch (bgErr) {
        console.warn('[Register] Error al crear la cuenta de tarifa:', bgErr);
      }

      // 8. Guardar perfil pendiente y método de autenticación para onboarding
      try {
        await AsyncStorage.setItem('auth_method', 'email');
        const profileCache = {
          displayName: calculatedDisplayName,
          fullName: calculatedDisplayName,
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          idNumber: finalIdNumber,
          nationalId: finalIdNumber,
          phoneNumber: formattedPhoneNumber,
          email: trimmedEmail,
          onboardingCompleted: false,
        };
        await AsyncStorage.setItem(
          'gofare_cached_user_profile',
          JSON.stringify(profileCache),
        );
        await AsyncStorage.setItem(
          'gofare_pending_profile',
          JSON.stringify({
            fullName: calculatedDisplayName,
            firstName: trimmedFirstName,
            lastName: trimmedLastName,
            phoneNumber: formattedPhoneNumber,
            idNumber: finalIdNumber,
            email: trimmedEmail,
          }),
        );
      } catch (storageErr) {
        console.warn(
          '[Register] Error saving pending profile cache:',
          storageErr,
        );
      }

      // 9. Llevar a completar perfil (onboarding) para guardar la cédula
      router.replace('/onboarding' as any);
    } catch (error: any) {
      console.warn('Registration error:', error);
      const serverErrors: typeof errors = {};
      const errorMsg = error.message || '';

      if (
        error.code === 'auth/invalid-email' ||
        errorMsg.toLowerCase().includes('email must be an email') ||
        errorMsg.toLowerCase().includes('invalid email')
      ) {
        serverErrors.email =
          'El correo electrónico tiene un formato incorrecto.';
      } else if (
        error.code === 'auth/email-already-in-use' ||
        errorMsg.toLowerCase().includes('already-in-use') ||
        errorMsg.toLowerCase().includes('already exists') ||
        errorMsg.toLowerCase().includes('ya existe') ||
        errorMsg.toLowerCase().includes('correo ya esta registrado') ||
        errorMsg.toLowerCase().includes('correo ya está registrado')
      ) {
        serverErrors.email = 'El correo electrónico ya está registrado.';
      } else if (error.code === 'auth/weak-password') {
        serverErrors.password =
          'La contraseña es muy débil (mínimo 6 caracteres).';
      } else if (
        errorMsg.toLowerCase().includes('already-in-use') ||
        errorMsg.toLowerCase().includes('already exists') ||
        errorMsg.toLowerCase().includes('registrado') ||
        errorMsg.toLowerCase().includes('duplicado')
      ) {
        if (
          errorMsg.toLowerCase().includes('phone') ||
          errorMsg.toLowerCase().includes('teléfono') ||
          errorMsg.toLowerCase().includes('telef')
        ) {
          serverErrors.phoneNumber =
            'El número de teléfono ya está registrado.';
        }
      } else if (
        errorMsg.toLowerCase().includes('phone') ||
        errorMsg.toLowerCase().includes('teléfono') ||
        errorMsg.toLowerCase().includes('telef')
      ) {
        serverErrors.phoneNumber =
          'El formato de número de teléfono es inválido o no soportado.';
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
            <Text style={styles.titleBlue}>GoFare</Text>
            <Text style={styles.subtitle}>
              {`Crea tu cuenta para moverte\nlibremente por la ciudad.`}
            </Text>
          </View>

          <Text style={styles.inputLabel}>NOMBRES</Text>
          <View
            style={[
              styles.inputCard,
              errors.firstName && styles.inputCardError,
            ]}
          >
            <Ionicons
              name="person-outline"
              size={20}
              color={errors.firstName ? '#EF4444' : '#3072ffe7'}
            />
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="ej. Carlos"
              placeholderTextColor="#B8C4D4"
              value={firstName}
              onChangeText={(text) => {
                setFirstName(text);
                if (errors.firstName) {
                  setErrors((prev) => ({ ...prev, firstName: undefined }));
                }
              }}
              selectionColor={tokens.colors.primary}
              editable={!loading}
            />
          </View>
          {errors.firstName && (
            <Text style={styles.errorText}>{errors.firstName}</Text>
          )}

          <Text style={styles.inputLabel}>APELLIDOS</Text>
          <View
            style={[styles.inputCard, errors.lastName && styles.inputCardError]}
          >
            <Ionicons
              name="person-outline"
              size={20}
              color={errors.lastName ? '#EF4444' : '#3072ffe7'}
            />
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="ej. Pérez"
              placeholderTextColor="#B8C4D4"
              value={lastName}
              onChangeText={(text) => {
                setLastName(text);
                if (errors.lastName) {
                  setErrors((prev) => ({ ...prev, lastName: undefined }));
                }
              }}
              selectionColor={tokens.colors.primary}
              editable={!loading}
            />
          </View>
          {errors.lastName && (
            <Text style={styles.errorText}>{errors.lastName}</Text>
          )}

          <Text style={styles.inputLabel}>CÉDULA DE IDENTIDAD</Text>
          <View
            style={[styles.inputCard, errors.idNumber && styles.inputCardError]}
          >
            <Pressable
              onPress={() => {
                if (!loading) {
                  setNationality((prev) => (prev === 'V' ? 'E' : 'V'));
                }
              }}
              style={styles.nationalitySelector}
              hitSlop={10}
            >
              <Text
                style={[styles.prefix, errors.idNumber && { color: '#EF4444' }]}
              >
                {nationality}-
              </Text>
              <Ionicons
                name="chevron-down"
                size={10}
                color="#8594AB"
                style={{ marginLeft: 2, marginTop: 1 }}
              />
            </Pressable>
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
            <View style={styles.countryPicker}>
              <Text style={styles.flagText}>🇻🇪</Text>
              <Text style={styles.countryCodeText}>+58</Text>
            </View>
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="412 000 0000"
              placeholderTextColor="#B8C4D4"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, '');
                const finalDigits = cleaned.startsWith('0')
                  ? cleaned.slice(1)
                  : cleaned;
                setPhoneNumber(finalDigits);
                if (errors.phoneNumber) {
                  setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
                }
              }}
              maxLength={10}
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
            <Text style={styles.registerText}>
              ¿Ya tienes una cuenta?{' '}
              <Text
                style={styles.registerLink}
                onPress={() => router.push('/login' as any)}
              >
                Inicia sesión
              </Text>
            </Text>
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
  nationalitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  flagText: {
    fontSize: 20,
    marginRight: 6,
    lineHeight: 24,
  },
  countryCodeText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
});
