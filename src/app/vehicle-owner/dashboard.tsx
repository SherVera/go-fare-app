import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import type { MockVehicle } from '@/interfaces';
import {
  getBackendProfile,
  getOwnerVehicles,
  verifyAuthStatus,
} from '@/lib/api';
import { purgeUserSessionAndLogout } from '@/lib/auth-session';
import { tokens } from '@/theme/tokens';

type FilterType =
  | 'all'
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'pending'
  | 'rejected'
  | 'approved';

const formatDate = (dateStr: string | Date) => {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    return dateStr;
  }
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return String(dateStr);

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function VehicleOwnerDashboard() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<MockVehicle | null>(
    null,
  );
  const [isModalVisible, setIsModalVisible] = useState(false);

  const [vehicles, setVehicles] = useState<MockVehicle[]>([]);
  const [cooperative, setCooperative] = useState<{ name: string; rif: string }>(
    {
      name: 'Línea / Cooperativa',
      rif: '',
    },
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const scrollTimeoutRef = useRef<any>(null);

  const handleScroll = useCallback(
    (_event: any) => {
      Animated.spring(slideAnim, {
        toValue: 100,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }).start();

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }).start();
      }, 450);
    },
    [slideAnim],
  );

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const authStatus = await verifyAuthStatus();
      if (!authStatus.isAuthenticated) {
        await purgeUserSessionAndLogout();
        router.replace('/login');
        return;
      }

      // 1. Cargar vehículos reales del dueño desde PostgreSQL (GET /vehicles/my)
      const realVehicles = await getOwnerVehicles();
      setVehicles(realVehicles);

      // 2. Cargar perfil real del backend para obtener el nombre de la cooperativa/asociación
      try {
        const profile = await getBackendProfile();
        const civil =
          (profile as any)?.transportOwner?.civilAssociation ||
          (profile as any)?.civilAssociation;

        if (civil?.name) {
          setCooperative({
            name: civil.name,
            rif: civil.rif
              ? `RIF: ${civil.rif}`
              : profile.nationalId
                ? `RIF: ${profile.nationalId}`
                : '',
          });
        } else {
          // Si el dueño no está asociado a ninguna asociación civil en PostgreSQL
          const ownerName =
            profile.displayName ||
            `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
          setCooperative({
            name: ownerName
              ? `Dueño: ${ownerName}`
              : 'Particular / Sin Asociación',
            rif: profile.nationalId ? `Cédula: ${profile.nationalId}` : '',
          });
        }
      } catch (profErr) {
        console.warn(
          '[Dashboard] Error al consultar perfil para asociación:',
          profErr,
        );
      }
    } catch (err: any) {
      console.warn(
        '[Dashboard] Error al cargar lista de vehículos reales:',
        err,
      );
      if (
        err?.status === 401 ||
        err?.message?.includes('401') ||
        err?.message?.includes('expired') ||
        err?.message?.includes('No authenticated user')
      ) {
        await purgeUserSessionAndLogout();
        router.replace('/login');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Filtrado de unidades
  const filteredVehicles = vehicles.filter((vehicle) => {
    if (filter === 'all') return true;
    if (filter === 'active') {
      return vehicle.status === 'active' || vehicle.status === 'approved';
    }
    if (filter === 'inactive') {
      return vehicle.status === 'inactive';
    }
    if (filter === 'suspended') {
      return vehicle.status === 'suspended';
    }
    if (filter === 'pending') {
      return vehicle.status === 'pending';
    }
    if (filter === 'rejected') {
      return vehicle.status === 'rejected';
    }
    return vehicle.status === filter;
  });

  // Estadísticas
  const totalUnits = vehicles.length;
  const activeUnits = vehicles.filter(
    (v) => v.status === 'active' || v.status === 'approved',
  ).length;
  const inactiveUnits = vehicles.filter((v) => v.status === 'inactive').length;
  const suspendedUnits = vehicles.filter(
    (v) => v.status === 'suspended',
  ).length;
  const pendingUnits = vehicles.filter((v) => v.status === 'pending').length;
  const rejectedUnits = vehicles.filter((v) => v.status === 'rejected').length;

  const handleShowNotes = (vehicle: MockVehicle) => {
    setSelectedVehicle(vehicle);
    setIsModalVisible(true);
  };

  const getStatusStyle = (status: MockVehicle['status'] | string) => {
    switch (status) {
      case 'active':
      case 'approved':
        return {
          bg: '#DCFCE7',
          text: '#16A34A',
          label: 'Activo',
          icon: 'checkmark-circle-outline' as const,
        };
      case 'inactive':
        return {
          bg: '#F1F5F9',
          text: '#64748B',
          label: 'Inactivo',
          icon: 'pause-circle-outline' as const,
        };
      case 'suspended':
        return {
          bg: '#FFEDD5',
          text: '#EA580C',
          label: 'Suspendido',
          icon: 'alert-circle-outline' as const,
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
      default:
        return {
          bg: '#F1F5F9',
          text: '#64748B',
          label: status ? String(status).toUpperCase() : 'Inactivo',
          icon: 'help-circle-outline' as const,
        };
    }
  };

  if (loading && !refreshing) {
    return <AppLoadingScreen message="Cargando panel de unidades..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Panel de Dueño de Vehiculo</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
        <Text style={styles.sectionTitle}>Resumen de Buses</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsScroll}
        >
          {/* Total */}
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: tokens.colors.primary }]}>
              {totalUnits}
            </Text>
            <Text style={styles.statLabel}>Total Unidades</Text>
          </View>
          {/* Activas */}
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#16A34A' }]}>
              {activeUnits}
            </Text>
            <Text style={styles.statLabel}>Activas</Text>
          </View>
          {/* Inactivas */}
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#64748B' }]}>
              {inactiveUnits}
            </Text>
            <Text style={styles.statLabel}>Inactivas</Text>
          </View>
          {/* Suspendidas */}
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#EA580C' }]}>
              {suspendedUnits}
            </Text>
            <Text style={styles.statLabel}>Suspendidas</Text>
          </View>
          {/* Pendientes (si hay) */}
          {pendingUnits > 0 && (
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: '#D97706' }]}>
                {pendingUnits}
              </Text>
              <Text style={styles.statLabel}>Pendientes</Text>
            </View>
          )}
          {/* Rechazadas (si hay) */}
          {rejectedUnits > 0 && (
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: '#DC2626' }]}>
                {rejectedUnits}
              </Text>
              <Text style={styles.statLabel}>Rechazadas</Text>
            </View>
          )}
        </ScrollView>

        {/* ── FILTROS (CHIPS) ── */}
        <View style={styles.filtersWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersScroll}
          >
            {[
              { type: 'all' as const, label: 'Todos' },
              { type: 'active' as const, label: 'Activos' },
              { type: 'inactive' as const, label: 'Inactivos' },
              { type: 'suspended' as const, label: 'Suspendidos' },
              ...(pendingUnits > 0
                ? [{ type: 'pending' as const, label: 'Pendientes' }]
                : []),
              ...(rejectedUnits > 0
                ? [{ type: 'rejected' as const, label: 'Rechazados' }]
                : []),
            ].map((item) => {
              const isActive = filter === item.type;
              return (
                <Pressable
                  key={item.type}
                  style={[
                    styles.filterChip,
                    isActive && styles.filterChipActive,
                  ]}
                  onPress={() => setFilter(item.type)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isActive && styles.filterChipTextActive,
                    ]}
                  >
                    {item.label}
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
            <Ionicons
              name="bus-outline"
              size={64}
              color="#8594AB"
              style={{ marginBottom: 12 }}
            />
            <Text style={styles.emptyTitle}>No hay vehículos</Text>
            <Text style={styles.emptySubtitle}>
              No se encontraron vehículos en esta categoría. Puedes registrar
              uno presionando el botón inferior.
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
                  pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                ]}
                onPress={() =>
                  router.push(`/vehicle-owner/${vehicle.uuid}` as any)
                }
              >
                <View style={styles.vehicleHeader}>
                  <View style={styles.vehicleTitleRow}>
                    <Ionicons
                      name="bus"
                      size={22}
                      color={tokens.colors.primary}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.vehicleName}>
                      {vehicle.vehicleMake} {vehicle.vehicleModel}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusInfo.bg },
                    ]}
                  >
                    <Ionicons
                      name={statusInfo.icon}
                      size={14}
                      color={statusInfo.text}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: statusInfo.text },
                      ]}
                    >
                      {statusInfo.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.vehicleDetails}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>PLACA / MATRÍCULA</Text>
                    <Text style={styles.detailValue}>
                      {vehicle.licensePlate}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>AÑO</Text>
                    <Text style={styles.detailValue}>
                      {vehicle.vehicleYear}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>REGISTRADO EL</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(vehicle.createdAt)}
                    </Text>
                  </View>
                </View>

                {vehicle.routeNumber ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginTop: 8,
                      backgroundColor: '#F1F5F9',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      alignSelf: 'flex-start',
                      gap: 4,
                    }}
                  >
                    <Ionicons
                      name="trail-sign-outline"
                      size={13}
                      color="#475569"
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        color: '#475569',
                        fontWeight: '500',
                      }}
                    >
                      Ruta:{' '}
                      <Text
                        style={{
                          color: '#0F172A',
                          fontWeight: '700',
                        }}
                      >
                        {vehicle.routeNumber}
                      </Text>
                    </Text>
                  </View>
                ) : null}

                {(vehicle.status === 'rejected' ||
                  vehicle.status === 'suspended') &&
                  vehicle.adminNotes && (
                    <Pressable
                      style={[
                        styles.actionBtn,
                        vehicle.status === 'suspended' && {
                          backgroundColor: '#FFEDD5',
                        },
                      ]}
                      onPress={() => handleShowNotes(vehicle)}
                    >
                      <Ionicons
                        name="warning-outline"
                        size={16}
                        color={
                          vehicle.status === 'suspended' ? '#EA580C' : '#DC2626'
                        }
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.actionBtnText,
                          vehicle.status === 'suspended' && {
                            color: '#EA580C',
                          },
                        ]}
                      >
                        Ver Motivo de{' '}
                        {vehicle.status === 'suspended'
                          ? 'Suspensión'
                          : 'Rechazo'}
                      </Text>
                    </Pressable>
                  )}
              </Pressable>
            );
          })
        )}

        {/* Espacio final */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── BOTÓN FLOTANTE REGISTRAR VEHÍCULO ── */}
      <Animated.View
        style={[
          styles.fab,
          {
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.fabPressable,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => router.push('/register-vehicle' as any)}
        >
          <Ionicons name="add" size={30} color="#FFFFFF" />
        </Pressable>
      </Animated.View>

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
                <Ionicons
                  name={
                    selectedVehicle?.status === 'suspended'
                      ? 'alert-circle'
                      : 'close-circle'
                  }
                  size={24}
                  color={
                    selectedVehicle?.status === 'suspended'
                      ? '#EA580C'
                      : '#DC2626'
                  }
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.modalTitle}>
                  {selectedVehicle?.status === 'suspended'
                    ? 'Unidad Suspendida'
                    : 'Solicitud Rechazada'}
                </Text>
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
                  Placa: {selectedVehicle.licensePlate} • Año:{' '}
                  {selectedVehicle.vehicleYear}
                </Text>
              </View>
            )}

            {/* Nota de Administración */}
            <Text style={styles.modalLabel}>
              OBSERVACIONES DE ADMINISTRACIÓN:
            </Text>
            <ScrollView
              style={styles.modalNotesScroll}
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.modalNotes}>
                {selectedVehicle?.adminNotes ||
                  'No hay observaciones adicionales registradas.'}
              </Text>
            </ScrollView>

            <View style={styles.modalTipBox}>
              <Ionicons
                name="bulb-outline"
                size={18}
                color="#D97706"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.modalTipText}>
                Puedes volver a realizar una solicitud de registro para esta
                unidad corrigiendo los puntos indicados anteriormente.
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
  statsScroll: {
    flexDirection: 'row',
    marginBottom: 20,
    minWidth: '100%',
    paddingBottom: 4,
  },
  statBox: {
    flex: 1,
    minWidth: 78,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
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
    bottom: 120,
    right: 20,
    backgroundColor: tokens.colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: '#1D5BD9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 99,
  },
  fabPressable: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
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
