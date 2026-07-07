import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
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
import { getCooperatives, submitVehicleRequest } from '@/lib/api';
import { tokens } from '@/theme/tokens';

interface FormFields {
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  licensePlate: string;
  capacity: string;
  cooperativeUuid: string;
}

interface FormErrors {
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  licensePlate?: string;
  capacity?: string;
  cooperativeUuid?: string;
}

export default function RegisterVehicleScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cooperatives, setCooperatives] = useState<any[]>([]);
  const [showCoopDropdown, setShowCoopDropdown] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [form, setForm] = useState<FormFields>({
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    licensePlate: '',
    capacity: '',
    cooperativeUuid: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Cargar lista de cooperativas al iniciar
  useEffect(() => {
    const loadCooperatives = async () => {
      try {
        const list = await getCooperatives();
        setCooperatives(list || []);
      } catch (err) {
        console.warn('[RegisterVehicle] Error loading cooperatives:', err);
      }
    };
    loadCooperatives();
  }, []);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.vehicleMake.trim()) {
      newErrors.vehicleMake = 'La marca del vehículo es requerida';
    }
    if (!form.vehicleModel.trim()) {
      newErrors.vehicleModel = 'El modelo del vehículo es requerido';
    }

    const yearNum = parseInt(form.vehicleYear, 10);
    if (!form.vehicleYear.trim()) {
      newErrors.vehicleYear = 'El año del vehículo es requerido';
    } else if (
      Number.isNaN(yearNum) ||
      yearNum < 1900 ||
      yearNum > new Date().getFullYear() + 2
    ) {
      newErrors.vehicleYear = `El año debe estar entre 1900 y ${new Date().getFullYear() + 2}`;
    }

    if (!form.licensePlate.trim()) {
      newErrors.licensePlate = 'La placa del vehículo es requerida';
    }

    const capacityNum = parseInt(form.capacity, 10);
    if (!form.capacity.trim()) {
      newErrors.capacity = 'La capacidad es requerida';
    } else if (Number.isNaN(capacityNum) || capacityNum < 1) {
      newErrors.capacity = 'La capacidad debe ser al menos 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setLoading(true);
      await submitVehicleRequest({
        vehicleMake: form.vehicleMake.trim(),
        vehicleModel: form.vehicleModel.trim(),
        vehicleYear: parseInt(form.vehicleYear, 10),
        licensePlate: form.licensePlate.trim().toUpperCase(),
        capacity: parseInt(form.capacity, 10),
        lineUuid: form.cooperativeUuid || undefined,
      });

      Alert.alert(
        'Vehículo Registrado',
        'Tu vehículo ha sido registrado correctamente.',
        [
          {
            text: 'Aceptar',
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error: any) {
      console.error('[RegisterVehicle] Error submitting request:', error);
      Alert.alert(
        'Error',
        error.message ||
          'Ocurrió un error al enviar tu solicitud. Intenta de nuevo más tarde.',
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

  const selectedCoopName =
    cooperatives.find((c) => c.uuid === form.cooperativeUuid)?.name ||
    'Ninguna (Particular)';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScreenHeader title="Registrar Vehículo" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.infoBanner}>
            <Ionicons
              name="information-circle-outline"
              size={24}
              color="#0369A1"
            />
            <Text style={styles.infoText}>
              Completa el formulario para registrar un vehículo en tu flota. Una
              vez aprobada la solicitud por administración, la unidad estará
              disponible para operar.
            </Text>
          </View>

          {/* Marca del Vehículo */}
          <Text style={styles.inputLabel}>MARCA DEL VEHÍCULO</Text>
          <View
            style={[
              styles.inputCard,
              errors.vehicleMake && styles.inputCardError,
            ]}
          >
            <Ionicons
              name="car-outline"
              size={20}
              color={errors.vehicleMake ? '#EF4444' : '#8594AB'}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Ej. Toyota, Encava, Chevrolet"
              placeholderTextColor="#A1A1AA"
              value={form.vehicleMake}
              onChangeText={(text) => updateField('vehicleMake', text)}
              editable={!loading}
            />
          </View>
          {errors.vehicleMake && (
            <Text style={styles.errorText}>{errors.vehicleMake}</Text>
          )}

          {/* Modelo del Vehículo */}
          <Text style={styles.inputLabel}>MODELO DEL VEHÍCULO</Text>
          <View
            style={[
              styles.inputCard,
              errors.vehicleModel && styles.inputCardError,
            ]}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={errors.vehicleModel ? '#EF4444' : '#8594AB'}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Ej. Corolla, Coaster, ENT-610"
              placeholderTextColor="#A1A1AA"
              value={form.vehicleModel}
              onChangeText={(text) => updateField('vehicleModel', text)}
              editable={!loading}
            />
          </View>
          {errors.vehicleModel && (
            <Text style={styles.errorText}>{errors.vehicleModel}</Text>
          )}

          <View style={styles.rowFields}>
            {/* Año */}
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.inputLabel}>AÑO</Text>
              <View
                style={[
                  styles.inputCard,
                  errors.vehicleYear && styles.inputCardError,
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 2018"
                  placeholderTextColor="#A1A1AA"
                  keyboardType="numeric"
                  maxLength={4}
                  value={form.vehicleYear}
                  onChangeText={(text) => updateField('vehicleYear', text)}
                  editable={!loading}
                />
              </View>
              {errors.vehicleYear && (
                <Text style={styles.errorText}>{errors.vehicleYear}</Text>
              )}
            </View>

            {/* Placa */}
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.inputLabel}>PLACA / MATRÍCULA</Text>
              <View
                style={[
                  styles.inputCard,
                  errors.licensePlate && styles.inputCardError,
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="Ej. AB123CD"
                  placeholderTextColor="#A1A1AA"
                  autoCapitalize="characters"
                  value={form.licensePlate}
                  onChangeText={(text) => updateField('licensePlate', text)}
                  editable={!loading}
                />
              </View>
              {errors.licensePlate && (
                <Text style={styles.errorText}>{errors.licensePlate}</Text>
              )}
            </View>
          </View>

          {/* Capacidad */}
          <Text style={styles.inputLabel}>CAPACIDAD (PASAJEROS)</Text>
          <View
            style={[styles.inputCard, errors.capacity && styles.inputCardError]}
          >
            <TextInput
              style={styles.input}
              placeholder="Ej. 30"
              placeholderTextColor="#A1A1AA"
              keyboardType="numeric"
              maxLength={3}
              value={form.capacity}
              onChangeText={(text) => updateField('capacity', text)}
              editable={!loading}
            />
          </View>
          {errors.capacity && (
            <Text style={styles.errorText}>{errors.capacity}</Text>
          )}

          {/* Línea de Transporte Asociada (Opcional) */}
          <Text style={styles.inputLabel}>LÍNEA DE TRANSPORTE (OPCIONAL)</Text>
          <Pressable
            style={styles.dropdownButton}
            onPress={() => {
              const nextState = !showCoopDropdown;
              setShowCoopDropdown(nextState);
              if (nextState) setSearchText('');
            }}
            disabled={loading}
          >
            <Ionicons
              name="business-outline"
              size={20}
              color="#8594AB"
              style={styles.inputIcon}
            />
            <Text style={styles.dropdownButtonText}>{selectedCoopName}</Text>
            <Ionicons
              name={showCoopDropdown ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#8594AB"
            />
          </Pressable>

          {showCoopDropdown && (
            <View style={styles.dropdownContainer}>
              {/* Buscador / Combobox */}
              <View style={styles.searchInputContainer}>
                <Ionicons
                  name="search-outline"
                  size={18}
                  color="#8594AB"
                  style={styles.searchIcon}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar cooperativa por nombre o RIF..."
                  placeholderTextColor="#A1A1AA"
                  value={searchText}
                  onChangeText={setSearchText}
                  autoCapitalize="none"
                  editable={!loading}
                />
                {searchText.length > 0 && (
                  <Pressable onPress={() => setSearchText('')} hitSlop={10}>
                    <Ionicons name="close-circle" size={18} color="#A1A1AA" />
                  </Pressable>
                )}
              </View>

              <ScrollView
                style={styles.dropdownScroll}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {/* Opción Particular siempre disponible */}
                <Pressable
                  style={[
                    styles.dropdownItem,
                    form.cooperativeUuid === '' && styles.dropdownItemActive,
                  ]}
                  onPress={() => {
                    updateField('cooperativeUuid', '');
                    setShowCoopDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      form.cooperativeUuid === '' &&
                        styles.dropdownItemTextActive,
                    ]}
                  >
                    Ninguna (Particular)
                  </Text>
                </Pressable>

                {/* Lista filtrada de cooperativas */}
                {cooperatives
                  .filter((coop) => {
                    const term = searchText.trim().toLowerCase();
                    if (!term) return true;
                    return (
                      coop.name.toLowerCase().includes(term) ||
                      coop.rif.toLowerCase().includes(term)
                    );
                  })
                  .map((coop) => (
                    <Pressable
                      key={coop.uuid}
                      style={[
                        styles.dropdownItem,
                        form.cooperativeUuid === coop.uuid &&
                          styles.dropdownItemActive,
                      ]}
                      onPress={() => {
                        updateField('cooperativeUuid', coop.uuid);
                        setShowCoopDropdown(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          form.cooperativeUuid === coop.uuid &&
                            styles.dropdownItemTextActive,
                        ]}
                      >
                        {coop.name} ({coop.rif})
                      </Text>
                    </Pressable>
                  ))}

                {/* Mensaje de no resultados */}
                {cooperatives.filter((coop) => {
                  const term = searchText.trim().toLowerCase();
                  if (!term) return true;
                  return (
                    coop.name.toLowerCase().includes(term) ||
                    coop.rif.toLowerCase().includes(term)
                  );
                }).length === 0 && (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>
                      No se encontraron cooperativas
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
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
    backgroundColor: '#E0F2FE',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#0284C7',
  },
  infoText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#0369A1',
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
  rowFields: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    marginTop: -10,
    marginBottom: 16,
    paddingLeft: 4,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 60,
    marginBottom: 8,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  dropdownButtonText: {
    flex: 1,
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#18243E',
  },
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    marginBottom: 16,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    margin: 8,
    backgroundColor: '#F8FAFC',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#18243E',
    paddingVertical: 4,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  noResultsContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 13,
    color: '#8594AB',
    fontFamily: tokens.typography.fontFamily.medium,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  dropdownItemActive: {
    backgroundColor: '#EFF6FF',
  },
  dropdownItemText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#4B5563',
  },
  dropdownItemTextActive: {
    color: tokens.colors.primary,
    fontFamily: tokens.typography.fontFamily.bold,
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
