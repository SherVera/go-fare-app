import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
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
import { syncWithBackend } from '@/lib/api';
import { confirmPhoneCode, sendPhoneVerificationCode, sigOutAccount } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

type Step = 'phone' | 'otp';

export default function PhoneLoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const confirmationRef = useRef<FirebaseAuthTypes.ConfirmationResult | null>(
    null,
  );

  const handleBack = () => {
    if (step === 'otp') {
      setStep('phone');
      setOtp('');
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login' as any);
    }
  };

  const handleSendCode = async () => {
    const trimmed = phoneNumber.trim();
    // Formatos venezolanos: 04XX-XXXXXXX → +58 4XX XXXXXXX
    if (!/^(0412|0414|0424|0416|0426)\d{7}$/.test(trimmed)) {
      Alert.alert(
        'Número inválido',
        'Ingresa un número venezolano válido (ej. 04140000000).',
      );
      return;
    }

    // Convertir 04XXXXXXXXX → +584XXXXXXXXX
    const e164 = `+58${trimmed.slice(1)}`;

    try {
      setLoading(true);
      confirmationRef.current = await sendPhoneVerificationCode(e164);
      setStep('otp');
    } catch (error: any) {
      console.error('[phone-login] sendCode error:', error);
      if (error?.code === 'auth/invalid-phone-number') {
        Alert.alert('Error', 'El número de teléfono no es válido.');
      } else if (error?.code === 'auth/too-many-requests') {
        Alert.alert('Error', 'Demasiados intentos. Intenta más tarde.');
      } else {
        Alert.alert('Error', error?.message ?? 'No se pudo enviar el código.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (otp.trim().length < 6) {
      Alert.alert('Código inválido', 'El código debe tener 6 dígitos.');
      return;
    }
    if (!confirmationRef.current) {
      Alert.alert('Error', 'Solicita un nuevo código.');
      setStep('phone');
      return;
    }

    try {
      setLoading(true);
      const credential = await confirmPhoneCode(
        confirmationRef.current,
        otp.trim(),
      );

      if (credential?.user) {
        try {
          await syncWithBackend(credential.user);
        } catch (backendErr) {
          console.warn('[phone-login] backend sync failed:', backendErr);
          try {
            await sigOutAccount();
          } catch {}
          Alert.alert(
            'Error de Conexión',
            'No se pudo conectar con el servidor para sincronizar tu cuenta. Por favor, verifica tu conexión a internet e inténtalo de nuevo.'
          );
          setLoading(false);
          return;
        }
      }
    } catch (error: any) {
      console.error('[phone-login] verifyCode error:', error);
      if (error?.code === 'auth/invalid-verification-code') {
        Alert.alert(
          'Código incorrecto',
          'Verifica el código e intenta de nuevo.',
        );
      } else if (error?.code === 'auth/code-expired') {
        Alert.alert('Código expirado', 'Solicita un nuevo código.');
        setStep('phone');
        setOtp('');
      } else {
        Alert.alert(
          'Error',
          error?.message ?? 'No se pudo verificar el código.',
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
        <ScreenHeader
          title={step === 'phone' ? 'Iniciar con Teléfono' : 'Verificar Código'}
          onBack={handleBack}
        />

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
                name={step === 'phone' ? 'cellphone' : 'message-text-outline'}
                size={96}
                color={tokens.colors.primary}
              />
            </View>
          </View>

          {/* ── TÍTULOS ── */}
          <View style={styles.titleBlock}>
            {step === 'phone' ? (
              <>
                <Text style={styles.titleDark}>Tu</Text>
                <Text style={styles.titleBlue}>Número</Text>
                <Text style={styles.subtitle}>
                  Ingresa tu número venezolano y te enviaremos un código SMS.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.titleDark}>Código</Text>
                <Text style={styles.titleBlue}>SMS</Text>
                <Text style={styles.subtitle}>
                  {`Enviamos un código a +58${phoneNumber.trim().slice(1)}.\nIntrodúcelo a continuación.`}
                </Text>
              </>
            )}
          </View>

          {step === 'phone' ? (
            <>
              <Text style={styles.inputLabel}>NÚMERO DE TELÉFONO</Text>
              <View style={styles.inputCard}>
                <Ionicons name="call-outline" size={20} color="#3072ffe7" />
                <View style={styles.divider} />
                <TextInput
                  style={styles.input}
                  placeholder="04140000000"
                  placeholderTextColor="#B8C4D4"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  maxLength={11}
                  selectionColor={tokens.colors.primary}
                  editable={!loading}
                />
              </View>

              <View style={styles.secureRow}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={13}
                  color={tokens.colors.primary}
                  style={{ marginTop: 1, marginRight: 6 }}
                />
                <Text style={styles.secureText}>
                  Solo usamos tu número para verificar tu identidad vía SMS.
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.inputLabel}>CÓDIGO DE 6 DÍGITOS</Text>
              <View style={styles.inputCard}>
                <Ionicons name="keypad-outline" size={20} color="#3072ffe7" />
                <View style={styles.divider} />
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="000000"
                  placeholderTextColor="#B8C4D4"
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={setOtp}
                  maxLength={6}
                  selectionColor={tokens.colors.primary}
                  editable={!loading}
                />
              </View>

              <View style={styles.resendRow}>
                <Text style={styles.resendText}>¿No llegó el código? </Text>
                <Pressable
                  onPress={() => {
                    setStep('phone');
                    setOtp('');
                  }}
                  disabled={loading}
                  hitSlop={10}
                >
                  <Text style={styles.resendLink}>Reenviar</Text>
                </Pressable>
              </View>
            </>
          )}

          <View style={{ flex: 1, minHeight: 48 }} />

          <Pressable
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              loading && { opacity: 0.7 },
            ]}
            onPress={step === 'phone' ? handleSendCode : handleVerifyCode}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>
                  {step === 'phone' ? 'Enviar Código' : 'Verificar'}
                </Text>
                <Ionicons
                  name={
                    step === 'phone'
                      ? 'send-outline'
                      : 'checkmark-circle-outline'
                  }
                  size={20}
                  color="#fff"
                  style={{ marginLeft: 10 }}
                />
              </>
            )}
          </Pressable>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>¿Prefieres usar email? </Text>
            <Pressable onPress={() => router.replace('/login' as any)}>
              <Text style={styles.loginLink}>Iniciar sesión</Text>
            </Pressable>
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
  otpInput: {
    fontSize: 24,
    letterSpacing: 8,
  },
  secureRow: { flexDirection: 'row', alignItems: 'flex-start' },
  secureText: {
    flex: 1,
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#8594AB',
    lineHeight: 17,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resendText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#6B7A93',
  },
  resendLink: {
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
