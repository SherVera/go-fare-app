import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useLiteMode } from '@/context/LiteModeContext';
import { findEmailByPhone, syncWithBackend } from '@/lib/api';
import { refreshAuthSessionPhase } from '@/lib/auth-session';
import { auth, signIn } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

export default function PhoneLoginScreen() {
  const router = useRouter();
  const { isLiteMode, setLiteMode } = useLiteMode();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login' as any);
    }
  };

  const handlePhoneLogin = async () => {
    let cleaned = phoneNumber.trim().replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    }

    if (cleaned.length !== 10) {
      Alert.alert(
        'Número de teléfono inválido',
        'Ingresa los 10 dígitos de tu número de teléfono (ej. 414 000 0000).',
      );
      return;
    }

    const trimmedPassword = password.trim();
    if (trimmedPassword.length < 6) {
      Alert.alert(
        'Contraseña inválida',
        'La contraseña debe tener al menos 6 caracteres.',
      );
      return;
    }

    const e164 = `+58${cleaned}`;

    try {
      setLoading(true);
      const foundEmail = await findEmailByPhone(e164);
      if (!foundEmail) {
        Alert.alert(
          'Cuenta no encontrada',
          'No se encontró ninguna cuenta registrada con este número de teléfono. Verifica el número o regístrate.',
        );
        setLoading(false);
        return;
      }

      // Autenticar con Firebase Auth usando el correo asociado y la contraseña
      const userCredential = await signIn({
        email: foundEmail,
        password: trimmedPassword,
      });

      if (userCredential?.user) {
        await AsyncStorage.setItem('phone_verified_bypass', 'true');
        await AsyncStorage.setItem('auth_method', 'phone');

        let backendUser: any = null;
        try {
          const response = await syncWithBackend(userCredential.user);
          backendUser = response.user;
        } catch (syncErr) {
          console.warn('[phone-login] sync error handled:', syncErr);
        }

        const roles = (backendUser as any)?.roles || [];
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

        await SecureStore.setItemAsync('user_role', userRole);
        await refreshAuthSessionPhase();
        setLoading(false);

        if (userRole === 'platform_admin' || userRole === 'admin') {
          router.replace('/admin/dashboard' as any);
        } else if (userRole === 'transport_owner') {
          router.replace('/vehicle-owner/dashboard' as any);
        } else if (userRole === 'driver') {
          router.replace('/driver/dashboard' as any);
        } else {
          router.replace('/(tabs)' as any);
        }
      }
    } catch (error: any) {
      console.error('[phone-login] login error:', error);
      if (
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/user-not-found'
      ) {
        Alert.alert(
          'Credenciales incorrectas',
          'El número de teléfono o la contraseña son incorrectos.',
        );
      } else if (error.code === 'auth/too-many-requests') {
        Alert.alert(
          'Error',
          'Demasiados intentos fallidos. Intenta de nuevo más tarde.',
        );
      } else {
        Alert.alert(
          'Error al iniciar sesión',
          error?.message ?? 'Ocurrió un error al verificar tus credenciales.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.blob} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title="Iniciar con Teléfono" onBack={handleBack} />

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
                name="cellphone"
                size={96}
                color={tokens.colors.primary}
              />
            </View>
          </View>

          {/* ── TÍTULOS ── */}
          <View style={styles.titleBlock}>
            <Text style={styles.titleDark}>Tu</Text>
            <Text style={styles.titleBlue}>Número</Text>
            <Text style={styles.subtitle}>
              Ingresa tu número de teléfono y contraseña para acceder a tu cuenta.
            </Text>
          </View>

          {/* ── CARD MODO LITE ── */}
          <View style={styles.liteModeCard}>
            <View style={styles.liteModeInfo}>
              <Ionicons
                name="flash"
                size={20}
                color={isLiteMode ? tokens.colors.primary : '#8594AB'}
              />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.liteModeTitle}>Modo Lite (Alto Rendimiento)</Text>
                <Text style={styles.liteModeSubtitle}>
                  {isLiteMode
                    ? 'Activado: Ahorro de datos y batería'
                    : 'Modo estándar'}
                </Text>
              </View>
            </View>
            <Switch
              value={isLiteMode}
              onValueChange={(val) => setLiteMode(val)}
              trackColor={{ false: '#D4DEEC', true: tokens.colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* ── INPUT TELÉFONO ── */}
          <Text style={styles.inputLabel}>NÚMERO DE TELÉFONO</Text>
          <View style={styles.inputCard}>
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
              placeholderTextColor="#B8C4D4"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, '');
                setPhoneNumber(cleaned);
              }}
              maxLength={10}
              selectionColor={tokens.colors.primary}
              editable={!loading}
            />
          </View>

          {/* ── INPUT CONTRASEÑA ── */}
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
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              style={({ pressed }) => [
                styles.eyeButton,
                pressed && { opacity: 0.6 },
              ]}
              hitSlop={10}
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#6B7A93"
              />
            </Pressable>
          </View>

          <View style={styles.secureRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={13}
              color={tokens.colors.primary}
              style={{ marginTop: 1, marginRight: 6 }}
            />
            <Text style={styles.secureText}>
              Tu número de teléfono se utilizará para localizar tu cuenta e iniciar sesión de forma segura.
            </Text>
          </View>

          <View style={{ flex: 1, minHeight: 36 }} />

          {/* ── BOTÓN CONTINUAR ── */}
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              loading && { opacity: 0.7 },
            ]}
            onPress={handlePhoneLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>Iniciar Sesión</Text>
                <Ionicons
                  name="arrow-forward-outline"
                  size={20}
                  color="#fff"
                  style={{ marginLeft: 10 }}
                />
              </>
            )}
          </Pressable>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>
              ¿Prefieres usar email?{' '}
              <Text
                style={styles.loginLink}
                onPress={() => router.replace('/login' as any)}
              >
                Iniciar sesión
              </Text>
            </Text>
          </View>

          <Text style={styles.footerLegal}>
            CARACAS MOVE • ACCESO SEGURO
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  liteModeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D4DEEC',
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  liteModeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  liteModeTitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  liteModeSubtitle: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#6B7A93',
    marginTop: 2,
  },
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
  iconSection: { alignItems: 'center', marginBottom: 36 },
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
  titleBlock: { marginBottom: 28 },
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
    marginBottom: 10,
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
    marginBottom: 16,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
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
  eyeButton: {
    padding: 6,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
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
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 36,
  },
  loginText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#6B7A93',
  },
  loginLink: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
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
