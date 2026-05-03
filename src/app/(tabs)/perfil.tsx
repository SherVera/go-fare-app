import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { tokens } from '@/theme/tokens';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { sigOutAccount } from '@/lib/firebase';

export default function PerfilScreen() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas cerrar sesión?',
      [
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
      ]
    );
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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* ── PROFILE CARD ── */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: 'https://i.pravatar.cc/150?img=11' }}
              style={styles.profileAvatar}
            />
          </View>
          <Text style={styles.profileName}>Carlos Pérez</Text>
          <View style={styles.idBadge}>
            <Text style={styles.idText}>ID: 4892-3012-8821</Text>
          </View>
        </View>

        {/* ── INFO CARDS ── */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>CORREO ELECTRÓNICO</Text>
          <Text style={styles.infoValueBlue}>carlos.perez@email.com</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>TELÉFONO</Text>
          <Text style={styles.infoValueBlue}>+58 412 555 1234</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>CIUDAD</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={20} color="#0F766E" style={styles.locationIcon} />
            <Text style={styles.infoValueDark}>Caracas, Venezuela</Text>
          </View>
        </View>

        {/* ── CONFIGURATION SECTION ── */}
        <Text style={styles.sectionTitle}>Configuración de la Cuenta</Text>
        
        <Pressable style={styles.menuItem}>
          <View style={styles.menuIconWrapper}>
            <Ionicons name="card" size={22} color={tokens.colors.primary} />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Métodos de Pago</Text>
            <Text style={styles.menuSubtitle}>Visa, Master y Pago Móvil</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </Pressable>

        <Pressable style={styles.menuItem}>
          <View style={styles.menuIconWrapper}>
            <Ionicons name="lock-closed" size={22} color={tokens.colors.primary} />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Seguridad y Contraseña</Text>
            <Text style={styles.menuSubtitle}>2FA y cambio de clave</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </Pressable>

        <Pressable style={styles.menuItem}>
          <View style={styles.menuIconWrapper}>
            <Ionicons name="notifications" size={22} color={tokens.colors.primary} />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Notificaciones</Text>
            <Text style={styles.menuSubtitle}>Alertas de viaje y recargas</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </Pressable>

        <Pressable style={styles.menuItem}>
          <View style={styles.menuIconWrapper}>
            <Ionicons name="information-circle" size={24} color={tokens.colors.primary} />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Ayuda y Soporte</Text>
            <Text style={styles.menuSubtitle}>Centro de asistencia 24/7</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </Pressable>

        {/* ── LOGOUT BUTTON ── */}
        <Pressable
          style={[styles.logoutBtn, loggingOut && { opacity: 0.6 }]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#DC2626" style={{ marginRight: 8 }} />
          ) : (
            <Ionicons name="log-out-outline" size={22} color="#DC2626" style={{ marginRight: 8 }} />
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
