import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import {
  getCooperatives,
  submitLegalDocument,
  submitVehicleRequest,
} from '@/lib/api';
import { tokens } from '@/theme/tokens';

const isValidDate = (dateStr: string) => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return false;
  const parts = dateStr.split('/');
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day
  );
};

interface FormFields {
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleYear: string;
  licensePlate: string;
  cooperativeUuid: string;
  tituloPropiedadNumber: string;
  tituloPropiedadIssuedAt: string;
  tituloPropiedadExpiresAt: string;
  rcvNumber: string;
  rcvIssuedAt: string;
  rcvExpiresAt: string;
  revisionTecnicaNumber: string;
  revisionTecnicaIssuedAt: string;
  revisionTecnicaExpiresAt: string;
}

interface FormErrors {
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  vehicleYear?: string;
  licensePlate?: string;
  cooperativeUuid?: string;
  tituloPropiedadNumber?: string;
  tituloPropiedadIssuedAt?: string;
  tituloPropiedadExpiresAt?: string;
  rcvNumber?: string;
  rcvIssuedAt?: string;
  rcvExpiresAt?: string;
  revisionTecnicaNumber?: string;
  revisionTecnicaIssuedAt?: string;
  revisionTecnicaExpiresAt?: string;
}

export default function RegisterVehicleScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cooperatives, setCooperatives] = useState<any[]>([]);
  const [showCoopDropdown, setShowCoopDropdown] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  const [activeDateField, setActiveDateField] = useState<
    keyof FormFields | null
  >(null);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const [form, setForm] = useState<FormFields>({
    vehicleMake: '',
    vehicleModel: '',
    vehicleColor: '',
    vehicleYear: '',
    licensePlate: '',
    cooperativeUuid: '',
    tituloPropiedadNumber: '',
    tituloPropiedadIssuedAt: '',
    tituloPropiedadExpiresAt: '',
    rcvNumber: '',
    rcvIssuedAt: '',
    rcvExpiresAt: '',
    revisionTecnicaNumber: '',
    revisionTecnicaIssuedAt: '',
    revisionTecnicaExpiresAt: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const openDatePicker = (field: keyof FormFields) => {
    const currentValue = form[field];
    let initialDate = new Date();
    if (currentValue && isValidDate(currentValue)) {
      const parts = currentValue.split('/');
      initialDate = new Date(
        parseInt(parts[2], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[0], 10),
      );
    }
    setTempDate(initialDate);
    setActiveDateField(field);
  };

  const onDatePickerChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    const currentField = activeDateField;
    if (Platform.OS === 'android') {
      setActiveDateField(null);
      if (selectedDate && event.type !== 'dismissed' && currentField) {
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const year = selectedDate.getFullYear();
        const formatted = `${day}/${month}/${year}`;
        updateField(currentField, formatted);
      }
    } else {
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

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

  const validateStep1 = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.vehicleMake.trim()) {
      newErrors.vehicleMake = 'La marca del vehículo es requerida';
    }
    if (!form.vehicleModel.trim()) {
      newErrors.vehicleModel = 'El modelo del vehículo es requerido';
    }
    if (!form.vehicleColor.trim()) {
      newErrors.vehicleColor = 'El color del vehículo es requerido';
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.tituloPropiedadNumber.trim()) {
      newErrors.tituloPropiedadNumber =
        'El número del título de propiedad es requerido';
    }
    if (!form.tituloPropiedadIssuedAt.trim()) {
      newErrors.tituloPropiedadIssuedAt = 'La fecha de emisión es requerida';
    } else if (!isValidDate(form.tituloPropiedadIssuedAt)) {
      newErrors.tituloPropiedadIssuedAt = 'Formato inválido (DD/MM/AAAA)';
    }
    if (!form.tituloPropiedadExpiresAt.trim()) {
      newErrors.tituloPropiedadExpiresAt =
        'La fecha de expiración es requerida';
    } else if (!isValidDate(form.tituloPropiedadExpiresAt)) {
      newErrors.tituloPropiedadExpiresAt = 'Formato inválido (DD/MM/AAAA)';
    }

    if (!form.rcvNumber.trim()) {
      newErrors.rcvNumber =
        'El número de responsabilidad civil (RCV) es requerido';
    }
    if (!form.rcvIssuedAt.trim()) {
      newErrors.rcvIssuedAt = 'La fecha de emisión es requerida';
    } else if (!isValidDate(form.rcvIssuedAt)) {
      newErrors.rcvIssuedAt = 'Formato inválido (DD/MM/AAAA)';
    }
    if (!form.rcvExpiresAt.trim()) {
      newErrors.rcvExpiresAt = 'La fecha de expiración es requerida';
    } else if (!isValidDate(form.rcvExpiresAt)) {
      newErrors.rcvExpiresAt = 'Formato inválido (DD/MM/AAAA)';
    }

    if (!form.revisionTecnicaNumber.trim()) {
      newErrors.revisionTecnicaNumber =
        'El número de revisión técnica INTT es requerido';
    }
    if (!form.revisionTecnicaIssuedAt.trim()) {
      newErrors.revisionTecnicaIssuedAt = 'La fecha de emisión es requerida';
    } else if (!isValidDate(form.revisionTecnicaIssuedAt)) {
      newErrors.revisionTecnicaIssuedAt = 'Formato inválido (DD/MM/AAAA)';
    }
    if (!form.revisionTecnicaExpiresAt.trim()) {
      newErrors.revisionTecnicaExpiresAt =
        'La fecha de expiración es requerida';
    } else if (!isValidDate(form.revisionTecnicaExpiresAt)) {
      newErrors.revisionTecnicaExpiresAt = 'Formato inválido (DD/MM/AAAA)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep1() || !validateStep2()) {
      Alert.alert(
        'Datos Incompletos',
        'Por favor, completa todos los campos del vehículo y de los documentos obligatorios.',
      );
      return;
    }

    try {
      setLoading(true);

      // 1. Crear el vehículo en el backend
      const vehicle = await submitVehicleRequest({
        vehicleMake: form.vehicleMake.trim(),
        vehicleModel: form.vehicleModel.trim(),
        vehicleYear: parseInt(form.vehicleYear, 10),
        licensePlate: form.licensePlate.trim().toUpperCase(),
        vehicleColor: form.vehicleColor.trim(),
        cooperativeUuid: form.cooperativeUuid || undefined,
      });

      const vehicleUuid = vehicle?.uuid;
      if (!vehicleUuid) {
        throw new Error(
          'No se pudo obtener el identificador de la unidad creada.',
        );
      }

      // 2. Registrar los 3 documentos manuales en el backend
      const toYyyyMmDd = (dateStr: string) => {
        const parts = dateStr.trim().split('/');
        if (parts.length !== 3) return dateStr;
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      };

      const docTasks = [
        {
          type: 'titulo_propiedad',
          documentNumber: form.tituloPropiedadNumber.trim(),
          issuedAt: toYyyyMmDd(form.tituloPropiedadIssuedAt),
          expiresAt: toYyyyMmDd(form.tituloPropiedadExpiresAt),
          fileUrl: 'https://gofare.app/manual-entry.pdf',
        },
        {
          type: 'seguro_responsabilidad_civil',
          documentNumber: form.rcvNumber.trim(),
          issuedAt: toYyyyMmDd(form.rcvIssuedAt),
          expiresAt: toYyyyMmDd(form.rcvExpiresAt),
          fileUrl: 'https://gofare.app/manual-entry.pdf',
        },
        {
          type: 'revision_tecnica_intt',
          documentNumber: form.revisionTecnicaNumber.trim(),
          issuedAt: toYyyyMmDd(form.revisionTecnicaIssuedAt),
          expiresAt: toYyyyMmDd(form.revisionTecnicaExpiresAt),
          fileUrl: 'https://gofare.app/manual-entry.pdf',
        },
      ];

      for (const doc of docTasks) {
        await submitLegalDocument({
          type: doc.type,
          fileUrl: doc.fileUrl,
          vehicleUuid,
          documentNumber: doc.documentNumber,
          issuedAt: doc.issuedAt,
          expiresAt: doc.expiresAt,
        });
      }

      Alert.alert(
        'Registro Exitoso',
        'Tu vehículo y sus documentos obligatorios han sido registrados y enviados a revisión.',
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
              Completa el formulario en 2 pasos para registrar tu vehículo. Una
              vez aprobado, la unidad estará disponible para operar.
            </Text>
          </View>

          {/* Step Indicator */}
          <View style={styles.stepIndicatorContainer}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepNumberCircle,
                  currentStep >= 1 && styles.stepNumberCircleActive,
                ]}
              >
                <Text
                  style={[
                    styles.stepNumberText,
                    currentStep >= 1 && styles.stepNumberTextActive,
                  ]}
                >
                  1
                </Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  currentStep === 1 && styles.stepLabelActive,
                ]}
              >
                Datos del Vehículo
              </Text>
            </View>

            <View
              style={[
                styles.stepLine,
                currentStep === 2 && styles.stepLineActive,
              ]}
            />

            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepNumberCircle,
                  currentStep === 2 && styles.stepNumberCircleActive,
                ]}
              >
                <Text
                  style={[
                    styles.stepNumberText,
                    currentStep === 2 && styles.stepNumberTextActive,
                  ]}
                >
                  2
                </Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  currentStep === 2 && styles.stepLabelActive,
                ]}
              >
                Documentos
              </Text>
            </View>
          </View>

          {currentStep === 1 && (
            <>
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

              {/* Placa */}
              <Text style={styles.inputLabel}>PLACA / MATRÍCULA</Text>
              <View
                style={[
                  styles.inputCard,
                  errors.licensePlate && styles.inputCardError,
                ]}
              >
                <Ionicons
                  name="id-card-outline"
                  size={20}
                  color={errors.licensePlate ? '#EF4444' : '#8594AB'}
                  style={styles.inputIcon}
                />
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

                {/* Color */}
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inputLabel}>COLOR</Text>
                  <View
                    style={[
                      styles.inputCard,
                      errors.vehicleColor && styles.inputCardError,
                    ]}
                  >
                    <TextInput
                      style={styles.input}
                      placeholder="Ej. Blanco, Azul, Rojo"
                      placeholderTextColor="#A1A1AA"
                      value={form.vehicleColor}
                      onChangeText={(text) => updateField('vehicleColor', text)}
                      editable={!loading}
                    />
                  </View>
                  {errors.vehicleColor && (
                    <Text style={styles.errorText}>{errors.vehicleColor}</Text>
                  )}
                </View>
              </View>

              {/* Cooperativa Asociada (Opcional) */}
              <Text style={styles.inputLabel}>
                COOPERATIVA ASOCIADA (OPCIONAL)
              </Text>
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
                <Text style={styles.dropdownButtonText}>
                  {selectedCoopName}
                </Text>
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
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color="#A1A1AA"
                        />
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
                        form.cooperativeUuid === '' &&
                          styles.dropdownItemActive,
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

              {/* Botón Siguiente */}
              <Pressable style={styles.cta} onPress={handleNextStep}>
                <Text style={styles.ctaText}>Siguiente</Text>
                <Ionicons
                  name="arrow-forward-outline"
                  size={18}
                  color="#FFFFFF"
                  style={{ marginLeft: 8 }}
                />
              </Pressable>
            </>
          )}

          {currentStep === 2 && (
            <>
              {/* ── SECCIÓN DE DOCUMENTOS ── */}
              <Text
                style={[
                  styles.sectionTitle,
                  { marginTop: 16, marginBottom: 16 },
                ]}
              >
                DOCUMENTOS OBLIGATORIOS
              </Text>

              {/* Tarjeta 1: Título de Propiedad */}
              <View style={styles.documentSectionCard}>
                <View style={styles.documentSectionHeader}>
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color={tokens.colors.primary}
                  />
                  <Text style={styles.documentSectionTitle}>
                    Título de Propiedad
                  </Text>
                </View>

                <Text style={styles.inputLabelText}>NÚMERO DE TÍTULO</Text>
                <View
                  style={[
                    styles.inputRowCard,
                    errors.tituloPropiedadNumber && styles.inputRowCardError,
                  ]}
                >
                  <TextInput
                    style={styles.rowDateInputText}
                    placeholder="Ej. TP-12345678"
                    placeholderTextColor="#94A3B8"
                    value={form.tituloPropiedadNumber}
                    onChangeText={(text) =>
                      updateField('tituloPropiedadNumber', text)
                    }
                    editable={!loading}
                  />
                </View>
                {errors.tituloPropiedadNumber && (
                  <Text style={styles.errorTextSmall}>
                    {errors.tituloPropiedadNumber}
                  </Text>
                )}

                <View style={styles.rowFields}>
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={styles.inputLabelText}>FECHA EMISIÓN</Text>
                    <Pressable
                      style={[
                        styles.inputRowCard,
                        errors.tituloPropiedadIssuedAt &&
                          styles.inputRowCardError,
                      ]}
                      onPress={() => openDatePicker('tituloPropiedadIssuedAt')}
                      disabled={loading}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={
                          errors.tituloPropiedadIssuedAt ? '#EF4444' : '#8594AB'
                        }
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={[
                          styles.rowDateInputText,
                          !form.tituloPropiedadIssuedAt &&
                            styles.placeholderDateText,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {form.tituloPropiedadIssuedAt || 'DD/MM/YYYY'}
                      </Text>
                    </Pressable>
                    {errors.tituloPropiedadIssuedAt && (
                      <Text style={styles.errorTextSmall}>
                        {errors.tituloPropiedadIssuedAt}
                      </Text>
                    )}
                  </View>

                  <View style={{ flex: 1, marginLeft: 6 }}>
                    <Text style={styles.inputLabelText}>FECHA EXPIRACIÓN</Text>
                    <Pressable
                      style={[
                        styles.inputRowCard,
                        errors.tituloPropiedadExpiresAt &&
                          styles.inputRowCardError,
                      ]}
                      onPress={() => openDatePicker('tituloPropiedadExpiresAt')}
                      disabled={loading}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={
                          errors.tituloPropiedadExpiresAt
                            ? '#EF4444'
                            : '#8594AB'
                        }
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={[
                          styles.rowDateInputText,
                          !form.tituloPropiedadExpiresAt &&
                            styles.placeholderDateText,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {form.tituloPropiedadExpiresAt || 'DD/MM/YYYY'}
                      </Text>
                    </Pressable>
                    {errors.tituloPropiedadExpiresAt && (
                      <Text style={styles.errorTextSmall}>
                        {errors.tituloPropiedadExpiresAt}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Tarjeta 2: Responsabilidad Civil (RCV) */}
              <View style={styles.documentSectionCard}>
                <View style={styles.documentSectionHeader}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={20}
                    color={tokens.colors.primary}
                  />
                  <Text style={styles.documentSectionTitle}>
                    Responsabilidad Civil (RCV)
                  </Text>
                </View>

                <Text style={styles.inputLabelText}>NÚMERO DE RCV</Text>
                <View
                  style={[
                    styles.inputRowCard,
                    errors.rcvNumber && styles.inputRowCardError,
                  ]}
                >
                  <TextInput
                    style={styles.rowDateInputText}
                    placeholder="Ej. RCV-998877"
                    placeholderTextColor="#94A3B8"
                    value={form.rcvNumber}
                    onChangeText={(text) => updateField('rcvNumber', text)}
                    editable={!loading}
                  />
                </View>
                {errors.rcvNumber && (
                  <Text style={styles.errorTextSmall}>{errors.rcvNumber}</Text>
                )}

                <View style={styles.rowFields}>
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={styles.inputLabelText}>FECHA EMISIÓN</Text>
                    <Pressable
                      style={[
                        styles.inputRowCard,
                        errors.rcvIssuedAt && styles.inputRowCardError,
                      ]}
                      onPress={() => openDatePicker('rcvIssuedAt')}
                      disabled={loading}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={errors.rcvIssuedAt ? '#EF4444' : '#8594AB'}
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={[
                          styles.rowDateInputText,
                          !form.rcvIssuedAt && styles.placeholderDateText,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {form.rcvIssuedAt || 'DD/MM/YYYY'}
                      </Text>
                    </Pressable>
                    {errors.rcvIssuedAt && (
                      <Text style={styles.errorTextSmall}>
                        {errors.rcvIssuedAt}
                      </Text>
                    )}
                  </View>

                  <View style={{ flex: 1, marginLeft: 6 }}>
                    <Text style={styles.inputLabelText}>FECHA EXPIRACIÓN</Text>
                    <Pressable
                      style={[
                        styles.inputRowCard,
                        errors.rcvExpiresAt && styles.inputRowCardError,
                      ]}
                      onPress={() => openDatePicker('rcvExpiresAt')}
                      disabled={loading}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={errors.rcvExpiresAt ? '#EF4444' : '#8594AB'}
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={[
                          styles.rowDateInputText,
                          !form.rcvExpiresAt && styles.placeholderDateText,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {form.rcvExpiresAt || 'DD/MM/YYYY'}
                      </Text>
                    </Pressable>
                    {errors.rcvExpiresAt && (
                      <Text style={styles.errorTextSmall}>
                        {errors.rcvExpiresAt}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Tarjeta 3: Revisión Técnica INTT */}
              <View style={styles.documentSectionCard}>
                <View style={styles.documentSectionHeader}>
                  <Ionicons
                    name="build-outline"
                    size={20}
                    color={tokens.colors.primary}
                  />
                  <Text style={styles.documentSectionTitle}>
                    Revisión Técnica (INTT)
                  </Text>
                </View>

                <Text style={styles.inputLabelText}>NÚMERO DE REVISIÓN</Text>
                <View
                  style={[
                    styles.inputRowCard,
                    errors.revisionTecnicaNumber && styles.inputRowCardError,
                  ]}
                >
                  <TextInput
                    style={styles.rowDateInputText}
                    placeholder="Ej. INTT-REV-6655"
                    placeholderTextColor="#94A3B8"
                    value={form.revisionTecnicaNumber}
                    onChangeText={(text) =>
                      updateField('revisionTecnicaNumber', text)
                    }
                    editable={!loading}
                  />
                </View>
                {errors.revisionTecnicaNumber && (
                  <Text style={styles.errorTextSmall}>
                    {errors.revisionTecnicaNumber}
                  </Text>
                )}

                <View style={styles.rowFields}>
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={styles.inputLabelText}>FECHA EMISIÓN</Text>
                    <Pressable
                      style={[
                        styles.inputRowCard,
                        errors.revisionTecnicaIssuedAt &&
                          styles.inputRowCardError,
                      ]}
                      onPress={() => openDatePicker('revisionTecnicaIssuedAt')}
                      disabled={loading}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={
                          errors.revisionTecnicaIssuedAt ? '#EF4444' : '#8594AB'
                        }
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={[
                          styles.rowDateInputText,
                          !form.revisionTecnicaIssuedAt &&
                            styles.placeholderDateText,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {form.revisionTecnicaIssuedAt || 'DD/MM/YYYY'}
                      </Text>
                    </Pressable>
                    {errors.revisionTecnicaIssuedAt && (
                      <Text style={styles.errorTextSmall}>
                        {errors.revisionTecnicaIssuedAt}
                      </Text>
                    )}
                  </View>

                  <View style={{ flex: 1, marginLeft: 6 }}>
                    <Text style={styles.inputLabelText}>FECHA EXPIRACIÓN</Text>
                    <Pressable
                      style={[
                        styles.inputRowCard,
                        errors.revisionTecnicaExpiresAt &&
                          styles.inputRowCardError,
                      ]}
                      onPress={() => openDatePicker('revisionTecnicaExpiresAt')}
                      disabled={loading}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={
                          errors.revisionTecnicaExpiresAt
                            ? '#EF4444'
                            : '#8594AB'
                        }
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={[
                          styles.rowDateInputText,
                          !form.revisionTecnicaExpiresAt &&
                            styles.placeholderDateText,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {form.revisionTecnicaExpiresAt || 'DD/MM/YYYY'}
                      </Text>
                    </Pressable>
                    {errors.revisionTecnicaExpiresAt && (
                      <Text style={styles.errorTextSmall}>
                        {errors.revisionTecnicaExpiresAt}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Botones de Navegación del Paso 2 */}
              <View style={styles.buttonRow}>
                <Pressable
                  style={styles.backBtn}
                  onPress={() => setCurrentStep(1)}
                  disabled={loading}
                >
                  <Ionicons
                    name="arrow-back-outline"
                    size={18}
                    color={tokens.colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.backBtnText}>Atrás</Text>
                </Pressable>

                <Pressable
                  style={[styles.cta, { flex: 1, marginTop: 0 }]}
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
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal/Overlay */}
      {activeDateField &&
        (Platform.OS === 'ios' ? (
          <Modal visible={true} transparent={true} animationType="slide">
            <View style={styles.modalOverlay}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setActiveDateField(null)}
              />
              <View style={styles.iosPickerContainer}>
                <View style={styles.iosPickerHeader}>
                  <Pressable onPress={() => setActiveDateField(null)}>
                    <Text style={styles.iosPickerCancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const day = String(tempDate.getDate()).padStart(2, '0');
                      const month = String(tempDate.getMonth() + 1).padStart(
                        2,
                        '0',
                      );
                      const year = tempDate.getFullYear();
                      const formatted = `${day}/${month}/${year}`;
                      updateField(activeDateField!, formatted);
                      setActiveDateField(null);
                    }}
                  >
                    <Text style={styles.iosPickerConfirmText}>Confirmar</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  onChange={onDatePickerChange}
                  locale="es-ES"
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="default"
            onChange={onDatePickerChange}
          />
        ))}
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
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  stepNumberCircleActive: {
    backgroundColor: tokens.colors.primary,
  },
  stepNumberText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
  },
  stepNumberTextActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  stepLabelActive: {
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
    maxWidth: 60,
  },
  stepLineActive: {
    backgroundColor: tokens.colors.primary,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: tokens.colors.primary,
    borderWidth: 1.5,
    borderRadius: 16,
    height: 60,
    paddingHorizontal: 24,
    marginRight: 12,
  },
  backBtnText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    letterSpacing: 0.5,
  },
  placeholderText: {
    color: '#A1A1AA',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  iosPickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iosPickerCancelText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  iosPickerConfirmText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  documentSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#18243E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  documentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    paddingBottom: 8,
  },
  documentSectionTitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginLeft: 8,
  },
  inputRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
    marginBottom: 4,
  },
  inputRowCardError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  inputLabelText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  rowDateInputText: {
    fontSize: 13.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#18243E',
    flex: 1,
  },
  placeholderDateText: {
    color: '#94A3B8',
  },
  errorTextSmall: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#EF4444',
    marginTop: 2,
    marginBottom: 10,
  },
});
