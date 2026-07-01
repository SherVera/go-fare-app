import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCurrentSession,
  getSessionQr,
  getSessionRides,
  validateTicketByQr,
  getAllUsers,
  getAllTransactions,
  getFareAccountByUserId,
} from '@/lib/api';
import { tokens } from '@/theme/tokens';

export default function DriverScanScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<any | null>(null);

  // QR dinámico de la sesión
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);

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

  // Detalle de pago seleccionado para mostrar en el modal
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);

  // Helper para resolver los pasajeros de los viajes de la sesión
  const resolveRidesPassengers = useCallback(async (rides: any[]) => {
    try {
      const [users, transactions] = await Promise.all([
        getAllUsers(),
        getAllTransactions(),
      ]);

      const cacheKey = 'gofare_account_to_user_uuid_cache';
      const resolvedKey = 'gofare_resolved_user_uuids';

      const cacheStr = await AsyncStorage.getItem(cacheKey);
      const resolvedStr = await AsyncStorage.getItem(resolvedKey);

      const accountToUserUuidCache = cacheStr ? JSON.parse(cacheStr) : {};
      const resolvedUserUuids = resolvedStr ? JSON.parse(resolvedStr) : [];
      const resolvedUserUuidsSet = new Set(resolvedUserUuids);

      let cacheUpdated = false;

      for (const ride of rides) {
        if (
          ride.passenger &&
          (ride.passenger.displayName || ride.passenger.nationalId)
        ) {
          continue;
        }

        const tx = transactions.find(
          (t) =>
            t.transactionType === 'ride_payment' &&
            t.description &&
            ride.uuid &&
            t.description.includes(ride.uuid),
        );

        if (tx && tx.fareAccount && tx.fareAccount.uuid) {
          const accountUuid = tx.fareAccount.uuid;
          let userUuid = accountToUserUuidCache[accountUuid];

          if (!userUuid) {
            const unresolvedUsers = users.filter(
              (u) => u.uuid && !resolvedUserUuidsSet.has(u.uuid),
            );

            for (const u of unresolvedUsers) {
              if (!u.uuid) continue;
              resolvedUserUuidsSet.add(u.uuid);
              resolvedUserUuids.push(u.uuid);
              cacheUpdated = true;

              try {
                const acc = await getFareAccountByUserId(u.uuid);
                if (acc && acc.id) {
                  accountToUserUuidCache[acc.id] = u.uuid;
                  if (acc.id === accountUuid) {
                    userUuid = u.uuid;
                    break;
                  }
                }
              } catch (_e) {
                // Ignore
              }
            }
          }

          if (userUuid) {
            const foundUser = users.find((u) => u.uuid === userUuid);
            if (foundUser) {
              ride.passenger = foundUser;
            }
          }
        }
      }

      if (cacheUpdated) {
        await AsyncStorage.setItem(
          cacheKey,
          JSON.stringify(accountToUserUuidCache),
        );
        await AsyncStorage.setItem(
          resolvedKey,
          JSON.stringify(resolvedUserUuids),
        );
      }
    } catch (err) {
      console.warn('[Scan] Error resolving passenger details:', err);
    }
    return rides;
  }, []);

  // Cargar estado inicial del turno
  const checkServiceStatus = useCallback(async () => {
    try {
      setLoading(true);
      const session = await getCurrentSession();
      if (session && session.status === 'open') {
        setActiveSession(session);
        // Cargar QR y viajes
        const qrRes = await getSessionQr(session.uuid);
        setQrCodeData(qrRes.qr);

        const rides = await getSessionRides(session.uuid);
        const resolvedRides = await resolveRidesPassengers(rides);
        setRecentPayments(resolvedRides.slice(0, 5));
      } else {
        setActiveSession(null);
        setQrCodeData(null);
        setRecentPayments([]);
      }
    } catch (err) {
      console.warn('[Scan] Error loading service status:', err);
    } finally {
      setLoading(false);
    }
  }, [resolveRidesPassengers]);


  useFocusEffect(
    useCallback(() => {
      checkServiceStatus();
    }, [checkServiceStatus]),
  );

  // Polling de pagos y renovación del QR cifrado cada 4 segundos
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'open') return;

    const pollInterval = setInterval(async () => {
      try {
        // 1. Verificar si la sesión sigue activa/abierta
        const current = await getCurrentSession();
        if (!current || current.status !== 'open') {
          setActiveSession(null);
          setQrCodeData(null);
          setRecentPayments([]);
          return;
        }

        // 2. Renovar el QR dinámico (Omitido para mantener el QR estático)
        // const qrRes = await getSessionQr(current.uuid);
        // setQrCodeData(qrRes.qr);

        // 3. Consultar viajes recientes de la sesión en base de datos
        const rides = await getSessionRides(current.uuid);
        const resolvedRides = await resolveRidesPassengers(rides);
        
        // Detectar si hay nuevos cobros para alertas
        if (resolvedRides.length > recentPayments.length) {
          const newRides = resolvedRides.filter(
            (r: any) => !recentPayments.some((prev: any) => prev.uuid === r.uuid)
          );

          for (const newRide of newRides) {
            const passengerName =
              newRide.passenger?.displayName ||
              `${newRide.passenger?.firstName || ''} ${newRide.passenger?.lastName || ''}`.trim() ||
              'Pasajero';

            const timeStr = new Date(newRide.createdAt).toLocaleTimeString(
              'es-VE',
              {
                hour: '2-digit',
                minute: '2-digit',
              },
            );

            // Disparar banner
            setSuccessNotification({
              passengerName,
              fare: Number(newRide.fareCost),
              time: timeStr,
            });

            // Vibración
            try {
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
            } catch (_) {}

            setTimeout(() => setSuccessNotification(null), 4000);
          }
        }

        setActiveSession(current);
        setRecentPayments(resolvedRides.slice(0, 5));
      } catch (err) {
        console.warn('[Scan] Error during polling in scan:', err);
      }
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [activeSession, recentPayments, resolveRidesPassengers]);

  // Validación manual de código de boleto (pasaje QR)
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
      const ticket = (await validateTicketByQr(sanitizedCode)) as any;
      const ticketName =
        ticket.user?.displayName ||
        `${ticket.user?.firstName || ''} ${ticket.user?.lastName || ''}`.trim() ||
        'Pasajero Verificado';

      const fareValue =
        Number(ticket.price) ||
        (activeSession ? Number(activeSession.fareCost) : 15);

      const timeStr = new Date().toLocaleTimeString('es-VE', {
        hour: '2-digit',
        minute: '2-digit',
      });

      // Recargar cobros recientes para reflejar el cambio en la sesión
      if (activeSession) {
        const rides = await getSessionRides(activeSession.uuid);
        const resolvedRides = await resolveRidesPassengers(rides);
        setRecentPayments(resolvedRides.slice(0, 5));
      }

      setQrCodeInput('');

      // Mostrar banner flotante de éxito
      setSuccessNotification({
        passengerName: ticketName,
        fare: fareValue,
        time: timeStr,
      });

      setTimeout(() => {
        setSuccessNotification(null);
      }, 3500);

      Alert.alert(
        'Boleto Validado',
        `El boleto fue verificado y cobrado con éxito. Pasajero: ${ticketName}`,
      );
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

  const isEnServicio = activeSession?.status === 'open';

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
            Inicio para poder generar el código QR de cobro.
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
                {successNotification.fare.toFixed(2)} Fare
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
        {/* Código QR de Cobro Dinámico */}
        <View style={styles.qrCard}>
          <View style={styles.routeHeader}>
            <Text style={styles.routeHeaderLabel}>TARIFA Y RUTA ACTIVA</Text>
            <Text style={styles.routeHeaderValue}>
              {activeSession.route?.name}
            </Text>
          </View>

          <View style={styles.qrContainer}>
            {qrCodeData ? (
              <Image
                source={{
                  uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=0f172a&data=${encodeURIComponent(
                    qrCodeData,
                  )}`,
                }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            ) : (
              <ActivityIndicator size="large" color={tokens.colors.primary} />
            )}
            {/* Indicador de Escaneo Pulsante */}
            <View style={styles.scanPulse} />
          </View>

          <Text style={styles.qrFareValue}>
            {Number(activeSession.fareCost).toFixed(2)} Fare
          </Text>

          <Text style={styles.qrInstruction}>
            Muestra este código al pasajero para cobrar de forma rápida y
            segura.
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
            recentPayments.map((item, index) => {
              const passengerName =
                `${item.passenger?.firstName || ''} ${item.passenger?.lastName || ''}`.trim() ||
                item.passenger?.displayName ||
                'Pasajero';

              const passengerCedula = item.passenger?.nationalId
                ? `C.I. ${item.passenger.nationalId}`
                : 'C.I. No registrada';

              const timeStr = new Date(item.createdAt).toLocaleTimeString(
                'es-VE',
                {
                  hour: '2-digit',
                  minute: '2-digit',
                },
              );

              return (
                <View key={item.uuid}>
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
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={styles.feedPassenger} numberOfLines={1}>
                          {passengerName}
                        </Text>
                        <Text style={styles.feedCedula}>{passengerCedula}</Text>
                        <Text style={styles.feedTime}>
                          Cobro exitoso • {timeStr}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.feedRightContainer}>
                      <View style={styles.feedRight}>
                        <Text style={styles.feedAmount}>
                          +{Number(item.fareCost).toFixed(2)} Fare
                        </Text>
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color="#16A34A"
                          style={{ marginLeft: 6 }}
                        />
                      </View>
                      <Pressable
                        style={styles.detailsBtn}
                        onPress={() => setSelectedPayment(item)}
                      >
                        <Text style={styles.detailsBtnText}>Detalles</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })
          )}
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

      {/* Modal de Detalle de Pago del Usuario */}
      <Modal
        visible={!!selectedPayment}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedPayment(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header del Modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalle del Pago</Text>
              <Pressable onPress={() => setSelectedPayment(null)} hitSlop={12}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            {selectedPayment &&
              (() => {
                const passenger = selectedPayment.passenger || {};
                const passName =
                  `${passenger.firstName || ''} ${passenger.lastName || ''}`.trim() ||
                  passenger.displayName ||
                  'Pasajero';
                const passCedula = passenger.nationalId || 'No registrada';
                const passEmail = passenger.email || 'No registrado';
                const passPhone = passenger.phoneNumber || 'No registrado';

                const dateObj = new Date(selectedPayment.createdAt);
                const dateStr = dateObj.toLocaleDateString('es-VE');
                const timeStr = dateObj.toLocaleTimeString('es-VE', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <View style={styles.receiptContainer}>
                    {/* Icono de ticket / exito */}
                    <View style={styles.receiptHeader}>
                      <View style={styles.receiptSuccessIcon}>
                        <Ionicons name="checkmark" size={28} color="#16A34A" />
                      </View>
                      <Text style={styles.receiptStatusText}>Pago Exitoso</Text>
                      <Text style={styles.receiptAmount}>
                        {Number(selectedPayment.fareCost).toFixed(2)} fares
                      </Text>
                    </View>

                    {/* Cuerpo del ticket decorativo */}
                    <View style={styles.ticketBody}>
                      <View style={styles.ticketDividerWrapper}>
                        <View style={styles.ticketDashedLine} />
                      </View>

                      {/* Información del Pasajero */}
                      <Text style={styles.receiptSectionTitle}>PASAJERO</Text>
                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptLabel}>Nombre:</Text>
                        <Text style={styles.receiptValue}>{passName}</Text>
                      </View>
                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptLabel}>Cédula:</Text>
                        <Text style={styles.receiptValue}>{passCedula}</Text>
                      </View>
                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptLabel}>Teléfono:</Text>
                        <Text style={styles.receiptValue}>{passPhone}</Text>
                      </View>
                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptLabel}>Email:</Text>
                        <Text style={styles.receiptValue} numberOfLines={1}>
                          {passEmail}
                        </Text>
                      </View>

                      <View style={styles.ticketDividerWrapper}>
                        <View style={styles.ticketDashedLine} />
                      </View>

                      {/* Detalles del Pago */}
                      <Text style={styles.receiptSectionTitle}>
                        TRANSACCIÓN
                      </Text>
                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptLabel}>ID de Viaje:</Text>
                        <Text style={[styles.receiptValue, styles.receiptCode]}>
                          GF-{selectedPayment.uuid?.slice(0, 8).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptLabel}>Fecha y Hora:</Text>
                        <Text style={styles.receiptValue}>
                          {dateStr} - {timeStr}
                        </Text>
                      </View>
                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptLabel}>Tarifa cobrada:</Text>
                        <Text style={styles.receiptValue}>
                          {Number(selectedPayment.fareCost).toFixed(2)} fares
                        </Text>
                      </View>
                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptLabel}>Tasa BCV:</Text>
                        <Text style={styles.receiptValue}>
                          {Number(selectedPayment.bcvRate || 36.5).toFixed(2)}{' '}
                          Bs/$
                        </Text>
                      </View>
                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptLabel}>Equivalente Bs:</Text>
                        <Text
                          style={[
                            styles.receiptValue,
                            { fontFamily: tokens.typography.fontFamily.bold },
                          ]}
                        >
                          {Number(selectedPayment.bsAmount || 0).toFixed(2)} Bs
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      style={styles.closeModalBtn}
                      onPress={() => setSelectedPayment(null)}
                    >
                      <Text style={styles.closeModalBtnText}>Entendido</Text>
                    </Pressable>
                  </View>
                );
              })()}
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
    flex: 1,
    marginRight: 8,
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
  // Nuevos estilos para detalles de pasajero y modal de recibo
  feedCedula: {
    fontSize: 11.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginTop: 2,
  },
  feedRightContainer: {
    alignItems: 'flex-end',
  },
  detailsBtn: {
    marginTop: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  detailsBtnText: {
    fontSize: 10.5,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    width: '100%',
    maxWidth: 380,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 16.5,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
  },
  receiptContainer: {
    alignItems: 'center',
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  receiptSuccessIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  receiptStatusText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#16A34A',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  receiptAmount: {
    fontSize: 24,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#1E293B',
  },
  ticketBody: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ticketDividerWrapper: {
    marginVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketDashedLine: {
    width: '100%',
    height: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
  },
  receiptSectionTitle: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#64748B',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  receiptLabel: {
    fontSize: 12.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  receiptValue: {
    fontSize: 12.5,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
    textAlign: 'right',
  },
  receiptCode: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    color: '#475569',
  },
  closeModalBtn: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 14,
    width: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  closeModalBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontFamily: tokens.typography.fontFamily.bold,
  },
});
