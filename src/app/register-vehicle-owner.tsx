import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import {
  clearGoFareToken,
  createFareAccount,
  getCooperatives,
  loginWithFirebaseToken,
  registerWithEmail,
  submitVehicleOwnerRequest,
} from '@/lib/api';
import { sigOutAccount } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

export default function RegisterVehicleOwnerScreen() {
  const router = useRouter();

  // ── ESTADOS DE LOS CAMPOS ──
  // Datos del Usuario
  const [fullName, setFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Datos del Propietario/Comercio
  const [businessName, setBusinessName] = useState('');
  const [ownerIdNumber, setOwnerIdNumber] = useState('');
  const [cooperatives, setCooperatives] = useState<any[]>([]);
  const [selectedCooperativeUuid, setSelectedCooperativeUuid] = useState('');
  const [showCoopDropdown, setShowCoopDropdown] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Cargar lista de cooperativas al iniciar
  React.useEffect(() => {
    const loadCooperatives = async () => {
      try {
        const list = await getCooperatives();
        setCooperatives(list || []);
      } catch (err) {
        console.warn('[RegisterVehicleOwner] Error loading cooperatives:', err);
      }
    };
    loadCooperatives();
  }, []);

  // Estados de control
  const [loading, setLoading] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  // Errores de validación
  const [errors, setErrors] = useState<{
    fullName?: string;
    idNumber?: string;
    phoneNumber?: string;
    email?: string;
    password?: string;
    businessName?: string;
    ownerIdNumber?: string;
  }>({});

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/landing');
    }
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    const trimmedFullName = fullName.trim();
    const trimmedIdNumber = idNumber.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedPhoneNumber = phoneNumber.trim();

    const trimmedBusinessName = businessName.trim();
    const trimmedOwnerIdNumber = ownerIdNumber.trim();

    // ── Validaciones Datos de Usuario ──
    if (trimmedFullName.length < 3) {
      newErrors.fullName = 'El nombre debe tener al menos 3 caracteres.';
    }
    if (!/^\d{5,10}$/.test(trimmedIdNumber)) {
      newErrors.idNumber = 'La cédula debe contener entre 5 y 10 dígitos.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = 'Ingresa un correo electrónico válido.';
    }
    if (!/^(0412|0414|0424|0416|0426|0212)\d{7}$/.test(trimmedPhoneNumber)) {
      newErrors.phoneNumber = 'Ingresa un número válido (ej. 04120000000).';
    }
    if (trimmedPassword.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres.';
    }

    // ── Validaciones Datos de Propietario/Comercio ──
    if (!selectedCooperativeUuid) {
      newErrors.businessName =
        'Debes seleccionar una cooperativa o agencia registrada.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegisterAndSubmit = async () => {
    if (!validate()) {
      Alert.alert(
        'Formulario Incompleto',
        'Por favor corrige los errores resaltados en el formulario.',
      );
      return;
    }

    setLoading(true);

    try {
      // 1. Crear el usuario en Firebase/PostgreSQL con el rol 'passenger' inicialmente.
      // Su rol será ascendido a 'transport_owner' únicamente cuando el administrador apruebe la solicitud.
      const credentials = await registerWithEmail({
        email: email.trim(),
        password: password.trim(),
        registrationRole: 'passenger',
        displayName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
      });

      // 2. Intercambiar el ID Token por el JWT de GoFare
      let backendUser;
      try {
        const result = await loginWithFirebaseToken(credentials.idToken);
        backendUser = result.user;
      } catch (authError: any) {
        console.error(
          '[RegisterVehicleOwner] Error en intercambio de token:',
          authError,
        );
        Alert.alert(
          'Error de Sincronización',
          'El usuario fue creado pero no se pudo iniciar sesión para subir la solicitud: ' +
            (authError.message || 'Error del servidor'),
        );
        setLoading(false);
        return;
      }

      // 3. Crear cuenta de tarifa del usuario
      try {
        await createFareAccount(backendUser.id);
      } catch (fareError) {
        console.warn(
          '[RegisterVehicleOwner] Error creando cuenta de tarifa:',
          fareError,
        );
      }

      // 4. Subir la solicitud de afiliación de dueño de vehículo
      try {
        await submitVehicleOwnerRequest({
          businessName: businessName.trim(),
          idNumber: ownerIdNumber.trim(),
        });
      } catch (requestError: any) {
        console.error(
          '[RegisterVehicleOwner] Error guardando solicitud de socio:',
          requestError,
        );
        Alert.alert(
          'Solicitud Pendiente',
          'Tu cuenta fue creada pero hubo un error al registrar los datos del propietario: ' +
            (requestError.message || 'Error del servidor') +
            '. Podrás ingresar e intentar registrarlos nuevamente desde tu perfil.',
        );
      }

      // 5. Mostrar pantalla de éxito y revisión por parte del administrador
      setRequestSubmitted(true);
    } catch (error: any) {
      console.warn('[RegisterVehicleOwner] Error en registro completo:', error);
      const serverErrors: typeof errors = {};
      const errorMsg = error.message || '';

      if (
        error.code === 'auth/email-already-in-use' ||
        errorMsg.toLowerCase().includes('email') ||
        errorMsg.toLowerCase().includes('correo')
      ) {
        serverErrors.email = 'El correo electrónico ya está registrado.';
      } else if (error.code === 'auth/invalid-email') {
        serverErrors.email =
          'El correo electrónico tiene un formato incorrecto.';
      } else if (
        errorMsg.toLowerCase().includes('teléfono') ||
        errorMsg.toLowerCase().includes('phone')
      ) {
        serverErrors.phoneNumber = 'El número de teléfono ya está registrado.';
      } else {
        Alert.alert(
          'Error',
          error.message || 'Ocurrió un error al procesar tu registro.',
        );
      }
      setErrors(serverErrors);
    } finally {
      setLoading(false);
    }
  };

  const handleFinishFlow = async () => {
    // Limpiar sesión para evitar que el dueño de vehículo acceda a la app móvil como pasajero
    try {
      await sigOutAccount();
      await clearGoFareToken();
    } catch (err) {
      console.warn(
        '[RegisterVehicleOwner] Error al cerrar sesión al finalizar:',
        err,
      );
    }
    router.replace('/landing');
  };

  // ── PANTALLA EXITO / REVISIÓN PENDIENTE ──
  if (requestSubmitted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.blob} />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScreenHeader title="Solicitud Enviada" onBack={handleFinishFlow} />
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              { justifyContent: 'center' },
            ]}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.iconSection}>
              <View style={styles.fakeShadow} />
              <View style={styles.iconCard}>
                <View style={styles.topShine} />
                <Ionicons
                  name="time-outline"
                  size={96}
                  color={tokens.colors.primary}
                />
              </View>
            </View>

            <View style={[styles.titleBlock, { alignItems: 'center' }]}>
              <Text style={[styles.titleDark, { textAlign: 'center' }]}>
                Solicitud en
              </Text>
              <Text style={[styles.titleBlue, { textAlign: 'center' }]}>
                Revisión
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { textAlign: 'center', marginTop: 12 },
                ]}
              >
                Tu solicitud de registro como Dueño de Vehículo ha sido enviada
                con éxito.
                {'\n\n'}
                El administrador del sistema revisará y verificará tus datos
                comerciales. Una vez aprobada la solicitud, se habilitará tu
                cuenta y recibirás tus credenciales para acceder a tu panel de
                dueño de vehículo.
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.cta,
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
              onPress={handleFinishFlow}
            >
              <Text style={styles.ctaText}>Volver a Inicio</Text>
              <Ionicons
                name="home-outline"
                size={20}
                color="#fff"
                style={{ marginLeft: 10 }}
              />
            </Pressable>

            <Text style={styles.footerLegal}>
              CARACAS MOVE • REGISTRO DE SOCIO
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.blob} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScreenHeader title="Registro de Propietario" onBack={handleBack} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Cabecera */}
          <View style={styles.titleBlock}>
            <Text style={styles.titleDark}>Registro de</Text>
            <Text style={styles.titleBlue}>Dueño de Vehículo</Text>
            <Text style={styles.subtitle}>
              Crea tu cuenta de socio y envía tu solicitud de afiliación para
              revisión administrativa.
            </Text>
          </View>

          {/* ───── SECCIÓN 1: DATOS DE LA CUENTA ───── */}
          <Text style={styles.sectionDividerText}>1. DATOS DE TU CUENTA</Text>
          <View style={styles.sectionLine} />

          {/* Nombre Completo */}
          <Text style={styles.inputLabel}>NOMBRE COMPLETO</Text>
          <View
            style={[styles.inputCard, errors.fullName && styles.inputCardError]}
          >
            <Ionicons
              name="person-outline"
              size={20}
              color={errors.fullName ? '#EF4444' : '#3072ffe7'}
            />
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="Ej. Carlos Pérez"
              placeholderTextColor="#B8C4D4"
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                if (errors.fullName)
                  setErrors((prev) => ({ ...prev, fullName: undefined }));
              }}
              editable={!loading}
            />
          </View>
          {errors.fullName && (
            <Text style={styles.errorText}>{errors.fullName}</Text>
          )}

          {/* Cédula */}
          <Text style={styles.inputLabel}>CÉDULA DE IDENTIDAD</Text>
          <View
            style={[styles.inputCard, errors.idNumber && styles.inputCardError]}
          >
            <Text
              style={[styles.prefix, errors.idNumber && { color: '#EF4444' }]}
            >
              V-
            </Text>
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="00000000"
              placeholderTextColor="#B8C4D4"
              keyboardType="number-pad"
              value={idNumber}
              onChangeText={(text) => {
                setIdNumber(text);
                if (errors.idNumber)
                  setErrors((prev) => ({ ...prev, idNumber: undefined }));
              }}
              maxLength={10}
              editable={!loading}
            />
          </View>
          {errors.idNumber && (
            <Text style={styles.errorText}>{errors.idNumber}</Text>
          )}

          {/* Teléfono */}
          <Text style={styles.inputLabel}>TELÉFONO</Text>
          <View
            style={[
              styles.inputCard,
              errors.phoneNumber && styles.inputCardError,
            ]}
          >
            <Ionicons
              name="call-outline"
              size={20}
              color={errors.phoneNumber ? '#EF4444' : '#3072ffe7'}
            />
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="04120000000"
              placeholderTextColor="#B8C4D4"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={(text) => {
                setPhoneNumber(text);
                if (errors.phoneNumber)
                  setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
              }}
              maxLength={11}
              editable={!loading}
            />
          </View>
          {errors.phoneNumber && (
            <Text style={styles.errorText}>{errors.phoneNumber}</Text>
          )}

          {/* Correo */}
          <Text style={styles.inputLabel}>CORREO ELECTRÓNICO</Text>
          <View
            style={[styles.inputCard, errors.email && styles.inputCardError]}
          >
            <Ionicons
              name="mail-outline"
              size={20}
              color={errors.email ? '#EF4444' : '#3072ffe7'}
            />
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="email@example.com"
              placeholderTextColor="#B8C4D4"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email)
                  setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              editable={!loading}
            />
          </View>
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

          {/* Contraseña */}
          <Text style={styles.inputLabel}>CONTRASEÑA</Text>
          <View
            style={[styles.inputCard, errors.password && styles.inputCardError]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={errors.password ? '#EF4444' : '#3072ffe7'}
            />
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="******"
              placeholderTextColor="#B8C4D4"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password)
                  setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              editable={!loading}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={10}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#8594AB"
              />
            </Pressable>
          </View>
          {errors.password && (
            <Text style={styles.errorText}>{errors.password}</Text>
          )}

          {/* ───── SECCIÓN 2: DATOS DEL ASOCIADO / NEGOCIO ───── */}
          <Text style={[styles.sectionDividerText, { marginTop: 24 }]}>
            2. DATOS DE AFILIACIÓN COMERCIAL
          </Text>
          <View style={styles.sectionLine} />

          {/* Seleccionar Cooperativa / Agencia */}
          <Text style={styles.inputLabel}>
            SELECCIONA TU COOPERATIVA / AGENCIA
          </Text>
          <Pressable
            style={[
              styles.dropdownButton,
              errors.businessName && styles.dropdownButtonError,
            ]}
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
              color={errors.businessName ? '#EF4444' : '#3072ffe7'}
            />
            <View style={styles.divider} />
            <Text
              style={[
                styles.dropdownButtonText,
                !selectedCooperativeUuid && { color: '#B8C4D4' },
              ]}
            >
              {selectedCooperativeUuid
                ? `${businessName} (${ownerIdNumber})`
                : 'Selecciona una cooperativa registrada...'}
            </Text>
            <Ionicons
              name={showCoopDropdown ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#8594AB"
            />
          </Pressable>
          {errors.businessName && (
            <Text style={styles.errorText}>{errors.businessName}</Text>
          )}

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
                        selectedCooperativeUuid === coop.uuid &&
                          styles.dropdownItemActive,
                      ]}
                      onPress={() => {
                        setSelectedCooperativeUuid(coop.uuid);
                        setBusinessName(coop.name);
                        setOwnerIdNumber(coop.rif);
                        setShowCoopDropdown(false);
                        if (errors.businessName) {
                          setErrors((prev) => ({
                            ...prev,
                            businessName: undefined,
                          }));
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          selectedCooperativeUuid === coop.uuid &&
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
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              loading && { opacity: 0.7 },
            ]}
            onPress={handleRegisterAndSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>Enviar Solicitud</Text>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#fff"
                  style={{ marginLeft: 10 }}
                />
              </>
            )}
          </Pressable>

          <Text style={styles.footerLegal}>
            CARACAS MOVE • REGISTRO DE SOCIO
          </Text>
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
    opacity: 0.6,
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
  sectionDividerText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 4,
  },
  sectionLine: {
    height: 1,
    backgroundColor: '#D4DEEC',
    marginBottom: 16,
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
  inputCardError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
    shadowColor: '#EF4444',
    shadowOpacity: 0.15,
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
    fontSize: 17,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#18243E',
    includeFontPadding: false,
  },
  rowFields: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cta: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: 16,
    height: 60,
    marginTop: 20,
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
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    marginTop: -8,
    marginBottom: 16,
    paddingLeft: 4,
  },
  footerLegal: {
    textAlign: 'center',
    fontSize: 9.5,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#B0BCCC',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  dropdownButton: {
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
  dropdownButtonError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  dropdownButtonText: {
    flex: 1,
    fontSize: 17,
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
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
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
});
