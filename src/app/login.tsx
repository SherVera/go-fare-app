import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import { signIn, sendVerificationEmail, sigOutAccount } from '@/lib/firebase';
import { ScreenHeader } from '@/components/ScreenHeader';
import { tokens } from '@/theme/tokens';
import type { LoginFormState } from '@/interfaces';

export default function LoginScreen() {
  const router = useRouter();
  // Estado del formulario — tipado por LoginFormState
  const [email, setEmail] = useState<LoginFormState['email']>('');
  const [password, setPassword] = useState<LoginFormState['password']>('');
  const [showPassword, setShowPassword] = useState<LoginFormState['showPassword']>(false);
  const [loading, setLoading] = useState<LoginFormState['loading']>(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/landing');
    }
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    // Validaciones básicas de formato
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert('Atención', 'Por favor, ingresa un correo electrónico válido.');
      return;
    }
    if (trimmedPassword.length < 6) {
      Alert.alert('Atención', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      setLoading(true);

      // Autenticar con Firebase
      const userCredential = await signIn({ email: trimmedEmail, password: trimmedPassword });

      // Bloquear acceso si el correo no ha sido verificado
      if (!userCredential.user.emailVerified) {
        // Cerrar sesión para no dejar al usuario en un estado intermedio
        try {
          await sigOutAccount();
        } catch {
          /* Ignorar errores de cierre de sesión; el guardián de rutas ya maneja el estado */
        }
        Alert.alert(
          'Correo No Verificado',
          'Por favor, verifica tu correo antes de iniciar sesión.\n\nSi no ves el correo, revisa tu carpeta de Spam o Promociones y agrega noreply@gofare.firebaseapp.com a tus contactos.',
          [
            { text: 'Cerrar', style: 'cancel' },
            {
              text: 'Reenviar Correo',
              onPress: async () => {
                try {
                  // Necesitamos volver a autenticar brevemente para enviar el correo
                  const temp = await signIn({ email: trimmedEmail, password: trimmedPassword });
                  if (temp.user) {
                    await sendVerificationEmail(temp.user);
                    await sigOutAccount();
                    Alert.alert('Correo Enviado', 'Se ha enviado un nuevo correo de verificación.');
                  }
                } catch {
                  Alert.alert('Error', 'No se pudo enviar el correo. Intenta de nuevo más tarde.');
                }
              },
            },
          ],
        );
        return;
      }

      // Correo verificado — permitir acceso
      router.replace('/(tabs)' as any);
    } catch (error: any) {
      console.error('Login error:', error);
      // Manejar errores comunes de Firebase Auth con mensajes claros
      if (
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/user-not-found'
      ) {
        Alert.alert('Error', 'Correo o contraseña inválidos. Intenta de nuevo.');
      } else if (error.code === 'auth/too-many-requests') {
        Alert.alert('Error', 'Demasiados intentos fallidos. Intenta de nuevo más tarde.');
      } else if (error.code === 'auth/network-request-failed') {
        Alert.alert('Error', 'Error de red. Revisa tu conexión a internet.');
      } else {
        Alert.alert('Error', error.message || 'Ocurrió un error al iniciar sesión.');
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#8594AB"
              />
            </Pressable>
          </View>

          {/* ── OLVIDÉ MI CONTRASEÑA ── */}
          <View style={styles.forgotRow}>
            <Pressable onPress={() => router.push('/forgot-password' as any)} hitSlop={10}>
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

          {/* ── BOTÓN ── */}
          <Pressable
            style={({ pressed }) => [
              styles.cta,
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
                <Ionicons name="arrow-forward-circle-outline" size={20} color="#fff" style={{ marginLeft: 10 }} />
              </>
            )}
          </Pressable>

          {/* ── LINK A REGISTRO ── */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>¿No tienes una cuenta? </Text>
            <Pressable onPress={() => router.push('/register' as any)}>
              <Text style={styles.registerLink}>Regístrate</Text>
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
    opacity: 0.30,
    top: 18,
    transform: [{ scaleX: 0.90 }],
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
});
