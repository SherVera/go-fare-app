import { ScreenHeader } from '@/components/ScreenHeader';
import { tokens } from '@/theme/tokens';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useRef } from 'react';
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
import { sendPhoneVerificationCode, confirmPhoneCode, setDocument, auth } from '@/lib/firebase';

export default function RegistroScreen() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmation, setConfirmation] = useState<any>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBack = () => {
    if (confirmation) {
      setConfirmation(null);
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/landing');
    }
  };

  const handleSendSMS = async () => {
    try {
      const trimmedNombre = nombre.trim();
      const trimmedCedula = cedula.trim();
      let finalPhone = phone.trim().replace(/\s+/g, ''); // Quitar espacios

      if (finalPhone.startsWith('0')) {
        finalPhone = finalPhone.substring(1); // Quitar el 0 inicial si existe
      }

      if (trimmedNombre.length < 3) {
        Alert.alert('Atención', 'El nombre debe tener al menos 3 caracteres.');
        return;
      }
      if (!/^\d{7,8}$/.test(trimmedCedula)) {
        Alert.alert('Atención', 'La cédula debe contener exactamente 7 u 8 números.');
        return;
      }
      if (!/^\d{10}$/.test(finalPhone)) {
        Alert.alert('Atención', 'El teléfono debe ser válido (Ej: 0412 1234567).');
        return;
      }

      setLoading(true);
      const phoneNumber = `+58${finalPhone}`;
      const confirmObj = await sendPhoneVerificationCode(phoneNumber);
      setConfirmation(confirmObj);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', 'No se pudo enviar el SMS. Intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    try {
      if (!code || code.length < 6) {
        Alert.alert('Atención', 'Ingrese el código de 6 dígitos');
        return;
      }
      setLoading(true);
      await confirmPhoneCode(confirmation, code);
      
      // Save user to Firestore
      if (auth.currentUser) {
        await setDocument(`users/${auth.currentUser.uid}`, {
          nombre,
          cedula,
          phone: phone.startsWith('+') ? phone : `+58${phone}`,
        });
      }
      
      router.replace('/(tabs)' as any);
    } catch (error: any) {
      console.error("Error en registro:", error);
      if (error.message && error.message.includes('firestore')) {
        Alert.alert('Error de Base de Datos', 'Usuario autenticado pero no se pudo guardar el perfil. Revisa las reglas de Firestore.');
      } else {
        Alert.alert('Error', 'Código inválido o expirado. ' + error.message);
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
            <Text style={styles.titleDark}>{confirmation ? 'Confirma tu' : 'Únete a'}</Text>
            <Text style={styles.titleBlue}>{confirmation ? 'Registro' : 'GoFair'}</Text>
            <Text style={styles.subtitle}>
              {confirmation 
                ? `Ingresa el código SMS enviado al +58 ${phone}` 
                : `Crea tu cuenta para moverte\npor la ciudad libremente.`}
            </Text>
          </View>

          {/* ── INPUTS ── */}
          {!confirmation ? (
            <>
              <Text style={styles.inputLabel}>NOMBRE COMPLETO</Text>
              <View style={styles.inputCard}>
                <Ionicons name="person-outline" size={20} color="#3072ffe7" />
                <View style={styles.divider} />
                <TextInput
                  style={styles.input}
                  placeholder="Ej. Carlos Pérez"
                  placeholderTextColor="#B8C4D4"
                  value={nombre}
                  onChangeText={setNombre}
                  selectionColor={tokens.colors.primary}
                  editable={!loading}
                />
              </View>

              <Text style={styles.inputLabel}>NÚMERO DE IDENTIDAD</Text>
              <View style={styles.inputCard}>
                <Text style={styles.prefix}>V-</Text>
                <View style={styles.divider} />
                <TextInput
                  style={styles.input}
                  placeholder="00000000"
                  placeholderTextColor="#B8C4D4"
                  keyboardType="number-pad"
                  value={cedula}
                  onChangeText={setCedula}
                  maxLength={10}
                  selectionColor={tokens.colors.primary}
                  editable={!loading}
                />
              </View>

              <Text style={styles.inputLabel}>NÚMERO DE TELÉFONO</Text>
              <View style={styles.inputCard}>
                <Text style={styles.prefix}>+58</Text>
                <View style={styles.divider} />
                <TextInput
                  style={styles.input}
                  placeholder="412 1234567"
                  placeholderTextColor="#B8C4D4"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  maxLength={12}
                  selectionColor={tokens.colors.primary}
                  editable={!loading}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.inputLabel}>CÓDIGO SMS</Text>
              <View style={styles.inputCard}>
                <Ionicons name="keypad" size={20} color="#3072ffe7" />
                <View style={styles.divider} />
                <TextInput
                  style={styles.input}
                  placeholder="000000"
                  placeholderTextColor="#B8C4D4"
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={setCode}
                  maxLength={6}
                  selectionColor={tokens.colors.primary}
                  editable={!loading}
                />
              </View>
            </>
          )}

          <View style={styles.secureRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={13}
              color={tokens.colors.primary}
              style={{ marginTop: 1, marginRight: 6 }}
            />
            <Text style={styles.secureText}>
              Su información será validada de forma segura.
            </Text>
          </View>

          <View style={{ flex: 1, minHeight: 32 }} />

          {/* ── BOTÓN ── */}
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }, loading && { opacity: 0.7 }]}
            onPress={confirmation ? handleVerifyCode : handleSendSMS}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>{confirmation ? 'Confirmar Registro' : 'Recibir SMS'}</Text>
                <Ionicons name={confirmation ? 'checkmark-circle-outline' : 'chatbubble-outline'} size={20} color="#fff" style={{ marginLeft: 10 }} />
              </>
            )}
          </Pressable>

          {/* ── LINK A LOGIN ── */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>¿Ya tienes cuenta? </Text>
            <Pressable onPress={() => router.push('/login' as any)}>
              <Text style={styles.registerLink}>Inicia Sesión</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: 10,
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
  footerLegal: {
    textAlign: 'center',
    fontSize: 9.5,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#B0BCCC',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});
