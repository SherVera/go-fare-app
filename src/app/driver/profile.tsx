import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import {
  formatUserProfileName,
  getAssignedVehicles,
  getBackendProfile,
  getMyAssociatedOwner,
  updateBackendProfile,
  verifyAuthStatus,
} from '@/lib/api';
import { purgeUserSessionAndLogout } from '@/lib/auth-session';
import { auth } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

export default function DriverProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [name, setName] = useState('Conductor');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('No registrado');
  const [license, setLicense] = useState('');

  // Association & Vehicle info
  const [associatedOwner, setAssociatedOwner] = useState<any | null>(null);
  const [ownerName, setOwnerName] = useState('Sin Dueño Asociado');
  const [ownerSubtitle, setOwnerSubtitle] = useState('');
  const [cooperative, setCooperative] = useState('Línea Particular');
  const [vehicle, setVehicle] = useState('Sin Unidad Asignada');

  const loadProfileData = useCallback(async () => {
    try {
      setLoading(true);
      const authStatus = await verifyAuthStatus();
      if (!authStatus.isAuthenticated) {
        await purgeUserSessionAndLogout();
        router.replace('/login');
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        await purgeUserSessionAndLogout();
        router.replace('/login');
        return;
      }
      try {
        const backendUser = await getBackendProfile();
        const resolvedName =
          formatUserProfileName(backendUser) ||
          formatUserProfileName(user) ||
          'Conductor';

        if (
          backendUser?.id &&
          resolvedName &&
          resolvedName !== 'Conductor' &&
          backendUser.displayName !== resolvedName
        ) {
          try {
            await updateBackendProfile(backendUser.id, {
              displayName: resolvedName,
            });
          } catch {}
        }

        setName(resolvedName);
        setEmail(backendUser.email || user.email || '');
        setPhone(
          backendUser.phoneNumber || user.phoneNumber || 'No registrado',
        );
        const bUser = backendUser as any;
        if (bUser.nationalId || bUser.idNumber || bUser.cedula) {
          setLicense(bUser.nationalId || bUser.idNumber || bUser.cedula);
        }
      } catch (apiErr: any) {
        console.warn('[DriverProfile] API error, checking error type:', apiErr);
        if (
          apiErr?.status === 401 ||
          apiErr?.message?.includes('401') ||
          apiErr?.message?.includes('expired') ||
          apiErr?.message?.includes('No authenticated user')
        ) {
          await purgeUserSessionAndLogout();
          router.replace('/login');
          return;
        }
        try {
          const cached = await AsyncStorage.getItem(
            'gofare_cached_user_profile',
          );
          if (cached) {
            const cachedData = JSON.parse(cached);
            if (
              cachedData.email === 'invitado@gofare.dev' ||
              cachedData.displayName === 'Usuario Invitado' ||
              (cachedData.uid && cachedData.uid !== user.uid)
            ) {
              await AsyncStorage.removeItem('gofare_cached_user_profile');
            } else {
              setName(
                cachedData.fullName ||
                  cachedData.displayName ||
                  user.displayName ||
                  'Conductor',
              );
              setEmail(cachedData.email || user.email || '');
              setPhone(
                cachedData.phoneNumber || user.phoneNumber || 'No registrado',
              );
              setLicense(cachedData.nationalId || cachedData.idNumber || '');
            }
          } else {
            setName(user.displayName || 'Conductor');
            setEmail(user.email || '');
            setPhone(user.phoneNumber || 'No registrado');
          }
        } catch (cacheErr) {
          console.warn('[DriverProfile] Error loading cached data:', cacheErr);
        }
      }

      // 1. Cargar dueño asociado desde el backend real
      try {
        const owner = await getMyAssociatedOwner();
        if (owner) {
          setAssociatedOwner(owner);
          const resolvedOwnerName =
            formatUserProfileName(owner) ||
            owner.displayName ||
            `${owner.firstName || ''} ${owner.lastName || ''}`.trim() ||
            owner.email ||
            'Dueño de Transporte';
          setOwnerName(resolvedOwnerName);

          const extraDetails: string[] = [];
          if (owner.nationalId || owner.idNumber) {
            extraDetails.push(`C.I: ${owner.nationalId || owner.idNumber}`);
          }
          if (owner.email && !resolvedOwnerName.includes(owner.email)) {
            extraDetails.push(owner.email);
          }
          setOwnerSubtitle(extraDetails.join(' • '));
        } else {
          setAssociatedOwner(null);
          setOwnerName('Sin Dueño Asociado');
          setOwnerSubtitle(
            'No tienes ningún transportista vinculado actualmente',
          );
        }
      } catch (ownerErr) {
        console.warn(
          '[DriverProfile] Error loading associated owner:',
          ownerErr,
        );
        setAssociatedOwner(null);
        setOwnerName('Sin Dueño Asociado');
        setOwnerSubtitle(
          'No tienes ningún transportista vinculado actualmente',
        );
      }

      // 2. Cargar vehículo asignado real desde el backend
      try {
        const vehicles = await getAssignedVehicles();
        if (vehicles && vehicles.length > 0) {
          const v = vehicles[0];
          setVehicle(`${v.brand} ${v.model} (${v.plate})`);
          if (v.cooperativeName) {
            setCooperative(v.cooperativeName);
          }
        } else {
          setVehicle('Sin Unidad Asignada');
        }
      } catch (vehErr) {
        console.warn('[DriverProfile] Error loading vehicles:', vehErr);
        setVehicle('Sin Unidad Asignada');
      }

      // 3. Cargar info de cooperativa si existiera local
      const coopStr = await AsyncStorage.getItem(
        'mock_vehicle_owner_cooperative',
      );
      if (coopStr) {
        const coopData = JSON.parse(coopStr);
        if (coopData.businessName) {
          setCooperative(coopData.businessName);
        }
      }
    } catch (err) {
      console.warn('[DriverProfile] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData]),
  );

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas finalizar tu turno y cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoggingOut(true);
              await AsyncStorage.setItem('driver_service_status', 'inactive');
              await purgeUserSessionAndLogout();
              router.replace('/login');
            } catch (error) {
              console.error('[DriverProfile] Error logging out:', error);
              Alert.alert(
                'Error',
                'No se pudo cerrar sesión. Inténtalo de nuevo.',
              );
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ],
    );
  };

  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return <AppLoadingScreen message="Cargando perfil del conductor..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(name)}</Text>
            </View>
          </View>
          <Text style={styles.profileName}>{name}</Text>
          <Text style={styles.profileRoleBadge}>Conductor de Unidad</Text>
        </View>

        {/* Association, Coop & Vehicle Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>ASOCIACIÓN Y TRANSPORTE</Text>

          {/* Dueño Asociado */}
          <View style={styles.row}>
            <View
              style={[
                styles.iconWrapper,
                !associatedOwner && styles.iconWrapperInactive,
              ]}
            >
              <Ionicons
                name={associatedOwner ? 'person' : 'person-outline'}
                size={20}
                color={associatedOwner ? '#FFFFFF' : '#94A3B8'}
              />
            </View>
            <View style={styles.infoDetails}>
              <Text style={styles.infoLabelText}>Dueño Asociado</Text>
              <Text style={styles.infoValueText}>{ownerName}</Text>
              {ownerSubtitle ? (
                <Text style={styles.infoSubText}>{ownerSubtitle}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.horizontalDivider} />

          {/* Cooperativa Afiliada */}
          <View style={styles.row}>
            <View style={styles.iconWrapper}>
              <Ionicons name="business" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.infoDetails}>
              <Text style={styles.infoLabelText}>Cooperativa Afiliada</Text>
              <Text style={styles.infoValueText}>{cooperative}</Text>
            </View>
          </View>

          <View style={styles.horizontalDivider} />

          {/* Unidad de Transporte */}
          <View style={styles.row}>
            <View
              style={[
                styles.iconWrapper,
                vehicle === 'Sin Unidad Asignada' && styles.iconWrapperInactive,
              ]}
            >
              <Ionicons
                name="bus"
                size={20}
                color={
                  vehicle === 'Sin Unidad Asignada' ? '#94A3B8' : '#FFFFFF'
                }
              />
            </View>
            <View style={styles.infoDetails}>
              <Text style={styles.infoLabelText}>Unidad de Transporte</Text>
              <Text style={styles.infoValueText}>{vehicle}</Text>
            </View>
          </View>
        </View>

        {/* Driver Details Card */}
        <Text style={styles.sectionTitle}>Datos Personales</Text>
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>CÉDULA / LICENCIA</Text>
            <Text style={styles.detailValue}>{license}</Text>
          </View>
          <View style={styles.horizontalDivider} />
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
            <Text style={styles.menuTitle}>Seguridad y Bloqueo</Text>
            <Text style={styles.menuSubtitle}>
              Configurar huella o datos biométricos
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>

        <Pressable style={styles.menuItem}>
          <View style={styles.menuIconWrapper}>
            <Ionicons
              name="notifications-outline"
              size={20}
              color={tokens.colors.primary}
            />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Notificaciones</Text>
            <Text style={styles.menuSubtitle}>
              Ajustar alertas de turnos y pasajes
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
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoDetails: {
    flex: 1,
  },
  infoLabelText: {
    fontSize: 10.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
    marginBottom: 2,
  },
  infoValueText: {
    fontSize: 13.5,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  horizontalDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  iconWrapperInactive: {
    backgroundColor: '#E2E8F0',
  },
  infoSubText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginTop: 2,
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
