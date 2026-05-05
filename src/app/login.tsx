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
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const router = useRouter();
  const [cedula, setCedula] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/landing');
    }
  };

  // 🚧 ACCESO TEMPORAL — cualquier cédula válida permite el ingreso
  const handleLogin = async () => {
    const trimmedCedula = cedula.trim();
    if (!/^\d{5,10}$/.test(trimmedCedula)) {
      Alert.alert('Atención', 'Ingresa una cédula válida (5 a 10 dígitos).');
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    // Guardar bandera de sesión temporal
    await AsyncStorage.setItem('temp_auth', 'true');
    setLoading(false);
    router.replace('/(tabs)' as any);
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Blob lavanda esquina sup-derecha */}
      <View style={styles.blob} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── HEADER FIJO — componente reutilizable ── */}
        <ScreenHeader title="Verificación de Identidad" onBack={handleBack} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── SECCIÓN DEL ÍCONO ── */}
          <View style={styles.iconSection}>
            {/* Sombra falsa azulada para efecto de flotación/3D */}
            <View style={styles.fakeShadow} />
            <View style={styles.iconCard}>
              {/* Brillo superior — simula luz desde arriba */}
              <View style={styles.topShine} />
              {/*
               * shield-account de MaterialCommunityIcons:
               * un solo ícono que integra escudo + persona,
               * idéntico al diseño de referencia
               */}
              <MaterialCommunityIcons
                name="shield-account"
                size={96}
                color={tokens.colors.primary}
              />
            </View>
          </View>

          {/* ── TÍTULOS ── */}
          <View style={styles.titleBlock}>
            <Text style={styles.titleDark}>Inicia</Text>
            <Text style={styles.titleBlue}>Sesión</Text>
            <Text style={styles.subtitle}>
              {`Ingresa tu número de cédula para\ncontinuar de forma segura.`}
            </Text>
          </View>

          {/* ── INPUT CÉDULA ── */}
          <Text style={styles.inputLabel}>NÚMERO DE CÉDULA</Text>
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


          {/* Nota de seguridad */}
          <View style={styles.secureRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={13}
              color={tokens.colors.primary}
              style={{ marginTop: 1, marginRight: 6 }}
            />
            <Text style={styles.secureText}>
              Su información está protegida por encriptación{'\n'}de grado gubernamental para Caracas Move.
            </Text>
          </View>

          <View style={{ flex: 1, minHeight: 48 }} />

          {/* ── BOTÓN ── */}
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>Ingresar</Text>
                <Ionicons name="arrow-forward-circle-outline" size={20} color="#fff" style={{ marginLeft: 10 }} />
              </>
            )}
          </Pressable>

          {/* ── LINK A REGISTRO ── */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>¿No tienes cuenta? </Text>
            <Pressable onPress={() => router.push('/registro' as any)}>
              <Text style={styles.registerLink}>Regístrate aquí</Text>
            </Pressable>
          </View>

          {/* ── FOOTER ── */}
          <View style={styles.footerRow}>
            <Text style={styles.footerHelp}>¿Necesitas ayuda?</Text>
            <Text style={styles.footerBullet}> • </Text>
            <Text style={styles.footerSupport}>Soporte Técnico</Text>
          </View>
          <Text style={styles.footerLegal}>CARACAS MOVE • VERIFICACIÓN SEGURA</Text>

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

  /* Blob decorativo */
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

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 32,
  },
  backBtn: { width: 28 },
  headerTitle: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },

  /* Sección ícono centrada */
  iconSection: {
    alignItems: 'center',
    marginBottom: 44,
  },

  /*
   * Sombra falsa: un View idéntico al card pero desplazado hacia abajo
   * y con un color azulado semi-transparente — da efecto de profundidad
   * tanto en iOS como en Android sin depender de elevation
   */
  fakeShadow: {
    position: 'absolute',
    width: 148,
    height: 136,
    borderRadius: 30,
    backgroundColor: '#91B4E0',
    opacity: 0.30,
    top: 18,          // desplazado hacia abajo
    transform: [{ scaleX: 0.90 }],  // ligeramente más angosto que el card
  },

  /* Tarjeta del ícono */
  iconCard: {
    width: 160,
    height: 148,
    backgroundColor: '#D6E5F8',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // iOS: sombra suave extra
    shadowColor: '#5080C0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },

  /* Brillo en la parte superior del card — efecto de luz 3D */
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

  /* Contenedor del ícono escudo */
  shieldContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  /*
   * Persona: bottom: 10 = dentro del escudo, en su tercio inferior
   * Antes era -10 (fuera del escudo), ahora está integrada
   */
  personInShield: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
  },

  /* Títulos */
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

  /* Input */
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
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#18243E',
    includeFontPadding: false,
  },

  /* Nota de seguridad */
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

  /* Botón principal */
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

  /* Link de Registro */
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

  /* Footer */
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
