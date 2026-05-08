import { ScreenHeader } from '@/components/ScreenHeader';
import { tokens } from '@/theme/tokens';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sentResetEmail } from '@/lib/firebase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login');
    }
  };

  const handleResetPassword = async () => {
    const trimmedEmail = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert('Atención', 'Por favor, ingresa un correo electrónico válido.');
      return;
    }

    try {
      setLoading(true);
      await sentResetEmail(trimmedEmail);
      setSentEmail(trimmedEmail);
      setEmailSent(true);
    } catch (error: any) {
      console.error('Reset password error:', error);
      if (error.code === 'auth/user-not-found') {
        Alert.alert('Error', 'No existe una cuenta asociada a este correo electrónico.');
      } else if (error.code === 'auth/invalid-email') {
        Alert.alert('Error', 'El correo electrónico tiene un formato incorrecto.');
      } else if (error.code === 'auth/too-many-requests') {
        Alert.alert('Error', 'Demasiados intentos. Intenta de nuevo más tarde.');
      } else if (error.code === 'auth/network-request-failed') {
        Alert.alert('Error', 'Error de red. Revisa tu conexión a internet.');
      } else {
        Alert.alert('Error', error.message || 'No se pudo enviar el correo de recuperación.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Pantalla de éxito — se muestra tras enviar el correo
  if (emailSent) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.blob} />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScreenHeader title="Revisa tu Correo" onBack={handleBack} />
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
                  name="email-fast-outline"
                  size={96}
                  color={tokens.colors.primary}
                />
              </View>
            </View>

            {/* ── TÍTULOS ── */}
            <View style={[styles.titleBlock, { alignItems: 'center' }]}>
              <Text style={[styles.titleDark, { textAlign: 'center' }]}>Correo</Text>
              <Text style={[styles.titleBlue, { textAlign: 'center' }]}>Enviado</Text>
              <Text style={[styles.subtitle, { textAlign: 'center' }]}>
                {`Hemos enviado un enlace de recuperación a:\n`}
                <Text style={{ fontFamily: tokens.typography.fontFamily.bold, color: '#18243E' }}>
                  {sentEmail}
                </Text>
                {`\n\nHaz clic en el enlace del correo para restablecer tu contraseña.`}
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
                1. Revisa tu carpeta <Text style={styles.spamBold}>Spam / Correo no deseado</Text>.{'\n'}
                2. Busca también en <Text style={styles.spamBold}>Promociones</Text> (Gmail).{'\n'}
                3. Agrega <Text style={styles.spamBold}>noreply@gofare.firebaseapp.com</Text> a tus contactos.{'\n'}
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
              <Ionicons name="arrow-forward-circle-outline" size={20} color="#fff" style={{ marginLeft: 10 }} />
            </Pressable>

            {/* ── REENVIAR CORREO ── */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>¿Aún nada? </Text>
              <Pressable onPress={handleResetPassword} disabled={loading}>
                <Text style={styles.registerLink}>
                  {loading ? 'Enviando...' : 'Reenviar correo'}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.footerLegal}>CARACAS MOVE • RECUPERACIÓN SEGURA</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Blob decorativo */}
      <View style={styles.blob} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title="Recuperar Contraseña" onBack={handleBack} />

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
                name="lock-reset"
                size={96}
                color={tokens.colors.primary}
              />
            </View>
          </View>

          {/* ── TÍTULOS ── */}
          <View style={styles.titleBlock}>
            <Text style={styles.titleDark}>¿Olvidaste tu</Text>
            <Text style={styles.titleBlue}>Contraseña?</Text>
            <Text style={styles.subtitle}>
              {`No te preocupes. Ingresa tu correo y te enviaremos un enlace para restablecerla.`}
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
              onSubmitEditing={handleResetPassword}
              returnKeyType="send"
            />
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
              Te enviaremos un enlace seguro para restablecer tu contraseña.
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
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>Enviar Enlace</Text>
                <Ionicons name="send-outline" size={20} color="#fff" style={{ marginLeft: 10 }} />
              </>
            )}
          </Pressable>

          {/* ── LINK A LOGIN ── */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>¿Recuerdas tu contraseña? </Text>
            <Pressable onPress={() => router.push('/login' as any)}>
              <Text style={styles.registerLink}>Inicia sesión</Text>
            </Pressable>
          </View>

          {/* ── FOOTER ── */}
          <View style={styles.footerRow}>
            <Text style={styles.footerHelp}>¿Necesitas ayuda?</Text>
            <Text style={styles.footerBullet}> • </Text>
            <Text style={styles.footerSupport}>Soporte Técnico</Text>
          </View>
          <Text style={styles.footerLegal}>CARACAS MOVE • RECUPERACIÓN SEGURA</Text>

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
    opacity: 0.60,
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
    shadowOpacity: 0.40,
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
});
