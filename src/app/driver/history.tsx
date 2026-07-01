import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentSession, getSessionRides, getAllUsers, getAllTransactions, getFareAccountByUserId } from '@/lib/api';
import { tokens } from '@/theme/tokens';

export default function DriverHistoryScreen() {
  const [validations, setValidations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const loadValidations = useCallback(async () => {
    try {
      const session = await getCurrentSession();
      if (session && session.uuid) {
        setTotalEarnings(Number(session.totalFares) || 0);
        setTotalCount(Number(session.ridesCount) || 0);

        const rides = await getSessionRides(session.uuid);

        try {
          // Obtener usuarios y transacciones
          const [users, transactions] = await Promise.all([
            getAllUsers(),
            getAllTransactions()
          ]);

          // Cargar cachés de mapeo desde AsyncStorage
          const cacheKey = 'gofare_account_to_user_uuid_cache';
          const resolvedKey = 'gofare_resolved_user_uuids';

          const cacheStr = await AsyncStorage.getItem(cacheKey);
          const resolvedStr = await AsyncStorage.getItem(resolvedKey);

          const accountToUserUuidCache = cacheStr ? JSON.parse(cacheStr) : {};
          const resolvedUserUuids = resolvedStr ? JSON.parse(resolvedStr) : [];
          const resolvedUserUuidsSet = new Set(resolvedUserUuids);

          let cacheUpdated = false;

          for (const ride of rides) {
            // Si el backend ya retorna el pasajero (por ejemplo, en local o futuras actualizaciones), lo respetamos
            if (ride.passenger && (ride.passenger.displayName || ride.passenger.nationalId)) {
              continue;
            }

            // Buscar la transacción correspondiente a este cobro (ride)
            // La descripción de la transacción es "Pasaje <ride_uuid>"
            const tx = transactions.find(
              (t) =>
                t.transactionType === 'ride_payment' &&
                t.description &&
                ride.uuid &&
                t.description.includes(ride.uuid)
            );

            if (tx && tx.fareAccount && tx.fareAccount.uuid) {
              const accountUuid = tx.fareAccount.uuid;
              let userUuid = accountToUserUuidCache[accountUuid];

              if (!userUuid) {
                const unresolvedUsers = users.filter((u) => u.uuid && !resolvedUserUuidsSet.has(u.uuid));

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
                        break; // Encontrado, detenemos la búsqueda para este ride
                      }
                    }
                  } catch (_e) {
                    // El usuario no tiene cuenta de tarifa creada
                  }
                }
              }

              // Si logramos resolver el userUuid, asociar el usuario del listado actual al ride
              if (userUuid) {
                const foundUser = users.find((u) => u.uuid === userUuid);
                if (foundUser) {
                  ride.passenger = foundUser;
                }
              }
            }
          }

          // Guardar cachés actualizados
          if (cacheUpdated) {
            await AsyncStorage.setItem(cacheKey, JSON.stringify(accountToUserUuidCache));
            await AsyncStorage.setItem(resolvedKey, JSON.stringify(resolvedUserUuids));
          }
        } catch (apiErr) {
          console.warn('[DriverHistory] Error resolving passenger details via API fallback:', apiErr);
        }

        // Ordenar por fecha de creación descendente para mostrar cobros recientes arriba
        const sortedRides = [...rides].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setValidations(sortedRides);
      } else {
        setValidations([]);
        setTotalEarnings(0);
        setTotalCount(0);
      }
    } catch (err) {
      console.warn('[DriverHistory] Error loading validated tickets:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);


  useFocusEffect(
    useCallback(() => {
      loadValidations();
    }, [loadValidations]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadValidations();
  };

  const renderItem = ({ item }: { item: any }) => {
    const passengerName =
      item.passenger?.displayName ||
      `${item.passenger?.firstName || ''} ${item.passenger?.lastName || ''}`.trim() ||
      'Pasajero';

    const passengerCedula = item.passenger?.nationalId 
      ? `C.I. ${item.passenger.nationalId}` 
      : 'C.I. No registrada';

    // Determinar iniciales del pasajero
    const initials = passengerName
      .split(' ')
      .map((name: string) => name[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);

    const routeName = item.route?.name || 'General';

    // Formatear fecha y hora
    const dateObj = new Date(item.createdAt);
    const dateStr = dateObj.toLocaleDateString('es-VE');
    const timeStr = dateObj.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          {/* Avatar circular con iniciales del pasajero */}
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{initials || 'P'}</Text>
          </View>

          {/* Información del cobro */}
          <View style={styles.infoContainer}>
            <Text style={styles.passengerText}>{passengerName}</Text>
            <Text style={styles.cedulaText}>{passengerCedula}</Text>
            <Text style={styles.routeText} numberOfLines={1}>
              {routeName}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons
                name="time-outline"
                size={12}
                color="#64748B"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.metaText}>
                {dateStr} • {timeStr}
              </Text>
            </View>
          </View>

          {/* Tarifa cobrada */}
          <View style={styles.fareContainer}>
            <Text style={styles.fareText}>+{Number(item.fareCost).toFixed(2)} fares</Text>
            <Text style={styles.codeTextMono} numberOfLines={1}>
              GF-{item.uuid?.substring(0, 8).toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
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
        <Text style={styles.headerTitle}>Historial de Viajes</Text>
      </View>

      {/* Estadísticas superiores */}
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>RESUMEN DE HOY</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{totalCount}</Text>
            <Text style={styles.statLabel}>Boletos Validados</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: '#16A34A' }]}>
              {totalEarnings.toFixed(2)} fares
            </Text>
            <Text style={styles.statLabel}>Total Recaudado</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Cobros Recientes</Text>

      <FlatList
        data={validations}
        keyExtractor={(item) => item.uuid}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[tokens.colors.primary]}
            tintColor={tokens.colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <Ionicons name="bus-outline" size={48} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>Ningún cobro registrado aún</Text>
            <Text style={styles.emptySubtitle}>
              Cuando valides los códigos QR de los pasajeros, sus boletos
              aparecerán listados cronológicamente aquí.
            </Text>
          </View>
        }
      />
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
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 20,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  statsTitle: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 0.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#1E293B',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  verticalDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 12,
    marginHorizontal: 24,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 110, // Margen para que las tabs no tapen el contenido
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  infoContainer: {
    flex: 1,
    marginRight: 8,
  },
  passengerText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
    marginBottom: 2,
  },
  cedulaText: {
    fontSize: 11.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginBottom: 2,
  },
  routeText: {
    fontSize: 11.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 10.5,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
  },
  fareContainer: {
    alignItems: 'flex-end',
  },
  fareText: {
    fontSize: 14.5,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#16A34A',
    marginBottom: 2,
  },
  codeTextMono: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#94A3B8',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 16,
  },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
