import { ScreenHeader } from '@/components/ScreenHeader';
import { tokens } from '@/theme/tokens';
import type { RegisterFormState } from '@/interfaces';
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
import { createUser, setDocument, updateUser, sendVerificationEmail, sigOutAccount } from '@/lib/firebase';

export default function RegisterScreen() {
    const router = useRouter();
    // Estado del formulario — tipado por RegisterFormState
    const [fullName, setFullName] = useState<RegisterFormState['fullName']>('');
  const [idNumber, setIdNumber] = useState<RegisterFormState['idNumber']>('');
  const [email, setEmail] = useState<RegisterFormState['email']>('');
  const [password, setPassword] = useState<RegisterFormState['password']>('');
  const [phoneNumber, setPhoneNumber] = useState<RegisterFormState['phoneNumber']>('');
  const [showPassword, setShowPassword] = useState<RegisterFormState['showPassword']>(false);
  const [loading, setLoading] = useState<RegisterFormState['loading']>(false);
  // Controla si mostrar la pantalla de verificación pendiente
  const [verificationSent, setVerificationSent] = useState<RegisterFormState['verificationSent']>(false);
  const [registeredEmail, setRegisteredEmail] = useState<RegisterFormState['registeredEmail']>('');

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/landing');
    }
  };

  const handleRegister = async () => {
    try {
      const trimmedFullName = fullName.trim();
      const trimmedIdNumber = idNumber.trim();
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();
      const trimmedPhoneNumber = phoneNumber.trim();

      // Validaciones básicas
      if (trimmedFullName.length < 3) {
        Alert.alert('Atención', 'El nombre debe tener al menos 3 caracteres.');
        return;
      }
      if (!/^\d{5,10}$/.test(trimmedIdNumber)) {
        Alert.alert('Atención', 'La cédula debe contener entre 5 y 10 dígitos.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        Alert.alert('Atención', 'Por favor, ingresa un correo electrónico válido.');
        return;
      }
      if (!/^(0412|0414|0424|0416|0426|0212)\d{7}$/.test(trimmedPhoneNumber)) {
        Alert.alert('Atención', 'Por favor, ingresa un número de teléfono válido (ej. 04120000000).');
        return;
      }
      if (trimmedPassword.length < 6) {
        Alert.alert('Atención', 'La contraseña debe tener al menos 6 caracteres.');
        return;
      }

      setLoading(true);

      // Crear usuario en Firebase Authentication
      const userCredential = await createUser({ email: trimmedEmail, password: trimmedPassword });
      const { user } = userCredential;

      // Retraso para sincronizar sesión nativa
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Actualizar el perfil del usuario con su nombre
      await updateUser(user, { displayName: trimmedFullName });

      // Guardar datos adicionales en Firestore con valores iniciales
      await setDocument(`users/${user.uid}`, {
        fullName: trimmedFullName,
        idNumber: trimmedIdNumber,
        email: trimmedEmail,
        phoneNumber: trimmedPhoneNumber,
        balance: 0,
        carnetId: `GO-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
      });

      // Intentar enviar el correo de verificación pasando el user directamente
      // Se usa un try/catch propio para que, si falla, igual mostremos la pantalla
      try {
        await sendVerificationEmail(user);
      } catch (emailError: any) {
        console.error('Verification email error:', emailError);
        Alert.alert(
          'Aviso',
          'La cuenta se creó pero no pudimos enviar el correo de verificación. Puedes intentar reenviarlo desde la pantalla de inicio de sesión.'
        );
      }

      // Cerrar sesión inmediatamente para que no pueda acceder hasta verificar
      try {
        await sigOutAccount();
      } catch (signOutError) {
        console.warn('Could not sign out after registration:', signOutError);
      }

      // Siempre mostrar la pantalla de verificación pendiente
      setRegisteredEmail(trimmedEmail);
      setVerificationSent(true);
    } catch (error: any) {
      console.error("Registration error:", error);
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert('Error', 'El correo electrónico ya está en uso por otra cuenta.');
      } else if (error.code === 'auth/invalid-email') {
        Alert.alert('Error', 'El correo electrónico tiene un formato incorrecto.');
      } else if (error.code === 'auth/weak-password') {
        Alert.alert('Error', 'La contraseña es muy débil.');
      } else {
        Alert.alert('Error', error.message || 'Ocurrió un error durante el registro.');
      }
    } finally {
      setLoading(false);
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
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
              <Text style={[styles.titleDark, { textAlign: 'center' }]}>Revisa tu</Text>
              <Text style={[styles.titleBlue, { textAlign: 'center' }]}>Bandeja de Entrada</Text>
              <Text style={[styles.subtitle, { textAlign: 'center' }]}>
                {`Hemos enviado un enlace de verificación a:\n`}
                <Text style={{ fontFamily: tokens.typography.fontFamily.bold, color: '#18243E' }}>
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
                1. Revisa tu carpeta <Text style={styles.spamBold}>Spam / Correo no deseado</Text>.{'\n'}
                2. Busca también en <Text style={styles.spamBold}>Promociones</Text> (Gmail).{'\n'}
                3. Agrega <Text style={styles.spamBold}>noreply@gofare.firebaseapp.com</Text> a tus contactos.{'\n'}
                4. Si sigue sin llegar, espera 1 minuto y presiona reenviar.
              </Text>
            </View>

            {/* ── BOTÓN — Ir a Login ── */}
            <Pressable
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
              onPress={() => router.replace('/login' as any)}
            >
              <Text style={styles.ctaText}>Ir al Login</Text>
              <Ionicons name="arrow-forward-circle-outline" size={20} color="#fff" style={{ marginLeft: 10 }} />
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

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Forma decorativa */}
      <View style={styles.blob} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

          {/* ── INPUTS ── */}
          <Text style={styles.inputLabel}>NOMBRE COMPLETO</Text>
          <View style={styles.inputCard}>
            <Ionicons name="person-outline" size={20} color="#3072ffe7" />
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="ej. Carlos Pérez"
              placeholderTextColor="#B8C4D4"
              value={fullName}
              onChangeText={setFullName}
              selectionColor={tokens.colors.primary}
              editable={!loading}
            />
          </View>

          <Text style={styles.inputLabel}>CÉDULA DE IDENTIDAD</Text>
          <View style={styles.inputCard}>
            <Text style={styles.prefix}>V-</Text>
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="00000000"
              placeholderTextColor="#B8C4D4"
              keyboardType="number-pad"
              value={idNumber}
              onChangeText={setIdNumber}
              maxLength={10}
              selectionColor={tokens.colors.primary}
              editable={!loading}
            />
          </View>
          
          <Text style={styles.inputLabel}>TELÉFONO</Text>
          <View style={styles.inputCard}>
            <Ionicons name="call-outline" size={20} color="#3072ffe7" />
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="04120000000"
              placeholderTextColor="#B8C4D4"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              maxLength={11}
              selectionColor={tokens.colors.primary}
              editable={!loading}
            />
          </View>

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
              hitSlop={10}
            >
              <Ionicons 
                name={showPassword ? "eye-off-outline" : "eye-outline"} 
                size={22} 
                color="#8594AB" 
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
              Tu información será validada de forma segura.
            </Text>
          </View>

          <View style={{ flex: 1, minHeight: 32 }} />

          {/* ── BOTÓN ── */}
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }, loading && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>Crear Cuenta</Text>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginLeft: 10 }} />
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
    marginBottom: 32,
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
});
