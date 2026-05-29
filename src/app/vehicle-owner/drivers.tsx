import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { tokens } from '@/theme/tokens';

interface MockDriver {
  id: string;
  name: string;
  nationalId: string;
  phone: string;
  status: 'active' | 'inactive';
}

interface MockVehicle {
  uuid: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  licensePlate: string;
  cooperativeName: string;
  status: 'approved' | 'pending' | 'rejected';
  createdAt: string;
  assignedDriver?: MockDriver;
}

const MOCK_DRIVERS_BASE: MockDriver[] = [
  {
    id: 'd1',
    name: 'Carlos Mendoza',
    nationalId: 'V-14.892.401',
    phone: '0412-5551234',
    status: 'active',
  },
  {
    id: 'd2',
    name: 'Ramón Delgado',
    nationalId: 'V-18.304.582',
    phone: '0414-9994567',
    status: 'active',
  },
  {
    id: 'd3',
    name: 'José Gregorio',
    nationalId: 'V-11.204.381',
    phone: '0424-3338888',
    status: 'active',
  },
];

const MOCK_VEHICLES_BASE: MockVehicle[] = [
  {
    uuid: '1',
    vehicleMake: 'Toyota',
    vehicleModel: 'Coaster Bus',
    vehicleYear: 2018,
    licensePlate: 'AB123CD',
    cooperativeName: 'Cooperativa Caracas Move R.L.',
    status: 'approved',
    createdAt: '24/05/2026',
    assignedDriver: MOCK_DRIVERS_BASE[0],
  },
  {
    uuid: '2',
    vehicleMake: 'Encava',
    vehicleModel: 'ENT-610',
    vehicleYear: 2015,
    licensePlate: 'XY987ZT',
    cooperativeName: 'Cooperativa Caracas Move R.L.',
    status: 'approved',
    createdAt: '25/05/2026',
    assignedDriver: MOCK_DRIVERS_BASE[1],
  },
  {
    uuid: '3',
    vehicleMake: 'Hyundai',
    vehicleModel: 'County',
    vehicleYear: 2017,
    licensePlate: 'HJ321OP',
    cooperativeName: 'Cooperativa Caracas Move R.L.',
    status: 'approved',
    createdAt: '26/05/2026',
  },
];

export default function VehicleOwnerDrivers() {
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<MockDriver[]>(MOCK_DRIVERS_BASE);
  const [vehicles, setVehicles] = useState<MockVehicle[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    nationalId?: string;
    phone?: string;
  }>({});

  const loadDriversData = useCallback(async () => {
    try {
      setLoading(true);
      // 1. Cargar vehículos de AsyncStorage
      const localVehiclesStr = await AsyncStorage.getItem(
        'mock_vehicle_requests',
      );
      const localVehicles: MockVehicle[] = localVehiclesStr
        ? JSON.parse(localVehiclesStr)
        : [];

      const deletedPlatesStr = await AsyncStorage.getItem(
        'mock_deleted_vehicle_plates',
      );
      const deletedPlates: string[] = deletedPlatesStr
        ? JSON.parse(deletedPlatesStr)
        : [];

      const mergedVehicles = [
        ...localVehicles,
        ...MOCK_VEHICLES_BASE.filter(
          (mv) =>
            !localVehicles.some((lv) => lv.licensePlate === mv.licensePlate),
        ),
      ].filter((v) => !deletedPlates.includes(v.licensePlate));

      setVehicles(mergedVehicles);

      // 2. Cargar conductores locales de AsyncStorage
      const localDriversStr = await AsyncStorage.getItem(
        'mock_cooperative_drivers',
      );
      const localDrivers: MockDriver[] = localDriversStr
        ? JSON.parse(localDriversStr)
        : [];

      const mergedDrivers = [
        ...localDrivers,
        ...MOCK_DRIVERS_BASE.filter(
          (md) => !localDrivers.some((ld) => ld.nationalId === md.nationalId),
        ),
      ];

      setDrivers(mergedDrivers);
    } catch (err) {
      console.warn('[Drivers] Error loading drivers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDriversData();
    }, [loadDriversData]),
  );

  const getDriverAssignment = (driverId: string) => {
    const assignedVehicle = vehicles.find(
      (v) => v.assignedDriver?.id === driverId,
    );
    if (assignedVehicle) {
      return `${assignedVehicle.vehicleMake} ${assignedVehicle.vehicleModel} (${assignedVehicle.licensePlate})`;
    }
    return null;
  };

  const validateForm = () => {
    const errors: typeof formErrors = {};
    if (!name.trim()) errors.name = 'El nombre es requerido';
    if (!nationalId.trim()) errors.nationalId = 'La cédula es requerida';
    if (!phone.trim()) errors.phone = 'El teléfono es requerido';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegisterDriver = async () => {
    if (!validateForm()) return;

    try {
      const localDriversStr = await AsyncStorage.getItem(
        'mock_cooperative_drivers',
      );
      const localDrivers: MockDriver[] = localDriversStr
        ? JSON.parse(localDriversStr)
        : [];

      // Validar duplicado por cédula
      const isDuplicated = drivers.some(
        (d) =>
          d.nationalId.trim().toUpperCase() === nationalId.trim().toUpperCase(),
      );
      if (isDuplicated) {
        Alert.alert(
          'Cédula Duplicada',
          'Ya existe un conductor registrado con esta cédula de identidad.',
        );
        return;
      }

      const newDriver: MockDriver = {
        id: `mock-drv-${Date.now()}`,
        name: name.trim(),
        nationalId: nationalId.trim().toUpperCase(),
        phone: phone.trim(),
        status: 'active',
      };

      const updated = [newDriver, ...localDrivers];
      await AsyncStorage.setItem(
        'mock_cooperative_drivers',
        JSON.stringify(updated),
      );

      // Limpiar campos y cerrar modal
      setName('');
      setNationalId('');
      setPhone('');
      setFormErrors({});
      setIsModalVisible(false);

      Alert.alert(
        'Registro Exitoso',
        `El conductor ${newDriver.name} ha sido agregado al directorio.`,
      );
      loadDriversData();
    } catch (err) {
      console.error('[Drivers] Error registering driver:', err);
      Alert.alert(
        'Error',
        'Ocurrió un error al registrar el conductor. Intente de nuevo.',
      );
    }
  };

  const filteredDrivers = drivers.filter((d) => {
    const term = searchText.trim().toLowerCase();
    if (!term) return true;
    return (
      d.name.toLowerCase().includes(term) ||
      d.nationalId.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Directorio de Conductores</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={20}
          color="#8594AB"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar conductor por nombre o cédula..."
          placeholderTextColor="#A1A1AA"
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="none"
        />
        {searchText.length > 0 && (
          <Pressable onPress={() => setSearchText('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color="#A1A1AA" />
          </Pressable>
        )}
      </View>

      <FlatList
        data={filteredDrivers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="people-outline"
              size={64}
              color="#8594AB"
              style={{ marginBottom: 12 }}
            />
            <Text style={styles.emptyTitle}>Sin resultados</Text>
            <Text style={styles.emptySubtitle}>
              No se encontraron conductores registrados en la cooperativa.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const assignment = getDriverAssignment(item.id);

          return (
            <View style={styles.driverCard}>
              <View style={styles.driverMainRow}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {item.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </Text>
                </View>
                <View style={styles.driverDetails}>
                  <Text style={styles.driverName}>{item.name}</Text>
                  <Text style={styles.driverMeta}>
                    Cédula: {item.nationalId}
                  </Text>
                  <Text style={styles.driverMeta}>Teléfono: {item.phone}</Text>
                </View>
                <View style={styles.statusPill}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeText}>Activo</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.assignmentRow}>
                <Ionicons
                  name={assignment ? 'bus-outline' : 'alert-circle-outline'}
                  size={16}
                  color={assignment ? tokens.colors.primary : '#D97706'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.assignmentText,
                    assignment ? { color: '#1E293B' } : { color: '#D97706' },
                  ]}
                >
                  {assignment
                    ? `Operando: ${assignment}`
                    : 'Disponible (Sin unidad asignada)'}
                </Text>
              </View>
            </View>
          );
        }}
        ListFooterComponent={<View style={{ height: 110 }} />}
      />

      {/* FAB Registrar Conductor */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] },
        ]}
        onPress={() => setIsModalVisible(true)}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
        <Text style={styles.fabText}>Registrar Conductor</Text>
      </Pressable>

      {/* Modal Registrar Conductor */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar Conductor</Text>
              <Pressable onPress={() => setIsModalVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#8594AB" />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalForm}
              keyboardShouldPersistTaps="handled"
            >
              {/* Nombre */}
              <Text style={styles.inputLabel}>NOMBRE Y APELLIDO</Text>
              <View
                style={[
                  styles.inputCard,
                  formErrors.name && styles.inputCardError,
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color="#8594AB"
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Ej. Pedro Pérez"
                  placeholderTextColor="#A1A1AA"
                  value={name}
                  onChangeText={(val) => {
                    setName(val);
                    if (formErrors.name)
                      setFormErrors((p) => ({ ...p, name: undefined }));
                  }}
                />
              </View>
              {formErrors.name && (
                <Text style={styles.errorText}>{formErrors.name}</Text>
              )}

              {/* Cédula */}
              <Text style={styles.inputLabel}>CÉDULA DE IDENTIDAD</Text>
              <View
                style={[
                  styles.inputCard,
                  formErrors.nationalId && styles.inputCardError,
                ]}
              >
                <Ionicons
                  name="id-card-outline"
                  size={20}
                  color="#8594AB"
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Ej. V-12345678"
                  placeholderTextColor="#A1A1AA"
                  value={nationalId}
                  onChangeText={(val) => {
                    setNationalId(val);
                    if (formErrors.nationalId)
                      setFormErrors((p) => ({ ...p, nationalId: undefined }));
                  }}
                />
              </View>
              {formErrors.nationalId && (
                <Text style={styles.errorText}>{formErrors.nationalId}</Text>
              )}

              {/* Teléfono */}
              <Text style={styles.inputLabel}>TELÉFONO MÓVIL</Text>
              <View
                style={[
                  styles.inputCard,
                  formErrors.phone && styles.inputCardError,
                ]}
              >
                <Ionicons
                  name="call-outline"
                  size={20}
                  color="#8594AB"
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 0412-5556677"
                  placeholderTextColor="#A1A1AA"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(val) => {
                    setPhone(val);
                    if (formErrors.phone)
                      setFormErrors((p) => ({ ...p, phone: undefined }));
                  }}
                />
              </View>
              {formErrors.phone && (
                <Text style={styles.errorText}>{formErrors.phone}</Text>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.submitBtn,
                  pressed && { opacity: 0.9 },
                ]}
                onPress={handleRegisterDriver}
              >
                <Text style={styles.submitBtnText}>Registrar Conductor</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 8,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#18243E',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  driverMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  driverAvatarText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 2,
  },
  driverMeta: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
    marginRight: 6,
  },
  activeText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#16A34A',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignmentText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
    textAlign: 'center',
    lineHeight: 18,
  },
  fab: {
    position: 'absolute',
    bottom: 96, // Acomodar sobre la barra de pestañas
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: 20,
    height: 60,
    shadowColor: '#1D5BD9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  fabText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  modalForm: {
    paddingTop: 8,
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
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputCardError: {
    borderColor: '#EF4444',
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#18243E',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11.5,
    fontFamily: tokens.typography.fontFamily.medium,
    marginTop: -10,
    marginBottom: 14,
    paddingLeft: 4,
  },
  submitBtn: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 16,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#1D5BD9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
  },
  submitBtnText: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
});
