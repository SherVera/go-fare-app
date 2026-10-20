import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeatureCard } from '@/components/FeatureCard';
import { HeaderLogo } from '@/components/HeaderLogo';
import { ImageHero } from '@/components/ImageHero';
import {
  createFareAccount,
  findEmailByPhone,
  getFareAccountByUserId,
  getMyTransportOwnerProfile,
  syncWithBackend,
} from '@/lib/api';
import { refreshAuthSessionPhase } from '@/lib/auth-session';
import { auth, reloadUserSafely, signIn, sigOutAccount } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

export default function LandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();

  const passwordRef = useRef<TextInput>(null);
  const [loginMode, setLoginMode] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<
    'email' | 'phone' | 'password' | null
  >(null);

  // Cargar credenciales previas recordadas
  useEffect(() => {
    const loadLastCredentials = async () => {
      try {
        const lastEmail =
          (await AsyncStorage.getItem('last_login_email')) ||
          (await AsyncStorage.getItem('last_login_identifier'));
        if (lastEmail) {
          setEmail(lastEmail);
        }
        const lastPhone = await AsyncStorage.getItem('last_login_phone');
        if (lastPhone) {
          setPhoneNumber(lastPhone);
        }
      } catch {}
    };
    loadLastCredentials();
  }, []);

  // Ajustes responsivos dinámicos según el alto y ancho del dispositivo
  const isSmallScreen = height < 720;
  const isMediumScreen = height >= 720 && height < 820;
  const isTablet = height >= 900 || width >= 600;

  const heroSize = isSmallScreen
    ? 150
    : isMediumScreen
      ? 180
      : isTablet
        ? 340
        : 220;
  const heroPaddingTop = isSmallScreen
    ? tokens.spacing.sm
    : isTablet
      ? tokens.spacing.xl
      : tokens.spacing.md;
  const heroPaddingBottom = isSmallScreen
    ? tokens.spacing.sm
    : isTablet
      ? tokens.spacing.xl
      : tokens.spacing.md;

  const handleLogin = async () => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const trimmedPassword = password.trim();
    let targetEmail = '';

    if (loginMode === 'phone') {
      let cleaned = phoneNumber.trim().replace(/[^0-9]/g, '');
      if (cleaned.startsWith('58')) cleaned = cleaned.slice(2);
      if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);

      if (cleaned.length !== 10) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'Número incompleto',
          'Ingresa los 10 dígitos de tu número de teléfono (por ejemplo: 414 123 4567).',
        );
        return;
      }

      if (!trimmedPassword) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'Contraseña requerida',
          'Por favor, ingresa tu contraseña.',
        );
        return;
      }

      if (trimmedPassword.length < 6) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'Contraseña corta',
          'La contraseña debe tener al menos 6 caracteres.',
        );
        return;
      }

      const e164 = `+58${cleaned}`;

      try {
        setLoading(true);
        const foundEmail = await findEmailByPhone(e164);
        if (!foundEmail) {
          setLoading(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(
            'Cuenta no encontrada',
            'No se encontró ninguna cuenta asociada a este número de teléfono. Verifica el número o regístrate.',
          );
          return;
        }
        targetEmail = foundEmail.toLowerCase();
        await AsyncStorage.setItem('phone_verified_bypass', 'true');
        await AsyncStorage.setItem('auth_method', 'phone');
        await AsyncStorage.setItem('last_login_phone', cleaned);
      } catch (err: any) {
        setLoading(false);
        console.warn('[PhoneLogin] Error buscando email por teléfono:', err);
        Alert.alert(
          'Error',
          'No se pudo verificar el número de teléfono con el servidor.',
        );
        return;
      }
    } else {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'Correo requerido',
          'Por favor, ingresa tu correo electrónico.',
        );
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail.toLowerCase())) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'Correo no válido',
          'Por favor, ingresa un correo electrónico válido (ejemplo: usuario@correo.com).',
        );
        return;
      }

      if (!trimmedPassword) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'Contraseña requerida',
          'Por favor, ingresa tu contraseña.',
        );
        return;
      }

      if (trimmedPassword.length < 6) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'Contraseña corta',
          'La contraseña debe tener al menos 6 caracteres.',
        );
        return;
      }

      targetEmail = trimmedEmail.toLowerCase();
      await AsyncStorage.removeItem('phone_verified_bypass');
      await AsyncStorage.setItem('auth_method', 'email');
    }

    try {
      setLoading(true);

      // Autenticar con Firebase
      const userCredential = await signIn({
        email: targetEmail,
        password: trimmedPassword,
      });

      // Recargar usuario de forma segura
      await reloadUserSafely(userCredential.user);

      const currentUser = auth.currentUser || userCredential.user;

      // Sincronizar con backend
      let backendUser = null;
      try {
        const response = await syncWithBackend(currentUser);
        backendUser = response.user;
      } catch (backendError: any) {
        console.warn('[backend] sync failed:', backendError);
        try {
          await sigOutAccount();
        } catch {}
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const rawMsg = backendError?.message || '';
        const isNetworkErr =
          rawMsg.includes('red') ||
          rawMsg.includes('Network') ||
          rawMsg.includes('Failed to fetch') ||
          rawMsg.includes('connect');
        Alert.alert(
          isNetworkErr ? 'Error de Conexión' : 'Atención',
          rawMsg ||
            'No se pudo conectar con el servidor para sincronizar tu cuenta.',
        );
        setLoading(false);
        return;
      }

      // Determinar rol
      const roles = (backendUser as any).roles || [];
      const isAdmin = roles.some(
        (role: any) => role.name === 'platform_admin' || role.name === 'admin',
      );
      const isOwner =
        roles.some(
          (role: any) =>
            role.name === 'transport_owner' ||
            role.name === 'vehicle_owner' ||
            role.name === 'owner' ||
            role.name === 'civil_association',
        ) ||
        (backendUser as any)?.role === 'transport_owner' ||
        (backendUser as any)?.transportOwner != null ||
        (backendUser as any)?.transport_owner != null;
      const isDriver = roles.some((role: any) => role.name === 'driver');

      let isVehicleOwner = isOwner;
      if (!isVehicleOwner) {
        try {
          const ownerRes = await getMyTransportOwnerProfile().catch(() => null);
          if (
            ownerRes &&
            (ownerRes.status === 'pending_review' ||
              ownerRes.status === 'pending' ||
              ownerRes.status === 'approved' ||
              ownerRes.status === 'rejected')
          ) {
            isVehicleOwner = true;
          }
        } catch {}
      }

      if (!isVehicleOwner && !currentUser.emailVerified) {
        router.replace({
          pathname: '/verify-email',
          params: { email: targetEmail },
        } as any);
        return;
      }

      await AsyncStorage.setItem('last_login_email', targetEmail);

      try {
        await getFareAccountByUserId(backendUser.id);
      } catch {
        try {
          await createFareAccount(backendUser.id);
        } catch (createError) {
          console.warn('[Landing] Error creando cuenta tarifa:', createError);
        }
      }

      let userRole = isAdmin
        ? 'platform_admin'
        : isVehicleOwner
          ? 'transport_owner'
          : isDriver
            ? 'driver'
            : 'passenger';

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
              userRole = claimRole;
            }
          }
        } catch {}
      }

      await SecureStore.setItemAsync('user_role', userRole);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshAuthSessionPhase();

      const normRole = (userRole || '').toLowerCase();
      if (normRole === 'platform_admin' || normRole === 'admin') {
        router.replace('/admin/dashboard' as any);
      } else if (
        normRole === 'transport_owner' ||
        normRole === 'vehicle_owner' ||
        normRole === 'owner'
      ) {
        router.replace('/vehicle-owner/dashboard' as any);
      } else if (normRole === 'driver' || normRole === 'conductor') {
        router.replace('/driver/dashboard' as any);
      } else {
        router.replace('/(tabs)' as any);
      }
    } catch (error: any) {
      console.warn('Login error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/user-not-found'
      ) {
        Alert.alert(
          'Datos incorrectos',
          'El correo o la contraseña no coinciden. Por favor verifica que estén bien escritos.',
        );
      } else if (error.code === 'auth/too-many-requests') {
        Alert.alert(
          'Intenta más tarde',
          'Muchos intentos fallidos por seguridad. Espera unos minutos antes de volver a intentar.',
        );
      } else if (error.code === 'auth/network-request-failed') {
        Alert.alert(
          'Sin conexión',
          'No se pudo conectar a internet. Revisa tu conexión Wi-Fi o datos móviles.',
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Logo */}
          <HeaderLogo />

          {/* Hero Image */}
          <View
            style={[
              styles.heroWrapper,
              { paddingTop: heroPaddingTop, paddingBottom: heroPaddingBottom },
            ]}
          >
            <ImageHero size={heroSize} />
          </View>

          {/* Bottom Sheet */}
          <View
            style={[
              styles.bottomSheet,
              { paddingBottom: insets.bottom + tokens.spacing.xl },
            ]}
          >
            <View
              style={[
                styles.sheetContent,
                isTablet && styles.sheetContentTablet,
              ]}
            >
              {/* Título y Subtítulo */}
              <View style={styles.textContainer}>
                <Text
                  style={[styles.title, isTablet && styles.titleTablet]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  Muévete libremente por{' '}
                  <Text style={styles.titleHighlight}>tu ciudad.</Text>
                </Text>
                <Text
                  style={[
                    styles.subtitle,
                    isTablet && styles.subtitleTablet,
                    { marginBottom: tokens.spacing.md },
                  ]}
                >
                  Tu pase digital para el transporte público sin efectivo. Viaja
                  de forma rápida, cómoda y segura.
                </Text>
              </View>

              {/* Tarjetas de Características para Tablets / Pantallas Grandes */}
              {isTablet && (
                <View style={styles.featuresRowTablet}>
                  <FeatureCard
                    title="Pago Rápido"
                    description="Recargas al instante y validación de pasaje sin contacto."
                    iconName="wallet-outline"
                    iconBgColor={tokens.colors.primary}
                    iconColor={tokens.colors.surface}
                    style={{ marginRight: tokens.spacing.md }}
                  />
                  <FeatureCard
                    title="Seguridad en Rutas"
                    description="Rastreo en tiempo real y verificación de pase digital."
                    iconName="shield-checkmark-outline"
                    iconBgColor={tokens.colors.iconGreen}
                    iconColor={tokens.colors.surface}
                  />
                </View>
              )}

              {/* ── FORMULARIO DE INICIO DE SESIÓN ── */}
              <View style={styles.formContainer}>
                {/* ── CAMBIAR MODO DE INICIO (TEXTLINK SUPERIOR) ── */}
                <Pressable
                  style={({ pressed }) => [
                    styles.phoneLinkRow,
                    pressed && styles.phoneLinkRowPressed,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setLoginMode((prev) =>
                      prev === 'email' ? 'phone' : 'email',
                    );
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    loginMode === 'email'
                      ? 'Ingresar con número de teléfono'
                      : 'Ingresar con correo electrónico'
                  }
                >
                  <Ionicons
                    name={
                      loginMode === 'email' ? 'call-outline' : 'mail-outline'
                    }
                    size={15}
                    color={tokens.colors.primary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.phoneLinkText}>
                    {loginMode === 'email'
                      ? 'Ingresar con número de teléfono'
                      : 'Ingresar con correo electrónico'}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color={tokens.colors.primary}
                    style={{ marginLeft: 6 }}
                  />
                </Pressable>

                {loginMode === 'email' ? (
                  /* Input Correo */
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>CORREO ELECTRÓNICO</Text>
                    <View
                      style={[
                        styles.inputCard,
                        focusedField === 'email' && styles.inputCardFocused,
                      ]}
                    >
                      <Ionicons
                        name="mail-outline"
                        size={20}
                        color={
                          focusedField === 'email'
                            ? tokens.colors.primary
                            : '#3072ffe7'
                        }
                      />
                      <View style={styles.divider} />
                      <TextInput
                        style={styles.input}
                        placeholder="correo@ejemplo.com"
                        placeholderTextColor="#94A3B8"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        spellCheck={false}
                        textContentType="emailAddress"
                        autoComplete="email"
                        returnKeyType="next"
                        onSubmitEditing={() => passwordRef.current?.focus()}
                        blurOnSubmit={false}
                        value={email}
                        onChangeText={setEmail}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        editable={!loading}
                        selectionColor={tokens.colors.primary}
                      />
                    </View>
                  </View>
                ) : (
                  /* Input Teléfono */
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>NÚMERO DE TELÉFONO</Text>
                    <View
                      style={[
                        styles.inputCard,
                        focusedField === 'phone' && styles.inputCardFocused,
                      ]}
                    >
                      <View style={styles.countryPicker}>
                        <Text style={styles.flagText}>🇻🇪</Text>
                        <Text style={styles.countryCodeText}>+58</Text>
                        <Ionicons
                          name="chevron-down"
                          size={12}
                          color="#6B7A93"
                          style={{ marginLeft: 4 }}
                        />
                      </View>
                      <View style={styles.divider} />
                      <TextInput
                        style={styles.input}
                        placeholder="414 000 0000"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                        textContentType="telephoneNumber"
                        autoComplete="tel"
                        importantForAutofill="yes"
                        value={phoneNumber}
                        onChangeText={(text) => {
                          let cleaned = text.replace(/[^0-9]/g, '');
                          if (cleaned.startsWith('58')) {
                            cleaned = cleaned.slice(2);
                          }
                          if (cleaned.startsWith('0')) {
                            cleaned = cleaned.slice(1);
                          }
                          setPhoneNumber(cleaned);
                        }}
                        maxLength={10}
                        returnKeyType="next"
                        onSubmitEditing={() => passwordRef.current?.focus()}
                        blurOnSubmit={false}
                        onFocus={() => setFocusedField('phone')}
                        onBlur={() => setFocusedField(null)}
                        editable={!loading}
                        selectionColor={tokens.colors.primary}
                      />
                    </View>
                    <View style={styles.phoneNoteRow}>
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={13}
                        color={tokens.colors.primary}
                        style={{ marginTop: 1, marginRight: 6 }}
                      />
                      <Text style={styles.phoneNoteText}>
                        Tu número de teléfono se utilizará para localizar tu
                        cuenta de forma segura.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Input Contraseña */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>CONTRASEÑA</Text>
                  <View
                    style={[
                      styles.inputCard,
                      focusedField === 'password' && styles.inputCardFocused,
                    ]}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={
                        focusedField === 'password'
                          ? tokens.colors.primary
                          : '#3072ffe7'
                      }
                    />
                    <View style={styles.divider} />
                    <TextInput
                      ref={passwordRef}
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      spellCheck={false}
                      textContentType="password"
                      autoComplete="password"
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      editable={!loading}
                      selectionColor={tokens.colors.primary}
                    />
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowPassword(!showPassword);
                      }}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword ? 'Ocultar contraseña' : 'Ver contraseña'
                      }
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#8594AB"
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Enlace Olvidé mi Contraseña */}
                <View style={styles.forgotRow}>
                  <Pressable
                    onPress={() => router.push('/forgot-password' as any)}
                    hitSlop={10}
                  >
                    <Text style={styles.forgotLink}>
                      ¿Olvidaste tu contraseña?
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* ── BOTÓN Y ENLACES ── */}
              <View style={styles.actionsContainer}>
                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    isTablet && styles.buttonTablet,
                    pressed && styles.buttonPressed,
                    loading && styles.buttonDisabled,
                  ]}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <View style={styles.buttonContent}>
                      <Text style={styles.buttonText}>Iniciar Sesión</Text>
                      <Ionicons
                        name="arrow-forward"
                        size={tokens.typography.sizes.lg}
                        color={tokens.colors.surface}
                        style={styles.buttonIcon}
                      />
                    </View>
                  )}
                </Pressable>

                {/* Fila de registro para usuarios sin cuenta */}
                <View style={styles.registerContainer}>
                  <Text
                    style={[
                      styles.registerText,
                      isTablet && styles.registerTextTablet,
                    ]}
                  >
                    ¿No tienes una cuenta?{' '}
                    <Text
                      style={[
                        styles.registerLink,
                        isTablet && styles.registerLinkTablet,
                      ]}
                      onPress={() => router.push('/register' as any)}
                    >
                      Regístrate
                    </Text>
                  </Text>
                </View>

                {/* Fila de registro para dueños de vehículo */}
                <View
                  style={[
                    styles.registerContainer,
                    { marginTop: 0, marginBottom: tokens.spacing.xs },
                  ]}
                >
                  <Text
                    style={[
                      styles.registerText,
                      isTablet && styles.registerTextTablet,
                      { textAlign: 'center' },
                    ]}
                  >
                    ¿Eres dueño de vehículo?{' '}
                    <Text
                      style={[
                        styles.registerLink,
                        isTablet && styles.registerLinkTablet,
                      ]}
                      onPress={() =>
                        router.push('/register-vehicle-owner' as any)
                      }
                    >
                      Envía tu solicitud aquí
                    </Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    width: '100%',
  },
  heroWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  bottomSheet: {
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: tokens.radii.sheet,
    borderTopRightRadius: tokens.radii.sheet,
    flex: 1,
    paddingTop: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetContent: {
    flex: 1,
    width: '100%',
    maxWidth: 580,
    alignSelf: 'center',
    paddingVertical: tokens.spacing.xs,
  },
  sheetContentTablet: {
    maxWidth: 680,
    paddingVertical: tokens.spacing.lg,
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
  },
  formContainer: {
    width: '100%',
    marginTop: tokens.spacing.xs,
    marginBottom: tokens.spacing.xs,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 1.1,
    marginBottom: 6,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    height: 52,
  },
  inputCardFocused: {
    borderColor: tokens.colors.primary,
    backgroundColor: '#FFFFFF',
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: '#D4DEEC',
    marginHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.medium,
    color: tokens.colors.textDark,
  },
  forgotRow: {
    alignItems: 'flex-end',
    width: '100%',
    marginTop: 2,
    marginBottom: 8,
  },
  forgotLink: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  actionsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.textDark,
    textAlign: 'center',
    marginBottom: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.xs,
  },
  titleTablet: {
    fontSize: 34,
    lineHeight: 44,
    marginBottom: tokens.spacing.md,
  },
  titleHighlight: {
    color: tokens.colors.primary,
  },
  subtitle: {
    fontSize: tokens.typography.sizes.sm,
    color: tokens.colors.textGray,
    fontFamily: tokens.typography.fontFamily.regular,
    lineHeight: 22,
    textAlign: 'justify',
    alignSelf: 'stretch',
    marginBottom: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.sm,
  },
  subtitleTablet: {
    fontSize: 18,
    lineHeight: 26,
    marginBottom: tokens.spacing.xl,
    textAlign: 'justify',
  },
  featuresRowTablet: {
    flexDirection: 'row',
    width: '100%',
    marginVertical: tokens.spacing.lg,
  },
  featuresRow: {
    flexDirection: 'row',
    marginBottom: tokens.spacing.xxl,
  },
  button: {
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radii.full,
    paddingVertical: 16,
    paddingHorizontal: tokens.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    width: '100%',
    marginBottom: tokens.spacing.sm,
  },
  buttonTablet: {
    height: 56,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: tokens.colors.surface,
    fontSize: 17,
    fontFamily: tokens.typography.fontFamily.bold,
    letterSpacing: 0.2,
  },
  buttonIcon: {
    marginLeft: tokens.spacing.sm,
  },
  phoneLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    marginBottom: 12,
  },
  phoneLinkRowPressed: {
    opacity: 0.65,
  },
  phoneLinkText: {
    fontSize: tokens.typography.sizes.sm,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 2,
  },
  flagText: {
    fontSize: 18,
    marginRight: 4,
    lineHeight: 22,
  },
  countryCodeText: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  phoneNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  phoneNoteText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#6B7A93',
    flex: 1,
    lineHeight: 16,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: tokens.spacing.xs,
    marginBottom: tokens.spacing.md,
  },
  registerText: {
    fontSize: tokens.typography.sizes.sm,
    fontFamily: tokens.typography.fontFamily.medium,
    color: tokens.colors.textGray,
  },
  registerTextTablet: {
    fontSize: 16,
  },
  registerLink: {
    fontSize: tokens.typography.sizes.sm,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  registerLinkTablet: {
    fontSize: 16,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 10,
    color: '#9CA3AF',
    fontFamily: tokens.typography.fontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
