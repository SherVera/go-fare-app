import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  BackendTicket,
  Trip,
  TripFilter,
  TripSummary,
} from '@/interfaces';
import {
  getAccountTransactions,
  getBackendProfile,
  getFareAccountByUserId,
  getUserTickets,
} from '@/lib/api';
import { tokens } from '@/theme/tokens';

export default function TripsScreen() {
  const [activeTab, setActiveTab] = useState<'trips' | 'transactions'>('trips');
  const [activeFilter, setActiveFilter] = useState<TripFilter['value']>('all');
  const [tickets, setTickets] = useState<BackendTicket[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros de período — tipados con TripFilter
  const filters: TripFilter[] = [
    { label: 'Todos', value: 'all' },
    { label: 'Este mes', value: 'month' },
    { label: 'Este año', value: 'year' },
  ];

  const fetchTicketsData = useCallback(async () => {
    try {
      const backendUser = await getBackendProfile();
      if (backendUser) {
        // 1. Obtener viajes / boletos
        const userTickets = await getUserTickets(backendUser.id);
        userTickets.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setTickets(userTickets);

        // 2. Obtener cuenta de tarifa e historial de transacciones de recarga/débito
        try {
          const account = await getFareAccountByUserId(backendUser.id);
          if (account) {
            const userTxs = await getAccountTransactions(account.id);
            userTxs.sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            );
            setTransactions(userTxs);
          }
        } catch (txErr) {
          console.warn('[Trips] Error fetching transactions:', txErr);
        }
      }
    } catch (error) {
      console.error('[Trips] Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTicketsData();
    }, [fetchTicketsData]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTicketsData();
  };

  // Resumen dinámico de viajes calculado a partir de la API
  const totalSpent = tickets
    .filter((t) => t.status === 'used')
    .reduce((sum, t) => sum + t.price, 0);
  const tripsCount = tickets.filter((t) => t.status === 'used').length;

  // Encontrar la ruta más frecuente
  const routeCounts: Record<string, number> = {};
  tickets.forEach((t) => {
    const routeName = t.route || 'General';
    routeCounts[routeName] = (routeCounts[routeName] || 0) + 1;
  });
  let mostFrequentRoute = 'Ninguno';
  let maxCount = 0;
  Object.entries(routeCounts).forEach(([route, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostFrequentRoute = route;
    }
  });

  const tripSummary: TripSummary = {
    totalSpent,
    tripsCount,
    mostFrequentRoute,
  };

  // Filtrado de boletos por tiempo
  const filteredTickets = tickets.filter((t) => {
    const ticketDate = new Date(t.createdAt);
    const now = new Date();
    if (activeFilter === 'month') {
      return (
        ticketDate.getMonth() === now.getMonth() &&
        ticketDate.getFullYear() === now.getFullYear()
      );
    }
    if (activeFilter === 'year') {
      return ticketDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  // Filtrado de transacciones por tiempo
  const filteredTransactions = transactions.filter((tx) => {
    const txDate = new Date(tx.createdAt);
    const now = new Date();
    if (activeFilter === 'month') {
      return (
        txDate.getMonth() === now.getMonth() &&
        txDate.getFullYear() === now.getFullYear()
      );
    }
    if (activeFilter === 'year') {
      return txDate.getFullYear() === now.getFullYear();
    }
    return true;
  });
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GoFair</Text>
        <Image
          source={{ uri: 'https://i.pravatar.cc/150?img=11' }}
          style={styles.avatar}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* ── TITULO ── */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Actividad</Text>
          <Text style={styles.pageSubtitle}>
            Revisa tus viajes, recargas y transacciones monetarias.
          </Text>
        </View>

        {/* ── SEGMENTED CONTROL ── */}
        <View style={styles.segmentContainer}>
          <Pressable
            style={[
              styles.segmentBtn,
              activeTab === 'trips' && styles.segmentBtnActive,
            ]}
            onPress={() => setActiveTab('trips')}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'trips' && styles.segmentTextActive,
              ]}
            >
              Viajes
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segmentBtn,
              activeTab === 'transactions' && styles.segmentBtnActive,
            ]}
            onPress={() => setActiveTab('transactions')}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'transactions' && styles.segmentTextActive,
              ]}
            >
              Transacciones
            </Text>
          </Pressable>
        </View>

        {/* ── FILTROS ── */}
        <View style={styles.filtersContainer}>
          {filters.map((filter) => {
            const isActive = activeFilter === filter.value;
            return (
              <Pressable
                key={filter.value}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setActiveFilter(filter.value)}
              >
                <Text
                  style={[
                    styles.filterText,
                    isActive && styles.filterTextActive,
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* CONTENIDO DE VIAJES (TRIPS) */}
        {activeTab === 'trips' && (
          <View>
            {/* ── RESUMEN CARDS ── */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCardWhite}>
                <View style={styles.summaryIconWhiteBg}>
                  <MaterialCommunityIcons
                    name="cash"
                    size={24}
                    color={tokens.colors.primary}
                  />
                </View>
                <Text style={styles.summaryLabelGrey}>GASTO TOTAL</Text>
                <Text style={styles.summaryValueDark}>
                  Bs. {tripSummary.totalSpent.toFixed(2).replace('.', ',')}
                </Text>
              </View>

              <View style={styles.summaryCardBlue}>
                <View style={styles.summaryIconBlueBg}>
                  <Ionicons name="bus" size={22} color="#FFFFFF" />
                </View>
                <Text style={styles.summaryLabelLight}>VIAJES REALIZADOS</Text>
                <Text style={styles.summaryValueLight}>
                  {tripSummary.tripsCount}
                </Text>
              </View>
            </View>

            {/* ── LISTA VIAJES RECIENTES ── */}
            <Text style={styles.sectionTitle}>HISTORIAL DE VIAJES</Text>

            {loading ? (
              <ActivityIndicator
                size="large"
                color={tokens.colors.primary}
                style={{ marginTop: 24, marginBottom: 24 }}
              />
            ) : filteredTickets.length === 0 ? (
              <View style={styles.noTripsContainer}>
                <Ionicons name="bus-outline" size={48} color="#9CA3AF" />
                <Text style={styles.noTripsText}>
                  No se encontraron boletos ni viajes registrados en este
                  período.
                </Text>
              </View>
            ) : (
              filteredTickets.map((ticket) => {
                const isUsed = ticket.status === 'used';
                const ticketDate = new Date(ticket.createdAt);
                const formattedDate = ticketDate.toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <View key={ticket.id} style={styles.tripCard}>
                    <View
                      style={[
                        styles.tripIconWrapper,
                        { backgroundColor: isUsed ? '#F3F4F6' : '#EFF6FF' },
                      ]}
                    >
                      <Ionicons
                        name="bus"
                        size={20}
                        color={isUsed ? '#6B7280' : tokens.colors.primary}
                      />
                    </View>
                    <View style={styles.tripInfo}>
                      <Text style={styles.tripTitle}>
                        {ticket.route || 'Boleto General'}
                      </Text>
                      <View style={styles.tripSubtitleRow}>
                        <Text style={styles.tripSubtitle}>{formattedDate}</Text>
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: isUsed ? '#F3F4F6' : '#DBEAFE' },
                          ]}
                        >
                          <View
                            style={[
                              styles.badgeDot,
                              {
                                backgroundColor: isUsed
                                  ? '#9CA3AF'
                                  : tokens.colors.primary,
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.badgeText,
                              {
                                color: isUsed
                                  ? '#6B7280'
                                  : tokens.colors.primary,
                              },
                            ]}
                          >
                            {isUsed ? 'COMPLETADO' : 'ACTIVO'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.priceContainer}>
                      <Text
                        style={[
                          styles.priceCurrency,
                          { color: isUsed ? '#6B7280' : tokens.colors.primary },
                        ]}
                      >
                        Bs.
                      </Text>
                      <Text
                        style={[
                          styles.priceAmount,
                          { color: isUsed ? '#4B5563' : tokens.colors.primary },
                        ]}
                      >
                        {ticket.price.toFixed(2).replace('.', ',')}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}

            {/* ── MAPA RUTA FRECUENTE ── */}
            <View style={styles.mapCard}>
              <Image
                source={{
                  uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80',
                }}
                style={styles.mapImage}
              />
              <View style={styles.mapOverlay}>
                <Text style={styles.mapText}>
                  Tu ruta más frecuente:{' '}
                  <Text style={styles.mapTextHighlight}>Chacao - Mercedes</Text>
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* CONTENIDO DE TRANSACCIONES (MONEY FLOW) */}
        {activeTab === 'transactions' && (
          <View>
            <Text style={styles.sectionTitle}>HISTORIAL DE MOVIMIENTOS</Text>

            {loading ? (
              <ActivityIndicator
                size="large"
                color={tokens.colors.primary}
                style={{ marginTop: 24, marginBottom: 24 }}
              />
            ) : filteredTransactions.length === 0 ? (
              <View style={styles.noTripsContainer}>
                <Ionicons name="card-outline" size={48} color="#9CA3AF" />
                <Text style={styles.noTripsText}>
                  No se encontraron recargas ni transacciones registradas en
                  este período.
                </Text>
              </View>
            ) : (
              filteredTransactions.map((tx) => {
                const isCredit = tx.type === 'credit';
                const txDate = new Date(tx.createdAt);
                const formattedDate = txDate.toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <View key={tx.id} style={styles.tripCard}>
                    <View
                      style={[
                        styles.tripIconWrapper,
                        { backgroundColor: isCredit ? '#ECFDF5' : '#FEF2F2' },
                      ]}
                    >
                      <Ionicons
                        name={isCredit ? 'wallet' : 'bus'}
                        size={20}
                        color={isCredit ? '#10B981' : '#EF4444'}
                      />
                    </View>
                    <View style={styles.tripInfo}>
                      <Text style={styles.tripTitle}>
                        {isCredit ? 'Recarga de Saldo' : 'Débito por Viaje'}
                      </Text>
                      <Text style={styles.tripSubtitle}>
                        {tx.description ||
                          (isCredit
                            ? 'Saldo adicionado'
                            : 'Pago por viaje en bus')}
                      </Text>
                      <Text style={[styles.tripSubtitle, { marginTop: 4 }]}>
                        {formattedDate}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.priceContainer,
                        { minWidth: 70, alignItems: 'flex-end' },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          fontFamily: tokens.typography.fontFamily.black,
                          color: isCredit ? '#10B981' : '#EF4444',
                        }}
                      >
                        {isCredit ? '+' : '-'} Bs.{' '}
                        {Number(tx.amount || 0)
                          .toFixed(2)
                          .replace('.', ',')}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  menuBtn: {
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  titleSection: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 32,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.textDark,
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.regular,
    color: tokens.colors.textGray,
  },
  filtersContainer: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  filterTab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#E2E8F0',
    borderRadius: 24,
    marginRight: 12,
  },
  filterTabActive: {
    backgroundColor: tokens.colors.primary,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  filterText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#4B5563',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontFamily: tokens.typography.fontFamily.bold,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 36,
  },
  summaryCardWhite: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  summaryCardBlue: {
    flex: 1,
    backgroundColor: tokens.colors.primary,
    borderRadius: 24,
    padding: 20,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  summaryIconWhiteBg: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
  },
  summaryIconBlueBg: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
  },
  summaryLabelGrey: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValueDark: {
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.textDark,
  },
  summaryLabelLight: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValueLight: {
    fontSize: 24,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#6B7280',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  tripCardActive: {
    borderColor: '#E0E7FF',
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.primary,
  },
  tripIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  tripInfo: {
    flex: 1,
    marginRight: 8,
  },
  tripTitle: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
    marginBottom: 6,
  },
  tripSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  tripSubtitle: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#9CA3AF',
    marginRight: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  priceContainer: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    minWidth: 45,
  },
  priceCurrency: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    marginBottom: -2,
  },
  priceAmount: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.black,
  },
  mapCard: {
    height: 160,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: '#E2E8F0',
  },
  mapImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    opacity: 0.8,
  },
  mapOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  mapText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  mapTextHighlight: {
    color: '#93C5FD', // light blue to pop on dark overlay
  },
  noTripsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    marginTop: 8,
    marginBottom: 24,
  },
  noTripsText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
  },
  segmentTextActive: {
    color: tokens.colors.primary,
  },
});
