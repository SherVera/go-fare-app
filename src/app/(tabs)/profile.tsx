import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { EditProfileModal } from '@/components/EditProfileModal';
import { PhoneLinkModal } from '@/components/PhoneLinkModal';
import { useLiteMode } from '@/context/LiteModeContext';
import type {
  ProfileInfoCard,
  ProfileMenuItem,
  UserProfile,
} from '@/interfaces';
import {
  getBackendProfile,
  getFareAccountByUserId,
  verifyAuthStatus,
} from '@/lib/api';
import { purgeUserSessionAndLogout } from '@/lib/auth-session';
import { tokens } from '@/theme/tokens';

const getInitials = (fullName?: string) => {
  if (!fullName) return 'U';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export default function ProfileScreen() {
  const { isLiteMode, setLiteMode } = useLiteMode();
  const [loggingOut, setLoggingOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const router = useRouter();
  const isRedirectingRef = useRef(false);

  const fetchUserData = useCallback(async () => {
    const authStatus = await verifyAuthStatus();
    if (!authStatus.isAuthenticated || !authStatus.user) {
      await purgeUserSessionAndLogout();
      setUserProfile(null);
      router.replace('/login');
      return;
    }
    const user = authStatus.user;

    // 1. Cargar desde la caché local solo si pertenece al usuario actual
    let cachedData: any = null;
    try {
      const cached = await AsyncStorage.getItem('gofare_cached_user_profile');
      if (cached) {
        cachedData = JSON.parse(cached);
        if (
          cachedData.email === 'invitado@gofare.dev' ||
          cachedData.displayName === 'Usuario Invitado' ||
          (cachedData.uid && cachedData.uid !== user.uid)
        ) {
          await AsyncStorage.removeItem('gofare_cached_user_profile');
          cachedData = null;
        } else {
          setUserProfile(cachedData);
        }
      }
    } catch (cacheErr) {
      console.warn('[Profile] Error al cargar caché del perfil:', cacheErr);
    }

    // 2. Consultar servidor en segundo plano
    try {
      const backendUser = await getBackendProfile();
      let fareAccountBalance = 0;
      try {
        const account = await getFareAccountByUserId(backendUser.id);
        fareAccountBalance = account.balance;
      } catch (accountErr) {
        console.warn('[Profile] Error loading fare account:', accountErr);
      }

      const updatedProfile: UserProfile = {
        uid: user.uid,
        backendUuid: backendUser.id,
        fullName:
          backendUser.displayName ||
          cachedData?.displayName ||
          cachedData?.fullName ||
          `${backendUser.firstName || ''} ${backendUser.lastName || ''}`.trim() ||
          'Usuario',
        displayName:
          backendUser.displayName ||
          cachedData?.displayName ||
          `${backendUser.firstName || ''} ${backendUser.lastName || ''}`.trim() ||
          'Usuario',
        idNumber:
          backendUser.nationalId ||
          cachedData?.nationalId ||
          cachedData?.idNumber ||
          'V-00000000',
        email: backendUser.email || cachedData?.email,
        phoneNumber: backendUser.phoneNumber || cachedData?.phoneNumber || '',
        balance: fareAccountBalance,
        photoURL: backendUser.profilePhoto || cachedData?.photoURL || '',
        city: 'Caracas, Venezuela',
        createdAt: backendUser.createdAt,
      };

      setUserProfile(updatedProfile);

      // Guardar en la caché local y sincronizar rol
      await AsyncStorage.setItem(
        'gofare_cached_user_profile',
        JSON.stringify(updatedProfile),
      );

      const isAdmin = (backendUser as any).roles?.some(
        (role: any) => role.name === 'platform_admin' || role.name === 'admin',
      );
      const isOwner = (backendUser as any).roles?.some(
        (role: any) => role.name === 'transport_owner',
      );
      const isDriver = (backendUser as any).roles?.some(
        (role: any) => role.name === 'driver',
      );
      const newRole = isAdmin
        ? 'platform_admin'
        : isOwner
          ? 'transport_owner'
          : isDriver
            ? 'driver'
            : 'passenger';
      await SecureStore.setItemAsync('user_role', newRole);

      if (isAdmin) {
        if (!isRedirectingRef.current) {
          isRedirectingRef.current = true;
          console.log('[Profile] User is platform admin, redirecting...');
          router.replace('/admin/dashboard' as any);
        }
        return;
      } else if (isOwner) {
        if (!isRedirectingRef.current) {
          isRedirectingRef.current = true;
          console.log('[Profile] User is transport owner, redirecting...');
          router.replace('/vehicle-owner/dashboard' as any);
        }
        return;
      } else if (isDriver) {
        if (!isRedirectingRef.current) {
          isRedirectingRef.current = true;
          console.log('[Profile] User is driver, redirecting...');
          router.replace('/driver/dashboard' as any);
        }
        return;
      }

      isRedirectingRef.current = false;
    } catch (error: any) {
      console.log(
        '[Profile] Error al obtener datos del backend:',
        error.message || error,
      );
      if (
        error?.message?.includes('401') ||
        error?.message?.includes('Unauthorized') ||
        error?.message?.includes('expirado') ||
        error?.message?.includes('No hay una sesión activa')
      ) {
        await purgeUserSessionAndLogout();
        setUserProfile(null);
        router.replace('/login');
        return;
      }
      // Fallback a caché local en caso de error de conexión solo si coincide con el usuario
      try {
        const cached = await AsyncStorage.getItem('gofare_cached_user_profile');
        if (cached) {
          const fbProfile = JSON.parse(cached);
          if (fbProfile.uid === user.uid) {
            setUserProfile(fbProfile);
          }
        }
      } catch (cacheErr: any) {
        console.log(
          '[Profile] Error en fallback de caché local:',
          cacheErr.message || cacheErr,
        );
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [fetchUserData]),
  );

  // Tarjetas de información — tipadas con ProfileInfoCard[]
  const infoCards: ProfileInfoCard[] = [
    {
      label: 'CORREO ELECTRÓNICO',
      value: userProfile?.email || '...',
      type: 'email',
    },
    {
      label: 'TELÉFONO',
      value: userProfile?.phoneNumber || '...',
      type: 'phone',
    },
  ];

  // Ítems del menú — tipados con ProfileMenuItem[]
  const menuItems: ProfileMenuItem[] = [
    {
      id: 'trips',
      title: 'Actividad de Viajes',
      subtitle: 'Historial de viajes y boletos',
      iconName: 'bus',
      onPress: () =>
        router.push({
          pathname: '/(tabs)/trips',
          params: { tab: 'trips' },
        }),
    },
    {
      id: 'transactions',
      title: 'Historial de Pagos y Recargas',
      subtitle: 'Consulta tus recargas, pagos y comprobantes',
      iconName: 'receipt',
      onPress: () =>
        router.push({
          pathname: '/(tabs)/trips',
          params: { tab: 'transactions' },
        }),
    },
    {
      id: 'payments',
      title: 'Métodos de Pago',
      subtitle: 'Visa, Master y Pago Móvil',
      iconName: 'card',
      onPress: () => router.push('/(tabs)/topup'),
    },
    {
      id: 'security',
      title: 'Seguridad y Contraseña',
      subtitle: '2FA y cambio de clave',
      iconName: 'lock-closed',
      onPress: () => router.push('/security'),
    },
    {
      id: 'notifications',
      title: 'Notificaciones',
      subtitle: 'Alertas de viaje y recargas',
      iconName: 'notifications',
      onPress: () => {},
    },
    {
      id: 'support',
      title: 'Ayuda y Soporte',
      subtitle: 'Centro de asistencia 24/7',
      iconName: 'information-circle',
      onPress: () => {},
    },
  ];

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    try {
      setLoggingOut(true);
      await purgeUserSessionAndLogout();
      setUserProfile(null);
      setShowLogoutModal(false);
      router.replace('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      Alert.alert('Error', 'No se pudo cerrar sesión. Intenta de nuevo.');
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return <AppLoadingScreen message="Cargando datos del perfil..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GoFare</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── PROFILE CARD ── */}
        <View style={styles.profileCard}>
          <Pressable
            style={({ pressed }) => [
              styles.editProfileBtn,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setShowEditModal(true)}
          >
            <Ionicons name="create-outline" size={16} color="#FFFFFF" />
            <Text style={styles.editProfileBtnText}>Editar</Text>
          </Pressable>

          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>
                {getInitials(userProfile?.fullName)}
              </Text>
            </View>
          </View>
          <Text style={styles.profileName}>
            {userProfile?.fullName || 'Usuario'}
          </Text>
          <View style={styles.idBadge}>
            <Text style={styles.idText}>Cedula: {userProfile?.idNumber}</Text>
          </View>
        </View>

        {/* ── INFO CARDS ── */}
        {infoCards.map((card) => (
          <View key={card.label} style={styles.infoCard}>
            <Text style={styles.infoLabel}>{card.label}</Text>
            {card.type === 'phone' ? (
              <Pressable
                style={styles.locationRow}
                onPress={() => setShowPhoneModal(true)}
              >
                <Ionicons
                  name="call-outline"
                  size={18}
                  color={tokens.colors.primary}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.infoValueBlue}>
                  {card.value && card.value !== '...'
                    ? card.value
                    : 'Toca para vincular número'}
                </Text>
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={tokens.colors.primary}
                  style={{ marginLeft: 8 }}
                />
              </Pressable>
            ) : (
              <Text style={styles.infoValueBlue}>{card.value}</Text>
            )}
          </View>
        ))}

        {/* ── CONFIGURATION SECTION ── */}
        <Text style={styles.sectionTitle}>Configuración de la Cuenta</Text>

        <View style={styles.menuItem}>
          <View style={styles.menuIconWrapper}>
            <Ionicons
              name="flash"
              size={22}
              color={isLiteMode ? tokens.colors.primary : '#9CA3AF'}
            />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Modo Lite (Alto Rendimiento)</Text>
            <Text style={styles.menuSubtitle}>
              {isLiteMode
                ? 'Activado: Interfaz ultraligera sin sombras'
                : 'Desactivado: Interfaz completa'}
            </Text>
          </View>
          <Switch
            value={isLiteMode}
            onValueChange={(val) => setLiteMode(val)}
            trackColor={{ false: '#D1D5DB', true: tokens.colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        {menuItems.map((item) => (
          <Pressable
            key={item.id}
            style={styles.menuItem}
            onPress={item.onPress}
          >
            <View style={styles.menuIconWrapper}>
              <Ionicons
                name={item.iconName}
                size={22}
                color={tokens.colors.primary}
              />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
        ))}

        {/* ── LOGOUT BUTTON ── */}
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

        {/* Space for the absolute tab bar */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── MODAL PARA VINCULAR Y VERIFICAR TELÉFONO VIA SMS OTP (POST /auth/phone/link) ── */}
      <PhoneLinkModal
        visible={showPhoneModal}
        onClose={() => setShowPhoneModal(false)}
        onSuccess={() => {
          setShowPhoneModal(false);
          fetchUserData();
        }}
        initialPhoneNumber={userProfile?.phoneNumber || ''}
      />
      {/* ── MODAL PARA EDITAR PERFIL (NOMBRES, APELLIDOS, CÉDULA) ── */}
      <EditProfileModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={() => {
          setShowEditModal(false);
          fetchUserData();
        }}
        userUuid={userProfile?.backendUuid}
        currentFullName={userProfile?.fullName}
        currentNationalId={userProfile?.idNumber}
      />

      {/* ── MODAL CUSTOM PARA CERRAR SESIÓN ── */}
      <Modal
        visible={showLogoutModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (!loggingOut) setShowLogoutModal(false);
        }}
      >
        <Pressable
          style={styles.logoutModalOverlay}
          onPress={() => {
            if (!loggingOut) setShowLogoutModal(false);
          }}
        >
          <Pressable
            style={styles.logoutModalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.logoutIconBadge}>
              <Ionicons name="log-out-outline" size={32} color="#EF4444" />
            </View>

            <Text style={styles.logoutModalTitle}>Cerrar Sesión</Text>
            <Text style={styles.logoutModalDesc}>
              ¿Estás seguro de que deseas cerrar sesión? Tendrás que ingresar
              tus credenciales nuevamente.
            </Text>

            <View style={styles.logoutModalActions}>
              <Pressable
                style={styles.logoutModalCancelBtn}
                onPress={() => setShowLogoutModal(false)}
                disabled={loggingOut}
              >
                <Text style={styles.logoutModalCancelText}>Cancelar</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.logoutModalConfirmBtn,
                  loggingOut && { opacity: 0.7 },
                ]}
                onPress={confirmLogout}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.logoutModalConfirmText}>
                    Cerrar Sesión
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  profileCard: {
    position: 'relative',
    backgroundColor: tokens.colors.primary,
    borderRadius: 32,
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    marginBottom: 24,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  editProfileBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  editProfileBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  avatarContainer: {
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 48,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 28,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
    letterSpacing: 1,
  },
  profileName: {
    fontSize: 24,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  idBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  idText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#E0E7FF',
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#6B7280',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  infoValueBlue: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
    marginTop: 16,
    marginBottom: 16,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  menuIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuInfo: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#9CA3AF',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 18,
    borderRadius: 20,
    marginTop: 12,
    marginBottom: 24,
  },
  logoutText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#DC2626',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verifyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  verifyBadgeText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#EF4444',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  verifiedBadgeText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#10B981',
  },
  debugCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  debugTitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#475569',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginBottom: 4,
  },

  // Modal Custom Cerrar Sesión
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoutModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  logoutIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoutModalTitle: {
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  logoutModalDesc: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  logoutModalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  logoutModalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutModalCancelText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#475569',
  },
  logoutModalConfirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  logoutModalConfirmText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
});
