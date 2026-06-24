import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  totalEarnings?: number;
  tripsCount?: number;
}

const VEHICLES_BASE_EARNINGS: Record<
  string,
  { earnings: number; trips: number }
> = {
  '1': { earnings: 3240.0, trips: 216 },
  '2': { earnings: 1890.0, trips: 126 },
  '3': { earnings: 840.0, trips: 56 },
};

export default function VehicleOwnerEarnings() {
  const _router = useRouter();
  const [loading, setLoading] = useState(true);
  const [totalEarnings, setTotalEarnings] = useState(5970.0);
  const [totalTrips, setTotalTrips] = useState(398);
  const [activeUnitsCount, setActiveUnitsCount] = useState(3);

  const loadEarningsData = useCallback(async () => {
    try {
      setLoading(true);
      const localStr = await AsyncStorage.getItem('mock_vehicle_requests');
      const localVehicles: MockVehicle[] = localStr ? JSON.parse(localStr) : [];

      const deletedPlatesStr = await AsyncStorage.getItem(
        'mock_deleted_vehicle_plates',
      );
      const deletedPlates: string[] = deletedPlatesStr
        ? JSON.parse(deletedPlatesStr)
        : [];

      // Lista base filtrada de eliminados
      const baseApproved = [
        { uuid: '1', licensePlate: 'AB123CD', status: 'approved' },
        { uuid: '2', licensePlate: 'XY987ZT', status: 'approved' },
        { uuid: '3', licensePlate: 'HJ321OP', status: 'approved' },
      ].filter((v) => !deletedPlates.includes(v.licensePlate));

      // Combinar
      let totalE = 0;
      let totalT = 0;
      let count = 0;

      // Calcular para los base aprobados que no fueron borrados
      for (const baseV of baseApproved) {
        // Ver si hay versión en AsyncStorage con más ganancias
        const localCopy = localVehicles.find(
          (lv) => lv.licensePlate === baseV.licensePlate,
        );
        const e =
          localCopy?.totalEarnings !== undefined
            ? localCopy.totalEarnings
            : (VEHICLES_BASE_EARNINGS[baseV.uuid]?.earnings ?? 0);
        const t =
          localCopy?.tripsCount !== undefined
            ? localCopy.tripsCount
            : (VEHICLES_BASE_EARNINGS[baseV.uuid]?.trips ?? 0);

        totalE += e;
        totalT += t;
        count++;
      }

      // Calcular para los nuevos agregados aprobados
      const localApprovedOnly = localVehicles.filter(
        (lv) =>
          lv.status === 'approved' &&
          !['AB123CD', 'XY987ZT', 'HJ321OP'].includes(lv.licensePlate),
      );

      for (const lv of localApprovedOnly) {
        totalE += lv.totalEarnings !== undefined ? lv.totalEarnings : 450.0;
        totalT += lv.tripsCount !== undefined ? lv.tripsCount : 30;
        count++;
      }

      setTotalEarnings(totalE);
      setTotalTrips(totalT);
      setActiveUnitsCount(count);
    } catch (err) {
      console.warn('[Earnings] Error calculating fleet earnings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEarningsData();
  }, [loadEarningsData]);

  const handleRequestPayout = () => {
    if (totalEarnings <= 0) {
      Alert.alert(
        'Saldo Insuficiente',
        'No tienes ingresos disponibles para solicitar liquidación.',
      );
      return;
    }

    Alert.alert(
      'Solicitar Liquidación',
      `¿Deseas transferir el saldo acumulado de ${totalEarnings.toFixed(2)} Bs a tu cuenta bancaria registrada mediante Pago Móvil interbancario?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Transferir Saldo',
          onPress: () => {
            Alert.alert(
              'Transferencia en Camino',
              'Tu solicitud ha sido procesada con éxito. El saldo de tu cuenta GoFare ha sido liquidado y recibirás los fondos en tu cuenta bancaria en un plazo máximo de 15 minutos.',
              [
                {
                  text: 'Entendido',
                  onPress: () => {
                    setTotalEarnings(0);
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const weeklyData = [
    { day: 'Lun', amount: '850 Bs', height: '60%' },
    { day: 'Mar', amount: '1100 Bs', height: '80%' },
    { day: 'Mie', amount: '950 Bs', height: '70%' },
    { day: 'Jue', amount: '1250 Bs', height: '90%' },
    { day: 'Vie', amount: '1400 Bs', height: '100%' },
    { day: 'Sab', amount: '420 Bs', height: '30%' },
    { day: 'Dom', amount: '0 Bs', height: '0%' },
  ];

  const recentTx = [
    {
      id: 'tx1',
      time: 'Hace 2 min',
      vehicle: 'Toyota Coaster (AB123CD)',
      route: 'Ruta 201',
      amount: 15.0,
    },
    {
      id: 'tx2',
      time: 'Hace 12 min',
      vehicle: 'Hyundai County (HJ321OP)',
      route: 'Ruta 201',
      amount: 15.0,
    },
    {
      id: 'tx3',
      time: 'Hace 18 min',
      vehicle: 'Encava ENT-610 (XY987ZT)',
      route: 'Ruta L1',
      amount: 20.0,
    },
    {
      id: 'tx4',
      time: 'Hace 45 min',
      vehicle: 'Toyota Coaster (AB123CD)',
      route: 'Ruta 201',
      amount: 15.0,
    },
    {
      id: 'tx5',
      time: 'Hace 1 hora',
      vehicle: 'Encava ENT-610 (XY987ZT)',
      route: 'Ruta L1',
      amount: 20.0,
    },
  ];

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
        <Text style={styles.headerTitle}>Ingresos de Flota</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>SALDO DISPONIBLE</Text>
          <Text style={styles.balanceValue}>{totalEarnings.toFixed(2)} Bs</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>VIAJES TOTALES</Text>
              <Text style={styles.metaValue}>{totalTrips}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>UNIDADES ACTIVAS</Text>
              <Text style={styles.metaValue}>{activeUnitsCount}</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.payoutBtn,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              totalEarnings <= 0 && styles.payoutBtnDisabled,
            ]}
            onPress={handleRequestPayout}
            disabled={totalEarnings <= 0}
          >
            <Ionicons
              name="card"
              size={20}
              color={tokens.colors.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.payoutBtnText}>Cobrar Ingresos Acumulados</Text>
          </Pressable>
        </View>

        {/* weekly chart */}
        <Text style={styles.sectionTitle}>Ingresos Semanales</Text>
        <View style={styles.chartCard}>
          <View style={styles.chartBarsContainer}>
            {weeklyData.map((data, idx) => (
              <View key={idx} style={styles.chartCol}>
                <View style={styles.chartBarOuter}>
                  <View
                    style={[
                      styles.chartBarInner,
                      { height: data.height as any },
                    ]}
                  />
                </View>
                <Text style={styles.chartDayText}>{data.day}</Text>
                <Text style={styles.chartValText}>
                  {data.amount.split(' ')[0]}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* recent activity */}
        <Text style={styles.sectionTitle}>Actividad de Cobros Recientes</Text>
        <View style={styles.transactionsCard}>
          {recentTx.map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={styles.txIconWrapper}>
                <Ionicons name="cash-outline" size={18} color="#16A34A" />
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txVehicleName}>{tx.vehicle}</Text>
                <Text style={styles.txRoute}>
                  {tx.route} • {tx.time}
                </Text>
              </View>
              <Text style={styles.txAmount}>+{tx.amount.toFixed(2)} Bs</Text>
            </View>
          ))}
        </View>

        {/* Espaciador final */}
        <View style={{ height: 110 }} />
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
  balanceCard: {
    backgroundColor: '#0F172A', // Slate 900
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  balanceLabel: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 36,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#FFFFFF',
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  metaCol: {
    flex: 1,
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  metaDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  payoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    height: 52,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  payoutBtnDisabled: {
    opacity: 0.5,
  },
  payoutBtnText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 12,
    marginLeft: 4,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  chartBarsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 10,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarOuter: {
    height: 100,
    width: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  chartBarInner: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 6,
    width: '100%',
  },
  chartDayText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 2,
  },
  chartValText: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
  },
  transactionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 16,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 12,
  },
  txIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txDetails: {
    flex: 1,
  },
  txVehicleName: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 2,
  },
  txRoute: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
  },
  txAmount: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#16A34A',
  },
});
