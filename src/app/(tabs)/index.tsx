import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionCard } from '@/components/Home/ActionCard';
import { BalanceCard } from '@/components/Home/BalanceCard';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { PhoneLinkModal } from '@/components/PhoneLinkModal';
import { useLiteMode } from '@/context/LiteModeContext';
import type { UserProfile } from '@/interfaces';
import {
  createFareAccount,
  getBackendProfile,
  getFareAccountByUserId,
} from '@/lib/api';
import { auth } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

export default function HomeDashboard() {
  const router = useRouter();
  const { isLiteMode } = useLiteMode();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPhoneLink, setShowPhoneLink] = useState(false);

  const fetchUserData = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setUserProfile(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // 1. Cargar desde la caché local solo si pertenece al usuario autenticado actual
    try {
      const cached = await AsyncStorage.getItem('gofare_cached_user_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.email === 'invitado@gofare.dev' || (parsed.uid && parsed.uid !== user.uid)) {
          await AsyncStorage.removeItem('gofare_cached_user_profile');
        } else {
          setUserProfile(parsed);
          if (isLiteMode && !refreshing) {
            setLoading(false);
            return;
          }
        }
      }
    } catch (cacheErr) {
      console.warn('[Home] Error al cargar caché del perfil:', cacheErr);
    }

    try {
      // Obtener perfil y cuenta de tarifa desde el backend de GoFare
      const backendUser = await getBackendProfile();
      let fareAccount = null;
      try {
        fareAccount = await getFareAccountByUserId(backendUser.id);
      } catch (_) {
        // Si no existe la cuenta de tarifa, la creamos
        try {
          fareAccount = await createFareAccount(backendUser.id);
        } catch (createError: unknown) {
          console.error(
            '[Home] Error al crear la cuenta de tarifa:',
            createError,
          );
          const errMsg = (createError as { message?: string })?.message || '';
          if (
            errMsg.includes('phone/link') ||
            errMsg.includes('phone number') ||
            errMsg.includes('auth/phone/link')
          ) {
            // Se omite la vinculación telefónica por ahora
            // setShowPhoneLink(true);
          }
        }
      }

      // Obtener carnetId de caché local o generar uno nuevo
      let carnetId = 'GO-0000-0000';
      try {
        const cached = await AsyncStorage.getItem('gofare_cached_user_profile');
        if (cached) {
          const cachedProfile = JSON.parse(cached);
          if (cachedProfile.carnetId) {
            carnetId = cachedProfile.carnetId;
          }
        }
      } catch (e) {
        console.warn('[Home] Error al cargar carnetId de la caché:', e);
      }

      if (carnetId === 'GO-0000-0000') {
        carnetId = `GO-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const updatedProfile = {
        uid: user.uid,
        fullName:
          backendUser.displayName ||
          `${backendUser.firstName || ''} ${backendUser.lastName || ''}`.trim() ||
          'Usuario',
        displayName:
          backendUser.displayName ||
          `${backendUser.firstName || ''} ${backendUser.lastName || ''}`.trim() ||
          'Usuario',
        idNumber: backendUser.nationalId || 'V-00000000',
        email: backendUser.email,
        phoneNumber: backendUser.phoneNumber || '',
        balance: fareAccount?.balance ?? 0,
        carnetId,
        createdAt: backendUser.createdAt,
      };

      const ticketProfile = {
        ...updatedProfile,
        balance: Number(fareAccount?.balance ?? 0),
      };

      setUserProfile(ticketProfile);
      // Guardar en la caché local
      await AsyncStorage.setItem(
        'gofare_cached_user_profile',
        JSON.stringify(ticketProfile),
      );

      // Sincronizar el rol del usuario para evitar desvíos o incoherencias
      const isAdmin = (backendUser as any).roles?.some(
        (role: any) => role.name === 'platform_admin' || role.name === 'admin',
      );
      const isOwner = (backendUser as any).roles?.some(
        (role: any) => role.name === 'transport_owner',
      );
      const isDriver = (backendUser as any).roles?.some(
        (role: any) => role.name === 'driver',
      );
      let newRole = isAdmin
        ? 'platform_admin'
        : isOwner
          ? 'transport_owner'
          : isDriver
            ? 'driver'
            : 'passenger';

      // Fallback a Firebase Custom Claims si el backend devuelve 'passenger'
      if (newRole === 'passenger') {
        try {
          const { auth: firebaseAuth } = await import('@/lib/firebase');
          const fbUser = firebaseAuth.currentUser;
          if (fbUser) {
            const idTokenResult = await fbUser.getIdTokenResult(false);
            const claimRole = (idTokenResult.claims as any)?.role as
              | string
              | undefined;
            const PRIVILEGED_ROLES = [
              'platform_admin',
              'admin',
              'transport_owner',
              'driver',
            ];
            if (claimRole && PRIVILEGED_ROLES.includes(claimRole)) {
              console.log('[Home] Usando Custom Claim para rol:', claimRole);
              newRole = claimRole;
            }
          }
        } catch (claimErr) {
          console.warn('[Home] Error leyendo custom claims:', claimErr);
        }
      }

      await SecureStore.setItemAsync('user_role', newRole);

      if (newRole === 'platform_admin' || newRole === 'admin') {
        console.log('[Home] User is platform admin, redirecting...');
        router.replace('/admin/dashboard' as any);
      } else if (newRole === 'transport_owner') {
        console.log('[Home] User is transport owner, redirecting...');
        router.replace('/vehicle-owner/dashboard' as any);
      } else if (newRole === 'driver') {
        console.log('[Home] User is driver, redirecting...');
        router.replace('/driver/dashboard' as any);
      }
    } catch (error: any) {
      console.log(
        '[Home] Error al obtener datos del backend:',
        error.message || error,
      );
      // Si el error es de autorización (Unauthorized), no hacemos fallback
      if (error?.message === 'Unauthorized') {
        return;
      }
      // Fallback a caché local en caso de error de conexión
      try {
        const cached = await AsyncStorage.getItem('gofare_cached_user_profile');
        if (cached) {
          setUserProfile(JSON.parse(cached));
        }
      } catch (cacheErr: any) {
        console.log(
          '[Home] Error en fallback de caché local:',
          cacheErr.message || cacheErr,
        );
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, [router.replace, isLiteMode, refreshing]);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [fetchUserData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserData();
  };

  /* Rutas cercanas comentadas temporalmente
  const nearbyRoutes: Route[] = [
    {
      number: '201',
      title: 'Chacaíto - El Hatillo',
      subtitle: 'Llega en 4 min • 1.2 km',
      status: 'ÓPTIMO',
      icon: 'time-outline',
      estimatedArrivalMin: 4,
    },
    {
      number: 'L1',
      title: 'Propatria - Palo Verde',
      subtitle: 'Frecuencia: 6 min',
      status: 'REGULAR',
      type: 'metro',
      statusType: 'primary',
      icon: 'flash-outline',
    },
  ];
  */

  if (loading && !refreshing) {
    return <AppLoadingScreen message="Sincronizando información de tu cuenta..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* ── CUSTOM HEADER ── */}
      <View style={styles.header}>
        <View style={styles.headerIcon} />
        <Text style={styles.headerTitle}>GoFare</Text>
        <Pressable style={styles.headerIcon}>
          <Ionicons
            name="notifications-outline"
            size={26}
            color={tokens.colors.primary}
          />
          <View style={styles.notificationDot} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
        {/* ── GREETING ── */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingLabel}>¡HOLA DE NUEVO!</Text>
          <Text style={styles.userName}>
            Hola, {userProfile?.fullName?.split(' ')[0] || 'Usuario'}
          </Text>
          <Text style={styles.greetingSub}>¿A dónde te diriges hoy?</Text>
        </View>

        {/* ── QUICK ACTIONS ── */}
        <View style={styles.actionsRow}>
          <ActionCard
            title="Comprar Tickets"
            subtitle="Adquiere tickets vía Pago Móvil o tarjeta"
            icon="ticket"
            onPress={() => router.push('/topup')}
          />
          <ActionCard
            title="Pagar viaje"
            subtitle="Escanea el código en la unidad"
            icon="qrcode-scan"
            color={tokens.colors.iconGreen}
            onPress={() => router.push('/pay')}
          />
        </View>

        {/* ── BALANCE CARD ── */}
        <BalanceCard
          balance={userProfile?.balance ?? 0}
          carnetId={userProfile?.idNumber || 'V-00000000'}
        />

        {/* ── ROUTES SECTION (Comentado) ──
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Rutas Cercanas</Text>
          <Pressable>
            <Text style={styles.viewMap}>VER MAPA</Text>
          </Pressable>
        </View>

        {nearbyRoutes.map((route) => (
          <RouteItem
            key={route.number}
            number={route.number}
            label={route.label}
            title={route.title}
            subtitle={route.subtitle}
            status={route.status}
            type={route.type}
            statusType={route.statusType}
            icon={route.icon}
          />
        ))}
        */}

        {/* ── MAP SECTION (Comentado) ──
        <MapCard />
        */}

        {/* Padding for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      <PhoneLinkModal
        visible={showPhoneLink}
        onClose={() => setShowPhoneLink(false)}
        onSuccess={() => {
          fetchUserData();
        }}
        initialPhoneNumber={userProfile?.phoneNumber}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
  },
  headerIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  greetingSection: {
    marginBottom: 24,
  },
  greetingLabel: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.textGray,
    letterSpacing: 1,
    marginBottom: 4,
  },
  userName: {
    fontSize: 32,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.textDark,
  },
  greetingSub: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.regular,
    color: tokens.colors.textGray,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.textDark,
  },
  viewMap: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
    letterSpacing: 0.5,
  },
});
