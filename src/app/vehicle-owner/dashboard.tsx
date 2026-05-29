import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokens } from '@/theme/tokens';

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
}

const MOCK_VEHICLES: MockVehicle[] = [
  {
    uuid: '1',
    vehicleMake: 'Toyota',
    vehicleModel: 'Coaster Bus',
    vehicleYear: 2018,
    licensePlate: 'AB123CD',
    cooperativeName: 'Cooperativa Caracas Move R.L.',
    status: 'approved',
    createdAt: '24/05/2026',
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
  {
    uuid: '4',
    vehicleMake: 'Ford',
    vehicleModel: 'F-350',
    vehicleYear: 2016,
    licensePlate: 'E2E-990T',
    cooperativeName: 'Cooperativa Caracas Move R.L.',
    status: 'pending',
    createdAt: '27/05/2026',
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
    adminNotes: 'El documento de propiedad (título del vehículo) cargado está borroso y no se puede leer la matrícula oficial. Por favor, realiza una nueva solicitud con fotos nítidas del título de propiedad del vehículo y la revisión de tránsito vigente.',
  },
];

type FilterType = 'all' | 'approved' | 'pending' | 'rejected';

const formatDate = (dateStr: string | Date) => {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    return dateStr;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return String(dateStr);
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function VehicleOwnerDashboard() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<MockVehicle | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const [vehicles, setVehicles] = useState<MockVehicle[]>(MOCK_VEHICLES);
  const [cooperative, setCooperative] = useState<{ name: string; rif: string }>({
    name: 'Cooperativa Caracas Move R.L.',
    rif: 'RIF: J-304598124',
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // 1. Cargar vehículos guardados y eliminados localmente
      const localVehiclesStr = await AsyncStorage.getItem('mock_vehicle_requests');
      const localVehicles: MockVehicle[] = localVehiclesStr ? JSON.parse(localVehiclesStr) : [];
      
      const deletedPlatesStr = await AsyncStorage.getItem('mock_deleted_vehicle_plates');
      const deletedPlates: string[] = deletedPlatesStr ? JSON.parse(deletedPlatesStr) : [];
      
      // Combinar los predeterminados de MOCK_VEHICLES con los guardados localmente
      // Evitamos duplicar por placa/licencia y filtramos las eliminadas
      const merged = [
        ...localVehicles,
        ...MOCK_VEHICLES.filter(mv => !localVehicles.some(lv => lv.licensePlate === mv.licensePlate))
      ].filter(v => !deletedPlates.includes(v.licensePlate));
      
      setVehicles(merged);

      // 2. Cargar cooperativa seleccionada localmente si existe
      const coopStr = await AsyncStorage.getItem('mock_vehicle_owner_cooperative');
      if (coopStr) {
        const coopData = JSON.parse(coopStr);
        setCooperative({
          name: coopData.businessName,
          rif: coopData.idNumber.startsWith('RIF:') ? coopData.idNumber : `RIF: ${coopData.idNumber}`,
        });
      }
    } catch (err) {
      console.warn('[Dashboard] Error al cargar datos simulados:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Filtrado de unidades
  const filteredVehicles = vehicles.filter((vehicle) => {
    if (filter === 'all') return true;
    return vehicle.status === filter;
  });

  // Estadísticas
  const totalUnits = vehicles.length;
  const approvedUnits = vehicles.filter((v) => v.status === 'approved').length;
  const pendingUnits = vehicles.filter((v) => v.status === 'pending').length;
  const rejectedUnits = vehicles.filter((v) => v.status === 'rejected').length;

  const handleShowNotes = (vehicle: MockVehicle) => {
    setSelectedVehicle(vehicle);
    setIsModalVisible(true);
  };

  const getStatusStyle = (status: MockVehicle['status']) => {
    switch (status) {
      case 'approved':
        return {
          bg: '#DCFCE7',
          text: '#16A34A',
          label: 'Aprobado',
          icon: 'checkmark-circle-outline' as const,
        };
      case 'pending':
        return {
          bg: '#FEF3C7',
          text: '#D97706',
          label: 'Pendiente',
          icon: 'time-outline' as const,
        };
      case 'rejected':
        return {
          bg: '#FEE2E2',
          text: '#DC2626',
          label: 'Rechazado',
          icon: 'close-circle-outline' as const,
        };
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Panel de Socio</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[tokens.colors.primary]}
          />
        }
      >
        {/* ── COOPERATIVA ASOCIADA ── */}
        <View style={styles.coopCard}>
          <View style={styles.coopIconWrapper}>
            <Ionicons name="business" size={26} color="#FFFFFF" />
          </View>
          <View style={styles.coopInfo}>
            <Text style={styles.coopLabel}>COOPERATIVA ASOCIADA</Text>
            <Text style={styles.coopName}>{cooperative.name}</Text>
            <Text style={styles.coopRif}>{cooperative.rif}</Text>
          </View>
          <View style={styles.activePill}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Activo</Text>
          </View>
        </View>

        {/* ── RESUMEN DE FLOTA (STATS) ── */}
        <Text style={styles.sectionTitle}>Resumen de Flota</Text>
        <View style={styles.statsContainer}>
          {/* Total */}
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: tokens.colors.primary }]}>{totalUnits}</Text>
            <Text style={styles.statLabel}>Total Unidades</Text>
          </View>
          {/* Aprobadas */}
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#16A34A' }]}>{approvedUnits}</Text>
            <Text style={styles.statLabel}>Aprobadas</Text>
          </View>
          {/* Pendientes */}
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#D97706' }]}>{pendingUnits}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
          {/* Rechazadas */}
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#DC2626' }]}>{rejectedUnits}</Text>
            <Text style={styles.statLabel}>Rechazadas</Text>
          </View>
        </View>

        {/* ── FILTROS (CHIPS) ── */}
        <View style={styles.filtersWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersScroll}
          >
            {(['all', 'approved', 'pending', 'rejected'] as const).map((type) => {
              const isActive = filter === type;
              let label = 'Todos';
              if (type === 'approved') label = 'Aprobados';
              if (type === 'pending') label = 'Pendientes';
              if (type === 'rejected') label = 'Rechazados';

              return (
                <Pressable
                  key={type}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setFilter(type)}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── LISTADO DE VEHÍCULOS ── */}
        <Text style={styles.sectionTitle}>Tus Unidades</Text>
        {filteredVehicles.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="car-sport-outline" size={64} color="#8594AB" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No hay vehículos</Text>
            <Text style={styles.emptySubtitle}>
              No se encontraron vehículos en esta categoría. Puedes registrar uno presionando el botón inferior.
            </Text>
          </View>
        ) : (
          filteredVehicles.map((vehicle) => {
            const statusInfo = getStatusStyle(vehicle.status);

            return (
              <Pressable
                key={vehicle.uuid}
                style={({ pressed }) => [
                  styles.vehicleCard,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }
                ]}
                onPress={() => router.push(`/vehicle-owner/${vehicle.uuid}` as any)}
              >
                <View style={styles.vehicleHeader}>
                  <View style={styles.vehicleTitleRow}>
                    <Ionicons name="car" size={22} color={tokens.colors.primary} style={{ marginRight: 8 }} />
                    <Text style={styles.vehicleName}>
                      {vehicle.vehicleMake} {vehicle.vehicleModel}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <Ionicons name={statusInfo.icon} size={14} color={statusInfo.text} style={{ marginRight: 4 }} />
                    <Text style={[styles.statusBadgeText, { color: statusInfo.text }]}>
                      {statusInfo.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.vehicleDetails}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>PLACA / MATRÍCULA</Text>
                    <Text style={styles.detailValue}>{vehicle.licensePlate}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>AÑO</Text>
                    <Text style={styles.detailValue}>{vehicle.vehicleYear}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>REGISTRADO EL</Text>
                    <Text style={styles.detailValue}>{formatDate(vehicle.createdAt)}</Text>
                  </View>
                </View>

                {vehicle.status === 'rejected' && vehicle.adminNotes && (
                  <View style={styles.actionBtn}>
                    <Ionicons name="warning-outline" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnText}>Ver Motivo de Rechazo</Text>
                  </View>
                )}
              </Pressable>
            );
          })
        )}

        {/* Espacio final */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── BOTÓN FLOTANTE REGISTRAR VEHÍCULO ── */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] },
        ]}
        onPress={() => router.push('/register-vehicle' as any)}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
        <Text style={styles.fabText}>Registrar Unidad</Text>
      </Pressable>

      {/* ── MODAL MOTIVO DE RECHAZO ── */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Cabecera Modal */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="alert-circle" size={24} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Solicitud Rechazada</Text>
              </View>
              <Pressable onPress={() => setIsModalVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#8594AB" />
              </Pressable>
            </View>

            {/* Datos de Unidad en Modal */}
            {selectedVehicle && (
              <View style={styles.modalUnitCard}>
                <Text style={styles.modalUnitTitle}>
                  {selectedVehicle.vehicleMake} {selectedVehicle.vehicleModel}
                </Text>
                <Text style={styles.modalUnitMeta}>
                  Placa: {selectedVehicle.licensePlate} • Año: {selectedVehicle.vehicleYear}
                </Text>
              </View>
            )}

            {/* Nota de Administración */}
            <Text style={styles.modalLabel}>OBSERVACIONES DE ADMINISTRACIÓN:</Text>
            <ScrollView style={styles.modalNotesScroll} showsVerticalScrollIndicator={true}>
              <Text style={styles.modalNotes}>
                {selectedVehicle?.adminNotes || 'No hay observaciones adicionales registradas.'}
              </Text>
            </ScrollView>

            <View style={styles.modalTipBox}>
              <Ionicons name="bulb-outline" size={18} color="#D97706" style={{ marginRight: 8 }} />
              <Text style={styles.modalTipText}>
                Puedes volver a realizar una solicitud de registro para esta unidad corrigiendo los puntos indicados anteriormente.
              </Text>
            </View>

            {/* Botón Aceptar */}
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={styles.modalCloseBtnText}>Entendido</Text>
            </Pressable>
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  coopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A', // Slate 900
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  coopIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  coopInfo: {
    flex: 1,
  },
  coopLabel: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
    letterSpacing: 1,
    marginBottom: 2,
  },
  coopName: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  coopRif: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#94A3B8',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  activeText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#10B981',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 12,
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statNum: {
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.black,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#6B7280',
    textAlign: 'center',
  },
  filtersWrapper: {
    marginBottom: 16,
    marginLeft: -4,
  },
  filtersScroll: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: tokens.colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#4B5563',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontFamily: tokens.typography.fontFamily.bold,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
    marginBottom: 12,
  },
  vehicleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleName: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  vehicleDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  actionBtnText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#DC2626',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
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
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#DC2626',
  },
  modalUnitCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  modalUnitTitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 2,
  },
  modalUnitMeta: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#6B7280',
  },
  modalLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  modalNotesScroll: {
    maxHeight: 120,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  modalNotes: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#991B1B',
    lineHeight: 18,
  },
  modalTipBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  modalTipText: {
    flex: 1,
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#B45309',
    lineHeight: 15,
  },
  modalCloseBtn: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
});
