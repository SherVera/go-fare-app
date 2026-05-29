import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { auth, sentResetEmail } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';
export default function SecurityScreen() {
  const [isBiometricsEnabled, setIsBiometricsEnabled] = useState(false);
  const [hasBiometricsHardware, setHasBiometricsHardware] = useState(false);
  const [biometricsType, setBiometricsType] = useState<string>('Biometría');
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    const checkBiometrics = async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        setHasBiometricsHardware(hasHardware);

        if (hasHardware) {
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (
            types.includes(
              LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
            )
          ) {
            setBiometricsType(
              Platform.OS === 'ios' ? 'FaceID' : 'Reconocimiento Facial',
            );
          } else if (
            types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
          ) {
            setBiometricsType('Huella Dactilar');
          } else {
            setBiometricsType('Biometría');
          }
        }

        // Leer preferencia guardada
        const savedPref = await AsyncStorage.getItem('isBiometricsEnabled');
        setIsBiometricsEnabled(savedPref === 'true');
      } catch (err) {
        console.warn('[Security] Error checking biometrics config:', err);
      }
    };

    checkBiometrics();
  }, []);

  const handleToggleBiometrics = async (value: boolean) => {
    if (value) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware) {
        Alert.alert(
          'Biometría No Disponible',
          'Tu dispositivo no cuenta con hardware biométrico compatible.',
        );
        return;
      }

      if (!isEnrolled) {
        Alert.alert(
          'Biometría No Configurada',
          'No tienes ninguna huella o rostro registrado en la configuración de seguridad de tu dispositivo.',
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Confirma tu identidad para habilitar ${biometricsType}`,
        fallbackLabel: 'Cancelar',
        disableDeviceFallback: true,
      });

      if (result.success) {
        await AsyncStorage.setItem('isBiometricsEnabled', 'true');
        setIsBiometricsEnabled(true);
        Alert.alert(
          'Éxito',
          `${biometricsType} habilitado correctamente para el bloqueo de la app.`,
        );
      } else {
        setIsBiometricsEnabled(false);
      }
    } else {
      await AsyncStorage.setItem('isBiometricsEnabled', 'false');
      setIsBiometricsEnabled(false);
      try {
        await SecureStore.deleteItemAsync('savedEmail');
        await SecureStore.deleteItemAsync('savedPassword');
      } catch (err) {
        console.warn('[Security] Error deleting saved credentials on toggle off:', err);
      }
    }
  };

  const handleChangePassword = async () => {
    const userEmail = auth.currentUser?.email;
    if (!userEmail) {
      Alert.alert('Error', 'No se pudo encontrar el correo de tu cuenta activa.');
      return;
    }

    Alert.alert(
      'Cambiar Contraseña',
      `¿Deseas enviar un correo de restablecimiento de contraseña a ${userEmail}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            try {
              setSendingEmail(true);
              await sentResetEmail(userEmail);
              Alert.alert(
                'Correo Enviado',
                'Se ha enviado un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada.'
              );
            } catch (error: any) {
              console.error('[Security] Error sending reset password email:', error);
              Alert.alert('Error', error.message || 'No se pudo enviar el correo de recuperación.');
            } finally {
              setSendingEmail(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScreenHeader title="Seguridad y Contraseña" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Acceso Seguro</Text>

        {/* Bloqueo Biométrico */}
        {hasBiometricsHardware ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconWrapper}>
                <Ionicons name="finger-print" size={24} color={tokens.colors.primary} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.cardTitle}>Bloqueo con {biometricsType}</Text>
                <Text style={styles.cardSubtitle}>
                  Solicitar biometría al abrir o regresar a la app
                </Text>
              </View>
              <Switch
                value={isBiometricsEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: '#D1D5DB', true: tokens.colors.primary }}
                thumbColor={isBiometricsEnabled ? '#FFFFFF' : '#F4F4F5'}
              />
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconWrapper}>
                <Ionicons name="finger-print" size={24} color="#9CA3AF" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.cardTitle}>Biometría No Disponible</Text>
                <Text style={styles.cardSubtitle}>
                  Este dispositivo no cuenta con hardware biométrico compatible
                </Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Contraseña</Text>

        {/* Cambiar Contraseña */}
        <Pressable style={styles.card} onPress={handleChangePassword}>
          <View style={styles.row}>
            <View style={styles.iconWrapper}>
              <Ionicons name="key" size={22} color={tokens.colors.primary} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardTitle}>Cambiar Contraseña</Text>
              <Text style={styles.cardSubtitle}>
                Enviar un correo electrónico para restablecer tu clave
              </Text>
            </View>
            {sendingEmail ? (
              <ActivityIndicator size="small" color={tokens.colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            )}
          </View>
        </Pressable>

        <Text style={styles.sectionTitle}>Opciones Adicionales</Text>

        {/* Doble Factor (2FA) */}
        <View style={[styles.card, { opacity: 0.6 }]}>
          <View style={styles.row}>
            <View style={styles.iconWrapper}>
              <Ionicons name="shield-checkmark" size={22} color={tokens.colors.primary} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardTitle}>Autenticación de Dos Factores (2FA)</Text>
              <Text style={styles.cardSubtitle}>
                Próximamente disponible
              </Text>
            </View>
            <Switch
              value={false}
              disabled={true}
              trackColor={{ false: '#E5E7EB', true: tokens.colors.primary }}
              thumbColor="#F4F4F5"
            />
          </View>
        </View>

        {/* Dispositivos Activos */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconWrapper}>
              <Ionicons name="phone-portrait" size={22} color={tokens.colors.primary} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardTitle}>Este Dispositivo</Text>
              <Text style={styles.cardSubtitle}>
                {Platform.OS === 'ios' ? 'Apple iPhone' : 'Android Device'} • Sesión activa
              </Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeText}>ACTUAL</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#6B7280',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#6B7280',
    lineHeight: 16,
  },
  activeBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeText: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#15803D',
  },
});
