import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
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
import { ScreenHeader } from '@/components/ScreenHeader';
import { linkPhoneNumber, syncWithBackend } from '@/lib/api';
import { refreshAuthSessionPhase } from '@/lib/auth-session';
import {
  auth,
  linkPhoneWithCredential,
  mergeUserProfile,
  sendLinkPhoneCode,
  sigOutAccount,
  updateUser,
} from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

function vePhoneFromE164(phone: string | null | undefined): string {
  if (!phone?.startsWith('+58') || phone.length < 12) return '';
  return `0${phone.slice(3)}`;
}

export default function OnboardingScreen() {
  const user = auth.currentUser;
  const isPhoneVerified = true; // Omitir verificación telefónica temporalmente
  const stepsCount = 2;

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState(
    () => user?.displayName?.trim() ?? '',
  );
  const [idNumber, setIdNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(() =>
    vePhoneFromE164(user?.phoneNumber ?? undefined),
  );
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!user) {
    return null;
  }

  const email = user.email ?? '';

  const handleBack = () => {
    if (step > 0) {
      setStep((s) => s - 1);
      return;
    }
    Alert.alert(
      'Salir del registro',
      'Si sales ahora, cerraremos la sesión y podrás elegir otro método de acceso.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await sigOutAccount();
            } catch (e) {
              console.warn('[onboarding] signOut:', e);
            }
          },
        },
      ],
    );
  };

  const validateStep = (): boolean => {
    if (step === 0) {
      if (fullName.trim().length < 3) {
        Alert.alert('Atención', 'El nombre debe tener al menos 3 caracteres.');
        return false;
      }
    }
    if (step === 1) {
      if (!/^\d{5,10}$/.test(idNumber.trim())) {
        Alert.alert(
          'Atención',
          'La cédula debe contener entre 5 y 10 dígitos (solo números).',
        );
        return false;
      }
    }
    if (step === 2) {
      if (!/^(0412|0414|0424|0416|0426|0212)\d{7}$/.test(phoneNumber.trim())) {
        Alert.alert('Atención', 'Ingresa un número válido (ej. 04120000000).');
        return false;
      }
    }
    if (step === 3) {
      if (otp.trim().length < 6) {
        Alert.alert(
          'Código inválido',
          'El código de verificación debe tener 6 dígitos.',
        );
        return false;
      }
    }
    return true;
  };

  const handlePrimary = async () => {
    if (!validateStep()) return;

    if (step < stepsCount - 1) {
      if (step === 2 && !isPhoneVerified) {
        const trimmed = phoneNumber.trim();
        const e164 = `+58${trimmed.slice(1)}`;
        try {
          setLoading(true);
          console.log('[Onboarding] Enviando SMS de verificación a:', e164);
          const vId = await sendLinkPhoneCode(e164);
          setVerificationId(vId);
          setStep(3);
        } catch (error: any) {
          console.error(
            '[Onboarding] Error al enviar código de vinculación:',
            error,
          );
          if (error?.code === 'auth/invalid-phone-number') {
            Alert.alert('Error', 'El número de teléfono no es válido.');
          } else if (error?.code === 'auth/too-many-requests') {
            Alert.alert('Error', 'Demasiados intentos. Intenta más tarde.');
          } else if (error?.code === 'auth/credential-already-in-use') {
            Alert.alert(
              'Error',
              'Este número de teléfono ya está vinculado a otra cuenta.',
            );
          } else {
            Alert.alert(
              'Error',
              error?.message ??
                'No se pudo enviar el código de verificación por SMS.',
            );
          }
        } finally {
          setLoading(false);
        }
        return;
      }

      setStep((s) => s + 1);
      return;
    }

    try {
      setLoading(true);

      if (!isPhoneVerified && verificationId) {
        console.log('[Onboarding] Verificando código OTP de vinculación...');
        await linkPhoneWithCredential(verificationId, otp.trim());

        console.log('[Onboarding] Refrescando token de Firebase...');
        const firebaseToken = await user.getIdToken(true);

        console.log('[Onboarding] Sincronizando vinculación en el backend...');
        await linkPhoneNumber(firebaseToken);
      }

      console.log('[Onboarding] Actualizando perfil de usuario...');
      await updateUser(user, { displayName: fullName.trim() });
      await mergeUserProfile(user.uid, {
        fullName: fullName.trim(),
        idNumber: idNumber.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email || undefined,
        onboardingCompleted: true,
      });

      console.log('[Onboarding] Sincronizando base de datos local...');
      try {
        await syncWithBackend(user);
      } catch (e) {
        console.warn('[onboarding] backend sync:', e);
      }

      console.log('[Onboarding] Completado, refrescando sesión...');
      await refreshAuthSessionPhase();
    } catch (e: any) {
      console.error('[onboarding] save:', e);
      Alert.alert(
        'Error',
        e?.message ?? 'No se pudo guardar tu perfil. Intenta de nuevo.',
      );
    } finally {
      setLoading(false);
    }
  };

  const titles = [
    {
      dark: 'Cómo',
      blue: 'te llamas',
      sub: 'Usaremos tu nombre en recibos y viajes.',
    },
    {
      dark: 'Tu',
      blue: 'cédula',
      sub: 'Identificación requerida para el servicio.',
    },
    { dark: 'Tu', blue: 'teléfono', sub: 'Número de contacto en Venezuela.' },
    {
      dark: 'Verifica tu',
      blue: 'teléfono',
      sub: 'Introduce el código de 6 dígitos que te enviamos por SMS.',
    },
  ];

  const t = titles[step];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.blob} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title="Completa tu perfil" onBack={handleBack} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.stepRow}>
            {Array.from({ length: stepsCount }, (_, i) => (
              <View
                key={String(i)}
                style={[
                  styles.stepDot,
                  i < stepsCount - 1 && styles.stepDotSpacer,
                  i <= step && styles.stepDotActive,
                ]}
              />
            ))}
          </View>
          <Text style={styles.stepMeta}>
            Paso {step + 1} de {stepsCount}
          </Text>

          <View style={styles.iconSection}>
            <View style={styles.fakeShadow} />
            <View style={styles.iconCard}>
              <View style={styles.topShine} />
              <MaterialCommunityIcons
                name={
                  step === 0
                    ? 'account-outline'
                    : step === 1
                      ? 'card-account-details-outline'
                      : step === 2
                        ? 'phone-outline'
                        : 'message-text-outline'
                }
                size={88}
                color={tokens.colors.primary}
              />
            </View>
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.titleDark}>{t.dark}</Text>
            <Text style={styles.titleBlue}>{t.blue}</Text>
            <Text style={styles.subtitle}>{t.sub}</Text>
          </View>

          {email ? (
            <View style={styles.emailHint}>
              <Ionicons
                name="mail-outline"
                size={16}
                color="#8594AB"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.emailHintText}>{email}</Text>
            </View>
          ) : null}

          {step === 0 && (
            <>
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
            </>
          )}

          {step === 1 && (
            <>
              <Text style={styles.inputLabel}>CÉDULA (solo números)</Text>
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
            </>
          )}

          {step === 2 && (
            <>
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
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.inputLabel}>
                CÓDIGO DE VERIFICACIÓN (SMS)
              </Text>
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
                  onPress={async () => {
                    const trimmed = phoneNumber.trim();
                    const e164 = `+58${trimmed.slice(1)}`;
                    try {
                      setLoading(true);
                      const vId = await sendLinkPhoneCode(e164);
                      setVerificationId(vId);
                      Alert.alert(
                        'Reenviado',
                        'Se ha enviado un nuevo código de verificación por SMS.',
                      );
                    } catch (error: any) {
                      Alert.alert(
                        'Error',
                        error?.message ?? 'No se pudo reenviar el código.',
                      );
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  hitSlop={10}
                >
                  <Text style={styles.resendLink}>Reenviar</Text>
                </Pressable>
              </View>
            </>
          )}

          <View style={{ flex: 1, minHeight: 32 }} />

          <Pressable
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              loading && { opacity: 0.7 },
            ]}
            onPress={() => void handlePrimary()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>
                  {step < stepsCount - 1 ? 'Continuar' : 'Finalizar'}
                </Text>
                <Ionicons
                  name={
                    step < stepsCount - 1
                      ? 'arrow-forward-circle-outline'
                      : 'checkmark-circle-outline'
                  }
                  size={20}
                  color="#fff"
                  style={{ marginLeft: 10 }}
                />
              </>
            )}
          </Pressable>

          <Text style={styles.footerLegal}>GOFAIR • ONBOARDING</Text>
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
    paddingTop: 8,
    paddingBottom: 36,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D4DEEC',
  },
  stepDotSpacer: {
    marginRight: 8,
  },
  stepDotActive: {
    backgroundColor: tokens.colors.primary,
  },
  stepMeta: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
    marginBottom: 20,
  },
  iconSection: { alignItems: 'center', marginBottom: 28 },
  fakeShadow: {
    position: 'absolute',
    width: 132,
    height: 120,
    borderRadius: 28,
    backgroundColor: '#91B4E0',
    opacity: 0.3,
    top: 14,
    transform: [{ scaleX: 0.9 }],
  },
  iconCard: {
    width: 144,
    height: 132,
    backgroundColor: '#D6E5F8',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#5080C0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  topShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 52,
    backgroundColor: '#EBF4FF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    opacity: 0.75,
  },
  titleBlock: { marginBottom: 20 },
  titleDark: {
    fontSize: 34,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#18243E',
    lineHeight: 40,
  },
  titleBlue: {
    fontSize: 34,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
    lineHeight: 40,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#6B7A93',
    lineHeight: 22,
  },
  emailHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2EAF4',
  },
  emailHintText: {
    flex: 1,
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#6B7A93',
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
    paddingHorizontal: 18,
    height: 56,
    marginBottom: 14,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2EAF4',
  },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: '#D4DEEC',
    marginHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 17,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#18243E',
    includeFontPadding: false,
  },
  prefix: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
    minWidth: 28,
  },
  cta: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: 16,
    height: 56,
    marginBottom: 20,
    shadowColor: '#1D5BD9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  ctaText: {
    fontSize: 17,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  footerLegal: {
    textAlign: 'center',
    fontSize: 9.5,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#B0BCCC',
    letterSpacing: 1.1,
  },
  otpInput: {
    fontSize: 24,
    letterSpacing: 8,
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
});
