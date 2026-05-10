import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  ProfileInfoCard,
  ProfileMenuItem,
  UserProfile,
} from '@/interfaces';
import { auth, getDocument, sigOutAccount } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

export default function ProfileScreen() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const data = await getDocument(`users/${user.uid}`);
          if (data) {
            setUserProfile(data as UserProfile);
          }
        } catch (error) {
          console.error('[Profile] Error fetching user data:', error);
        }
      }
      setLoading(false);
    };

    fetchUserData();
  }, []);

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
    {
      label: 'CIUDAD',
      value: userProfile?.city || 'Caracas, Venezuela',
      type: 'location',
    },
  ];

  // Ítems del menú — tipados con ProfileMenuItem[]
  const menuItems: ProfileMenuItem[] = [
    {
      id: 'payments',
      title: 'Métodos de Pago',
      subtitle: 'Visa, Master y Pago Móvil',
      iconName: 'card',
      onPress: () => {},
    },
    {
      id: 'security',
      title: 'Seguridad y Contraseña',
      subtitle: '2FA y cambio de clave',
      iconName: 'lock-closed',
      onPress: () => {},
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
    Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoggingOut(true);
            await sigOutAccount();
            router.replace('/login');
          } catch (error) {
            console.error('Error al cerrar sesión:', error);
            Alert.alert('Error', 'No se pudo cerrar sesión. Intenta de nuevo.');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Pressable hitSlop={10} style={styles.menuBtn}>
          <Ionicons name="menu" size={28} color={tokens.colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>GoFair</Text>
        <Image
          source={{ uri: 'https://i.pravatar.cc/150?img=11' }}
          style={styles.headerAvatar}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── PROFILE CARD ── */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Image
              source={{
                uri:
                  userProfile?.photoURL || 'https://i.pravatar.cc/150?img=11',
              }}
              style={styles.profileAvatar}
            />
          </View>
          <Text style={styles.profileName}>
            {userProfile?.fullName || 'Usuario'}
          </Text>
          <View style={styles.idBadge}>
            <Text style={styles.idText}>Cedula: {userProfile?.idNumber}</Text>
          </View>
        </View>

        {/* ── INFO CARDS ── */}
        {infoCards.map((card, idx) => (
          <View key={idx} style={styles.infoCard}>
            <Text style={styles.infoLabel}>{card.label}</Text>
            {card.type === 'location' ? (
              <View style={styles.locationRow}>
                <Ionicons
                  name="location-outline"
                  size={20}
                  color="#0F766E"
                  style={styles.locationIcon}
                />
                <Text style={styles.infoValueDark}>{card.value}</Text>
              </View>
            ) : (
              <Text style={styles.infoValueBlue}>{card.value}</Text>
            )}
          </View>
        ))}

        {/* ── CONFIGURATION SECTION ── */}
        <Text style={styles.sectionTitle}>Configuración de la Cuenta</Text>

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
    backgroundColor: 'transparent',
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
  headerAvatar: {
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
  profileCard: {
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
  avatarContainer: {
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 46,
    marginBottom: 16,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
  locationIcon: {
    marginRight: 8,
  },
  infoValueDark: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
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
});
