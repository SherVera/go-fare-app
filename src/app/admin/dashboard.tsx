import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminSidebar } from '@/components/AdminSidebarContext';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import {
  getAllDocuments,
  getAllOwnerRequests,
  getAllTransportUnits,
  getAllUsers,
  getCurrentRates,
} from '@/lib/api';
import { tokens } from '@/theme/tokens';

const STATS_CACHE_KEY = 'gofare_admin_dashboard_stats';
const RECENT_USERS_CACHE_KEY = 'gofare_admin_dashboard_recent_users';
const RATES_CACHE_KEY = 'gofare_admin_dashboard_rates';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { setIsOpen } = useAdminSidebar();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    passengers: 0,
    drivers: 0,
    owners: 0,
    units: 0,
    pendingDocs: 0,
    pendingOwners: 0,
    civilAssociations: 0,
  });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [rates, setRates] = useState<{
    fareUsdValue: number;
    bcvRate: number;
    bcvRateDate?: string;
  }>({
    fareUsdValue: 0.25,
    bcvRate: 40.0,
  });

  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [users, units, docs, ownerReqs, currentRates] = await Promise.all([
        getAllUsers().catch(() => []),
        getAllTransportUnits().catch(() => []),
        getAllDocuments().catch(() => []),
        getAllOwnerRequests().catch(() => []),
        getCurrentRates().catch(() => null),
      ]);

      const safeUsers = Array.isArray(users) ? users : [];
      const safeUnits = Array.isArray(units) ? units : [];
      const safeDocs = Array.isArray(docs) ? docs : [];
      const safeOwnerReqs = Array.isArray(ownerReqs) ? ownerReqs : [];

      if (currentRates?.fareUsdValue && currentRates?.bcvRate) {
        setRates(currentRates);
        AsyncStorage.setItem(
          RATES_CACHE_KEY,
          JSON.stringify(currentRates),
        ).catch(() => {});
      }

      // Calcular métricas de usuarios en una sola pasada O(N)
      let passengerCount = 0;
      let driverCount = 0;
      let ownerCount = 0;
      let civilCount = 0;

      for (const u of safeUsers) {
        if (!u) continue;
        const userRoles = (u as any).roles || [];
        const isOwner = userRoles.some(
          (r: any) => r.name === 'transport_owner',
        );
        const isDriver = userRoles.some((r: any) => r.name === 'driver');
        const isCivil = userRoles.some(
          (r: any) => r.name === 'civil_association',
        );
        const isAdmin = userRoles.some(
          (r: any) => r.name === 'platform_admin' || r.name === 'admin',
        );

        if (isAdmin) continue;
        if (isCivil) civilCount++;
        if (isOwner) ownerCount++;
        else if (isDriver) driverCount++;
        else passengerCount++;
      }

      const pendingCount = safeDocs.filter(
        (d: any) => d && d.status === 'pending_review',
      ).length;

      const pendingOwnersCount = safeOwnerReqs.filter(
        (r: any) =>
          r && (r.status === 'pending' || r.status === 'pending_review'),
      ).length;

      const hasAnyData =
        safeUsers.length > 0 ||
        safeUnits.length > 0 ||
        safeDocs.length > 0 ||
        safeOwnerReqs.length > 0;

      if (hasAnyData) {
        const newStats = {
          passengers: passengerCount,
          drivers: driverCount,
          owners: ownerCount,
          units: safeUnits.length,
          pendingDocs: pendingCount,
          pendingOwners: pendingOwnersCount,
          civilAssociations: civilCount,
        };
        setStats(newStats);
        AsyncStorage.setItem(STATS_CACHE_KEY, JSON.stringify(newStats)).catch(
          () => {},
        );

        if (safeUsers.length > 0) {
          const sortedUsers = [...safeUsers]
            .filter((u) => u?.createdAt)
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )
            .slice(0, 4);

          setRecentUsers(sortedUsers);
          AsyncStorage.setItem(
            RECENT_USERS_CACHE_KEY,
            JSON.stringify(sortedUsers),
          ).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[AdminDashboard] Error al cargar datos:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Cargar métricas cacheadas de inmediato
  useEffect(() => {
    const loadCached = async () => {
      try {
        const [cachedStatsStr, cachedUsersStr, cachedRatesStr] =
          await Promise.all([
            AsyncStorage.getItem(STATS_CACHE_KEY),
            AsyncStorage.getItem(RECENT_USERS_CACHE_KEY),
            AsyncStorage.getItem(RATES_CACHE_KEY),
          ]);

        if (cachedStatsStr) {
          setStats(JSON.parse(cachedStatsStr));
          setLoading(false);
        }
        if (cachedUsersStr) {
          setRecentUsers(JSON.parse(cachedUsersStr));
        }
        if (cachedRatesStr) {
          setRates(JSON.parse(cachedRatesStr));
        }
      } catch {}
    };
    loadCached();
  }, []);

  const onRefresh = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setRefreshing(true);
    await loadDashboardData(true);
  }, [loadDashboardData]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData]),
  );

  const handleCardPress = (route: string) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    router.push(route as any);
  };

  const fareBsEquivalent = rates.fareUsdValue * rates.bcvRate;

  if (loading && !refreshing) {
    return (
      <AppLoadingScreen message="Sincronizando consola de administración..." />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={true}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[tokens.colors.primary]}
            tintColor={tokens.colors.primary}
          />
        }
      >
        {/* Cabecera Principal */}
        <View style={styles.header}>
          <Pressable
            style={styles.menuBtn}
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
              setIsOpen(true);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="menu" size={24} color={tokens.colors.primary} />
          </Pressable>

          <View style={styles.headerTextContainer}>
            <View style={styles.liveTagRow}>
              <View style={styles.liveDot} />
              <Text style={styles.headerSubtitle}>SISTEMA EN LÍNEA</Text>
            </View>
            <Text style={styles.headerTitle}>Panel de Control</Text>
          </View>

          <Pressable
            style={styles.refreshIconBtn}
            onPress={onRefresh}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="sync-outline" size={20} color="#64748B" />
          </Pressable>
        </View>
        {/* Tarjeta de Pulso Financiero (Tarifas y Tasa BCV) */}
        <Pressable
          style={styles.financialCard}
          onPress={() => handleCardPress('/admin/rates')}
        >
          <View style={styles.financialHeader}>
            <View style={styles.financialTag}>
              <Ionicons name="trending-up" size={14} color="#059669" />
              <Text style={styles.financialTagText}>Control Cambiario</Text>
            </View>
            <View style={styles.financialActionRow}>
              <Text style={styles.financialActionText}>Ajustar</Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={tokens.colors.primary}
              />
            </View>
          </View>

          <View style={styles.financialGrid}>
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>1 BOLETO (FARE)</Text>
              <Text style={styles.financialValue}>
                ${rates.fareUsdValue.toFixed(2)} USD
              </Text>
              <Text style={styles.financialSubtext}>
                ≈ {fareBsEquivalent.toFixed(2)} Bs.
              </Text>
            </View>

            <View style={styles.financialDivider} />

            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>TASA OFICIAL BCV</Text>
              <Text style={styles.financialValue}>
                {rates.bcvRate.toFixed(2)} Bs/$
              </Text>
              <Text style={styles.financialSubtext}>
                {rates.bcvRateDate ? `Fecha: ${rates.bcvRateDate}` : 'Vigente'}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Sección de Métricas Generales */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Métricas de la Red</Text>
          <Text style={styles.sectionBadge}>Tiempo Real</Text>
        </View>

        <View style={styles.statsGrid}>
          {/* Pasajeros */}
          <Pressable
            style={styles.statBox}
            onPress={() => handleCardPress('/admin/users?role=passenger')}
          >
            <View
              style={[styles.statIconCircle, { backgroundColor: '#EFF6FF' }]}
            >
              <Ionicons name="people" size={20} color="#2563EB" />
            </View>
            <Text style={styles.statValue}>{stats.passengers}</Text>
            <Text style={styles.statLabel}>Pasajeros</Text>
          </Pressable>

          {/* Unidades */}
          <Pressable
            style={styles.statBox}
            onPress={() => handleCardPress('/admin/transport-units')}
          >
            <View
              style={[styles.statIconCircle, { backgroundColor: '#ECFDF5' }]}
            >
              <Ionicons name="bus" size={20} color="#059669" />
            </View>
            <Text style={styles.statValue}>{stats.units}</Text>
            <Text style={styles.statLabel}>Unidades</Text>
          </Pressable>

          {/* Conductores */}
          <Pressable
            style={styles.statBox}
            onPress={() => handleCardPress('/admin/users?role=driver')}
          >
            <View
              style={[styles.statIconCircle, { backgroundColor: '#F1F5F9' }]}
            >
              <Ionicons name="card" size={20} color="#475569" />
            </View>
            <Text style={styles.statValue}>{stats.drivers}</Text>
            <Text style={styles.statLabel}>Conductores</Text>
          </Pressable>

          {/* Asoc. Civiles */}
          <Pressable
            style={styles.statBox}
            onPress={() => handleCardPress('/admin/civil-associations')}
          >
            <View
              style={[styles.statIconCircle, { backgroundColor: '#FFF7ED' }]}
            >
              <Ionicons name="business" size={20} color="#EA580C" />
            </View>
            <Text style={styles.statValue}>{stats.civilAssociations}</Text>
            <Text style={styles.statLabel}>Asoc. Civiles</Text>
          </Pressable>

          {/* Documentos Pendientes */}
          <Pressable
            style={[
              styles.statBox,
              stats.pendingDocs > 0 && styles.statBoxAlert,
            ]}
            onPress={() => handleCardPress('/admin/documents')}
          >
            <View
              style={[
                styles.statIconCircle,
                {
                  backgroundColor:
                    stats.pendingDocs > 0 ? '#FEF3C7' : '#F8FAFC',
                },
              ]}
            >
              <Ionicons
                name="document-text"
                size={20}
                color={stats.pendingDocs > 0 ? '#D97706' : '#94A3B8'}
              />
            </View>
            <Text
              style={[
                styles.statValue,
                stats.pendingDocs > 0 && { color: '#D97706' },
              ]}
            >
              {stats.pendingDocs}
            </Text>
            <Text style={styles.statLabel}>Doc. Pendientes</Text>
          </Pressable>

          {/* Solicitudes de Socios */}
          <Pressable
            style={[
              styles.statBox,
              stats.pendingOwners > 0 && styles.statBoxAlertRed,
            ]}
            onPress={() => handleCardPress('/admin/owner-requests')}
          >
            <View
              style={[
                styles.statIconCircle,
                {
                  backgroundColor:
                    stats.pendingOwners > 0 ? '#FEE2E2' : '#F8FAFC',
                },
              ]}
            >
              <Ionicons
                name="file-tray-full"
                size={20}
                color={stats.pendingOwners > 0 ? '#EF4444' : '#94A3B8'}
              />
            </View>
            <Text
              style={[
                styles.statValue,
                stats.pendingOwners > 0 && { color: '#EF4444' },
              ]}
            >
              {stats.pendingOwners}
            </Text>
            <Text style={styles.statLabel}>Solic. Socios</Text>
          </Pressable>
        </View>

        {/* Módulos Administrativos */}
        <Text style={styles.sectionTitle}>Módulos Administrativos</Text>
        <View style={styles.actionsBlock}>
          {/* Usuarios */}
          <Pressable
            style={styles.actionRow}
            onPress={() => handleCardPress('/admin/users')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="people-outline" size={22} color="#4F46E5" />
            </View>
            <View style={styles.actionInfoText}>
              <Text style={styles.actionName}>Usuarios de la Plataforma</Text>
              <Text style={styles.actionSub}>
                Ver listado, roles y detalles
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>

          {/* Tasas y Tarifas */}
          <Pressable
            style={styles.actionRow}
            onPress={() => handleCardPress('/admin/rates')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="trending-up-outline" size={22} color="#059669" />
            </View>
            <View style={styles.actionInfoText}>
              <Text style={styles.actionName}>Tasas y Tarifas (BCV / USD)</Text>
              <Text style={styles.actionSub}>
                Gestión de cambio oficial y costo de pasaje
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>

          {/* Asociaciones Civiles */}
          <Pressable
            style={styles.actionRow}
            onPress={() => handleCardPress('/admin/civil-associations')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="business-outline" size={22} color="#EA580C" />
            </View>
            <View style={styles.actionInfoText}>
              <Text style={styles.actionName}>Asociaciones Civiles</Text>
              <Text style={styles.actionSub}>
                Registrar representantes y cooperativas
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>

          {/* Validación de Documentos */}
          <Pressable
            style={styles.actionRow}
            onPress={() => handleCardPress('/admin/documents')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons
                name="document-text-outline"
                size={22}
                color="#D97706"
              />
            </View>
            <View style={styles.actionInfoText}>
              <Text style={styles.actionName}>Validación de Documentos</Text>
              <Text style={styles.actionSub}>
                Revisar licencias, títulos y permisos
              </Text>
            </View>
            {stats.pendingDocs > 0 && (
              <View style={styles.warningBadge}>
                <Text style={styles.warningBadgeText}>{stats.pendingDocs}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>

          {/* Solicitudes de Socios */}
          <Pressable
            style={styles.actionRow}
            onPress={() => handleCardPress('/admin/owner-requests')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons
                name="file-tray-full-outline"
                size={22}
                color="#DC2626"
              />
            </View>
            <View style={styles.actionInfoText}>
              <Text style={styles.actionName}>Solicitudes de Socios</Text>
              <Text style={styles.actionSub}>
                Aprobar o suspender dueños y choferes
              </Text>
            </View>
            {stats.pendingOwners > 0 && (
              <View style={styles.dangerBadge}>
                <Text style={styles.dangerBadgeText}>
                  {stats.pendingOwners}
                </Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>

          {/* Unidades de Transporte */}
          <Pressable
            style={[styles.actionRow, styles.lastActionRow]}
            onPress={() => handleCardPress('/admin/transport-units')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#F1F5F9' }]}>
              <Ionicons name="bus-outline" size={22} color="#334155" />
            </View>
            <View style={styles.actionInfoText}>
              <Text style={styles.actionName}>Unidades de Transporte</Text>
              <Text style={styles.actionSub}>
                Flota de autobuses, placas y choferes asignados
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>
        </View>

        {/* Registros Recientes */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Registros Recientes</Text>
          <Pressable onPress={() => handleCardPress('/admin/users')}>
            <Text style={styles.seeAllText}>Ver todos</Text>
          </Pressable>
        </View>

        <View style={styles.recentUsersCard}>
          {recentUsers.length === 0 ? (
            <Text style={styles.emptyText}>No hay registros recientes.</Text>
          ) : (
            recentUsers.map((user, idx) => {
              const userRoles = user.roles || [];
              const isOwner = userRoles.some(
                (r: any) => r.name === 'transport_owner',
              );
              const isDriver = userRoles.some((r: any) => r.name === 'driver');
              const isCivil = userRoles.some(
                (r: any) => r.name === 'civil_association',
              );

              const roleText = isOwner
                ? 'Socio'
                : isDriver
                  ? 'Conductor'
                  : isCivil
                    ? 'Asoc. Civil'
                    : 'Pasajero';

              const roleColor = isOwner
                ? '#8B5CF6'
                : isDriver
                  ? '#10B981'
                  : isCivil
                    ? '#EA580C'
                    : '#3B82F6';

              const initial = (user.displayName || user.firstName || 'U')
                .charAt(0)
                .toUpperCase();

              return (
                <View
                  key={user.uuid || idx}
                  style={[
                    styles.userRow,
                    idx < recentUsers.length - 1 && styles.borderBottom,
                  ]}
                >
                  <View style={styles.userLeft}>
                    <View
                      style={[
                        styles.avatarPlaceholder,
                        { borderColor: `${roleColor}40`, borderWidth: 1.5 },
                      ]}
                    >
                      <Text style={[styles.avatarText, { color: roleColor }]}>
                        {initial}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {user.displayName ||
                          `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                          'Usuario'}
                      </Text>
                      <Text style={styles.userEmail} numberOfLines={1}>
                        {user.email || user.phoneNumber || 'Sin contacto'}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.roleBadge,
                      { backgroundColor: `${roleColor}14` },
                    ]}
                  >
                    <Text style={[styles.roleBadgeText, { color: roleColor }]}>
                      {roleText}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Espaciador inferior */}
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTextContainer: {
    flex: 1,
  },
  liveTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  headerSubtitle: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#059669',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  refreshIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  financialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  financialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  financialTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  financialTagText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#059669',
  },
  financialActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  financialActionText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  financialGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  financialItem: {
    flex: 1,
  },
  financialDivider: {
    width: 1,
    height: 38,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 14,
  },
  financialLabel: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  financialValue: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  financialSubtext: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#059669',
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#64748B',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  sectionBadge: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#3B82F6',
  },
  seeAllText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  statBoxAlert: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  statBoxAlertRed: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  statIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginTop: 2,
  },
  actionsBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  lastActionRow: {
    borderBottomWidth: 0,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionInfoText: {
    flex: 1,
  },
  actionName: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  actionSub: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    marginTop: 1,
  },
  warningBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
  },
  warningBadgeText: {
    color: '#FFFFFF',
    fontFamily: tokens.typography.fontFamily.bold,
    fontSize: 11,
  },
  dangerBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
  },
  dangerBadgeText: {
    color: '#FFFFFF',
    fontFamily: tokens.typography.fontFamily.bold,
    fontSize: 11,
  },
  recentUsersCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  userLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  userEmail: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    marginTop: 1,
  },
  roleBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 18,
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#94A3B8',
  },
});
