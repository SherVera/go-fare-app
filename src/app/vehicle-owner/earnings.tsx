import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { getAllTransactions, getOwnerVehicles } from '@/lib/api';
import { tokens } from '@/theme/tokens';

interface RecentTransaction {
  id: string;
  time: string;
  vehicle: string;
  route: string;
  amount: number;
}

interface WeeklyBarData {
  day: string;
  amount: string;
  height: string;
}

const fallbackDateFormatter = new Intl.DateTimeFormat('es-VE', {
  day: 'numeric',
  month: 'short',
});

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Hace un momento';
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;

  return fallbackDateFormatter.format(date);
}

export default function VehicleOwnerEarnings() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalTrips, setTotalTrips] = useState(0);
  const [activeUnitsCount, setActiveUnitsCount] = useState(0);
  const [recentTx, setRecentTx] = useState<RecentTransaction[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyBarData[]>([
    { day: 'Lun', amount: '0 Bs', height: '0%' },
    { day: 'Mar', amount: '0 Bs', height: '0%' },
    { day: 'Mie', amount: '0 Bs', height: '0%' },
    { day: 'Jue', amount: '0 Bs', height: '0%' },
    { day: 'Vie', amount: '0 Bs', height: '0%' },
    { day: 'Sab', amount: '0 Bs', height: '0%' },
    { day: 'Dom', amount: '0 Bs', height: '0%' },
  ]);

  const loadEarningsData = useCallback(async () => {
    try {
      const [vehicles, allTx] = await Promise.all([
        getOwnerVehicles().catch((err) => {
          console.warn('[Earnings] Error al obtener vehículos:', err);
          return [];
        }),
        getAllTransactions().catch((err) => {
          console.warn('[Earnings] Error al obtener transacciones:', err);
          return [];
        }),
      ]);

      const approvedVehicles = vehicles.filter(
        (v: any) => v.status === 'approved',
      );

      let totalE = 0;
      let totalT = 0;

      for (const v of approvedVehicles) {
        totalE += Number(v.totalEarnings) || 0;
        totalT += Number(v.tripsCount) || 0;
      }

      setTotalEarnings(totalE);
      setTotalTrips(totalT);
      setActiveUnitsCount(approvedVehicles.length);

      // Mapear transacciones reales que pertenezcan a la flota del dueño
      const vehicleUuids = new Set(
        approvedVehicles.map((v: any) => v.uuid).filter(Boolean),
      );
      const vehiclePlates = new Set(
        approvedVehicles
          .map((v: any) => (v.licensePlate || '').toLowerCase().trim())
          .filter(Boolean),
      );

      const ownerTx = (allTx || []).filter((tx: any) => {
        if (!tx) return false;
        if (tx.vehicleUuid && vehicleUuids.has(tx.vehicleUuid)) return true;
        if (tx.vehicle?.uuid && vehicleUuids.has(tx.vehicle.uuid)) return true;
        if (
          tx.vehicle?.plate &&
          vehiclePlates.has(tx.vehicle.plate.toLowerCase().trim())
        )
          return true;
        if (
          tx.licensePlate &&
          vehiclePlates.has(tx.licensePlate.toLowerCase().trim())
        )
          return true;
        if (tx.description) {
          const desc = tx.description.toLowerCase();
          for (const plate of vehiclePlates) {
            if (plate && desc.includes(plate)) return true;
          }
        }
        return false;
      });

      // Ordenar por fecha descendente
      const sortedTx = [...ownerTx].sort((a: any, b: any) => {
        const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
        const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
        return timeB - timeA;
      });

      const formattedTx: RecentTransaction[] = sortedTx
        .slice(0, 15)
        .map((tx: any) => {
          const vehicleObj = approvedVehicles.find(
            (v: any) =>
              v.uuid === tx.vehicleUuid ||
              v.uuid === tx.vehicle?.uuid ||
              (v.licensePlate &&
                tx.description
                  ?.toLowerCase()
                  .includes(v.licensePlate.toLowerCase())),
          );

          const vehicleTitle = vehicleObj
            ? `${vehicleObj.vehicleMake} ${vehicleObj.vehicleModel} (${vehicleObj.licensePlate})`
            : tx.vehicleTitle || tx.vehicle?.name || 'Unidad de Transporte';

          return {
            id: String(tx.uuid || tx.id || Math.random()),
            time: formatRelativeTime(tx.createdAt || tx.timestamp),
            vehicle: vehicleTitle,
            route: tx.route || tx.description || 'Pasaje Urbano',
            amount: Math.abs(Number(tx.amount || tx.fareAmount || 0)),
          };
        });

      setRecentTx(formattedTx);

      // Calcular gráfico semanal real
      const daysMap: { [key: number]: string } = {
        1: 'Lun',
        2: 'Mar',
        3: 'Mie',
        4: 'Jue',
        5: 'Vie',
        6: 'Sab',
        0: 'Dom',
      };

      const now = new Date();
      const currentDay = now.getDay();
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);

      const dayTotals: { [dayLabel: string]: number } = {
        Lun: 0,
        Mar: 0,
        Mie: 0,
        Jue: 0,
        Vie: 0,
        Sab: 0,
        Dom: 0,
      };

      for (const tx of ownerTx) {
        const txDate = new Date(tx.createdAt || tx.timestamp);
        if (!Number.isNaN(txDate.getTime()) && txDate >= monday) {
          const dayLabel = daysMap[txDate.getDay()];
          if (dayLabel && dayTotals[dayLabel] !== undefined) {
            dayTotals[dayLabel] += Math.abs(
              Number(tx.amount || tx.fareAmount || 0),
            );
          }
        }
      }

      const maxDayAmount = Math.max(...Object.values(dayTotals), 0);
      const calculatedWeekly: WeeklyBarData[] = [
        'Lun',
        'Mar',
        'Mie',
        'Jue',
        'Vie',
        'Sab',
        'Dom',
      ].map((day) => {
        const amount = dayTotals[day];
        let height = '0%';
        if (maxDayAmount > 0 && amount > 0) {
          const pct = Math.round((amount / maxDayAmount) * 100);
          height = `${Math.max(pct, 12)}%`;
        }
        return {
          day,
          amount: `${amount.toFixed(0)} Bs`,
          height,
        };
      });

      setWeeklyData(calculatedWeekly);
    } catch (err) {
      console.warn('[Earnings] Error calculating fleet earnings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEarningsData();
  }, [loadEarningsData]);

  useFocusEffect(
    useCallback(() => {
      loadEarningsData();
    }, [loadEarningsData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEarningsData();
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

  if (loading && !refreshing) {
    return <AppLoadingScreen message="Cargando ingresos de la flota..." />;
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[tokens.colors.primary]}
          />
        }
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
              totalEarnings > 0
                ? styles.payoutBtnActive
                : styles.payoutBtnDisabled,
              pressed &&
                totalEarnings > 0 && {
                  opacity: 0.9,
                  transform: [{ scale: 0.98 }],
                },
            ]}
            onPress={handleRequestPayout}
            disabled={totalEarnings <= 0}
          >
            <Ionicons
              name={totalEarnings > 0 ? 'card' : 'wallet-outline'}
              size={18}
              color={totalEarnings > 0 ? tokens.colors.primary : '#94A3B8'}
              style={{ marginRight: 8 }}
            />
            <Text
              style={[
                styles.payoutBtnText,
                totalEarnings <= 0 && styles.payoutBtnTextDisabled,
              ]}
            >
              Cobrar Ingresos Acumulados
            </Text>
          </Pressable>
        </View>

        {/* weekly chart */}
        <Text style={styles.sectionTitle}>Ingresos Semanales</Text>
        <View style={styles.chartCard}>
          <View style={styles.chartBarsContainer}>
            {weeklyData.map((data) => (
              <View key={data.day} style={styles.chartCol}>
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
          {recentTx.length === 0 ? (
            <View style={styles.emptyActivityContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="receipt-outline" size={28} color="#94A3B8" />
              </View>
              <Text style={styles.emptyActivityTitle}>
                Sin cobros registrados
              </Text>
              <Text style={styles.emptyActivitySubtitle}>
                Los cobros de pasajes generados por tus unidades y conductores
                aparecerán aquí automáticamente en tiempo real.
              </Text>
            </View>
          ) : (
            recentTx.map((tx, idx) => (
              <View
                key={tx.id}
                style={[
                  styles.txRow,
                  idx === recentTx.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
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
            ))
          )}
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
    backgroundColor: '#0F172A',
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
    borderRadius: 16,
    height: 52,
    width: '100%',
  },
  payoutBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  payoutBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  payoutBtnText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  payoutBtnTextDisabled: {
    color: '#94A3B8',
    fontFamily: tokens.typography.fontFamily.medium,
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
  emptyActivityContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyActivityTitle: {
    fontSize: 14.5,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
    marginBottom: 4,
  },
  emptyActivitySubtitle: {
    fontSize: 12.5,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
});
