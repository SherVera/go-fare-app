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
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBackendProfile, getUsedTicketsByRoute } from '@/lib/api';
import { auth } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

interface RouteOption {
  id: string;
  name: string;
  fare: number;
  plate: string;
}

const ROUTE_OPTIONS: RouteOption[] = [
  { id: 'r1', name: 'Ruta 201: Chacaíto - El Hatillo', fare: 15.0, plate: 'xy987zt' },
  { id: 'r2', name: 'Ruta L1: Propatria - Palo Verde', fare: 20.0, plate: 'ab123cd' },
  { id: 'r3', name: 'Ruta 102: Plaza Venezuela - Baruta', fare: 12.0, plate: 'ef456gh' },
];

export default function DriverDashboard() {
  const _router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isEnServicio, setIsEnServicio] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption>(ROUTE_OPTIONS[0]);
  const [showRouteDropdown, setShowRouteDropdown] = useState(false);

  // Driver stats
  const [driverName, setDriverName] = useState('Conductor');
  const [vehicleInfo, _setVehicleInfo] = useState('Encava ENT-610 (Placa: XY987ZT)');
  const [todayTripsCount, setTodayTripsCount] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0.0);

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

  // Polling de pagos en tiempo real desde backend PostgreSQL (tabla tickets)
  // No usa Firebase — solo el endpoint REST /tickets
  useEffect(() => {
    if (!isEnServicio) return;

    const sessionStartedAt = Date.now();
    const processedIds = new Set<string>();

    const pollInterval = setInterval(async () => {
      try {
        // Keywords para filtrar: placa de la unidad + id de ruta
        const keywords = [
          selectedRoute.plate,
          selectedRoute.id,
          selectedRoute.name.toLowerCase().split(':')[0].trim(),
        ];

        const usedTickets = await getUsedTicketsByRoute(keywords, sessionStartedAt);

        for (const ticket of usedTickets) {
          if (processedIds.has(ticket.id)) continue;
          processedIds.add(ticket.id);

          const fare = Number(ticket.price) || selectedRoute.fare;

          // Actualizar estadísticas en tiempo real
          setTodayTripsCount((prev) => prev + 1);
          setTodayEarnings((prev) => prev + fare);

          // Mostrar banner de notificación animado
          showPayNotification(fare);

          // Vibración/haptics de confirmación
          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (_) {}

          // Guardar en caché local para histórico
          try {
            const localStr = await AsyncStorage.getItem('mock_validated_tickets');
            const localList = localStr ? JSON.parse(localStr) : [];
            if (!localList.some((p: any) => p.id === ticket.id)) {
              localList.unshift({
                id: ticket.id,
                code: ticket.qrCode || `GF-${ticket.id.slice(-4).toUpperCase()}`,
                fare,
                route: selectedRoute.name,
                time: new Date().toLocaleTimeString('es-VE', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                date: new Date().toLocaleDateString('es-VE'),
                passengerName: 'Pasajero',
              });
              await AsyncStorage.setItem(
                'mock_validated_tickets',
                JSON.stringify(localList),
              );
            }
          } catch (_) {}
        }
      } catch (err) {
        console.warn('[Dashboard] Error polling tickets:', err);
      }
    }, 4000); // Poll cada 4 segundos

    return () => clearInterval(pollInterval);
  }, [isEnServicio, selectedRoute, showPayNotification]);

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

      // Cargar estado de servicio
      const serviceStatus = await AsyncStorage.getItem('driver_service_status');
      setIsEnServicio(serviceStatus === 'active');

      // Cargar ruta seleccionada
      const cachedRouteId = await AsyncStorage.getItem('driver_active_route_id');
      if (cachedRouteId) {
        const found = ROUTE_OPTIONS.find((r) => r.id === cachedRouteId);
        if (found) setSelectedRoute(found);
      } else {
        await AsyncStorage.setItem('driver_active_route_id', ROUTE_OPTIONS[0].id);
      }

      // Cargar estadísticas del día desde historial local
      const validatedStr = await AsyncStorage.getItem('mock_validated_tickets');
      const validatedList = validatedStr ? JSON.parse(validatedStr) : [];
      const localCount = validatedList.length;
      const localEarnings = validatedList.reduce(
        (sum: number, tx: any) => sum + (tx.fare || 15.0),
        0,
      );
      setTodayTripsCount(localCount);
      setTodayEarnings(localEarnings);
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

  const handleToggleService = async (value: boolean) => {
    try {
      setIsEnServicio(value);
      await AsyncStorage.setItem('driver_service_status', value ? 'active' : 'inactive');
      Alert.alert(
        value ? 'Servicio Iniciado' : 'Servicio Finalizado',
        value
          ? 'Ya estás disponible. Los pasajeros pueden escanear tu código QR y recibirás notificaciones de cobro.'
          : 'Has finalizado tu jornada. Los pasajeros no podrán escanear tu unidad.',
      );
    } catch (err) {
      console.error('[DriverDashboard] Error toggling status:', err);
    }
  };

  const handleSelectRoute = async (route: RouteOption) => {
    setSelectedRoute(route);
    setShowRouteDropdown(false);
    try {
      await AsyncStorage.setItem('driver_active_route_id', route.id);
    } catch (err) {
      console.warn('[DriverDashboard] Error saving active route:', err);
    }
  };

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
        <Text style={styles.headerTitle}>Panel de Conductor</Text>
        {isEnServicio && (
          <View style={styles.activePill}>
            <View style={styles.activeDot} />
            <Text style={styles.activePillText}>EN RUTA</Text>
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
              +{payNotification.amount.toFixed(2).replace('.', ',')} Bs
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
            isEnServicio ? styles.statusCardActive : styles.statusCardInactive,
          ]}
        >
          <View style={styles.statusInfoRow}>
            <View
              style={[
                styles.statusIconWrapper,
                isEnServicio ? styles.iconActive : styles.iconInactive,
              ]}
            >
              <Ionicons name="bus" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.statusTexts}>
              <Text style={styles.statusPillLabel}>ESTADO DEL TURNO</Text>
              <Text style={styles.statusPillValue}>
                {isEnServicio ? 'En Servicio / Disponible' : 'Fuera de Servicio'}
              </Text>
              {isEnServicio && (
                <Text style={styles.statusSubNote}>
                  Recibiendo notificaciones de cobro en tiempo real
                </Text>
              )}
            </View>
            <Switch
              value={isEnServicio}
              onValueChange={handleToggleService}
              trackColor={{ false: '#94A3B8', true: '#DCFCE7' }}
              thumbColor={isEnServicio ? '#16A34A' : '#64748B'}
            />
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
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleNameText}>{vehicleInfo}</Text>
              <Text style={styles.vehicleCoopText}>Cooperativa Caracas Move R.L.</Text>
            </View>
          </View>
        </View>

        {/* Selector de Ruta */}
        <Text style={styles.sectionTitle}>Ruta en Operación</Text>
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
          <Text style={styles.dropdownBtnText}>{selectedRoute.name}</Text>
          <Ionicons
            name={showRouteDropdown ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#8594AB"
          />
        </Pressable>

        {showRouteDropdown && (
          <View style={styles.dropdownContainer}>
            {ROUTE_OPTIONS.map((route) => (
              <Pressable
                key={route.id}
                style={[
                  styles.dropdownItem,
                  selectedRoute.id === route.id && styles.dropdownItemActive,
                ]}
                onPress={() => handleSelectRoute(route)}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    selectedRoute.id === route.id && styles.dropdownItemTextActive,
                  ]}
                >
                  {route.name}
                </Text>
                <Text style={styles.dropdownItemFare}>
                  Tarifa: {route.fare.toFixed(2)} Bs • Placa: {route.plate.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Estadísticas de Turno */}
        <Text style={styles.sectionTitle}>Estadísticas de Hoy</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <View style={[styles.statIconContainer, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons
                name="ticket-outline"
                size={20}
                color={tokens.colors.primary}
              />
            </View>
            <Text style={styles.statValue}>{todayTripsCount}</Text>
            <Text style={styles.statLabel}>Boletos Validados</Text>
          </View>
          <View style={styles.statBox}>
            <View style={[styles.statIconContainer, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="cash-outline" size={20} color="#16A34A" />
            </View>
            <Text style={styles.statValue}>
              {todayEarnings.toFixed(2).replace('.', ',')} Bs
            </Text>
            <Text style={styles.statLabel}>Recaudado Hoy</Text>
          </View>
        </View>

        {/* Aviso de tiempo real */}
        {isEnServicio && (
          <View style={styles.realtimeNote}>
            <Ionicons name="wifi" size={14} color="#0284C7" style={{ marginRight: 6 }} />
            <Text style={styles.realtimeNoteText}>
              Monitoreando pagos de pasajeros en tiempo real (cada 4 segundos)
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
    backgroundColor: '#DCFCE7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    marginRight: 5,
  },
  activePillText: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#16A34A',
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
    padding: 16,
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
  statusCardInactive: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#64748B',
    shadowColor: '#64748B',
  },
  statusInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  dropdownBtnText: {
    flex: 1,
    fontSize: 14.5,
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
