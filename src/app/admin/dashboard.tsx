import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import {
  clearBackendJwt,
  getAllDocuments,
  getAllTransportUnits,
  getAllUsers,
} from '@/lib/api';
import { sigOutAccount } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    passengers: 0,
    drivers: 0,
    owners: 0,
    units: 0,
    pendingDocs: 0,
  });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [users, units, docs] = await Promise.all([
        getAllUsers().catch(() => []),
        getAllTransportUnits().catch(() => []),
        getAllDocuments().catch(() => []),
      ]);

      // Calcular estadísticas
      let passengerCount = 0;
      let driverCount = 0;
      let ownerCount = 0;

      for (const u of users) {
        const roles = (u as any).roles || [];
        const isOwner = roles.some((r: any) => r.name === 'transport_owner');
        const isDriver = roles.some((r: any) => r.name === 'driver');
        const isAdmin = roles.some((r: any) => r.name === 'platform_admin');

        if (isAdmin) continue;
        if (isOwner) ownerCount++;
        else if (isDriver) driverCount++;
        else passengerCount++;
      }

      const pendingCount = docs.filter(
        (d: any) => d.status === 'pending_review',
      ).length;

      setStats({
        passengers: passengerCount,
        drivers: driverCount,
        owners: ownerCount,
        units: units.length,
        pendingDocs: pendingCount,
      });

      // Ordenar por fecha de creación (descendente) y tomar los 3 más recientes
      const sortedUsers = [...users]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 3);

      setRecentUsers(sortedUsers);
    } catch (err) {
      console.warn('[AdminDashboard] Error al cargar datos:', err);
      Alert.alert(
        'Error',
        'No se pudieron sincronizar las estadísticas del servidor.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas salir del panel de administración?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await sigOutAccount();
              await clearBackendJwt();
            } catch (err) {
              console.error('Logout error:', err);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
        <Text style={styles.loadingText}>
          Sincronizando consola de administración...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={true}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera Principal */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>PANEL DE CONTROL</Text>
            <Text style={styles.headerTitle}>Administración</Text>
          </View>
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          </Pressable>
        </View>

        {/* Tarjeta Informativa / Bienvenida */}
        <View style={styles.heroCard}>
          <View style={styles.heroInfo}>
            <Text style={styles.heroTitle}>Control de Plataforma</Text>
            <Text style={styles.heroDesc}>
              Monitorea el uso de boletos, aprueba conductores y valida el
              estado de la red de transporte.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Ionicons name="shield-checkmark" size={32} color="#FFFFFF" />
          </View>
        </View>

        {/* Sección de Indicadores Rápidos */}
        <Text style={styles.sectionTitle}>Métricas Generales</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <View
              style={[styles.statIconCircle, { backgroundColor: '#E0F2FE' }]}
            >
              <Ionicons name="people" size={20} color="#0284C7" />
            </View>
            <Text style={styles.statValue}>{stats.passengers}</Text>
            <Text style={styles.statLabel}>Pasajeros</Text>
          </View>

          <View style={styles.statBox}>
            <View
              style={[styles.statIconCircle, { backgroundColor: '#ECFDF5' }]}
            >
              <Ionicons name="bus" size={20} color="#059669" />
            </View>
            <Text style={styles.statValue}>{stats.units}</Text>
            <Text style={styles.statLabel}>Unidades</Text>
          </View>

          <View style={styles.statBox}>
            <View
              style={[styles.statIconCircle, { backgroundColor: '#EEF2F6' }]}
            >
              <Ionicons name="card" size={20} color="#475569" />
            </View>
            <Text style={styles.statValue}>{stats.drivers}</Text>
            <Text style={styles.statLabel}>Conductores</Text>
          </View>

          <Pressable
            style={[
              styles.statBox,
              stats.pendingDocs > 0 && {
                borderColor: '#F59E0B',
                borderWidth: 1.5,
              },
            ]}
            onPress={() => router.push('/admin/documents')}
          >
            <View
              style={[
                styles.statIconCircle,
                {
                  backgroundColor:
                    stats.pendingDocs > 0 ? '#FEF3C7' : '#F3F4F6',
                },
              ]}
            >
              <Ionicons
                name="document-text"
                size={20}
                color={stats.pendingDocs > 0 ? '#D97706' : '#9E9E9E'}
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
            <Text style={styles.statLabel}>Por Aprobar</Text>
          </Pressable>
        </View>

        {/* Accesos Rápidos */}
        <Text style={styles.sectionTitle}>Módulos Administrativos</Text>
        <View style={styles.actionsBlock}>
          <Pressable
            style={styles.actionRow}
            onPress={() => router.push('/admin/users')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="person-add-outline" size={22} color="#4F46E5" />
            </View>
            <View style={styles.actionInfoText}>
              <Text style={styles.actionName}>Usuarios de la Plataforma</Text>
              <Text style={styles.actionSub}>
                Ver listado, roles y detalles
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>

          <Pressable
            style={styles.actionRow}
            onPress={() => router.push('/admin/documents')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="checkbox-outline" size={22} color="#EA580C" />
            </View>
            <View style={styles.actionInfoText}>
              <Text style={styles.actionName}>Validación de Documentos</Text>
              <Text style={styles.actionSub}>
                Revisar licencias, títulos y permisos
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>

          <Pressable
            style={styles.actionRow}
            onPress={() => router.push('/admin/transport-units')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="git-network-outline" size={22} color="#16A34A" />
            </View>
            <View style={styles.actionInfoText}>
              <Text style={styles.actionName}>Unidades registradas</Text>
              <Text style={styles.actionSub}>
                Códigos de invitación y placa
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>
        </View>

        {/* Usuarios Recientes */}
        <Text style={styles.sectionTitle}>Registros Recientes</Text>
        <View style={styles.recentUsersCard}>
          {recentUsers.length === 0 ? (
            <Text style={styles.emptyText}>No hay registros recientes.</Text>
          ) : (
            recentUsers.map((user, idx) => {
              const roles = user.roles || [];
              const isOwner = roles.some(
                (r: any) => r.name === 'transport_owner',
              );
              const isDriver = roles.some((r: any) => r.name === 'driver');
              const roleText = isOwner
                ? 'Socio'
                : isDriver
                  ? 'Conductor'
                  : 'Pasajero';
              const roleColor = isOwner
                ? '#8B5CF6'
                : isDriver
                  ? '#10B981'
                  : '#3B82F6';

              return (
                <View
                  key={user.uuid}
                  style={[
                    styles.userRow,
                    idx < recentUsers.length - 1 && styles.borderBottom,
                  ]}
                >
                  <View style={styles.userLeft}>
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>
                        {(user.displayName || user.firstName || 'U')
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {user.displayName ||
                          `${user.firstName || ''} ${user.lastName || ''}`}
                      </Text>
                      <Text style={styles.userEmail} numberOfLines={1}>
                        {user.email || 'Sin correo electrónico'}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.roleBadge,
                      { backgroundColor: `${roleColor}1A` },
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

        {/* Espaciador inferior para evitar solapamiento con la barra de navegación */}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerSubtitle: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#94A3B8',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#0F172A',
  },
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 15,
    elevation: 4,
  },
  heroInfo: {
    flex: 1,
    marginRight: 12,
  },
  heroTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroDesc: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#94A3B8',
    lineHeight: 18,
  },
  heroBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#64748B',
    letterSpacing: 1.2,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statBox: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
    fontSize: 24,
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
    borderRadius: 20,
    padding: 8,
    marginBottom: 24,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
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
  recentUsersCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
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
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#475569',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#94A3B8',
  },
});
