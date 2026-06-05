import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PhoneLinkModal } from '@/components/PhoneLinkModal';
import type { QRScanResult } from '@/interfaces';
import {
  createFareTransaction,
  createTicket,
  getBackendProfile,
  getFareAccountByUserId,
  getTicketByQr,
  validateTicketByQr,
} from '@/lib/api';
import { auth } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

export default function PayTripScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);

  // Estados para Confirmación de Pasaje
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmStep, setConfirmStep] = useState<
    'details' | 'processing' | 'success'
  >('details');
  const [scannedQr, setScannedQr] = useState('');

  // Modelo de Saldo / Fare
  const [balance, setBalance] = useState(0.0);
  const [fareAccount, setFareAccount] = useState<any>(null);
  const [routeFare, setRouteFare] = useState(15.0);
  const [backendUserData, setBackendUserData] = useState<any>(null);
  const [routeLabel, setRouteLabel] = useState('General');

  const handleExecuteDirectPayment = async () => {
    if (!backendUserData || !fareAccount || !scannedQr) return;

    try {
      setConfirmStep('processing');
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 1. Crear el ticket como "used" en el backend (PostgreSQL table `tickets`)
      const ticket = await createTicket({
        userId: backendUserData.id,
        price: routeFare,
        status: 'used',
        route: routeLabel,
        qrCode: scannedQr,
        origin: 'Origen',
        destination: 'Destino',
      });

      // 2. Crear la transacción de débito en `fare_transactions` (descuenta saldo y asocia el ticket en BD)
      await createFareTransaction({
        fareAccountId: fareAccount.id,
        amount: routeFare,
        type: 'debit',
        transactionType: 'payment',
        description: `Pago de viaje en ruta: ${routeLabel}`,
        ticketId: ticket.id,
      });

      // 3. Acreditar cambio localmente
      setBalance((prev) => prev - routeFare);
      setConfirmStep('success');
    } catch (error: any) {
      console.error('[Scanner] Error processing direct payment:', error);
      Alert.alert(
        'Error de Pago',
        error.message ||
          'No se pudo procesar el pago del viaje. Intente nuevamente.',
        [{ text: 'Aceptar', onPress: () => handleCloseConfirmModal() }],
      );
    }
  };

  const handleCloseConfirmModal = () => {
    setShowConfirmModal(false);
    setScanned(false);
    setScannedQr('');
  };

  const handleSuccessClose = () => {
    setShowConfirmModal(false);
    setScanned(false);
    router.replace('/(tabs)/trips');
  };

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarCodeScanned = async (result: {
    type: string;
    data: string;
  }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);

    const scannedData = result.data.trim();

    try {
      // 1. Intentar validar si es un QR de un boleto prepagado existente
      let ticket = null;
      try {
        ticket = await getTicketByQr(scannedData);
      } catch (_e) {
        // Ignoramos error: significa que no es un QR de boleto, sino un QR de autobús/ruta
      }

      if (ticket) {
        if (ticket.status === 'used') {
          Alert.alert(
            'Fare Usado',
            'Este fare ya ha sido validado anteriormente.',
            [{ text: 'Aceptar', onPress: () => setScanned(false) }],
          );
          return;
        }

        // Validar el boleto existente
        await validateTicketByQr(scannedData);
        Alert.alert(
          'Fare Validado',
          `Fare para la ruta "${ticket.route || 'General'}" validado con éxito. ¡Buen viaje!`,
          [
            {
              text: 'Aceptar',
              onPress: () => {
                setScanned(false);
                router.replace('/(tabs)/trips');
              },
            },
          ],
        );
      } else {
        // 2. Si no es un boleto, es el QR de una unidad de transporte
        //    Verificar si el pasajero tiene saldo suficiente en su cuenta de tarifa
        const backendUser = await getBackendProfile();
        const account = await getFareAccountByUserId(backendUser.id);
        const userBalance = Number(account.balance);

        // Detectar ruta según el QR
        let detectedRoute = 'Ruta General';
        const dataLower = scannedData.toLowerCase();
        if (
          dataLower.includes('hatillo') ||
          dataLower.includes('201') ||
          dataLower.includes('r1')
        ) {
          detectedRoute = 'Ruta 201: Chacaíto - El Hatillo';
        } else if (
          dataLower.includes('propatria') ||
          dataLower.includes('l1') ||
          dataLower.includes('verde')
        ) {
          detectedRoute = 'Ruta L1: Propatria - Palo Verde';
        } else if (
          dataLower.includes('venezuela') ||
          dataLower.includes('baruta') ||
          dataLower.includes('r3') ||
          dataLower.includes('102')
        ) {
          detectedRoute = 'Ruta 102: Plaza Venezuela - Baruta';
        } else {
          detectedRoute =
            scannedData.length < 30 ? scannedData : 'Ruta General';
        }

        const costInTickets = 1;
        if (userBalance < costInTickets) {
          // No tiene fares suficientes — redirigir a comprar
          Alert.alert(
            'Fares Insuficientes',
            `No tienes fares disponibles para este viaje.\nTu Saldo: ${userBalance.toFixed(2)} fares\n\n¿Deseas comprar más fares ahora?`,
            [
              {
                text: 'Cancelar',
                onPress: () => setScanned(false),
                style: 'cancel',
              },
              {
                text: 'Comprar Fares',
                onPress: () => {
                  setScanned(false);
                  router.push('/(tabs)/topup');
                },
              },
            ],
          );
          return;
        }

        // Tiene saldo suficiente — mostrar confirmación del fare
        setBackendUserData(backendUser);
        setFareAccount(account);
        setBalance(userBalance);
        setRouteLabel(detectedRoute);
        setRouteFare(costInTickets);
        setScannedQr(scannedData);
        setConfirmStep('details');
        setShowConfirmModal(true);
        setProcessing(false);
      }
    } catch (error: any) {
      console.error('[Scanner] Error processing scan payment:', error);
      const errMsg = error.message || '';
      if (
        errMsg.includes('phone/link') ||
        errMsg.includes('phone number') ||
        errMsg.includes('auth/phone/link')
      ) {
        Alert.alert(
          'Error de Pago',
          'Se requiere un número de teléfono verificado para realizar pagos.',
          [{ text: 'Aceptar', onPress: () => setScanned(false) }],
        );
      } else {
        Alert.alert(
          'Error de Pago',
          errMsg ||
            'No se pudo procesar el pago del viaje. Intente nuevamente.',
          [{ text: 'Aceptar', onPress: () => setScanned(false) }],
        );
      }
    } finally {
      setProcessing(false);
    }
  };

  if (!permission) {
    // Camera permissions are still loading
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Pagar Viajes</Text>
        </View>
        <View style={styles.permissionContainer}>
          <Ionicons
            name="camera-outline"
            size={64}
            color="#9CA3AF"
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.permissionText}>
            Necesitamos acceso a tu cámara para escanear los códigos QR.
          </Text>
          <Pressable
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Otorgar Permiso</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Pagar Viajes</Text>
      </View>

      <View style={styles.content}>
        {/* ── SCANNER FRAME ── */}
        <View style={styles.scannerWrapper}>
          <View style={styles.scannerBox}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={
                scanned || processing ? undefined : handleBarCodeScanned
              }
            />
            {processing && (
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 24,
                    zIndex: 10,
                  },
                ]}
              >
                <ActivityIndicator size="large" color={tokens.colors.primary} />
                <Text
                  style={{
                    color: '#FFFFFF',
                    marginTop: 12,
                    fontFamily: tokens.typography.fontFamily.bold,
                  }}
                >
                  Procesando Pago...
                </Text>
              </View>
            )}

            {/* Corner Borders */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />

            {/* Laser Line */}
            <LinearGradient
              colors={[
                'rgba(59, 130, 246, 0)',
                'rgba(59, 130, 246, 0.8)',
                'rgba(59, 130, 246, 0)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.laserLine}
            />
          </View>
        </View>

        {/* ── TEXT INFO ── */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>Escanea el código QR del bus</Text>
          <Text style={styles.subtitle}>
            Ubica el código dentro del recuadro{'\n'}para pagar tu viaje
          </Text>
        </View>
      </View>

      {/* ── BOTTOM ACTIONS ── */}
      <View style={styles.bottomSection}>
        <View style={styles.actionButtonsRow}>
          <View style={styles.actionItem}>
            <Pressable style={styles.scanButtonActive}>
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={28}
                color="#FFFFFF"
              />
            </Pressable>
            <Text style={styles.actionTextActive}>ESCANEAR</Text>
          </View>

          <View style={styles.actionItem}>
            <Pressable style={styles.galleryButton}>
              <Ionicons name="image-outline" size={24} color="#9CA3AF" />
            </Pressable>
            <Text style={styles.actionTextInactive}>GALERÍA</Text>
          </View>
        </View>

        <View style={styles.secureBadge}>
          <MaterialCommunityIcons
            name="shield-check"
            size={16}
            color="#10B981"
          />
          <Text style={styles.secureText}>PAGO SEGURO ENCRIPTADO</Text>
        </View>
      </View>

      <PhoneLinkModal
        visible={showLinkModal}
        onClose={() => {
          setShowLinkModal(false);
          setScanned(false);
        }}
        onSuccess={() => {
          setScanned(false);
          Alert.alert(
            'Éxito',
            'Tu teléfono ha sido vinculado y verificado. Ya puedes escanear el código QR para pagar tu viaje.',
          );
        }}
      />

      {/* ── MODAL DE CONFIRMACIÓN DE VIAJE ── */}
      <Modal
        visible={showConfirmModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (confirmStep !== 'processing') handleCloseConfirmModal();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Cabecera del modal */}
            {confirmStep !== 'processing' && (
              <View style={styles.modalHeader}>
                <Text style={styles.modalSheetTitle}>
                  {confirmStep === 'details'
                    ? 'Confirmar Viaje'
                    : 'Viaje Confirmado'}
                </Text>
                {confirmStep === 'details' && (
                  <Pressable onPress={handleCloseConfirmModal} hitSlop={10}>
                    <Ionicons name="close" size={24} color="#9CA3AF" />
                  </Pressable>
                )}
              </View>
            )}

            {/* PASO 1: Detalles del Viaje */}
            {confirmStep === 'details' && (
              <View style={styles.modalContentContainer}>
                <View style={styles.busIconContainer}>
                  <MaterialCommunityIcons
                    name="bus"
                    size={40}
                    color={tokens.colors.primary}
                  />
                </View>

                <Text style={styles.modalSubtitle}>Confirma tu Fare</Text>

                {/* TICKET DIGITAL */}
                <View style={styles.ticketCard}>
                  {/* Left & Right punch hole cutouts */}
                  <View style={styles.ticketCutoutLeft} />
                  <View style={styles.ticketCutoutRight} />

                  {/* PARTE SUPERIOR DEL TICKET */}
                  <View style={styles.ticketTop}>
                    <View style={styles.ticketHeaderRow}>
                      <View style={styles.ticketLogoContainer}>
                        <MaterialCommunityIcons
                          name="transit-connection"
                          size={18}
                          color={tokens.colors.primary}
                        />
                        <Text style={styles.ticketLogoText}>FARE GOFARE</Text>
                      </View>
                      <View style={styles.ticketBadge}>
                        <Text style={styles.ticketBadgeText}>ACTIVO</Text>
                      </View>
                    </View>

                    <View style={styles.ticketRouteRow}>
                      <Text style={styles.ticketLabel}>UNIDAD / RUTA</Text>
                      <Text style={styles.ticketValueLarge} numberOfLines={1}>
                        {scannedQr}
                      </Text>
                    </View>

                    <View style={styles.ticketPriceRow}>
                      <Text style={styles.ticketLabel}>TARIFA (COSTO)</Text>
                      <Text style={styles.ticketPriceValue}>
                        {routeFare.toFixed(2)} fares
                      </Text>
                    </View>
                  </View>

                  {/* DIVISOR DASHEADO */}
                  <View style={styles.ticketDividerContainer}>
                    <View style={styles.ticketDashedLine} />
                  </View>

                  {/* PARTE INFERIOR DEL TICKET */}
                  <View style={styles.ticketBottom}>
                    <View style={styles.ticketInfoRow}>
                      <Text style={styles.ticketInfoLabel}>FECHA Y HORA</Text>
                      <Text style={styles.ticketInfoValue}>
                        {new Date().toLocaleDateString('es-VE')}{' '}
                        {new Date().toLocaleTimeString('es-VE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>

                    <View style={styles.ticketInfoRow}>
                      <Text style={styles.ticketInfoLabel}>
                        FARES DISPONIBLES
                      </Text>
                      <Text
                        style={[
                          styles.ticketInfoValue,
                          balance === 0 && { color: '#EF4444' },
                        ]}
                      >
                        {balance.toFixed(2)} fares
                      </Text>
                    </View>

                    <View style={styles.ticketInfoRow}>
                      <Text style={styles.ticketInfoLabel}>
                        FARES RESTANTES
                      </Text>
                      <Text
                        style={[
                          styles.ticketInfoValue,
                          {
                            color: '#10B981',
                            fontFamily: tokens.typography.fontFamily.bold,
                          },
                        ]}
                      >
                        {Math.max(0, balance - routeFare).toFixed(2)} fares
                      </Text>
                    </View>
                  </View>
                </View>

                {/* BOTONES DE ACCIÓN */}
                <Pressable
                  style={styles.confirmPayButton}
                  onPress={handleExecuteDirectPayment}
                >
                  <Text style={styles.confirmPayButtonText}>
                    Confirmar y Viajar
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.cancelPayButton}
                  onPress={handleCloseConfirmModal}
                >
                  <Text style={styles.cancelPayButtonText}>Cancelar</Text>
                </Pressable>
              </View>
            )}

            {/* PASO 2: Procesando */}
            {confirmStep === 'processing' && (
              <View style={styles.processingContainer}>
                <ActivityIndicator
                  size="large"
                  color={tokens.colors.primary}
                  style={{ marginBottom: 24 }}
                />
                <Text style={styles.processingTitle}>
                  Procesando tu Fare...
                </Text>
                <Text style={styles.processingSubtitle}>
                  Activando tu fare y registrando el viaje de forma segura.
                </Text>
              </View>
            )}

            {/* PASO 3: Éxito */}
            {confirmStep === 'success' && (
              <View style={styles.successContainer}>
                <View style={styles.successIconWrapper}>
                  <Ionicons name="checkmark-circle" size={80} color="#10B981" />
                </View>
                <Text style={styles.successTitle}>¡Buen Viaje!</Text>
                <Text style={styles.successSubtitle}>
                  Tu fare ha sido pagado y validado con éxito.
                </Text>

                {/* TICKET DIGITAL COMPROBANTE */}
                <View style={styles.ticketCard}>
                  {/* Left & Right punch hole cutouts */}
                  <View style={styles.ticketCutoutLeft} />
                  <View style={styles.ticketCutoutRight} />

                  {/* PARTE SUPERIOR DEL TICKET */}
                  <View style={styles.ticketTop}>
                    <View style={styles.ticketHeaderRow}>
                      <View style={styles.ticketLogoContainer}>
                        <MaterialCommunityIcons
                          name="transit-connection"
                          size={18}
                          color="#10B981"
                        />
                        <Text
                          style={[styles.ticketLogoText, { color: '#10B981' }]}
                        >
                          COMPROBANTE
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.ticketBadge,
                          { backgroundColor: '#DCFCE7' },
                        ]}
                      >
                        <Text
                          style={[styles.ticketBadgeText, { color: '#10B981' }]}
                        >
                          VALIDADO
                        </Text>
                      </View>
                    </View>

                    <View style={styles.ticketRouteRow}>
                      <Text style={styles.ticketLabel}>UNIDAD / RUTA</Text>
                      <Text style={styles.ticketValueLarge} numberOfLines={1}>
                        {scannedQr}
                      </Text>
                    </View>

                    <View style={styles.ticketPriceRow}>
                      <Text style={styles.ticketLabel}>FARE USADO</Text>
                      <Text
                        style={[styles.ticketPriceValue, { color: '#10B981' }]}
                      >
                        {routeFare.toFixed(2)} fares
                      </Text>
                    </View>
                  </View>

                  {/* DIVISOR DASHEADO */}
                  <View style={styles.ticketDividerContainer}>
                    <View style={styles.ticketDashedLine} />
                  </View>

                  {/* PARTE INFERIOR DEL TICKET */}
                  <View style={styles.ticketBottom}>
                    <View style={styles.ticketInfoRow}>
                      <Text style={styles.ticketInfoLabel}>FECHA Y HORA</Text>
                      <Text style={styles.ticketInfoValue}>
                        {new Date().toLocaleDateString('es-VE')}{' '}
                        {new Date().toLocaleTimeString('es-VE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>

                    <View style={styles.ticketInfoRow}>
                      <Text style={styles.ticketInfoLabel}>
                        BOLETOS RESTANTES
                      </Text>
                      <Text
                        style={[
                          styles.ticketInfoValue,
                          { fontFamily: tokens.typography.fontFamily.bold },
                        ]}
                      >
                        {Math.max(0, Math.floor(balance))}{' '}
                        {Math.max(0, Math.floor(balance)) === 1
                          ? 'boleto'
                          : 'boletos'}
                      </Text>
                    </View>

                    <View style={styles.ticketInfoRow}>
                      <Text style={styles.ticketInfoLabel}>ESTADO</Text>
                      <Text
                        style={[
                          styles.ticketInfoValue,
                          {
                            color: '#10B981',
                            fontFamily: tokens.typography.fontFamily.bold,
                          },
                        ]}
                      >
                        USADO / VALIDADO
                      </Text>
                    </View>

                    {/* Barcode Mock */}
                    <View style={styles.barcodeContainer}>
                      <MaterialCommunityIcons
                        name="barcode"
                        size={60}
                        color="#6B7280"
                      />
                      <Text style={styles.barcodeText}>GF-582910</Text>
                    </View>
                  </View>
                </View>

                <Pressable
                  style={styles.receiptCloseBtn}
                  onPress={handleSuccessClose}
                >
                  <Text style={styles.receiptCloseBtnText}>Entendido</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827', // Very dark background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scannerWrapper: {
    marginBottom: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerBox: {
    width: 280,
    height: 280,
    backgroundColor: '#000000', // Black inner scanner area
    borderRadius: 24,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#818CF8', // Lighter glowing blue
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 24,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 24,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 24,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 24,
  },
  laserLine: {
    width: '90%',
    height: 2,
    position: 'absolute',
    top: '30%', // Position the laser slightly above center
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 48,
    marginBottom: 32,
  },
  actionItem: {
    alignItems: 'center',
  },
  scanButtonActive: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: tokens.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  galleryButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1F2937', // Dark gray
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionTextActive: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
    letterSpacing: 1,
  },
  actionTextInactive: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  secureText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#9CA3AF',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  permissionText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#D1D5DB',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: tokens.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 20,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  permissionButtonText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalSheetTitle: {
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
  },
  modalContentContainer: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  busIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalSubtitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
    marginBottom: 16,
  },

  // Ticket Component Design
  ticketCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
    position: 'relative',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  ticketCutoutLeft: {
    position: 'absolute',
    left: -11,
    top: '47%',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 5,
  },
  ticketCutoutRight: {
    position: 'absolute',
    right: -11,
    top: '47%',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 5,
  },
  ticketTop: {
    padding: 20,
    paddingBottom: 12,
  },
  ticketHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  ticketLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ticketLogoText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
    letterSpacing: 0.8,
  },
  ticketBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ticketBadgeText: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  ticketRouteRow: {
    marginBottom: 12,
  },
  ticketLabel: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  ticketValueLarge: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
  },
  ticketPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketPriceValue: {
    fontSize: 22,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
  },
  ticketDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    width: '100%',
  },
  ticketDashedLine: {
    flex: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    height: 1,
    marginHorizontal: 12,
  },
  ticketBottom: {
    padding: 20,
    paddingTop: 12,
  },
  ticketInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ticketInfoLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  ticketInfoValue: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
  },
  insufficientBalanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  insufficientBalanceText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#EF4444',
    flex: 1,
  },
  confirmPayButton: {
    backgroundColor: tokens.colors.primary,
    width: '100%',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmPayButtonText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  rechargeRedirectButton: {
    backgroundColor: '#F59E0B',
    flexDirection: 'row',
    width: '100%',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  rechargeRedirectButtonText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  cancelPayButton: {
    backgroundColor: '#F1F5F9',
    width: '100%',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelPayButtonText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#475569',
  },

  // Processing View
  processingContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  processingTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
    marginBottom: 8,
  },
  processingSubtitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 20,
  },

  // Success View
  successContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  successIconWrapper: {
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 22,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#10B981',
    marginBottom: 6,
  },
  successSubtitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  barcodeContainer: {
    alignItems: 'center',
    marginTop: 12,
    opacity: 0.8,
  },
  barcodeText: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
    letterSpacing: 3,
    marginTop: 4,
  },
  receiptCloseBtn: {
    backgroundColor: tokens.colors.primary,
    width: '100%',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  receiptCloseBtnText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
});
