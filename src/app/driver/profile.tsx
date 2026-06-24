import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
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
import { clearGoFareToken, getBackendProfile } from '@/lib/api';
import { auth, sigOutAccount } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

export default function DriverProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [name, setName] = useState('Conductor');
  const [email, setEmail] = useState('conductor@example.com');
  const [phone, setPhone] = useState('No registrado');
  const [license, setLicense] = useState('V-12345678');

  // Coop / Vehicle info
  const [cooperative, setCooperative] = useState(
    'Cooperativa Caracas Move R.L.',
  );
  const [vehicle, _setVehicle] = useState('Encava ENT-610 - XY987ZT');

  const loadProfileData = useCallback(async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (user) {
        try {
          const backendUser = await getBackendProfile();
          setName(
            backendUser.displayName ||
              `${backendUser.firstName || ''} ${backendUser.lastName || ''}`.trim() ||
              'Conductor',
          );
          setEmail(backendUser.email);
          setPhone(backendUser.phoneNumber || 'No registrado');
        } catch (apiErr) {
          console.warn(
            '[DriverProfile] API error, falling back to local cache:',
            apiErr,
          );
          try {
            const cached = await AsyncStorage.getItem(
              'gofare_cached_user_profile',
            );
            if (cached) {
              const cachedData = JSON.parse(cached);
              setName(
                cachedData.fullName || cachedData.displayName || 'Conductor',
              );
              setEmail(
                cachedData.email || user.email || 'conductor@example.com',
              );
              setPhone(cachedData.phoneNumber || 'No registrado');
              setLicense(
                cachedData.nationalId || cachedData.idNumber || 'V-12345678',
              );
            }
          } catch (cacheErr) {
            console.warn(
              '[DriverProfile] Error loading cached data:',
              cacheErr,
            );
          }
        }
      }

      // Cargar info de cooperativa si existiera local
      const coopStr = await AsyncStorage.getItem(
        'mock_vehicle_owner_cooperative',
      );
      if (coopStr) {
        const coopData = JSON.parse(coopStr);
        setCooperative(coopData.businessName);
      }
    } catch (err) {
      console.warn('[DriverProfile] Error loading data:', err);
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
      '¿Estás seguro de que deseas finalizar tu turno y cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoggingOut(true);

              // Apagar servicio del chofer primero
              await AsyncStorage.setItem('driver_service_status', 'inactive');

              try {
                await sigOutAccount();
              } catch (authError) {
                console.warn(
                  '[DriverProfile] Firebase signOut error (using offline cleanup):',
                  authError,
                );
              }

              await clearGoFareToken();

              try {
                await SecureStore.deleteItemAsync('savedEmail');
                await SecureStore.deleteItemAsync('savedPassword');
                await AsyncStorage.removeItem('gofare_cached_user_profile');
                await AsyncStorage.removeItem('temp_auth');
                await AsyncStorage.removeItem('user_role');
                // Mantener limpia la lista local de boletos validados si el chofer lo requiere,
                // pero la dejamos persistente en AsyncStorage para que no pierda su historial entre cierres de sesión
              } catch (err) {
                console.warn(
                  '[DriverProfile] Error clearing local caches:',
                  err,
                );
              }

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

        {/* Coop Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>COOPERATIVA Y UNIDAD</Text>
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
          <View style={styles.row}>
            <View style={styles.iconWrapper}>
              <Ionicons name="bus" size={20} color="#FFFFFF" />
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
