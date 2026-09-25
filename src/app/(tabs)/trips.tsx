import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLiteMode } from '@/context/LiteModeContext';
import type { BackendTicket, TripFilter, TripSummary } from '@/interfaces';
import {
  getAccountTransactions,
  getBackendProfile,
  getFareAccountByUserId,
  getRidePaymentMetas,
  getUserTickets,
  type RidePaymentMeta,
  verifyAuthStatus,
} from '@/lib/api';
import { CACHE_KEYS, getLiteCache, setLiteCache } from '@/lib/api-cache';
import { purgeUserSessionAndLogout } from '@/lib/auth-session';
import { tokens } from '@/theme/tokens';

const tripDateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const formatTicketAmount = (amount: number): string => {
  const isInteger = amount % 1 === 0;
  const formatted = isInteger
    ? amount.toString()
    : amount.toFixed(2).replace('.', ',');
  const unit = Math.abs(amount) === 1 ? 'Ticket' : 'Tickets';
  return `${formatted} ${unit}`;
};

const splitTicketAmount = (amount: number): { value: string; unit: string } => {
  const abs = Math.abs(amount);
  const isInteger = abs % 1 === 0;
  const value = isInteger ? abs.toString() : abs.toFixed(2).replace('.', ',');
  const unit = abs === 1 ? 'Ticket' : 'Tickets';
  return { value, unit };
};

const MAX_QUERY_LIMIT = 50;
const PAGE_SIZE = 15;

export default function TripsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { isLiteMode } = useLiteMode();
  const [activeTab, setActiveTab] = useState<'trips' | 'transactions'>(
    params.tab === 'transactions' || params.tab === 'payments'
      ? 'transactions'
      : 'trips',
  );
  const [activeFilter, setActiveFilter] =
    useState<TripFilter['value']>('month');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<
    'all' | 'credit' | 'debit'
  >('all');
  const [tickets, setTickets] = useState<BackendTicket[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleTripsCount, setVisibleTripsCount] = useState(PAGE_SIZE);
  const [visibleTxsCount, setVisibleTxsCount] = useState(PAGE_SIZE);
  const [rideMetas, setRideMetas] = useState<Record<string, RidePaymentMeta>>(
    {},
  );

  useEffect(() => {
    if (params.tab === 'transactions' || params.tab === 'payments') {
      setActiveTab('transactions');
    } else {
      setActiveTab('trips');
    }
  }, [params.tab]);

  // Reiniciar la paginación progresiva al cambiar de filtro
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset pagination when filters change
  useEffect(() => {
    setVisibleTripsCount(PAGE_SIZE);
    setVisibleTxsCount(PAGE_SIZE);
  }, [activeFilter, transactionTypeFilter]);

  // Filtros de período — ordenados: Este mes, este año y Todos
  const filters: TripFilter[] = [
    { label: 'Este mes', value: 'month' },
    { label: 'Este año', value: 'year' },
    { label: 'Todos', value: 'all' },
  ];

  const fetchTicketsData = useCallback(
    async (isManualRefresh = false) => {
      // 1. Verificar primero si el usuario está autenticado y su token GoFare está vigente
      const authStatus = await verifyAuthStatus();
      if (!authStatus.isAuthenticated) {
        await purgeUserSessionAndLogout();
        router.replace('/login');
        return;
      }

      // 2. En Modo Lite: si tenemos datos en caché y no es actualización manual, usar caché instantáneo
      if (isLiteMode && !isManualRefresh) {
        const cachedTickets = await getLiteCache<BackendTicket[]>(
          CACHE_KEYS.TICKETS,
        );
        const cachedTxs = await getLiteCache<any[]>(CACHE_KEYS.TRANSACTIONS);

        if (cachedTickets && cachedTxs) {
          setTickets(cachedTickets);
          setTransactions(cachedTxs);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      try {
        const backendUser = await getBackendProfile();
        if (backendUser) {
          // 1. Obtener viajes / boletos con límite para evitar colapso de memoria
          const userTickets = await getUserTickets(
            backendUser.id,
            MAX_QUERY_LIMIT,
          );
          userTickets.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          const cappedTickets = userTickets.slice(0, MAX_QUERY_LIMIT);
          setTickets(cappedTickets);
          await setLiteCache(CACHE_KEYS.TICKETS, cappedTickets);

          // 2. Obtener cuenta de tarifa e historial de transacciones con límite
          try {
            const account = await getFareAccountByUserId(backendUser.id);
            if (account) {
              const userTxs = await getAccountTransactions(
                account.id,
                MAX_QUERY_LIMIT,
              );
              userTxs.sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime(),
              );
              const cappedTxs = userTxs.slice(0, MAX_QUERY_LIMIT);
              setTransactions(cappedTxs);
              await setLiteCache(CACHE_KEYS.TRANSACTIONS, cappedTxs);
            }
          } catch (txErr) {
            console.warn('[Trips] Error fetching transactions:', txErr);
          }

          // Cargar metadatos persistentes de conductores
          try {
            const metas = await getRidePaymentMetas();
            setRideMetas(metas);
          } catch {}
        }
      } catch (error: any) {
        console.error('[Trips] Error fetching data:', error);
        if (
          error?.status === 401 ||
          error?.message?.includes('401') ||
          error?.message?.includes('expired') ||
          error?.message?.includes('No authenticated user')
        ) {
          await purgeUserSessionAndLogout();
          router.replace('/login');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isLiteMode, router],
  );

  useFocusEffect(
    useCallback(() => {
      if (params.tab === 'transactions' || params.tab === 'payments') {
        setActiveTab('transactions');
      } else {
        setActiveTab('trips');
      }
      fetchTicketsData(false);
    }, [params.tab, fetchTicketsData]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    setVisibleTripsCount(PAGE_SIZE);
    setVisibleTxsCount(PAGE_SIZE);
    fetchTicketsData(true);
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

  // Totales de recargas y pagos en el período
  const totalRecharged = filteredTransactions
    .filter((tx) => tx.type === 'credit')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const totalPaid = filteredTransactions
    .filter((tx) => tx.type === 'debit')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const rechargedData = splitTicketAmount(totalRecharged);
  const paidData = splitTicketAmount(totalPaid);
  const spentData = splitTicketAmount(tripSummary.totalSpent);

  // Transacciones finales filtradas por tipo (Todos, Solo Recargas, Solo Pagos)
  const displayTransactions = filteredTransactions.filter((tx) => {
    if (transactionTypeFilter === 'credit') return tx.type === 'credit';
    if (transactionTypeFilter === 'debit') return tx.type === 'debit';
    return true;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={{ marginRight: 16, paddingVertical: 4 }}
        >
          <Ionicons name="arrow-back" size={24} color={tokens.colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>GoFare</Text>
        <Image
          source={{ uri: 'https://i.pravatar.cc/150?img=11' }}
          style={styles.avatar}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[tokens.colors.primary]}
            tintColor={tokens.colors.primary}
          />
        }
      >
        {/* ── TITULO ── */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>
            {activeTab === 'trips' ? 'Actividad de Viajes' : 'Pagos y Recargas'}
          </Text>
          <Text style={styles.pageSubtitle}>
            {activeTab === 'trips'
              ? 'Revisa tus viajes y boletos validados en el transporte.'
              : 'Historial de recargas de saldo y pagos realizados en la plataforma.'}
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
            <View style={styles.segmentBtnInner}>
              <Ionicons
                name="bus"
                size={16}
                color={
                  activeTab === 'trips' ? tokens.colors.primary : '#64748B'
                }
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.segmentText,
                  activeTab === 'trips' && styles.segmentTextActive,
                ]}
              >
                Viajes
              </Text>
            </View>
          </Pressable>
          <Pressable
            style={[
              styles.segmentBtn,
              activeTab === 'transactions' && styles.segmentBtnActive,
            ]}
            onPress={() => setActiveTab('transactions')}
          >
            <View style={styles.segmentBtnInner}>
              <Ionicons
                name="receipt"
                size={16}
                color={
                  activeTab === 'transactions'
                    ? tokens.colors.primary
                    : '#64748B'
                }
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.segmentText,
                  activeTab === 'transactions' && styles.segmentTextActive,
                ]}
              >
                Pagos y Recargas
              </Text>
            </View>
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
                <View style={styles.summaryIconContainerWhite}>
                  <MaterialCommunityIcons
                    name="ticket-confirmation"
                    size={20}
                    color={tokens.colors.primary}
                  />
                </View>
                <Text style={styles.summaryLabelGrey}>TICKETS CONSUMIDOS</Text>
                <View style={styles.summaryValueBlock}>
                  <Text
                    style={[
                      styles.summaryNumberText,
                      { color: tokens.colors.textDark },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {spentData.value}
                  </Text>
                  <View style={styles.unitBadgePrimary}>
                    <MaterialCommunityIcons
                      name="ticket-confirmation-outline"
                      size={12}
                      color={tokens.colors.primary}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.unitBadgePrimaryText}>
                      {spentData.unit}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.summaryCardBlue}>
                <View style={styles.summaryIconContainerBlue}>
                  <Ionicons name="bus" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.summaryLabelLight}>VIAJES REALIZADOS</Text>
                <View style={styles.summaryValueBlock}>
                  <Text
                    style={[styles.summaryNumberText, { color: '#FFFFFF' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {tripSummary.tripsCount}
                  </Text>
                  <View style={styles.unitBadgeBlue}>
                    <Ionicons
                      name="navigate-outline"
                      size={12}
                      color="#FFFFFF"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.unitBadgeBlueText}>
                      {tripSummary.tripsCount === 1 ? 'Viaje' : 'Viajes'}
                    </Text>
                  </View>
                </View>
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
                  No se encontraron tickets ni viajes registrados en este
                  período.
                </Text>
              </View>
            ) : (
              <>
                {filteredTickets.slice(0, visibleTripsCount).map((ticket) => {
                  const isUsed = ticket.status === 'used';
                  const ticketDate = new Date(ticket.createdAt);
                  const formattedDate = tripDateFormatter.format(ticketDate);
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
                          {ticket.route || 'Fare General'}
                        </Text>
                        <View style={styles.tripSubtitleRow}>
                          <Text style={styles.tripSubtitle}>
                            {formattedDate}
                          </Text>
                          <View
                            style={[
                              styles.badge,
                              {
                                backgroundColor: isUsed ? '#F3F4F6' : '#DBEAFE',
                              },
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
                      <View
                        style={[
                          styles.priceContainer,
                          { minWidth: 80, alignItems: 'flex-end' },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontFamily: tokens.typography.fontFamily.black,
                            color: isUsed ? '#4B5563' : tokens.colors.primary,
                          }}
                        >
                          {formatTicketAmount(Number(ticket.price || 1))}
                        </Text>
                      </View>
                    </View>
                  );
                })}

                {filteredTickets.length > visibleTripsCount && (
                  <Pressable
                    style={styles.loadMoreBtn}
                    onPress={() =>
                      setVisibleTripsCount((prev) => prev + PAGE_SIZE)
                    }
                  >
                    <Ionicons
                      name="chevron-down-circle-outline"
                      size={18}
                      color={tokens.colors.primary}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.loadMoreBtnText}>
                      Ver más viajes (
                      {Math.min(visibleTripsCount, filteredTickets.length)} de{' '}
                      {filteredTickets.length})
                    </Text>
                  </Pressable>
                )}

                {filteredTickets.length >= MAX_QUERY_LIMIT &&
                  visibleTripsCount >= filteredTickets.length && (
                    <View style={styles.limitInfoBox}>
                      <Ionicons
                        name="information-circle-outline"
                        size={16}
                        color="#94A3B8"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.limitInfoText}>
                        Mostrando los {MAX_QUERY_LIMIT} viajes más recientes.
                      </Text>
                    </View>
                  )}
              </>
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

        {/* CONTENIDO DE TRANSACCIONES (PAGOS Y RECARGAS) */}
        {activeTab === 'transactions' && (
          <View>
            {/* ── RESUMEN CARDS (RECARGAS Y PAGOS) ── */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCardGreen}>
                <View style={styles.summaryIconContainerGreen}>
                  <Ionicons name="arrow-down" size={18} color="#059669" />
                </View>
                <Text style={[styles.summaryLabelGrey, { color: '#059669' }]}>
                  TOTAL RECARGADO
                </Text>
                <View style={styles.summaryValueBlock}>
                  <Text
                    style={[styles.summaryNumberText, { color: '#047857' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    + {rechargedData.value}
                  </Text>
                  <View style={styles.unitBadgeGreen}>
                    <MaterialCommunityIcons
                      name="ticket-confirmation-outline"
                      size={12}
                      color="#059669"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.unitBadgeGreenText}>
                      {rechargedData.unit}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.summaryCardBlue}>
                <View style={styles.summaryIconContainerBlue}>
                  <MaterialCommunityIcons
                    name="ticket-confirmation"
                    size={18}
                    color="#FFFFFF"
                  />
                </View>
                <Text style={styles.summaryLabelLight}>PAGOS DE PASAJE</Text>
                <View style={styles.summaryValueBlock}>
                  <Text
                    style={[styles.summaryNumberText, { color: '#FFFFFF' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    - {paidData.value}
                  </Text>
                  <View style={styles.unitBadgeBlue}>
                    <MaterialCommunityIcons
                      name="ticket-confirmation-outline"
                      size={12}
                      color="#FFFFFF"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.unitBadgeBlueText}>
                      {paidData.unit}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── FILTROS POR TIPO (TODOS, RECARGAS, PAGOS) ── */}
            <View style={styles.typeFilterWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.typeFilterScroll}
              >
                <Pressable
                  style={[
                    styles.typeChip,
                    transactionTypeFilter === 'all' && styles.typeChipActive,
                  ]}
                  onPress={() => setTransactionTypeFilter('all')}
                >
                  <Ionicons
                    name="list"
                    size={14}
                    color={
                      transactionTypeFilter === 'all' ? '#FFFFFF' : '#64748B'
                    }
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.typeChipText,
                      transactionTypeFilter === 'all' &&
                        styles.typeChipTextActive,
                    ]}
                  >
                    Todos
                  </Text>
                  <View
                    style={[
                      styles.typeChipBadge,
                      transactionTypeFilter === 'all' &&
                        styles.typeChipBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeChipBadgeText,
                        transactionTypeFilter === 'all' &&
                          styles.typeChipBadgeTextActive,
                      ]}
                    >
                      {filteredTransactions.length}
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  style={[
                    styles.typeChip,
                    transactionTypeFilter === 'credit' && styles.typeChipActive,
                  ]}
                  onPress={() => setTransactionTypeFilter('credit')}
                >
                  <Ionicons
                    name="arrow-down"
                    size={14}
                    color={
                      transactionTypeFilter === 'credit' ? '#FFFFFF' : '#10B981'
                    }
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.typeChipText,
                      transactionTypeFilter === 'credit' &&
                        styles.typeChipTextActive,
                    ]}
                  >
                    Recargas
                  </Text>
                  <View
                    style={[
                      styles.typeChipBadge,
                      transactionTypeFilter === 'credit' &&
                        styles.typeChipBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeChipBadgeText,
                        transactionTypeFilter === 'credit' &&
                          styles.typeChipBadgeTextActive,
                      ]}
                    >
                      {
                        filteredTransactions.filter((t) => t.type === 'credit')
                          .length
                      }
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  style={[
                    styles.typeChip,
                    transactionTypeFilter === 'debit' && styles.typeChipActive,
                  ]}
                  onPress={() => setTransactionTypeFilter('debit')}
                >
                  <Ionicons
                    name="arrow-up"
                    size={14}
                    color={
                      transactionTypeFilter === 'debit' ? '#FFFFFF' : '#EF4444'
                    }
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.typeChipText,
                      transactionTypeFilter === 'debit' &&
                        styles.typeChipTextActive,
                    ]}
                  >
                    Pagos
                  </Text>
                  <View
                    style={[
                      styles.typeChipBadge,
                      transactionTypeFilter === 'debit' &&
                        styles.typeChipBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeChipBadgeText,
                        transactionTypeFilter === 'debit' &&
                          styles.typeChipBadgeTextActive,
                      ]}
                    >
                      {
                        filteredTransactions.filter((t) => t.type === 'debit')
                          .length
                      }
                    </Text>
                  </View>
                </Pressable>
              </ScrollView>
            </View>

            {/* ── LISTA DE MOVIMIENTOS ── */}
            <Text style={styles.sectionTitle}>
              {transactionTypeFilter === 'credit'
                ? 'HISTORIAL DE RECARGAS'
                : transactionTypeFilter === 'debit'
                  ? 'HISTORIAL DE PAGOS'
                  : 'HISTORIAL DE MOVIMIENTOS'}
            </Text>

            {loading ? (
              <ActivityIndicator
                size="large"
                color={tokens.colors.primary}
                style={{ marginTop: 24, marginBottom: 24 }}
              />
            ) : displayTransactions.length === 0 ? (
              <View style={styles.noTripsContainer}>
                <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
                <Text style={styles.noTripsText}>
                  {transactionTypeFilter === 'credit'
                    ? 'No se encontraron recargas en este período.'
                    : transactionTypeFilter === 'debit'
                      ? 'No se encontraron pagos de pasaje en este período.'
                      : 'No se encontraron pagos ni recargas registrados en este período.'}
                </Text>
                <Pressable
                  style={styles.emptyActionBtn}
                  onPress={() => router.push('/(tabs)/topup')}
                >
                  <Text style={styles.emptyActionBtnText}>Recargar Saldo</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {displayTransactions.slice(0, visibleTxsCount).map((tx) => {
                  const isCredit = tx.type === 'credit';
                  const txDate = new Date(tx.createdAt);
                  const formattedDate = tripDateFormatter.format(txDate);

                  // Resolver nombre del conductor evitando mostrar UUIDs de base de datos
                  const rideUuidMatch = (tx.description || '').match(
                    /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/,
                  );
                  const rideUuid = rideUuidMatch
                    ? rideUuidMatch[1]
                    : tx.rideId || tx.rideUuid || '';
                  const meta = rideUuid ? rideMetas[rideUuid] : undefined;

                  const resolvedDriverName =
                    tx.driverName ||
                    tx.driver?.name ||
                    meta?.driverName ||
                    (tx.description &&
                    !tx.description.toLowerCase().includes('pasaje ')
                      ? tx.description
                      : '') ||
                    'Conductor de Unidad';

                  return (
                    <View key={tx.id} style={styles.tripCard}>
                      <View
                        style={[
                          styles.tripIconWrapper,
                          { backgroundColor: isCredit ? '#ECFDF5' : '#EFF6FF' },
                        ]}
                      >
                        <Ionicons
                          name={isCredit ? 'arrow-down-circle' : 'bus'}
                          size={22}
                          color={isCredit ? '#10B981' : tokens.colors.primary}
                        />
                      </View>
                      <View style={styles.tripInfo}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            marginBottom: 4,
                          }}
                        >
                          <Text style={[styles.tripTitle, { marginBottom: 0 }]}>
                            {isCredit ? 'Recarga de Saldo' : 'Pago de Pasaje'}
                          </Text>
                          <View
                            style={[
                              styles.txBadge,
                              {
                                backgroundColor: isCredit
                                  ? '#DCFCE7'
                                  : '#DBEAFE',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.txBadgeText,
                                {
                                  color: isCredit
                                    ? '#15803D'
                                    : tokens.colors.primary,
                                },
                              ]}
                            >
                              {isCredit ? 'RECARGA' : 'DÉBITO'}
                            </Text>
                          </View>
                        </View>
                        {isCredit ? (
                          <Text style={styles.tripSubtitle} numberOfLines={1}>
                            {tx.description || 'Saldo acreditado en la cuenta'}
                          </Text>
                        ) : (
                          <View style={styles.txDriverRow}>
                            <Ionicons
                              name="person-circle-outline"
                              size={14}
                              color={tokens.colors.primary}
                              style={{ marginRight: 4 }}
                            />
                            <Text style={styles.txDriverText} numberOfLines={1}>
                              Conductor:{' '}
                              <Text style={styles.txDriverNameBold}>
                                {resolvedDriverName}
                              </Text>
                            </Text>
                          </View>
                        )}
                        <Text
                          style={[
                            styles.tripSubtitle,
                            { marginTop: 3, color: '#94A3B8' },
                          ]}
                        >
                          {formattedDate}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.priceContainer,
                          { minWidth: 90, alignItems: 'flex-end' },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 14.5,
                            fontFamily: tokens.typography.fontFamily.black,
                            color: isCredit ? '#059669' : '#1E293B',
                            textAlign: 'right',
                          }}
                        >
                          {isCredit ? '+' : '-'}{' '}
                          {formatTicketAmount(Number(tx.amount || 0))}
                        </Text>
                      </View>
                    </View>
                  );
                })}

                {displayTransactions.length > visibleTxsCount && (
                  <Pressable
                    style={styles.loadMoreBtn}
                    onPress={() =>
                      setVisibleTxsCount((prev) => prev + PAGE_SIZE)
                    }
                  >
                    <Ionicons
                      name="chevron-down-circle-outline"
                      size={18}
                      color={tokens.colors.primary}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.loadMoreBtnText}>
                      Ver más movimientos (
                      {Math.min(visibleTxsCount, displayTransactions.length)} de{' '}
                      {displayTransactions.length})
                    </Text>
                  </Pressable>
                )}

                {displayTransactions.length >= MAX_QUERY_LIMIT &&
                  visibleTxsCount >= displayTransactions.length && (
                    <View style={styles.limitInfoBox}>
                      <Ionicons
                        name="information-circle-outline"
                        size={16}
                        color="#94A3B8"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.limitInfoText}>
                        Mostrando los {MAX_QUERY_LIMIT} movimientos más
                        recientes.
                      </Text>
                    </View>
                  )}
              </>
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
    marginBottom: 24,
  },
  summaryCardWhite: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginRight: 12,
    minHeight: 144,
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryCardGreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginRight: 12,
    minHeight: 144,
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#DCFCE7',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryCardBlue: {
    flex: 1,
    backgroundColor: tokens.colors.primary,
    borderRadius: 22,
    padding: 16,
    minHeight: 144,
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  summaryIconContainerWhite: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  summaryIconContainerGreen: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  summaryIconContainerBlue: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  summaryLabelGrey: {
    fontSize: 10.5,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  summaryLabelLight: {
    fontSize: 10.5,
    fontFamily: tokens.typography.fontFamily.bold,
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  summaryValueBlock: {
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  summaryNumberText: {
    fontSize: 21,
    fontFamily: tokens.typography.fontFamily.black,
    lineHeight: 25,
    marginBottom: 6,
  },
  unitBadgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  unitBadgeGreenText: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#059669',
    letterSpacing: 0.3,
  },
  unitBadgeBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  unitBadgeBlueText: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  unitBadgePrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  unitBadgePrimaryText: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
    letterSpacing: 0.3,
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
  segmentBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeFilterWrapper: {
    marginBottom: 20,
  },
  typeFilterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  typeChipActive: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  typeChipText: {
    fontSize: 12.5,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
  },
  typeChipTextActive: {
    color: '#FFFFFF',
  },
  typeChipBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    marginLeft: 6,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeChipBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  typeChipBadgeText: {
    fontSize: 10.5,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#64748B',
  },
  typeChipBadgeTextActive: {
    color: '#FFFFFF',
  },
  txBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  txBadgeText: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  txDriverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 2,
  },
  txDriverText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  txDriverNameBold: {
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
  },
  emptyActionBtn: {
    marginTop: 16,
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginTop: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  loadMoreBtnText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  limitInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  limitInfoText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
});
