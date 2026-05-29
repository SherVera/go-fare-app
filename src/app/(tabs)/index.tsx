import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
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
import { MapCard } from '@/components/Home/MapCard';
import { RouteItem } from '@/components/Home/RouteItem';
import type { Route, UserProfile } from '@/interfaces';
import {
  createFareAccount,
  getBackendProfile,
  getFareAccountByUserId,
} from '@/lib/api';
import { auth, getDocument } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeDashboard() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUserData = useCallback(async () => {
    // 1. Cargar desde la caché local de forma instantánea
    try {
      const cached = await AsyncStorage.getItem('gofare_cached_user_profile');
      if (cached) {
        setUserProfile(JSON.parse(cached));
      }
    } catch (cacheErr) {
      console.warn('[Home] Error al cargar caché del perfil:', cacheErr);
    }
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // Obtener perfil y cuenta de tarifa desde el backend de GoFare
      const backendUser = await getBackendProfile();
      let fareAccount;
      try {
        fareAccount = await getFareAccountByUserId(backendUser.id);
      } catch (_) {
        // Si no existe la cuenta de tarifa, la creamos
        try {
          fareAccount = await createFareAccount(backendUser.id);
        } catch (createError) {
          console.error(
            '[Home] Error al crear la cuenta de tarifa:',
            createError,
          );
        }
      }

      // Obtener datos legacy de Firestore para compatibilidad (carnetId, idNumber)
      const legacyData = await getDocument(`users/${user.uid}`).catch(
        () => null,
      );
      const carnetId =
        legacyData?.carnetId ||
        `GO-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;

      const updatedProfile = {
        uid: user.uid,
        fullName:
          backendUser.displayName ||
          `${backendUser.firstName || ''} ${backendUser.lastName || ''}`.trim() ||
          legacyData?.fullName ||
          'Usuario',
        displayName:
          backendUser.displayName ||
          `${backendUser.firstName || ''} ${backendUser.lastName || ''}`.trim() ||
          legacyData?.fullName ||
          'Usuario',
        idNumber: legacyData?.idNumber || 'V-00000000',
        email: backendUser.email,
        phoneNumber: backendUser.phoneNumber || legacyData?.phoneNumber || '',
        balance: fareAccount?.balance ?? 0,
        carnetId,
        createdAt: backendUser.createdAt,
      };

      setUserProfile(updatedProfile);
      // Guardar en la caché local
      await AsyncStorage.setItem('gofare_cached_user_profile', JSON.stringify(updatedProfile));

      // Sincronizar el rol del usuario para evitar desvíos o incoherencias
      const isOwner = (backendUser as any).roles?.some((role: any) => role.name === 'transport_owner');
      const isDriver = (backendUser as any).roles?.some((role: any) => role.name === 'driver');
      const newRole = isOwner ? 'transport_owner' : isDriver ? 'driver' : 'passenger';
      await AsyncStorage.setItem('user_role', newRole);

      if (isOwner) {
        console.log('[Home] User is transport owner, redirecting...');
        router.replace('/vehicle-owner/dashboard' as any);
      } else if (isDriver) {
        console.log('[Home] User is driver, redirecting...');
        router.replace('/driver/dashboard' as any);
      }
    } catch (error: any) {
      console.log('[Home] Error al obtener datos del backend:', error.message || error);
      // Si el error es de autorización (Unauthorized), no hacemos fallback a Firestore
      if (error?.message === 'Unauthorized') {
        return;
      }
      // Fallback a Firestore local en caso de error de conexión
      try {
        const legacyData = await getDocument(`users/${user.uid}`);
        if (legacyData) {
          setUserProfile(legacyData as UserProfile);
        }
      } catch (fbError: any) {
        console.log('[Home] Error en fallback de Firestore:', fbError.message || fbError);
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, []);


  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [fetchUserData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserData();
  };

  // Rutas cercanas — tipadas con la interface Route
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

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.loadingCenter]}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={tokens.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* ── CUSTOM HEADER ── */}
      <View style={styles.header}>
        <View style={styles.headerIcon} />
        <Text style={styles.headerTitle}>GoFair</Text>
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

        {/* ── BALANCE CARD ── */}
        <BalanceCard
          balance={userProfile?.balance ?? 0}
          carnetId={userProfile?.carnetId || '0000 • 0000 • 0000'}
        />

        {/* ── QUICK ACTIONS ── */}
        <View style={styles.actionsRow}>
          <ActionCard
            title="Recargar saldo"
            subtitle="Instantáneo vía Pago Móvil o tarjeta"
            icon="wallet-plus"
            onPress={() => router.push('/topup')}
          />
          <ActionCard
            title="Pagar viajes"
            subtitle="Escanea el código en la unidad"
            icon="qrcode-scan"
            color={tokens.colors.iconGreen}
            onPress={() => router.push('/pay')}
          />
        </View>

        {/* ── ROUTES SECTION ── */}
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

        {/* ── MAP SECTION ── */}
        <MapCard />

        {/* Padding for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
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
