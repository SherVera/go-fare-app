import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
import { submitDriverRequest } from '@/lib/api';
import { tokens } from '@/theme/tokens';

interface FormFields {
  licenseNumber: string;
  licenseType: string;
  experienceYears: string;
  emergencyPhone: string;
}

interface FormErrors {
  licenseNumber?: string;
  licenseType?: string;
  experienceYears?: string;
  emergencyPhone?: string;
}

export default function RegisterDriverScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormFields>({
    licenseNumber: '',
    licenseType: '',
    experienceYears: '',
    emergencyPhone: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setLoading(true);
      await submitDriverRequest({
        licenseNumber: form.licenseNumber.trim(),
        licenseType: form.licenseType.trim(),
        experienceYears: parseInt(form.experienceYears, 10),
        emergencyPhone: form.emergencyPhone.trim(),
      });

      Alert.alert(
        'Solicitud Enviada',
        'Tu solicitud para registrarte como conductor ha sido recibida y está en proceso de revisión por el equipo de administración.',
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
            <Ionicons name="information-circle-outline" size={24} color="#0F766E" />
            <Text style={styles.infoText}>
              Ingresa los datos de tu licencia de conducir y contacto de emergencia para registrarte como conductor en la plataforma. Evaluaremos tu solicitud en la brevedad.
            </Text>
          </View>

          {/* Número de Licencia */}
          <Text style={styles.inputLabel}>NÚMERO DE LICENCIA</Text>
          <View style={[styles.inputCard, errors.licenseNumber && styles.inputCardError]}>
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
          {errors.licenseNumber && <Text style={styles.errorText}>{errors.licenseNumber}</Text>}

          {/* Tipo de Licencia */}
          <Text style={styles.inputLabel}>GRADO / TIPO DE LICENCIA</Text>
          <View style={[styles.inputCard, errors.licenseType && styles.inputCardError]}>
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
          {errors.licenseType && <Text style={styles.errorText}>{errors.licenseType}</Text>}

          {/* Años de Experiencia */}
          <Text style={styles.inputLabel}>AÑOS DE EXPERIENCIA</Text>
          <View style={[styles.inputCard, errors.experienceYears && styles.inputCardError]}>
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
          {errors.experienceYears && <Text style={styles.errorText}>{errors.experienceYears}</Text>}

          {/* Teléfono de Emergencia */}
          <Text style={styles.inputLabel}>TELÉFONO DE EMERGENCIA</Text>
          <View style={[styles.inputCard, errors.emergencyPhone && styles.inputCardError]}>
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
          {errors.emergencyPhone && <Text style={styles.errorText}>{errors.emergencyPhone}</Text>}

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
                <Text style={styles.ctaText}>Enviar Solicitud</Text>
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
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#18243E',
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
