import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBackendProfile } from '@/lib/api';
import { auth, getDocument } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

interface RouteOption {
  id: string;
  name: string;
  fare: number;
}

const ROUTE_OPTIONS: RouteOption[] = [
  { id: 'r1', name: 'Ruta 201: Chacaíto - El Hatillo', fare: 15.0 },
  { id: 'r2', name: 'Ruta L1: Propatria - Palo Verde', fare: 20.0 },
  { id: 'r3', name: 'Ruta 102: Plaza Venezuela - Baruta', fare: 12.0 },
];

export default function DriverDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isEnServicio, setIsEnServicio] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption>(
    ROUTE_OPTIONS[0],
  );
  const [showRouteDropdown, setShowRouteDropdown] = useState(false);

  // Driver stats
  const [driverName, setDriverName] = useState('Conductor');
  const [vehicleInfo, setVehicleInfo] = useState(
    'Encava ENT-610 (Placa: XY987ZT)',
  );
  const [todayTripsCount, setTodayTripsCount] = useState(42);
  const [todayEarnings, setTodayEarnings] = useState(630.0);

  const loadDriverData = useCallback(async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (user) {
        // Cargar nombre del conductor
        try {
          const backendUser = await getBackendProfile();
          setDriverName(
            backendUser.displayName ||
              `${backendUser.firstName || ''} ${backendUser.lastName || ''}`.trim() ||
              'Conductor',
          );
        } catch {
          const legacyData = await getDocument(`users/${user.uid}`).catch(
            () => null,
          );
          if (legacyData) {
            setDriverName(legacyData.fullName || 'Conductor');
          }
        }
      }

      // Cargar estado de servicio
      const serviceStatus = await AsyncStorage.getItem('driver_service_status');
      setIsEnServicio(serviceStatus === 'active');

      // Cargar ruta seleccionada
      const cachedRouteId = await AsyncStorage.getItem(
        'driver_active_route_id',
      );
      if (cachedRouteId) {
        const found = ROUTE_OPTIONS.find((r) => r.id === cachedRouteId);
        if (found) setSelectedRoute(found);
      } else {
        // Por defecto guardar la primera
        await AsyncStorage.setItem(
          'driver_active_route_id',
          ROUTE_OPTIONS[0].id,
        );
      }

      // Cargar estadísticas dinámicas de validaciones del chofer
      const validatedListStr = await AsyncStorage.getItem(
        'mock_validated_tickets',
      );
      const validatedList = validatedListStr
        ? JSON.parse(validatedListStr)
        : [];

      // Sumar al total del día
      const localCount = validatedList.length;
      const localEarnings = validatedList.reduce(
        (sum: number, tx: any) => sum + (tx.fare || 15.0),
        0,
      );

      setTodayTripsCount(42 + localCount);
      setTodayEarnings(630.0 + localEarnings);
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
      await AsyncStorage.setItem(
        'driver_service_status',
        value ? 'active' : 'inactive',
      );

      Alert.alert(
        value ? 'Servicio Iniciado' : 'Servicio Finalizado',
        value
          ? 'Ya te encuentras disponible para validar boletos y cobrar a los pasajeros.'
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
      </View>

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
                {isEnServicio
                  ? 'En Servicio / Disponible'
                  : 'Fuera de Servicio'}
              </Text>
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
              <Text style={styles.vehicleCoopText}>
                Cooperativa Caracas Move R.L.
              </Text>
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
                    selectedRoute.id === route.id &&
                      styles.dropdownItemTextActive,
                  ]}
                >
                  {route.name}
                </Text>
                <Text style={styles.dropdownItemFare}>
                  Tarifa: {route.fare.toFixed(2)} Bs
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Estadísticas de Turno */}
        <Text style={styles.sectionTitle}>Estadísticas de Hoy</Text>
        <View style={styles.statsRow}>
          {/* Viajes */}
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
            <Text style={styles.statValue}>{todayTripsCount}</Text>
            <Text style={styles.statLabel}>Boletos Validados</Text>
          </View>
          {/* Ingresos */}
          <View style={styles.statBox}>
            <View
              style={[styles.statIconContainer, { backgroundColor: '#DCFCE7' }]}
            >
              <Ionicons name="cash-outline" size={20} color="#16A34A" />
            </View>
            <Text style={styles.statValue}>{todayEarnings.toFixed(2)} Bs</Text>
            <Text style={styles.statLabel}>Recaudado Hoy</Text>
          </View>
        </View>

        {/* Espaciador final */}
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
  iconActive: {
    backgroundColor: '#16A34A',
  },
  iconInactive: {
    backgroundColor: '#64748B',
  },
  statusTexts: {
    flex: 1,
  },
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
  vehicleInfo: {
    flex: 1,
  },
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
  dropdownItemActive: {
    backgroundColor: '#EFF6FF',
  },
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
});
