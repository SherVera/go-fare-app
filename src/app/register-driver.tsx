import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
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
import { submitDriverRequest, getBackendProfile, redeemBackendInviteCode } from '@/lib/api';
import { tokens } from '@/theme/tokens';

interface FormFields {
  licenseNumber: string;
  licenseType: string;
  experienceYears: string;
  emergencyPhone: string;
  inviteCode: string;
}

interface FormErrors {
  licenseNumber?: string;
  licenseType?: string;
  experienceYears?: string;
  emergencyPhone?: string;
  inviteCode?: string;
}

export default function RegisterDriverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormFields>({
    licenseNumber: '',
    licenseType: '',
    experienceYears: '',
    emergencyPhone: '',
    inviteCode: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Cargar código de invitación si viene del Deep Link (URL query param)
  useEffect(() => {
    if (params.code) {
      console.log('[RegisterDriver] Código de invitación recibido por Deep Link:', params.code);
      setForm((prev) => ({ ...prev, inviteCode: params.code?.toUpperCase() || '' }));
    }
  }, [params.code]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.licenseNumber.trim()) {
      newErrors.licenseNumber = 'El número de licencia es requerido';
    }
    if (!form.licenseType.trim()) {
      newErrors.licenseType = 'El grado/tipo de licencia es requerido';
    }

    const expNum = parseInt(form.experienceYears, 10);
    if (!form.experienceYears.trim()) {
      newErrors.experienceYears = 'Los años de experiencia son requeridos';
    } else if (isNaN(expNum) || expNum < 0 || expNum > 70) {
      newErrors.experienceYears = 'Ingresa un número de años válido';
    }

    if (!form.emergencyPhone.trim()) {
      newErrors.emergencyPhone = 'El teléfono de emergencia es requerido';
    }

    if (!form.inviteCode.trim()) {
      newErrors.inviteCode = 'El código de invitación del socio es requerido para asociarte a una flota';
    } else if (form.inviteCode.trim().length !== 6) {
      newErrors.inviteCode = 'El código debe tener exactamente 6 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      // 1. Obtener perfil actual para el canje
      const profile = await getBackendProfile().catch(() => null);
      if (!profile) {
        Alert.alert(
          'Error de Sesión',
          'Debes haber iniciado sesión en la aplicación antes de registrarte como conductor.',
        );
        setLoading(false);
        return;
      }

      const driverUuid = profile.id;
      const driverName = profile.displayName || 'Conductor Registrado';
      const driverPhone = profile.phoneNumber || form.emergencyPhone;
      const driverNationalId = profile.nationalId || 'V-00000000';

      // 2. Canjear el código de invitación en el backend real
      console.log('[RegisterDriver] Canjeando código de invitación en backend:', form.inviteCode);
      try {
        await redeemBackendInviteCode(form.inviteCode.trim());
      } catch (err: any) {
        Alert.alert(
          'Invitación Inválida',
          err.message || 'El código ingresado es incorrecto, ya ha sido canjeado o está vencido.'
        );
        setLoading(false);
        return;
      }

      // 3. Registrar al conductor en el backend
      await submitDriverRequest({
        licenseNumber: form.licenseNumber.trim(),
        licenseType: form.licenseType.trim(),
        experienceYears: parseInt(form.experienceYears, 10),
        emergencyPhone: form.emergencyPhone.trim(),
      });

      Alert.alert(
        'Registro Exitoso',
        '¡Tu registro como conductor y la asociación con la flota del socio se han completado con éxito!',
        [
          {
            text: 'Aceptar',
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error: any) {
      console.error('[RegisterDriver] Error submitting request:', error);
      Alert.alert(
        'Error',
        error.message || 'Ocurrió un error al enviar tu solicitud. Intenta de nuevo más tarde.',
      );
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof FormFields, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScreenHeader title="Conductor" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.infoBanner}>
            <Ionicons
              name="information-circle-outline"
              size={24}
              color="#0F766E"
            />
            <Text style={styles.infoText}>
              Ingresa los datos de tu licencia de conducir, el código de invitación que recibiste por correo del socio y el teléfono de contacto de emergencia para completar tu registro.
            </Text>
          </View>

          {/* Código de Invitación */}
          <Text style={styles.inputLabel}>CÓDIGO DE INVITACIÓN (SOCIO)</Text>
          <View
            style={[
              styles.inputCard,
              errors.inviteCode && styles.inputCardError,
              params.code && styles.inputCardDisabled,
            ]}
          >
            <Ionicons
              name="mail-open-outline"
              size={20}
              color={errors.inviteCode ? '#EF4444' : '#0F766E'}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.input, params.code && styles.inputDisabled]}
              placeholder="Ej. AB42FD"
              placeholderTextColor="#A1A1AA"
              autoCapitalize="characters"
              maxLength={6}
              value={form.inviteCode}
              onChangeText={(text) => updateField('inviteCode', text.toUpperCase())}
              editable={!loading && !params.code}
            />
            {params.code && (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color="#10B981"
                style={{ marginLeft: 8 }}
              />
            )}
          </View>
          {errors.inviteCode && (
            <Text style={styles.errorText}>{errors.inviteCode}</Text>
          )}

          {/* Número de Licencia */}
          <Text style={styles.inputLabel}>NÚMERO DE LICENCIA</Text>
          <View
            style={[
              styles.inputCard,
              errors.licenseNumber && styles.inputCardError,
            ]}
          >
            <Ionicons
              name="card-outline"
              size={20}
              color={errors.licenseNumber ? '#EF4444' : '#8594AB'}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Ej. V-12345678"
              placeholderTextColor="#A1A1AA"
              value={form.licenseNumber}
              onChangeText={(text) => updateField('licenseNumber', text)}
              editable={!loading}
            />
          </View>
          {errors.licenseNumber && (
            <Text style={styles.errorText}>{errors.licenseNumber}</Text>
          )}

          {/* Tipo de Licencia */}
          <Text style={styles.inputLabel}>GRADO / TIPO DE LICENCIA</Text>
          <View
            style={[
              styles.inputCard,
              errors.licenseType && styles.inputCardError,
            ]}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={errors.licenseType ? '#EF4444' : '#8594AB'}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Ej. 5to Grado, Profesional"
              placeholderTextColor="#A1A1AA"
              value={form.licenseType}
              onChangeText={(text) => updateField('licenseType', text)}
              editable={!loading}
            />
          </View>
          {errors.licenseType && (
            <Text style={styles.errorText}>{errors.licenseType}</Text>
          )}

          {/* Años de Experiencia */}
          <Text style={styles.inputLabel}>AÑOS DE EXPERIENCIA</Text>
          <View
            style={[
              styles.inputCard,
              errors.experienceYears && styles.inputCardError,
            ]}
          >
            <Ionicons
              name="time-outline"
              size={20}
              color={errors.experienceYears ? '#EF4444' : '#8594AB'}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Ej. 5"
              placeholderTextColor="#A1A1AA"
              keyboardType="numeric"
              value={form.experienceYears}
              onChangeText={(text) => updateField('experienceYears', text)}
              editable={!loading}
            />
          </View>
          {errors.experienceYears && (
            <Text style={styles.errorText}>{errors.experienceYears}</Text>
          )}

          {/* Teléfono de Emergencia */}
          <Text style={styles.inputLabel}>TELÉFONO DE EMERGENCIA</Text>
          <View
            style={[
              styles.inputCard,
              errors.emergencyPhone && styles.inputCardError,
            ]}
          >
            <Ionicons
              name="call-outline"
              size={20}
              color={errors.emergencyPhone ? '#EF4444' : '#8594AB'}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Ej. +58 412 123 4567"
              placeholderTextColor="#A1A1AA"
              keyboardType="phone-pad"
              value={form.emergencyPhone}
              onChangeText={(text) => updateField('emergencyPhone', text)}
              editable={!loading}
            />
          </View>
          {errors.emergencyPhone && (
            <Text style={styles.errorText}>{errors.emergencyPhone}</Text>
          )}

          {/* Botón de Envío */}
          <Pressable
            style={[styles.cta, loading && { opacity: 0.8 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.ctaText}>Completar Registro</Text>
                <Ionicons
                  name="send-outline"
                  size={18}
                  color="#FFFFFF"
                  style={{ marginLeft: 8 }}
                />
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
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
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#F0FDFA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#0D9488',
  },
  infoText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#0F766E',
    lineHeight: 18,
    marginLeft: 12,
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
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  inputCardError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
    shadowColor: '#EF4444',
    shadowOpacity: 0.1,
  },
  inputCardDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    shadowOpacity: 0,
    elevation: 0,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#18243E',
  },
  inputDisabled: {
    color: '#64748B',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    marginTop: -10,
    marginBottom: 16,
    paddingLeft: 4,
  },
  cta: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: 16,
    height: 60,
    marginTop: 16,
    shadowColor: '#1D5BD9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
});
