import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  adminNotes?: string;
  assignedDriver?: MockDriver;
  totalEarnings?: number;
  tripsCount?: number;
}

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
    totalEarnings: 3240.00,
    tripsCount: 216,
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
    totalEarnings: 1890.00,
    tripsCount: 126,
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
    totalEarnings: 840.00,
    tripsCount: 56,
  },
  {
    uuid: '4',
    vehicleMake: 'Ford',
    vehicleModel: 'F-350',
    vehicleYear: 2016,
    licensePlate: 'E2E-990T',
    cooperativeName: 'Cooperativa Caracas Move R.L.',
    status: 'pending',
    createdAt: '27/05/2026',
    totalEarnings: 0.00,
    tripsCount: 0,
  },
  {
    uuid: '5',
    vehicleMake: 'Chevrolet',
    vehicleModel: 'NPR Turbo',
    vehicleYear: 2012,
    licensePlate: 'RJ456KL',
    cooperativeName: 'Cooperativa Caracas Move R.L.',
    status: 'rejected',
    createdAt: '22/05/2026',
    totalEarnings: 0.00,
    tripsCount: 0,
    adminNotes: 'El documento de propiedad (título del vehículo) cargado está borroso y no se puede leer la matrícula oficial. Por favor, realiza una nueva solicitud con fotos nítidas del título de propiedad del vehículo y la revisión de tránsito vigente.',
  },
];

const MOCK_DRIVERS: MockDriver[] = [
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

const MOCK_TRIPS = [
  { id: 't1', route: 'Ruta 201: Chacaíto - El Hatillo', amount: 15.00, date: 'Hoy, 02:40 PM', type: 'ticket' },
  { id: 't2', route: 'Ruta 201: Chacaíto - El Hatillo', amount: 15.00, date: 'Hoy, 01:15 PM', type: 'ticket' },
  { id: 't3', route: 'Ruta L1: Propatria - Palo Verde', amount: 20.00, date: 'Ayer, 06:30 PM', type: 'ticket' },
  { id: 't4', route: 'Ruta 201: Chacaíto - El Hatillo', amount: 15.00, date: 'Ayer, 11:24 AM', type: 'ticket' },
  { id: 't5', route: 'Ruta L1: Propatria - Palo Verde', amount: 20.00, date: '26/05/2026, 04:55 PM', type: 'ticket' },
];

export default function VehicleDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [vehicle, setVehicle] = useState<MockVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDriverModalVisible, setIsDriverModalVisible] = useState(false);

  // Cargar datos del vehículo desde AsyncStorage o base estática
  const loadVehicle = useCallback(async () => {
    try {
      setLoading(true);
      const localStr = await AsyncStorage.getItem('mock_vehicle_requests');
      const localVehicles: MockVehicle[] = localStr ? JSON.parse(localStr) : [];
      
      const merged = [
        ...localVehicles,
        ...MOCK_VEHICLES_BASE.filter(mv => !localVehicles.some(lv => lv.licensePlate === mv.licensePlate))
      ];

      const found = merged.find(v => v.uuid === id);
      if (found) {
        // Inicializar campos de simulación si no existen
        if (found.totalEarnings === undefined) found.totalEarnings = found.status === 'approved' ? 450.00 : 0.00;
        if (found.tripsCount === undefined) found.tripsCount = found.status === 'approved' ? 30 : 0;
        setVehicle(found);
      }
    } catch (err) {
      console.warn('[Details] Error loading vehicle details:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadVehicle();
  }, [loadVehicle]);

  // Actualizar conductor asignado
  const handleAssignDriver = async (driver: MockDriver | undefined) => {
    if (!vehicle) return;

    try {
      const localStr = await AsyncStorage.getItem('mock_vehicle_requests');
      let localVehicles: MockVehicle[] = localStr ? JSON.parse(localStr) : [];

      // Buscar si este vehículo ya está en AsyncStorage
      const idx = localVehicles.findIndex(v => v.uuid === vehicle.uuid);
      const updatedVehicle = { ...vehicle, assignedDriver: driver };

      if (idx !== -1) {
        localVehicles[idx] = updatedVehicle;
      } else {
        localVehicles.push(updatedVehicle);
      }

      await AsyncStorage.setItem('mock_vehicle_requests', JSON.stringify(localVehicles));
      setVehicle(updatedVehicle);
      setIsDriverModalVisible(false);
      
      Alert.alert(
        'Conductor Actualizado',
        driver 
          ? `Se ha asignado a ${driver.name} como conductor de esta unidad.` 
          : 'Se ha desvinculado al conductor de esta unidad.'
      );
    } catch (err) {
      console.error('[Details] Error updating driver:', err);
      Alert.alert('Error', 'No se pudo actualizar el conductor. Intente de nuevo.');
    }
  };

  // Eliminar vehículo (dar de baja)
  const handleDeleteVehicle = () => {
    if (!vehicle) return;

    Alert.alert(
      'Dar de Baja Unidad',
      '¿Estás seguro de que deseas dar de baja este vehículo? Esta acción eliminará permanentemente la unidad y desvinculará a su conductor.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar Baja',
          style: 'destructive',
          onPress: async () => {
            try {
              const localStr = await AsyncStorage.getItem('mock_vehicle_requests');
              let localVehicles: MockVehicle[] = localStr ? JSON.parse(localStr) : [];

              // Filtrar y remover el vehículo por placa
              const filtered = localVehicles.filter(v => v.licensePlate !== vehicle.licensePlate);
              
              // Si el vehículo era un mock estático (no persistido inicialmente en AsyncStorage),
              // agregamos una bandera de borrado o simplemente guardamos la lista filtrada.
              // Pero para dar de baja uno estático, necesitamos registrar que ha sido eliminado localmente.
              // Para simplificar, guardamos la lista completa filtrada y marcamos la placa como borrada.
              // Vamos a agregar la placa a una lista negra local si no estaba en AsyncStorage
              const deletedPlatesStr = await AsyncStorage.getItem('mock_deleted_vehicle_plates');
              const deletedPlates: string[] = deletedPlatesStr ? JSON.parse(deletedPlatesStr) : [];
              if (!deletedPlates.includes(vehicle.licensePlate)) {
                deletedPlates.push(vehicle.licensePlate);
                await AsyncStorage.setItem('mock_deleted_vehicle_plates', JSON.stringify(deletedPlates));
              }

              await AsyncStorage.setItem('mock_vehicle_requests', JSON.stringify(filtered));

              Alert.alert('Baja Exitosa', 'El vehículo ha sido removido de la flota.', [
                { text: 'Aceptar', onPress: () => router.replace('/vehicle-owner/dashboard') }
              ]);
            } catch (err) {
              console.error('[Details] Error deleting vehicle:', err);
              Alert.alert('Error', 'No se pudo dar de baja la unidad.');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#18243E" />
          </Pressable>
          <Text style={styles.headerTitle}>Unidad No Encontrada</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={[styles.center, { padding: 32 }]}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" style={{ marginBottom: 12 }} />
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorSubtitle}>La unidad solicitada no existe o fue dada de baja previamente.</Text>
          <Pressable style={styles.errorBtn} onPress={() => router.replace('/vehicle-owner/dashboard')}>
            <Text style={styles.errorBtnText}>Volver al Panel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isApproved = vehicle.status === 'approved';
  const isPending = vehicle.status === 'pending';
  const isRejected = vehicle.status === 'rejected';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={15}>
          <Ionicons name="arrow-back" size={24} color="#18243E" />
        </Pressable>
        <Text style={styles.headerTitle}>Detalle de Unidad</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── TARJETA PRINCIPAL VEHÍCULO ── */}
        <View style={styles.vehicleMainCard}>
          <View style={styles.vehicleBrandRow}>
            <View style={styles.vehicleIconContainer}>
              <Ionicons name="bus" size={32} color="#FFFFFF" />
            </View>
            <View style={styles.vehicleTitleBlock}>
              <Text style={styles.vehicleModelText}>
                {vehicle.vehicleMake} {vehicle.vehicleModel}
              </Text>
              <Text style={styles.vehicleCoopText}>{vehicle.cooperativeName}</Text>
            </View>
          </View>

          <View style={styles.horizontalDivider} />

          <View style={styles.specGrid}>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>MATRÍCULA / PLACA</Text>
              <Text style={styles.specValue}>{vehicle.licensePlate}</Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>AÑO DE FABRICACIÓN</Text>
              <Text style={styles.specValue}>{vehicle.vehicleYear}</Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>ESTADO DE REVISIÓN:</Text>
            <View
              style={[
                styles.statusBadge,
                isApproved && styles.badgeApproved,
                isPending && styles.badgePending,
                isRejected && styles.badgeRejected,
              ]}
            >
              <Ionicons
                name={
                  isApproved
                    ? 'checkmark-circle'
                    : isPending
                    ? 'time'
                    : 'close-circle'
                }
                size={16}
                color={isApproved ? '#16A34A' : isPending ? '#D97706' : '#DC2626'}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.statusText,
                  isApproved && { color: '#16A34A' },
                  isPending && { color: '#D97706' },
                  isRejected && { color: '#DC2626' },
                ]}
              >
                {isApproved ? 'Aprobada para operar' : isPending ? 'Revisión Pendiente' : 'Rechazada'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── MOTIVO DE RECHAZO (SI APLICA) ── */}
        {isRejected && vehicle.adminNotes && (
          <View style={styles.rejectedBanner}>
            <View style={styles.rejectedHeader}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" style={{ marginRight: 8 }} />
              <Text style={styles.rejectedTitle}>Motivo del Rechazo Administrativo</Text>
            </View>
            <Text style={styles.rejectedNotes}>{vehicle.adminNotes}</Text>
            <View style={styles.rejectedAlertBox}>
              <Text style={styles.rejectedAlertText}>
                Para corregir esto, debes dar de baja esta unidad y volver a registrarla adjuntando documentos legibles y nítidos.
              </Text>
            </View>
          </View>
        )}

        {/* ── GESTIÓN DE CONDUCTOR (SI ESTÁ APROBADO O PENDIENTE) ── */}
        {!isRejected && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="person-circle-outline" size={22} color={tokens.colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.sectionCardTitle}>Conductor Asignado</Text>
            </View>

            {vehicle.assignedDriver ? (
              <View style={styles.driverInfoBlock}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {vehicle.assignedDriver.name.split(' ').map(n => n[0]).join('')}
                  </Text>
                </View>
                <View style={styles.driverDetails}>
                  <Text style={styles.driverNameText}>{vehicle.assignedDriver.name}</Text>
                  <Text style={styles.driverMetaText}>Cédula: {vehicle.assignedDriver.nationalId}</Text>
                  <Text style={styles.driverMetaText}>Teléfono: {vehicle.assignedDriver.phone}</Text>
                </View>
                <Pressable
                  style={styles.driverActionBtn}
                  onPress={() => setIsDriverModalVisible(true)}
                >
                  <Ionicons name="create-outline" size={20} color={tokens.colors.primary} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.noDriverBlock}>
                <Text style={styles.noDriverText}>No hay un conductor asignado a este vehículo.</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.assignBtn,
                    pressed && { opacity: 0.88 }
                  ]}
                  onPress={() => setIsDriverModalVisible(true)}
                >
                  <Ionicons name="person-add-outline" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.assignBtnText}>Asignar Conductor</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* ── INGRESOS Y ESTADÍSTICAS (SI ESTÁ APROBADO) ── */}
        {isApproved && (
          <>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="analytics" size={22} color={tokens.colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.sectionCardTitle}>Rendimiento Financiero</Text>
              </View>

              <View style={styles.financialStatsRow}>
                <View style={styles.finStatBox}>
                  <Text style={styles.finStatLabel}>INGRESOS TOTALES</Text>
                  <Text style={styles.finStatValue}>{(vehicle.totalEarnings ?? 0).toFixed(2)} Bs</Text>
                </View>
                <View style={styles.verticalDivider} />
                <View style={styles.finStatBox}>
                  <Text style={styles.finStatLabel}>VIAJES REALIZADOS</Text>
                  <Text style={styles.finStatValue}>{vehicle.tripsCount ?? 0} viajes</Text>
                </View>
              </View>
            </View>

            {/* ── HISTORIAL DE VIAJES RECIENTES ── */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="time-outline" size={22} color={tokens.colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.sectionCardTitle}>Historial Reciente</Text>
              </View>

              {MOCK_TRIPS.map((trip) => (
                <View key={trip.id} style={styles.tripItem}>
                  <View style={styles.tripIconWrapper}>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" />
                  </View>
                  <View style={styles.tripMeta}>
                    <Text style={styles.tripRoute}>{trip.route}</Text>
                    <Text style={styles.tripDate}>{trip.date}</Text>
                  </View>
                  <Text style={styles.tripAmount}>+{trip.amount.toFixed(2)} Bs</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── ACCIONES DE UNIDAD ── */}
        <Pressable
          style={({ pressed }) => [
            styles.deleteBtn,
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleDeleteVehicle}
        >
          <Ionicons name="trash-outline" size={18} color="#DC2626" style={{ marginRight: 8 }} />
          <Text style={styles.deleteBtnText}>Dar de Baja Unidad (Retirar de Flota)</Text>
        </Pressable>

        {/* Padding final */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── MODAL SELECCIONAR CONDUCTOR ── */}
      <Modal
        visible={isDriverModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDriverModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Asignar Conductor</Text>
              <Pressable onPress={() => setIsDriverModalVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#8594AB" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={true}>
              {MOCK_DRIVERS.map((driver) => {
                const isSelected = vehicle.assignedDriver?.id === driver.id;

                return (
                  <Pressable
                    key={driver.id}
                    style={[styles.driverSelectItem, isSelected && styles.driverSelectItemActive]}
                    onPress={() => handleAssignDriver(driver)}
                  >
                    <View style={styles.driverSelectInfo}>
                      <Text style={[styles.driverSelectName, isSelected && { color: tokens.colors.primary }]}>
                        {driver.name}
                      </Text>
                      <Text style={styles.driverSelectMeta}>Cédula: {driver.nationalId}</Text>
                      <Text style={styles.driverSelectMeta}>Telf: {driver.phone}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color={tokens.colors.primary} />
                    )}
                  </Pressable>
                );
              })}

              {vehicle.assignedDriver && (
                <Pressable
                  style={styles.unassignOptionBtn}
                  onPress={() => handleAssignDriver(undefined)}
                >
                  <Ionicons name="person-remove-outline" size={18} color="#DC2626" style={{ marginRight: 8 }} />
                  <Text style={styles.unassignOptionText}>Desvincular Conductor Actual</Text>
                </Pressable>
              )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  vehicleMainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  vehicleBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  vehicleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  vehicleTitleBlock: {
    flex: 1,
  },
  vehicleModelText: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#18243E',
    marginBottom: 2,
  },
  vehicleCoopText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
  },
  horizontalDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 16,
  },
  specGrid: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  specBox: {
    flex: 1,
  },
  specLabel: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  specValue: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
  },
  statusLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeApproved: {
    backgroundColor: '#DCFCE7',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  badgeRejected: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  rejectedBanner: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
  },
  rejectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rejectedTitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#991B1B',
  },
  rejectedNotes: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#991B1B',
    lineHeight: 18,
    marginBottom: 12,
  },
  rejectedAlertBox: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
    padding: 10,
    borderRadius: 8,
  },
  rejectedAlertText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#B91C1C',
    lineHeight: 15,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionCardTitle: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  driverInfoBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  driverAvatarText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
  },
  driverDetails: {
    flex: 1,
  },
  driverNameText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 2,
  },
  driverMetaText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
  },
  driverActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDriverBlock: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  noDriverText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
    marginBottom: 12,
  },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  assignBtnText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  financialStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  finStatBox: {
    flex: 1,
    alignItems: 'center',
  },
  finStatLabel: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    marginBottom: 4,
  },
  finStatValue: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
  },
  verticalDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E2E8F0',
  },
  tripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 12,
  },
  tripIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tripMeta: {
    flex: 1,
  },
  tripRoute: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 2,
  },
  tripDate: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
  },
  tripAmount: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#16A34A',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 8,
  },
  deleteBtnText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#DC2626',
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 4,
  },
  errorSubtitle: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorBtn: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  errorBtnText: {
    color: '#FFFFFF',
    fontFamily: tokens.typography.fontFamily.bold,
    fontSize: 14,
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
  modalScroll: {
    maxHeight: 250,
  },
  driverSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    marginBottom: 10,
  },
  driverSelectItemActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: tokens.colors.primary,
  },
  driverSelectInfo: {
    flex: 1,
  },
  driverSelectName: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 2,
  },
  driverSelectMeta: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
  },
  unassignOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  unassignOptionText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#DC2626',
  },
});
