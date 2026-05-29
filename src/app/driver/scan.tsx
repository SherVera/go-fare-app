import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTicketByQr, validateTicketByQr } from '@/lib/api';
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

export default function DriverScanScreen() {
  const router = useRouter();
  const [isEnServicio, setIsEnServicio] = useState(false);
  const [activeRoute, setActiveRoute] = useState<RouteOption>(ROUTE_OPTIONS[0]);
  const [loading, setLoading] = useState(true);

  // Input code
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [processing, setProcessing] = useState(false);

  // Success / Error States
  const [scanResult, setScanResult] = useState<'success' | 'error' | null>(
    null,
  );
  const [resultMessage, setResultMessage] = useState('');
  const [resultDetails, setResultDetails] = useState<{
    passengerName?: string;
    route?: string;
    fare?: number;
    code?: string;
    time?: string;
  } | null>(null);

  // Cargar estado de servicio y ruta activa
  const checkServiceStatus = async () => {
    try {
      setLoading(true);
      const status = await AsyncStorage.getItem('driver_service_status');
      setIsEnServicio(status === 'active');

      const routeId = await AsyncStorage.getItem('driver_active_route_id');
      if (routeId) {
        const found = ROUTE_OPTIONS.find((r) => r.id === routeId);
        if (found) setActiveRoute(found);
      }
    } catch (err) {
      console.warn('[Scan] Error loading service status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkServiceStatus();
  }, []);

  const handleValidateTicket = async (code: string) => {
    if (processing) return;
    const sanitizedCode = code.trim();
    if (!sanitizedCode) {
      Alert.alert(
        'Código Requerido',
        'Por favor, ingresa el código del boleto.',
      );
      return;
    }

    Keyboard.dismiss();
    setProcessing(true);

    try {
      // 1. Intentar validar el boleto real en el backend
      console.log('[Scan] Validating real ticket:', sanitizedCode);
      const ticket = await validateTicketByQr(sanitizedCode);

      // Registrar cobro exitoso
      const validationRecord = {
        id: `val-${Date.now()}`,
        code: sanitizedCode,
        fare: ticket.price || activeRoute.fare,
        route: ticket.route || activeRoute.name,
        time: new Date().toLocaleTimeString('es-VE', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        date: new Date().toLocaleDateString('es-VE'),
        passengerName: 'Pasajero Verificado',
      };

      // Guardar localmente
      const localListStr = await AsyncStorage.getItem('mock_validated_tickets');
      const localList = localListStr ? JSON.parse(localListStr) : [];
      localList.unshift(validationRecord);
      await AsyncStorage.setItem(
        'mock_validated_tickets',
        JSON.stringify(localList),
      );

      setResultDetails({
        passengerName: 'Pasajero Registrado',
        route: ticket.route || activeRoute.name,
        fare: ticket.price || activeRoute.fare,
        code: sanitizedCode,
        time: validationRecord.time,
      });
      setResultMessage('¡Boleto Validado con Éxito!');
      setScanResult('success');
      setQrCodeInput('');
    } catch (err: any) {
      console.warn(
        '[Scan] Real validation failed (using fallback/simulator):',
        err.message || err,
      );

      // 2. Fallback de Simulación en caso de error de red o para códigos especiales de simulación
      const codeUpper = sanitizedCode.toUpperCase();

      if (
        codeUpper.startsWith('MOCK-VALID') ||
        codeUpper === 'OK' ||
        codeUpper.startsWith('TICKET-MOCK')
      ) {
        const fareValue = codeUpper.includes('20') ? 20.0 : 15.0;
        const validationRecord = {
          id: `val-${Date.now()}`,
          code: sanitizedCode,
          fare: fareValue,
          route: activeRoute.name,
          time: new Date().toLocaleTimeString('es-VE', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          date: new Date().toLocaleDateString('es-VE'),
          passengerName: codeUpper.includes('CARLOS')
            ? 'Carlos Pérez'
            : 'Rafael Castellano',
        };

        const localListStr = await AsyncStorage.getItem(
          'mock_validated_tickets',
        );
        const localList = localListStr ? JSON.parse(localListStr) : [];
        localList.unshift(validationRecord);
        await AsyncStorage.setItem(
          'mock_validated_tickets',
          JSON.stringify(localList),
        );

        setResultDetails({
          passengerName: validationRecord.passengerName,
          route: activeRoute.name,
          fare: fareValue,
          code: sanitizedCode,
          time: validationRecord.time,
        });
        setResultMessage('¡Boleto Validado con Éxito!');
        setScanResult('success');
        setQrCodeInput('');
      } else {
        // Mostrar error real o simulado
        let errorMsg = err.message || 'Código de boleto inválido o inactivo.';
        if (codeUpper.startsWith('USED') || codeUpper === 'USADO') {
          errorMsg =
            'El boleto ya ha sido validado anteriormente (Código: USED-TICKET).';
        } else if (
          codeUpper.startsWith('EXPIRED') ||
          codeUpper === 'EXPIRADO'
        ) {
          errorMsg = 'El boleto ha expirado o su validez temporal finalizó.';
        } else if (codeUpper.startsWith('SALDO') || codeUpper === 'NO-MONEY') {
          errorMsg = 'El pasajero no cuenta con saldo suficiente en su cuenta.';
        }

        setResultMessage(errorMsg);
        setResultDetails({
          code: sanitizedCode,
          time: new Date().toLocaleTimeString('es-VE', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
        setScanResult('error');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleSimulateQuickScan = (
    type: 'valid_15' | 'valid_20' | 'used' | 'expired' | 'no_money',
  ) => {
    let code = 'MOCK-VALID-15';
    if (type === 'valid_20') code = 'MOCK-VALID-20-CARLOS';
    if (type === 'used') code = 'USED-BOLETO';
    if (type === 'expired') code = 'EXPIRED-BOLETO';
    if (type === 'no_money') code = 'SALDO-INSUFICIENTE';

    handleValidateTicket(code);
  };

  const resetResult = () => {
    setScanResult(null);
    setResultMessage('');
    setResultDetails(null);
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

      {scanResult === null ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons
              name="information-circle-outline"
              size={24}
              color="#0369A1"
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.infoTitle}>TARIFA DE LA RUTA</Text>
              <Text style={styles.infoText}>
                {activeRoute.name} •{' '}
                <Text style={{ fontWeight: 'bold' }}>
                  {activeRoute.fare.toFixed(2)} Bs
                </Text>
              </Text>
            </View>
          </View>

          {/* Cámara de Escaneo Simulada */}
          <View style={styles.scannerWrapper}>
            <View style={styles.scannerOverlay}>
              <View style={styles.scanTargetBox}>
                {/* Cuatro esquinas del marco */}
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />

                {/* Línea roja/verde de escaneo */}
                <View style={styles.scanningLine} />
              </View>
              <Text style={styles.scannerPrompt}>
                Escanea el código QR del pasajero
              </Text>
            </View>
          </View>

          {/* Validador Manual */}
          <Text style={styles.inputLabel}>INGRESO MANUAL DE CÓDIGO</Text>
          <View style={styles.inputCard}>
            <Ionicons
              name="qr-code-outline"
              size={20}
              color="#8594AB"
              style={{ marginRight: 12 }}
            />
            <TextInput
              style={styles.input}
              placeholder="Ingresa código o ID del boleto..."
              placeholderTextColor="#A1A1AA"
              value={qrCodeInput}
              onChangeText={setQrCodeInput}
              autoCapitalize="characters"
              editable={!processing}
            />
            {processing ? (
              <ActivityIndicator size="small" color={tokens.colors.primary} />
            ) : (
              <Pressable
                style={styles.validateBtn}
                onPress={() => handleValidateTicket(qrCodeInput)}
              >
                <Text style={styles.validateBtnText}>Validar</Text>
              </Pressable>
            )}
          </View>

          {/* Quick Simulation Options */}
          <Text style={styles.sectionTitle}>Simular Casos de Prueba</Text>
          <View style={styles.simulationGrid}>
            <Pressable
              style={styles.simBtnSuccess}
              onPress={() => handleSimulateQuickScan('valid_15')}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.simBtnText}>Válido (Bs 15)</Text>
            </Pressable>
            <Pressable
              style={styles.simBtnSuccess}
              onPress={() => handleSimulateQuickScan('valid_20')}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.simBtnText}>Válido (Bs 20)</Text>
            </Pressable>
            <Pressable
              style={styles.simBtnError}
              onPress={() => handleSimulateQuickScan('used')}
            >
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.simBtnText}>Ya Usado</Text>
            </Pressable>
            <Pressable
              style={styles.simBtnError}
              onPress={() => handleSimulateQuickScan('expired')}
            >
              <Ionicons
                name="close-circle-outline"
                size={16}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.simBtnText}>Expirado</Text>
            </Pressable>
          </View>

          {/* Espacio final */}
          <View style={{ height: 100 }} />
        </ScrollView>
      ) : (
        /* PANTALLA RESULTADO DEL ESCANEO (ÉXITO / ERROR) */
        <View
          style={[
            styles.resultContainer,
            scanResult === 'success' ? styles.bgSuccess : styles.bgError,
          ]}
        >
          <View style={styles.resultCard}>
            <View
              style={[
                styles.resultIconWrapper,
                scanResult === 'success'
                  ? styles.iconSuccessBg
                  : styles.iconErrorBg,
              ]}
            >
              <Ionicons
                name={
                  scanResult === 'success' ? 'checkmark-circle' : 'alert-circle'
                }
                size={72}
                color={scanResult === 'success' ? '#16A34A' : '#DC2626'}
              />
            </View>

            <Text
              style={[
                styles.resultTitle,
                scanResult === 'success'
                  ? { color: '#16A34A' }
                  : { color: '#DC2626' },
              ]}
            >
              {scanResult === 'success'
                ? 'Validación Exitosa'
                : 'Validación Fallida'}
            </Text>

            <Text style={styles.resultMessageText}>{resultMessage}</Text>

            <View style={styles.resultDetailsCard}>
              {scanResult === 'success' && resultDetails ? (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>PASAJERO</Text>
                    <Text style={styles.detailValue}>
                      {resultDetails.passengerName}
                    </Text>
                  </View>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>RUTA</Text>
                    <Text style={styles.detailValue}>
                      {resultDetails.route}
                    </Text>
                  </View>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>TARIFA COBRADA</Text>
                    <Text
                      style={[
                        styles.detailValue,
                        { color: '#16A34A', fontWeight: 'bold' },
                      ]}
                    >
                      {resultDetails.fare?.toFixed(2)} Bs
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>MOTIVO</Text>
                  <Text style={[styles.detailValue, { color: '#DC2626' }]}>
                    Código de Boleto Inadecuado o Rechazado por Servidor
                  </Text>
                </View>
              )}

              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>CÓDIGO DE ESCANEO</Text>
                <Text style={styles.detailValueMono}>
                  {resultDetails?.code || qrCodeInput}
                </Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.dismissBtn,
                scanResult === 'success'
                  ? { backgroundColor: '#16A34A' }
                  : { backgroundColor: '#DC2626' },
                pressed && { opacity: 0.9 },
              ]}
              onPress={resetResult}
            >
              <Text style={styles.dismissBtnText}>Continuar Escaneo</Text>
            </Pressable>
          </View>
        </View>
      )}
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
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#E0F2FE',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#0284C7',
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#0369A1',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#0284C7',
  },
  scannerWrapper: {
    backgroundColor: '#0F172A',
    borderRadius: 28,
    height: 250,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  scannerOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  scanTargetBox: {
    width: 140,
    height: 140,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#10B981', // Emerald 500
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scanningLine: {
    width: '100%',
    height: 2.5,
    backgroundColor: '#10B981',
    position: 'absolute',
    top: '50%',
    opacity: 0.7,
  },
  scannerPrompt: {
    color: '#94A3B8',
    fontSize: 12.5,
    fontFamily: tokens.typography.fontFamily.bold,
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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
  sectionTitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 10,
    marginLeft: 4,
  },
  simulationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  simBtnSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    borderRadius: 12,
    height: 42,
    width: '48%',
    marginBottom: 10,
  },
  simBtnError: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 12,
    height: 42,
    width: '48%',
    marginBottom: 10,
  },
  simBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
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
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  bgSuccess: {
    backgroundColor: '#DCFCE7', // Light green
  },
  bgError: {
    backgroundColor: '#FEE2E2', // Light red
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  resultIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconSuccessBg: {
    backgroundColor: '#DCFCE7',
  },
  iconErrorBg: {
    backgroundColor: '#FEE2E2',
  },
  resultTitle: {
    fontSize: 22,
    fontFamily: tokens.typography.fontFamily.black,
    marginBottom: 8,
  },
  resultMessageText: {
    fontSize: 14.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  resultDetailsCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
  },
  detailRow: {
    marginVertical: 4,
  },
  detailLabel: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
  },
  detailValueMono: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: 'bold',
    color: '#64748B',
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  dismissBtn: {
    borderRadius: 16,
    height: 52,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  dismissBtnText: {
    color: '#FFFFFF',
    fontFamily: tokens.typography.fontFamily.bold,
    fontSize: 15,
  },
});
