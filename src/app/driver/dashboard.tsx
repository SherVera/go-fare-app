import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getBackendProfile,
  getCurrentSession,
  openSession,
  pauseSession,
  resumeSession,
  closeSession,
  getAssignedVehicles,
  getAssignedRoutes,
} from '@/lib/api';
import { auth } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

export default function DriverDashboard() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<any | null>(null);

  // Datos del conductor y listas del backend (mockeadas con UUIDs de DB)
  const [driverName, setDriverName] = useState('Conductor');
  const [assignedVehicles, setAssignedVehicles] = useState<any[]>([]);
  const [assignedRoutes, setAssignedRoutes] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);

  // Dropdowns del UI para selección
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [showRouteDropdown, setShowRouteDropdown] = useState(false);

  // Notificación flotante de pago recibido
  const [payNotification, setPayNotification] = useState<{
    amount: number;
    time: string;
  } | null>(null);
  const notifAnim = useRef(new Animated.Value(0)).current;

  const showPayNotification = useCallback(
    (amount: number) => {
      const time = new Date().toLocaleTimeString('es-VE', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setPayNotification({ amount, time });
      Animated.sequence([
        Animated.timing(notifAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(3500),
        Animated.timing(notifAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setPayNotification(null));
    },
    [notifAnim],
  );

  // Polling de estadísticas de sesión y estado en tiempo real (cada 4 segundos)
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'open') return;

    const pollInterval = setInterval(async () => {
      try {
        const session = await getCurrentSession();
        if (session && session.uuid) {
          setActiveSession((prev: any) => {
            if (prev && Number(session.ridesCount) > Number(prev.ridesCount)) {
              const diff = Number(session.ridesCount) - Number(prev.ridesCount);
              const amount = Number(session.totalFares) - Number(prev.totalFares);
              showPayNotification(amount / (diff || 1));

              try {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
              } catch (_) {}
            }
            return session;
          });
        } else {
          setActiveSession(null);
        }
      } catch (err) {
        console.warn('[Dashboard] Error polling session:', err);
      }
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [activeSession, showPayNotification]);

  // Carga inicial de datos del conductor y sesión activa
  const loadDriverData = useCallback(async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (user) {
        try {
          const backendUser = await getBackendProfile();
          setDriverName(
            backendUser.displayName ||
              `${backendUser.firstName || ''} ${backendUser.lastName || ''}`.trim() ||
              'Conductor',
          );
        } catch {
          setDriverName(user.displayName || 'Conductor');
        }
      }

      // Cargar listas de vehículos y rutas asociadas (simuladas en frontend con UUIDs reales de Neon)
      const vehicles = await getAssignedVehicles();
      const routes = await getAssignedRoutes();
      setAssignedVehicles(vehicles);
      setAssignedRoutes(routes);

      if (vehicles.length > 0) setSelectedVehicle(vehicles[0]);
      if (routes.length > 0) setSelectedRoute(routes[0]);

      // Consultar si hay una sesión activa de caja en el backend
      const session = await getCurrentSession();
      if (session && session.uuid) {
        setActiveSession(session);
        // Sincronizar ruta y vehículo locales con los de la sesión activa
        if (session.vehicle) {
          const foundVehicle = vehicles.find((v) => v.uuid === session.vehicle.uuid);
          if (foundVehicle) setSelectedVehicle(foundVehicle);
        }
        if (session.route) {
          const foundRoute = routes.find((r) => r.uuid === session.route.uuid);
          if (foundRoute) setSelectedRoute(foundRoute);
        }
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.warn('[DriverDashboard] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDriverData();
    }, [loadDriverData]),
  );

  // 1. INICIAR TURNO (Abrir sesión de caja en el backend)
  const handleStartShift = async () => {
    if (!selectedVehicle || !selectedRoute) {
      Alert.alert(
        'Atención',
        'Por favor, selecciona un vehículo y una ruta para iniciar tu turno.',
      );
      return;
    }
    try {
      setActionLoading(true);
      const session = await openSession(selectedVehicle.uuid, selectedRoute.uuid);
      setActiveSession(session);
      Alert.alert(
        'Turno Iniciado',
        'Tu turno ha sido registrado con éxito. Ya puedes ir a la pestaña "Cobrar" para generar tu código QR.',
      );
    } catch (err: any) {
      console.error('[Dashboard] Error opening session:', err);
      Alert.alert(
        'Error de Inicio',
        err.message || 'No se pudo iniciar el turno en el servidor. Intenta de nuevo.',
      );
    } finally {
      setActionLoading(false);
    }
  };

  // 2. PAUSAR TURNO (Pausar sesión en el backend)
  const handlePauseShift = async () => {
    if (!activeSession) return;
    try {
      setActionLoading(true);
      const session = await pauseSession(activeSession.uuid);
      setActiveSession(session);
      Alert.alert(
        'Turno Pausado',
        'Tu turno está en pausa. Las solicitudes de cobro de pasajeros se deshabilitarán hasta que reanudes.',
      );
    } catch (err: any) {
      console.error('[Dashboard] Error pausing session:', err);
      Alert.alert(
        'Error',
        err.message || 'No se pudo pausar el turno. Intenta de nuevo.',
      );
    } finally {
      setActionLoading(false);
    }
  };

  // 3. REANUDAR TURNO (Reanudar sesión en el backend)
  const handleResumeShift = async () => {
    if (!activeSession) return;
    try {
      setActionLoading(true);
      const session = await resumeSession(activeSession.uuid);
      setActiveSession(session);
      Alert.alert(
        'Turno Reanudado',
        'Turno activo. Los pasajeros ya pueden escanear tu unidad nuevamente.',
      );
    } catch (err: any) {
      console.error('[Dashboard] Error resuming session:', err);
      Alert.alert(
        'Error',
        err.message || 'No se pudo reanudar el turno. Intenta de nuevo.',
      );
    } finally {
      setActionLoading(false);
    }
  };

  // 4. FINALIZAR TURNO (Cerrar sesión de caja en el backend y liquidar)
  const handleCloseShift = async () => {
    if (!activeSession) return;
    Alert.alert(
      'Confirmar Cierre de Turno',
      `¿Estás seguro de que deseas finalizar tu turno de trabajo?\n\nSe validarán ${activeSession.ridesCount} boletos y se liquidará el monto de ${Number(activeSession.totalFares).toFixed(2).replace('.', ',')} fares a la cuenta del transportista.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar y Liquidar',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await closeSession(activeSession.uuid);
              setActiveSession(null);
              Alert.alert(
                'Turno Cerrado',
                'Tu turno ha finalizado correctamente y los fondos han sido transferidos al transportista.',
              );
            } catch (err: any) {
              console.error('[Dashboard] Error closing session:', err);
              Alert.alert(
                'Error al Cerrar',
                err.message || 'No se pudo cerrar el turno. Intenta de nuevo.',
              );
            } finally {
              setActionLoading(false);
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

  const isEnServicio = activeSession?.status === 'open';
  const isPausado = activeSession?.status === 'paused';

  const displayVehicle = activeSession
    ? `${activeSession.vehicle?.brand} ${activeSession.vehicle?.model} (Placa: ${activeSession.vehicle?.plate})`
    : selectedVehicle
      ? `${selectedVehicle.brand} ${selectedVehicle.model} (Placa: ${selectedVehicle.plate})`
      : 'Sin Unidad Asignada';

  const displayRouteName = activeSession
    ? activeSession.route?.name
    : selectedRoute
      ? selectedRoute.name
      : 'Selecciona una Ruta';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Panel de Conductor</Text>
        {isEnServicio && (
          <View style={[styles.activePill, { backgroundColor: '#DCFCE7' }]}>
            <View style={[styles.activeDot, { backgroundColor: '#16A34A' }]} />
            <Text style={[styles.activePillText, { color: '#16A34A' }]}>
              EN RUTA
            </Text>
          </View>
        )}
        {isPausado && (
          <View style={[styles.activePill, { backgroundColor: '#FEF3C7' }]}>
            <View style={[styles.activeDot, { backgroundColor: '#D97706' }]} />
            <Text style={[styles.activePillText, { color: '#D97706' }]}>
              EN PAUSA
            </Text>
          </View>
        )}
        {!activeSession && (
          <View style={[styles.activePill, { backgroundColor: '#F1F5F9' }]}>
            <View style={[styles.activeDot, { backgroundColor: '#64748B' }]} />
            <Text style={[styles.activePillText, { color: '#64748B' }]}>
              INACTIVO
            </Text>
          </View>
        )}
      </View>

      {/* Banner flotante de pago recibido */}
      {payNotification && (
        <Animated.View
          style={[
            styles.payBanner,
            {
              opacity: notifAnim,
              transform: [
                {
                  translateY: notifAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.payBannerIconWrapper}>
            <Ionicons name="checkmark-circle" size={28} color="#FFFFFF" />
          </View>
          <View style={styles.payBannerInfo}>
            <Text style={styles.payBannerLabel}>¡COBRO RECIBIDO!</Text>
            <Text style={styles.payBannerAmount}>
              +{payNotification.amount.toFixed(2).replace('.', ',')} fares
            </Text>
          </View>
          <Text style={styles.payBannerTime}>{payNotification.time}</Text>
        </Animated.View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Saludo */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingLabel}>¡HOLA DE NUEVO!</Text>
          <Text style={styles.userName}>{driverName.split(' ')[0]}</Text>
          <Text style={styles.greetingSub}>
            Controla tu turno de trabajo desde aquí.
          </Text>
        </View>

        {/* Card Estado de Servicio */}
        <View
          style={[
            styles.statusCard,
            isEnServicio
              ? styles.statusCardActive
              : isPausado
                ? styles.statusCardPaused
                : styles.statusCardInactive,
          ]}
        >
          <View style={styles.statusInfoRow}>
            <View
              style={[
                styles.statusIconWrapper,
                isEnServicio
                  ? styles.iconActive
                  : isPausado
                    ? styles.iconPaused
                    : styles.iconInactive,
              ]}
            >
              <Ionicons
                name={isPausado ? 'pause' : 'bus'}
                size={24}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.statusTexts}>
              <Text style={styles.statusPillLabel}>ESTADO DEL TURNO</Text>
              <Text style={styles.statusPillValue}>
                {isEnServicio
                  ? 'En Servicio / Disponible'
                  : isPausado
                    ? 'Turno en Pausa'
                    : 'Fuera de Servicio'}
              </Text>
              {isEnServicio && (
                <Text style={styles.statusSubNote}>
                  Recibiendo notificaciones de cobro en tiempo real
                </Text>
              )}
              {isPausado && (
                <Text style={[styles.statusSubNote, { color: '#D97706' }]}>
                  Cobros inhabilitados temporalmente
                </Text>
              )}
            </View>
          </View>

          {/* Botones de Control de Turno */}
          <View style={styles.controlButtonsContainer}>
            {actionLoading ? (
              <ActivityIndicator
                size="small"
                color={tokens.colors.primary}
                style={{ marginVertical: 8 }}
              />
            ) : !activeSession ? (
              <Pressable
                style={({ pressed }) => [
                  styles.primaryActionButton,
                  pressed && { opacity: 0.9 },
                ]}
                onPress={handleStartShift}
              >
                <Ionicons name="play" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionButtonText}>Iniciar Turno</Text>
              </Pressable>
            ) : isEnServicio ? (
              <View style={styles.actionRowButtons}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryActionButton,
                    styles.btnPause,
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={handlePauseShift}
                >
                  <Ionicons name="pause" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.actionButtonText}>Pausar</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryActionButton,
                    styles.btnStop,
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={handleCloseShift}
                >
                  <Ionicons name="stop" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.actionButtonText}>Cerrar</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.actionRowButtons}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryActionButton,
                    styles.btnResume,
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={handleResumeShift}
                >
                  <Ionicons name="play" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.actionButtonText}>Reanudar</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryActionButton,
                    styles.btnStop,
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={handleCloseShift}
                >
                  <Ionicons name="stop" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.actionButtonText}>Cerrar</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Unidad Asignada */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardLabel}>UNIDAD ASIGNADA</Text>
          <View style={styles.vehicleRow}>
            <Ionicons
              name="car-sport"
              size={24}
              color={tokens.colors.primary}
              style={{ marginRight: 12 }}
            />
            {activeSession ? (
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleNameText}>{displayVehicle}</Text>
                <Text style={styles.vehicleCoopText}>
                  Cooperativa Caracas Move R.L.
                </Text>
              </View>
            ) : (
              <View style={styles.dropdownPickerContainer}>
                <Pressable
                  style={styles.inlineDropdownBtn}
                  onPress={() => setShowVehicleDropdown(!showVehicleDropdown)}
                >
                  <Text style={styles.inlineDropdownBtnText}>
                    {selectedVehicle
                      ? `${selectedVehicle.brand} ${selectedVehicle.model} (${selectedVehicle.plate})`
                      : 'Seleccionar Unidad'}
                  </Text>
                  <Ionicons
                    name={showVehicleDropdown ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#8594AB"
                  />
                </Pressable>

                {showVehicleDropdown && (
                  <View style={styles.inlineDropdownList}>
                    {assignedVehicles.map((vehicle) => (
                      <Pressable
                        key={vehicle.uuid}
                        style={[
                          styles.inlineDropdownItem,
                          selectedVehicle?.uuid === vehicle.uuid &&
                            styles.inlineDropdownItemActive,
                        ]}
                        onPress={() => {
                          setSelectedVehicle(vehicle);
                          setShowVehicleDropdown(false);
                        }}
                      >
                        <Text style={styles.inlineDropdownItemText}>
                          {vehicle.brand} {vehicle.model} ({vehicle.plate})
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Ruta en Operación */}
        <Text style={styles.sectionTitle}>Ruta en Operación</Text>
        {activeSession ? (
          <View style={styles.dropdownBtnDisabled}>
            <Ionicons
              name="map-outline"
              size={20}
              color="#A1A1AA"
              style={{ marginRight: 12 }}
            />
            <Text style={styles.dropdownBtnTextDisabled}>
              {displayRouteName}
            </Text>
          </View>
        ) : (
          <View style={{ position: 'relative', zIndex: 10 }}>
            <Pressable
              style={styles.dropdownBtn}
              onPress={() => setShowRouteDropdown(!showRouteDropdown)}
            >
              <Ionicons
                name="map-outline"
                size={20}
                color="#8594AB"
                style={{ marginRight: 12 }}
              />
              <Text style={styles.dropdownBtnText}>
                {selectedRoute ? selectedRoute.name : 'Seleccionar Ruta'}
              </Text>
              <Ionicons
                name={showRouteDropdown ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#8594AB"
              />
            </Pressable>

            {showRouteDropdown && (
              <View style={styles.dropdownContainer}>
                {assignedRoutes.map((route) => (
                  <Pressable
                    key={route.uuid}
                    style={[
                      styles.dropdownItem,
                      selectedRoute?.uuid === route.uuid &&
                        styles.dropdownItemActive,
                    ]}
                    onPress={() => {
                      setSelectedRoute(route);
                      setShowRouteDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        selectedRoute?.uuid === route.uuid &&
                          styles.dropdownItemTextActive,
                      ]}
                    >
                      {route.name}
                    </Text>
                    <Text style={styles.dropdownItemFare}>
                      Tarifa: {Number(route.fareCost).toFixed(2)} fares
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Estadísticas de Turno */}
        <Text style={styles.sectionTitle}>Estadísticas de la Jornada</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <View
              style={[styles.statIconContainer, { backgroundColor: '#DBEAFE' }]}
            >
              <Ionicons
                name="ticket-outline"
                size={20}
                color={tokens.colors.primary}
              />
            </View>
            <Text style={styles.statValue}>
              {activeSession ? activeSession.ridesCount : 0}
            </Text>
            <Text style={styles.statLabel}>Boletos Validados</Text>
          </View>
          <View style={styles.statBox}>
            <View
              style={[styles.statIconContainer, { backgroundColor: '#DCFCE7' }]}
            >
              <Ionicons name="cash-outline" size={20} color="#16A34A" />
            </View>
            <Text style={styles.statValue}>
              {activeSession
                ? Number(activeSession.totalFares).toFixed(2).replace('.', ',')
                : '0,00'}{' '}
              fares
            </Text>
            <Text style={styles.statLabel}>Recaudado Turno</Text>
          </View>
        </View>

        {/* Aviso de tiempo real */}
        {isEnServicio && (
          <View style={styles.realtimeNote}>
            <Ionicons
              name="wifi"
              size={14}
              color="#0284C7"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.realtimeNoteText}>
              Sincronizado con base de datos en tiempo real (cada 4 segundos)
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
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
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },
  activePillText: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.black,
    letterSpacing: 0.5,
  },
  // Banner flotante de pago
  payBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
    zIndex: 100,
  },
  payBannerIconWrapper: {
    marginRight: 12,
  },
  payBannerInfo: {
    flex: 1,
  },
  payBannerLabel: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.black,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.8,
  },
  payBannerAmount: {
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#FFFFFF',
  },
  payBannerTime: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: 'rgba(255,255,255,0.7)',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  greetingSection: {
    marginBottom: 24,
  },
  greetingLabel: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.textGray,
    letterSpacing: 1,
    marginBottom: 4,
  },
  userName: {
    fontSize: 32,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.textDark,
    marginBottom: 4,
  },
  greetingSub: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.regular,
    color: tokens.colors.textGray,
  },
  statusCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statusCardActive: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#16A34A',
    shadowColor: '#16A34A',
  },
  statusCardPaused: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
    shadowColor: '#D97706',
  },
  statusCardInactive: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#64748B',
    shadowColor: '#64748B',
  },
  statusInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconActive: { backgroundColor: '#16A34A' },
  iconPaused: { backgroundColor: '#D97706' },
  iconInactive: { backgroundColor: '#64748B' },
  statusTexts: { flex: 1 },
  statusPillLabel: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statusPillValue: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
  },
  statusSubNote: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#16A34A',
    marginTop: 2,
  },
  controlButtonsContainer: {
    width: '100%',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: 14,
    height: 48,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    height: 46,
    marginHorizontal: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  actionRowButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -6,
  },
  btnPause: {
    backgroundColor: '#D97706',
    shadowColor: '#D97706',
  },
  btnResume: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
  },
  btnStop: {
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  infoCardLabel: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleInfo: { flex: 1 },
  vehicleNameText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
    marginBottom: 2,
  },
  vehicleCoopText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
  },
  dropdownPickerContainer: {
    flex: 1,
    position: 'relative',
  },
  inlineDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inlineDropdownBtnText: {
    fontSize: 13.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#334155',
  },
  inlineDropdownList: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 6,
    zIndex: 999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  inlineDropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  inlineDropdownItemActive: {
    backgroundColor: '#EFF6FF',
  },
  inlineDropdownItemText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#334155',
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 12,
    marginLeft: 4,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 54,
    marginBottom: 8,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  dropdownBtnDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 54,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dropdownBtnText: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#18243E',
  },
  dropdownBtnTextDisabled: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#94A3B8',
  },
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    marginBottom: 16,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  dropdownItemActive: { backgroundColor: '#EFF6FF' },
  dropdownItemText: {
    fontSize: 13.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#334155',
    marginBottom: 2,
  },
  dropdownItemTextActive: {
    color: tokens.colors.primary,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  dropdownItemFare: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 4,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#1E293B',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    textAlign: 'center',
  },
  realtimeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  realtimeNoteText: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#0369A1',
  },
});
