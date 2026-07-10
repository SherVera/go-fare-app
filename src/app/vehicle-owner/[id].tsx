import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  deleteVehicle,
  getBackendInviteCodes,
  getVehicleDetail,
} from '@/lib/api';
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

export default function VehicleDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [vehicle, setVehicle] = useState<MockVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDriverModalVisible, setIsDriverModalVisible] = useState(false);
  const [drivers, setDrivers] = useState<MockDriver[]>([]);

  // Cargar conductores reales del backend (de invitaciones canjeadas)
  const loadAssociatedDrivers = useCallback(async () => {
    try {
      const invites = await getBackendInviteCodes().catch(() => []);
      const realDrivers = invites
        .filter((inv: any) => inv.driver)
        .map((inv: any) => ({
          id: inv.driver.id,
          name:
            inv.driver.displayName ||
            `${inv.driver.firstName} ${inv.driver.lastName}`.trim() ||
            'Conductor sin nombre',
          nationalId: inv.driver.nationalId || 'Sin cédula',
          phone: inv.driver.phoneNumber || 'Sin teléfono',
          status: 'active' as const,
        }));
      setDrivers(realDrivers);
    } catch (err) {
      console.warn('[Details] Error loading associated drivers:', err);
    }
  }, []);

  // Cargar datos del vehículo desde el backend
  const loadVehicle = useCallback(async () => {
    try {
      setLoading(true);
      if (!id) return;
      const found = await getVehicleDetail(id);
      if (found) {
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
    loadAssociatedDrivers();
  }, [loadVehicle, loadAssociatedDrivers]);

  // Actualizar conductor asignado
  const handleAssignDriver = async (driver: MockDriver | undefined) => {
    if (!vehicle) return;

    try {
      const localStr = await AsyncStorage.getItem('mock_vehicle_requests');
      const localVehicles: MockVehicle[] = localStr ? JSON.parse(localStr) : [];

      // Buscar si este vehículo ya está en AsyncStorage
      const idx = localVehicles.findIndex((v) => v.uuid === vehicle.uuid);
      const updatedVehicle = { ...vehicle, assignedDriver: driver };

      if (idx !== -1) {
        localVehicles[idx] = updatedVehicle;
      } else {
        localVehicles.push(updatedVehicle);
      }

      await AsyncStorage.setItem(
        'mock_vehicle_requests',
        JSON.stringify(localVehicles),
      );
      setVehicle(updatedVehicle);
      setIsDriverModalVisible(false);

      Alert.alert(
        'Conductor Actualizado',
        driver
          ? `Se ha asignado a ${driver.name} como conductor de esta unidad.`
          : 'Se ha desvinculado al conductor de esta unidad.',
      );
    } catch (err) {
      console.error('[Details] Error updating driver:', err);
      Alert.alert(
        'Error',
        'No se pudo actualizar el conductor. Intente de nuevo.',
      );
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
              setLoading(true);
              await deleteVehicle(vehicle.uuid);
              Alert.alert(
                'Baja Exitosa',
                'El vehículo ha sido removido de la flota.',
                [
                  {
                    text: 'Aceptar',
                    onPress: () => router.replace('/vehicle-owner/dashboard'),
                  },
                ],
              );
            } catch (err) {
              console.error('[Details] Error deleting vehicle:', err);
              Alert.alert('Error', 'No se pudo dar de baja la unidad.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
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
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color="#EF4444"
            style={{ marginBottom: 12 }}
          />
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorSubtitle}>
            La unidad solicitada no existe o fue dada de baja previamente.
          </Text>
          <Pressable
            style={styles.errorBtn}
            onPress={() => router.replace('/vehicle-owner/dashboard')}
          >
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
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={15}
        >
          <Ionicons name="arrow-back" size={24} color="#18243E" />
        </Pressable>
        <Text style={styles.headerTitle}>Detalle de Unidad</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
              <Text style={styles.vehicleCoopText}>
                {vehicle.cooperativeName}
              </Text>
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
                color={
                  isApproved ? '#16A34A' : isPending ? '#D97706' : '#DC2626'
                }
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
                {isApproved
                  ? 'Aprobada para operar'
                  : isPending
                    ? 'Revisión Pendiente'
                    : 'Rechazada'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── MOTIVO DE RECHAZO (SI APLICA) ── */}
        {isRejected && vehicle.adminNotes && (
          <View style={styles.rejectedBanner}>
            <View style={styles.rejectedHeader}>
              <Ionicons
                name="alert-circle"
                size={20}
                color="#DC2626"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.rejectedTitle}>
                Motivo del Rechazo Administrativo
              </Text>
            </View>
            <Text style={styles.rejectedNotes}>{vehicle.adminNotes}</Text>
            <View style={styles.rejectedAlertBox}>
              <Text style={styles.rejectedAlertText}>
                Para corregir esto, debes dar de baja esta unidad y volver a
                registrarla adjuntando documentos legibles y nítidos.
              </Text>
            </View>
          </View>
        )}

        {/* ── GESTIÓN DE CONDUCTOR (SI ESTÁ APROBADO O PENDIENTE) ── */}
        {!isRejected && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons
                name="person-circle-outline"
                size={22}
                color={tokens.colors.primary}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.sectionCardTitle}>Conductor Asignado</Text>
            </View>

            {vehicle.assignedDriver ? (
              <View style={styles.driverInfoBlock}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {vehicle.assignedDriver.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </Text>
                </View>
                <View style={styles.driverDetails}>
                  <Text style={styles.driverNameText}>
                    {vehicle.assignedDriver.name}
                  </Text>
                  <Text style={styles.driverMetaText}>
                    Cédula: {vehicle.assignedDriver.nationalId}
                  </Text>
                  <Text style={styles.driverMetaText}>
                    Teléfono: {vehicle.assignedDriver.phone}
                  </Text>
                </View>
                <Pressable
                  style={styles.driverActionBtn}
                  onPress={() => {
                    if (isApproved) {
                      setIsDriverModalVisible(true);
                    } else {
                      Alert.alert(
                        'Operación no permitida',
                        'No puedes modificar el conductor asignado hasta que la unidad esté aprobada.',
                      );
                    }
                  }}
                >
                  <Ionicons
                    name="create-outline"
                    size={20}
                    color={tokens.colors.primary}
                  />
                </Pressable>
              </View>
            ) : (
              <View style={styles.noDriverBlock}>
                <Text style={styles.noDriverText}>
                  No hay un conductor asignado a este vehículo.
                </Text>
                {isApproved ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.assignBtn,
                      pressed && { opacity: 0.88 },
                    ]}
                    onPress={() => setIsDriverModalVisible(true)}
                  >
                    <Ionicons
                      name="person-add-outline"
                      size={16}
                      color="#FFFFFF"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.assignBtnText}>Asignar Conductor</Text>
                  </Pressable>
                ) : (
                  <View style={styles.pendingDriverWarning}>
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color="#D97706"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.pendingDriverWarningText}>
                      Debes esperar a que la unidad sea aprobada para poder
                      asignarle un conductor.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── INGRESOS Y ESTADÍSTICAS (SI ESTÁ APROBADO) ── */}
        {isApproved && (
          <>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons
                  name="analytics"
                  size={22}
                  color={tokens.colors.primary}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.sectionCardTitle}>
                  Rendimiento Financiero
                </Text>
              </View>

              <View style={styles.financialStatsRow}>
                <View style={styles.finStatBox}>
                  <Text style={styles.finStatLabel}>INGRESOS TOTALES</Text>
                  <Text style={styles.finStatValue}>
                    {(vehicle.totalEarnings ?? 0).toFixed(2)} Bs
                  </Text>
                </View>
                <View style={styles.verticalDivider} />
                <View style={styles.finStatBox}>
                  <Text style={styles.finStatLabel}>VIAJES REALIZADOS</Text>
                  <Text style={styles.finStatValue}>
                    {vehicle.tripsCount ?? 0} viajes
                  </Text>
                </View>
              </View>
            </View>

            {/* ── HISTORIAL DE VIAJES RECIENTES ── */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons
                  name="time-outline"
                  size={22}
                  color={tokens.colors.primary}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.sectionCardTitle}>Historial Reciente</Text>
              </View>

              <View style={styles.emptyTripsWrapper}>
                <Ionicons
                  name="document-text-outline"
                  size={32}
                  color="#94A3B8"
                  style={{ marginBottom: 6 }}
                />
                <Text style={styles.emptyTripsText}>
                  No hay viajes registrados para este vehículo
                </Text>
              </View>
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
          <Ionicons
            name="trash-outline"
            size={18}
            color="#DC2626"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.deleteBtnText}>
            Dar de Baja Unidad (Retirar de Flota)
          </Text>
        </Pressable>

        {/* Padding final */}
        <View style={{ height: 120 }} />
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
              <Pressable
                onPress={() => setIsDriverModalVisible(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={24} color="#8594AB" />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={true}
            >
              {drivers.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Ionicons
                    name="people-outline"
                    size={36}
                    color="#8594AB"
                    style={{ marginBottom: 8 }}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      color: '#64748B',
                      fontFamily: tokens.typography.fontFamily.medium,
                      textAlign: 'center',
                    }}
                  >
                    No tienes conductores asociados.
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: '#8594AB',
                      fontFamily: tokens.typography.fontFamily.regular,
                      textAlign: 'center',
                      marginTop: 2,
                    }}
                  >
                    Invita a un conductor desde la sección de Conductores.
                  </Text>
                </View>
              ) : (
                drivers.map((driver) => {
                  const isSelected = vehicle.assignedDriver?.id === driver.id;

                  return (
                    <Pressable
                      key={driver.id}
                      style={[
                        styles.driverSelectItem,
                        isSelected && styles.driverSelectItemActive,
                      ]}
                      onPress={() => handleAssignDriver(driver)}
                    >
                      <View style={styles.driverSelectInfo}>
                        <Text
                          style={[
                            styles.driverSelectName,
                            isSelected && { color: tokens.colors.primary },
                          ]}
                        >
                          {driver.name}
                        </Text>
                        <Text style={styles.driverSelectMeta}>
                          Cédula: {driver.nationalId}
                        </Text>
                        <Text style={styles.driverSelectMeta}>
                          Telf: {driver.phone}
                        </Text>
                      </View>
                      {isSelected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={tokens.colors.primary}
                        />
                      ) : (
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color="#8594AB"
                        />
                      )}
                    </Pressable>
                  );
                })
              )}

              {vehicle.assignedDriver && (
                <Pressable
                  style={styles.unassignOptionBtn}
                  onPress={() => handleAssignDriver(undefined)}
                >
                  <Ionicons
                    name="person-remove-outline"
                    size={18}
                    color="#DC2626"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.unassignOptionText}>
                    Desvincular Conductor Actual
                  </Text>
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
    flexWrap: 'wrap',
    gap: 8,
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
  pendingDriverWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  pendingDriverWarningText: {
    flex: 1,
    fontSize: 13,
    color: '#B45309',
    fontFamily: tokens.typography.fontFamily.medium,
    lineHeight: 18,
  },
  emptyTripsWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginTop: 8,
  },
  emptyTripsText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    textAlign: 'center',
  },
});
