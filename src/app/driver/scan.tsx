import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUsedTicketsByRoute, validateTicketByQr } from '@/lib/api';
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

export default function DriverScanScreen() {
  const router = useRouter();
  const [isEnServicio, setIsEnServicio] = useState(false);
  const [activeRoute, setActiveRoute] = useState<RouteOption>(ROUTE_OPTIONS[0]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Lista de cobros validados recientes
  const [recentPayments, setRecentPayments] = useState<any[]>([]);

  // Notificación flotante de cobro recibido
  const [successNotification, setSuccessNotification] = useState<{
    passengerName: string;
    fare: number;
    time: string;
  } | null>(null);

  // Input de validación manual
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [manualProcessing, setManualProcessing] = useState(false);

  // Polling de pagos en tiempo real — consulta la tabla `tickets` del backend PostgreSQL
  // No usa Firebase. Filtra por placa+ruta de la unidad activa del conductor.
  useEffect(() => {
    if (!isEnServicio) return;

    const sessionStartedAt = Date.now();
    const processedIds = new Set<string>();

    const pollInterval = setInterval(async () => {
      try {
        // Keywords: placa de la unidad + id de ruta para filtrar en la tabla tickets
        const keywords = [
          activeRoute.plate,
          activeRoute.id,
          activeRoute.name.toLowerCase().split(':')[0].trim(),
        ];

        const usedTickets = await getUsedTicketsByRoute(keywords, sessionStartedAt);

        for (const ticket of usedTickets) {
          if (processedIds.has(ticket.id)) continue;
          processedIds.add(ticket.id);

          const ticketTime = new Date(ticket.updatedAt || ticket.createdAt).getTime();
          const fare = Number(ticket.price) || activeRoute.fare;
          const timeStr = new Date(ticketTime).toLocaleTimeString('es-VE', {
            hour: '2-digit',
            minute: '2-digit',
          });

          const validationRecord = {
            id: ticket.id,
            code: ticket.qrCode || `GF-${ticket.id.slice(-4).toUpperCase()}`,
            fare,
            route: activeRoute.name,
            time: timeStr,
            date: new Date(ticketTime).toLocaleDateString('es-VE'),
            passengerName: 'Pasajero',
          };

          // 1. Guardar en AsyncStorage
          const localListStr = await AsyncStorage.getItem('mock_validated_tickets');
          const localList = localListStr ? JSON.parse(localListStr) : [];

          if (!localList.some((p: any) => p.id === ticket.id)) {
            localList.unshift(validationRecord);
            await AsyncStorage.setItem(
              'mock_validated_tickets',
              JSON.stringify(localList),
            );

            // 2. Actualizar feed de cobros recientes
            setRecentPayments((prev) => {
              if (prev.some((p) => p.id === ticket.id)) return prev;
              return [validationRecord, ...prev].slice(0, 5);
            });

            // 3. Banner de notificación flotante
            setSuccessNotification({
              passengerName: 'Pasajero',
              fare,
              time: timeStr,
            });

            // 4. Haptic feedback
            try {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (_) {}

            setTimeout(() => setSuccessNotification(null), 4000);
          }
        }
      } catch (err) {
        console.warn('[Scan] Error polling tickets:', err);
      }
    }, 4000); // Poll cada 4 segundos

    return () => clearInterval(pollInterval);
  }, [isEnServicio, activeRoute]);

  // Cargar lista de cobros recientes desde AsyncStorage
  const loadRecentPayments = useCallback(async () => {
    try {
      const localListStr = await AsyncStorage.getItem('mock_validated_tickets');
      const localList = localListStr ? JSON.parse(localListStr) : [];
      setRecentPayments(localList.slice(0, 5)); // Mostrar solo los últimos 5
    } catch (err) {
      console.warn('[Scan] Error loading recent payments:', err);
    }
  }, []);

  // Cargar estado de servicio y ruta activa
  const checkServiceStatus = useCallback(async () => {
    try {
      setLoading(true);
      const status = await AsyncStorage.getItem('driver_service_status');
      setIsEnServicio(status === 'active');

      const routeId = await AsyncStorage.getItem('driver_active_route_id');
      if (routeId) {
        const found = ROUTE_OPTIONS.find((r) => r.id === routeId);
        if (found) setActiveRoute(found);
      }

      await loadRecentPayments();
    } catch (err) {
      console.warn('[Scan] Error loading service status:', err);
    } finally {
      setLoading(false);
    }
  }, [loadRecentPayments]);

  useFocusEffect(
    useCallback(() => {
      checkServiceStatus();
    }, [checkServiceStatus]),
  );

  // Simular escaneo y cobro de un pasajero
  const handleSimulatePassengerScan = async (
    fare: number,
    passengerName: string,
  ) => {
    if (processing) return;
    setProcessing(true);

    try {
      const timeStr = new Date().toLocaleTimeString('es-VE', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const validationRecord = {
        id: `val-${Date.now()}`,
        code: `PASSENGER-${Date.now().toString().slice(-4)}`,
        fare: fare,
        route: activeRoute.name,
        time: timeStr,
        date: new Date().toLocaleDateString('es-VE'),
        passengerName: passengerName,
      };

      // 1. Guardar en AsyncStorage
      const localListStr = await AsyncStorage.getItem('mock_validated_tickets');
      const localList = localListStr ? JSON.parse(localListStr) : [];
      localList.unshift(validationRecord);
      await AsyncStorage.setItem(
        'mock_validated_tickets',
        JSON.stringify(localList),
      );

      // 2. Cargar recientes de inmediato en el estado
      setRecentPayments(localList.slice(0, 5));

      // 3. Mostrar banner de éxito flotante
      setSuccessNotification({
        passengerName,
        fare,
        time: timeStr,
      });

      // Ocultar banner automáticamente
      setTimeout(() => {
        setSuccessNotification(null);
      }, 3500);
    } catch (error) {
      console.warn('[Scan] Error simulating passenger scan:', error);
    } finally {
      setProcessing(false);
    }
  };

  // Validación manual de código de boleto
  const handleManualValidateTicket = async (code: string) => {
    if (manualProcessing) return;
    const sanitizedCode = code.trim();
    if (!sanitizedCode) {
      Alert.alert(
        'Código Requerido',
        'Por favor, ingresa el código del boleto.',
      );
      return;
    }

    Keyboard.dismiss();
    setManualProcessing(true);

    try {
      console.log('[Scan] Validating ticket:', sanitizedCode);
      let ticketName = 'Boleto Pasajero';
      let fareValue = activeRoute.fare;

      try {
        const ticket = await validateTicketByQr(sanitizedCode);
        ticketName = 'Pasajero Verificado';
        fareValue = ticket.price || activeRoute.fare;
      } catch (_e) {
        // Fallback simulación
        const codeUpper = sanitizedCode.toUpperCase();
        if (codeUpper.startsWith('USED') || codeUpper === 'USADO') {
          throw new Error('El boleto ya ha sido usado.');
        } else if (
          codeUpper.startsWith('EXPIRED') ||
          codeUpper === 'EXPIRADO'
        ) {
          throw new Error('El boleto ha expirado.');
        } else if (codeUpper.startsWith('SALDO') || codeUpper === 'NO-MONEY') {
          throw new Error('Saldo insuficiente en la cuenta del pasajero.');
        }

        if (codeUpper.includes('CARLOS')) {
          ticketName = 'Carlos Pérez';
          fareValue = 20.0;
        } else if (codeUpper.includes('RAFAEL')) {
          ticketName = 'Rafael Castellano';
          fareValue = 15.0;
        }
      }

      const timeStr = new Date().toLocaleTimeString('es-VE', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const validationRecord = {
        id: `val-${Date.now()}`,
        code: sanitizedCode,
        fare: fareValue,
        route: activeRoute.name,
        time: timeStr,
        date: new Date().toLocaleDateString('es-VE'),
        passengerName: ticketName,
      };

      const localListStr = await AsyncStorage.getItem('mock_validated_tickets');
      const localList = localListStr ? JSON.parse(localListStr) : [];
      localList.unshift(validationRecord);
      await AsyncStorage.setItem(
        'mock_validated_tickets',
        JSON.stringify(localList),
      );

      setRecentPayments(localList.slice(0, 5));
      setQrCodeInput('');

      // Mostrar banner flotante
      setSuccessNotification({
        passengerName: ticketName,
        fare: fareValue,
        time: timeStr,
      });

      setTimeout(() => {
        setSuccessNotification(null);
      }, 3500);
    } catch (err: any) {
      Alert.alert(
        'Error de Validación',
        err.message || 'El boleto no es válido.',
      );
    } finally {
      setManualProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
      </View>
    );
  }

  // Vista fuera de servicio
  if (!isEnServicio) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Cobrar Pasaje</Text>
        </View>
        <View style={[styles.center, { padding: 32 }]}>
          <View style={styles.offlineIconWrapper}>
            <Ionicons name="alert-circle" size={48} color="#64748B" />
          </View>
          <Text style={styles.offlineTitle}>Turno Fuera de Servicio</Text>
          <Text style={styles.offlineSubtitle}>
            Debes iniciar tu turno de trabajo ("En Servicio") en la pestaña de
            Inicio para poder cobrar a los pasajeros.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.offlineBtn,
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => router.push('/driver/dashboard')}
          >
            <Text style={styles.offlineBtnText}>Ir a Inicio</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cobrar Pasaje</Text>
      </View>

      {/* Notificación flotante de cobro recibido */}
      {successNotification && (
        <View style={styles.notificationBanner}>
          <View style={styles.notificationBadge}>
            <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.notificationTitle}>COBRO RECIBIDO</Text>
            <Text style={styles.notificationText}>
              {successNotification.passengerName} pagó{' '}
              <Text style={{ fontWeight: 'bold' }}>
                {successNotification.fare.toFixed(2)} Bs
              </Text>
            </Text>
          </View>
          <Text style={styles.notificationTime}>
            {successNotification.time}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Código QR de Cobro */}
        <View style={styles.qrCard}>
          <View style={styles.routeHeader}>
            <Text style={styles.routeHeaderLabel}>TARIFA Y RUTA ACTIVA</Text>
            <Text style={styles.routeHeaderValue}>{activeRoute.name}</Text>
          </View>

          <View style={styles.qrContainer}>
            <Image
              source={{
                uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=0f172a&data=${encodeURIComponent(
                  activeRoute.name,
                )}`,
              }}
              style={styles.qrImage}
              resizeMode="contain"
            />
            {/* Indicador de Escaneo Pulsante */}
            <View style={styles.scanPulse} />
          </View>

          <Text style={styles.qrFareValue}>
            {activeRoute.fare.toFixed(2)} Bs
          </Text>

          <Text style={styles.qrInstruction}>
            Muestra este código al pasajero al abordar para cobrar el pasaje de
            la ruta.
          </Text>
        </View>

        {/* Historial de Actividad Reciente */}
        <Text style={styles.sectionTitle}>Cobros Recibidos (Últimos 5)</Text>
        <View style={styles.feedCard}>
          {recentPayments.length === 0 ? (
            <View style={styles.feedEmpty}>
              <Ionicons name="hourglass-outline" size={28} color="#94A3B8" />
              <Text style={styles.feedEmptyText}>
                Esperando cobros de pasajeros...
              </Text>
            </View>
          ) : (
            recentPayments.map((item, index) => (
              <View key={item.id}>
                {index > 0 && <View style={styles.feedDivider} />}
                <View style={styles.feedItem}>
                  <View style={styles.feedLeft}>
                    <View style={styles.feedIconWrapper}>
                      <Ionicons
                        name="person"
                        size={16}
                        color={tokens.colors.primary}
                      />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.feedPassenger}>
                        {item.passengerName}
                      </Text>
                      <Text style={styles.feedTime}>
                        Cobro exitoso • {item.time}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.feedRight}>
                    <Text style={styles.feedAmount}>
                      +{item.fare.toFixed(2)} Bs
                    </Text>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#16A34A"
                      style={{ marginLeft: 6 }}
                    />
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Simular Escaneo de Pasajero */}
        <Text style={styles.sectionTitle}>Simular Escaneo de Pasajero</Text>
        <View style={styles.simulationGrid}>
          <Pressable
            style={styles.simBtnSuccess}
            onPress={() => handleSimulatePassengerScan(15.0, 'Juan Pérez')}
          >
            <Ionicons
              name="person-add-outline"
              size={16}
              color="#FFFFFF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.simBtnText}>Juan P. (Bs 15)</Text>
          </Pressable>

          <Pressable
            style={styles.simBtnSuccess}
            onPress={() => handleSimulatePassengerScan(15.0, 'María Rodríguez')}
          >
            <Ionicons
              name="person-add-outline"
              size={16}
              color="#FFFFFF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.simBtnText}>María R. (Bs 15)</Text>
          </Pressable>

          <Pressable
            style={styles.simBtnSuccess}
            onPress={() => handleSimulatePassengerScan(20.0, 'Carlos Gómez')}
          >
            <Ionicons
              name="person-add-outline"
              size={16}
              color="#FFFFFF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.simBtnText}>Carlos G. (Bs 20)</Text>
          </Pressable>

          <Pressable
            style={styles.simBtnSuccess}
            onPress={() => handleSimulatePassengerScan(12.0, 'Ana Silva')}
          >
            <Ionicons
              name="person-add-outline"
              size={16}
              color="#FFFFFF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.simBtnText}>Ana S. (Bs 12)</Text>
          </Pressable>
        </View>

        {/* Validación Manual de Boleto */}
        <Text style={styles.sectionTitle}>Validación Manual de Boleto</Text>
        <View style={styles.inputCard}>
          <Ionicons
            name="keypad-outline"
            size={20}
            color="#8594AB"
            style={{ marginRight: 12 }}
          />
          <TextInput
            style={styles.input}
            placeholder="Ingresa código o ID de boleto..."
            placeholderTextColor="#A1A1AA"
            value={qrCodeInput}
            onChangeText={setQrCodeInput}
            autoCapitalize="characters"
            editable={!manualProcessing}
          />
          {manualProcessing ? (
            <ActivityIndicator size="small" color={tokens.colors.primary} />
          ) : (
            <Pressable
              style={styles.validateBtn}
              onPress={() => handleManualValidateTicket(qrCodeInput)}
            >
              <Text style={styles.validateBtnText}>Validar</Text>
            </Pressable>
          )}
        </View>

        {/* Espacio final */}
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
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  routeHeader: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: '100%',
  },
  routeHeaderLabel: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#0284C7',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  routeHeaderValue: {
    fontSize: 13.5,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0369A1',
    textAlign: 'center',
  },
  qrContainer: {
    width: 200,
    height: 200,
    borderRadius: 20,
    padding: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qrImage: {
    width: 170,
    height: 170,
  },
  scanPulse: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#0EA5E9',
    opacity: 0.4,
  },
  qrFareValue: {
    fontSize: 28,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  qrInstruction: {
    fontSize: 12.5,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 12,
    marginLeft: 4,
    marginTop: 8,
  },
  feedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 24,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  feedEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  feedEmptyText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#94A3B8',
    marginTop: 8,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  feedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedPassenger: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
  },
  feedTime: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    marginTop: 1,
  },
  feedRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedAmount: {
    fontSize: 14.5,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#16A34A',
  },
  feedDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  simulationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  simBtnSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: 14,
    height: 44,
    width: '48%',
    marginBottom: 10,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  simBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 24,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#18243E',
  },
  validateBtn: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  validateBtnText: {
    color: '#FFFFFF',
    fontFamily: tokens.typography.fontFamily.bold,
    fontSize: 13,
  },
  offlineIconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  offlineTitle: {
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
    marginBottom: 8,
  },
  offlineSubtitle: {
    fontSize: 13.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  offlineBtn: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  offlineBtnText: {
    color: '#FFFFFF',
    fontFamily: tokens.typography.fontFamily.bold,
    fontSize: 14.5,
  },
  notificationBanner: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: '#16A34A', // Green 600
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 999,
  },
  notificationBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationTitle: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#FFFFFF',
    letterSpacing: 1.1,
    marginBottom: 1,
    opacity: 0.9,
  },
  notificationText: {
    fontSize: 13.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#FFFFFF',
  },
  notificationTime: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
    opacity: 0.8,
  },
});
