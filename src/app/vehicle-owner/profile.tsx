import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
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
  clearGoFareToken,
  getBackendInviteCodes,
  getBackendProfile,
  getOwnerVehicles,
} from '@/lib/api';
import { auth, sigOutAccount } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

export default function VehicleOwnerProfile() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [loading, setLoading] = useState(true);

  // Profile data
  const [name, setName] = useState('Socio');
  const [email, setEmail] = useState('socio@example.com');
  const [phone, setPhone] = useState('...');
  const [coopName, setCoopName] = useState('Cooperativa Caracas Move R.L.');
  const [coopRif, setCoopRif] = useState('J-304598124');

  // Stats
  const [unitsCount, setUnitsCount] = useState(0);
  const [driversCount, setDriversCount] = useState(0);

  const loadProfileData = useCallback(async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (user) {
        // Cargar datos del usuario
        try {
          const backendUser = await getBackendProfile();
          setName(
            backendUser.displayName ||
              `${backendUser.firstName || ''} ${backendUser.lastName || ''}`.trim() ||
              'Socio',
          );
          setEmail(backendUser.email);
          setPhone(backendUser.phoneNumber || 'No registrado');
        } catch (apiErr) {
          console.warn(
            '[Profile] API error, falling back to local cache:',
            apiErr,
          );
          try {
            const cached = await AsyncStorage.getItem(
              'gofare_cached_user_profile',
            );
            if (cached) {
              const cachedData = JSON.parse(cached);
              setName(cachedData.fullName || cachedData.displayName || 'Socio');
              setEmail(cachedData.email || user.email || 'socio@example.com');
              setPhone(cachedData.phoneNumber || 'No registrado');
            }
          } catch (cacheErr) {
            console.warn('[Profile] Error loading cached data:', cacheErr);
          }
        }
      }

      // Cargar cooperativa seleccionada localmente si existe
      const coopStr = await AsyncStorage.getItem(
        'mock_vehicle_owner_cooperative',
      );
      if (coopStr) {
        const coopData = JSON.parse(coopStr);
        setCoopName(coopData.businessName);
        setCoopRif(
          coopData.idNumber.startsWith('RIF:')
            ? coopData.idNumber
            : `RIF: ${coopData.idNumber}`,
        );
      }

      // Contar unidades reales
      const realVehicles = await getOwnerVehicles().catch(() => []);
      setUnitsCount(realVehicles.length);

      // Contar conductores reales desde invitaciones canjeadas y asignados a vehículos
      const realInvites = await getBackendInviteCodes().catch(() => []);
      const uniqueDriverIds = new Set<string>();

      for (const v of realVehicles) {
        if (v.assignedDriver?.id) {
          uniqueDriverIds.add(v.assignedDriver.id);
        }
      }
      for (const inv of realInvites) {
        if (inv.driver?.id) {
          uniqueDriverIds.add(inv.driver.id);
        }
      }
      setDriversCount(uniqueDriverIds.size);
    } catch (err) {
      console.warn('[Profile] Error loading profile stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData]),
  );

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas cerrar sesión de tu cuenta de Socio?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoggingOut(true);
              try {
                await sigOutAccount();
              } catch (authError) {
                console.warn(
                  '[Profile] Error al cerrar sesión de Firebase (offline):',
                  authError,
                );
              }
              await clearGoFareToken();
              try {
                await SecureStore.deleteItemAsync('savedEmail');
                await SecureStore.deleteItemAsync('savedPassword');
                await AsyncStorage.removeItem('gofare_cached_user_profile');
                await AsyncStorage.removeItem('temp_auth');
                await SecureStore.deleteItemAsync('user_role');
              } catch (err) {
                console.warn(
                  '[Profile] Error deleting credentials/cache:',
                  err,
                );
              }
              router.replace('/login');
            } catch (error) {
              console.error('Error al cerrar sesión:', error);
              Alert.alert(
                'Error',
                'No se pudo cerrar sesión. Intenta de nuevo.',
              );
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ],
    );
  };

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
        <Text style={styles.headerTitle}>Perfil de Dueño de Vehiculo</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </Text>
            </View>
          </View>
          <Text style={styles.profileName}>{name}</Text>
          <Text style={styles.profileRoleBadge}>Socio Propietario</Text>
        </View>

        {/* Coop Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Cooperativa Afiliada</Text>
          <View style={styles.coopRow}>
            <View style={styles.coopIconWrapper}>
              <Ionicons name="business" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.coopDetails}>
              <Text style={styles.coopNameText}>{coopName}</Text>
              <Text style={styles.coopRifText}>{coopRif}</Text>
              <View style={styles.activePill}>
                <View style={styles.activeDot} />
                <Text style={styles.activeText}>Afiliación Activa</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Fleet Summary Stats */}
        <View style={styles.statsCard}>
          <Text style={styles.statsCardTitle}>Resumen de Flota</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCol}>
              <Ionicons
                name="bus-outline"
                size={24}
                color={tokens.colors.primary}
                style={{ marginBottom: 4 }}
              />
              <Text style={styles.statValue}>{unitsCount}</Text>
              <Text style={styles.statLabel}>Unidades</Text>
            </View>
            <View style={styles.dividerCol} />
            <View style={styles.statCol}>
              <Ionicons
                name="people-outline"
                size={24}
                color={tokens.colors.primary}
                style={{ marginBottom: 4 }}
              />
              <Text style={styles.statValue}>{driversCount}</Text>
              <Text style={styles.statLabel}>Conductores</Text>
            </View>
          </View>
        </View>

        {/* Account Details */}
        <Text style={styles.sectionTitle}>Datos Personales</Text>
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>CORREO ELECTRÓNICO</Text>
            <Text style={styles.detailValue}>{email}</Text>
          </View>
          <View style={styles.horizontalDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>TELÉFONO</Text>
            <Text style={styles.detailValue}>{phone}</Text>
          </View>
        </View>

        {/* Settings options list */}
        <Text style={styles.sectionTitle}>Configuración</Text>
        <Pressable style={styles.menuItem}>
          <View style={styles.menuIconWrapper}>
            <Ionicons
              name="notifications-outline"
              size={20}
              color={tokens.colors.primary}
            />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Notificaciones de Flota</Text>
            <Text style={styles.menuSubtitle}>
              Alertas de viajes y transferencias
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>

        <Pressable
          style={styles.menuItem}
          onPress={() => router.push('/security')}
        >
          <View style={styles.menuIconWrapper}>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={tokens.colors.primary}
            />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Seguridad y Huella</Text>
            <Text style={styles.menuSubtitle}>
              Configurar bloqueo biométrico
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>

        {/* Logout Button */}
        <Pressable
          style={[styles.logoutBtn, loggingOut && { opacity: 0.6 }]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator
              size="small"
              color="#DC2626"
              style={{ marginRight: 8 }}
            />
          ) : (
            <Ionicons
              name="log-out-outline"
              size={22}
              color="#DC2626"
              style={{ marginRight: 8 }}
            />
          )}
          <Text style={styles.logoutText}>
            {loggingOut ? 'Cerrando sesión...' : 'Cerrar Sesión'}
          </Text>
        </Pressable>

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
  profileCard: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 32,
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 20,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarContainer: {
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 44,
    marginBottom: 12,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
  },
  profileName: {
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  profileRoleBadge: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#EFF6FF',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  infoCardTitle: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  coopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coopIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  coopDetails: {
    flex: 1,
  },
  coopNameText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 2,
  },
  coopRifText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
    marginBottom: 6,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#16A34A',
    marginRight: 4,
  },
  activeText: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#16A34A',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  statsCardTitle: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 0.5,
    marginBottom: 12,
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
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#18243E',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#6B7280',
  },
  dividerCol: {
    width: 1,
    height: 36,
    backgroundColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginTop: 12,
    marginBottom: 10,
    marginLeft: 4,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  detailRow: {
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 13.5,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
  },
  horizontalDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  menuIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuInfo: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#9CA3AF',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 16,
    borderRadius: 20,
    marginTop: 16,
    marginBottom: 24,
  },
  logoutText: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#DC2626',
  },
});
