import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { UserProfile } from '@/interfaces';
import { tokens } from '@/theme/tokens';

interface LiteHomeScreenProps {
  userProfile: UserProfile | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export function LiteHomeScreen({
  userProfile,
  refreshing,
  onRefresh,
}: LiteHomeScreenProps) {
  const router = useRouter();
  const balance =
    typeof userProfile?.balance === 'number'
      ? userProfile.balance
      : parseFloat((userProfile?.balance as any) || '0') || 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
        {/* ── HEADER ULTRA-LITE LIGHT ── */}
        <View style={styles.header}>
          <View>
            <View style={styles.liteBadge}>
              <Ionicons name="flash" size={12} color={tokens.colors.primary} />
              <Text style={styles.liteBadgeText}>MODO LITE (AHORRO DATOS)</Text>
            </View>
            <Text style={styles.greeting}>
              Hola, {userProfile?.fullName?.split(' ')[0] || 'Pasajero'}
            </Text>
          </View>
          <Pressable
            style={styles.profileBtn}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Ionicons
              name="person-circle-outline"
              size={34}
              color={tokens.colors.primary}
            />
          </Pressable>
        </View>

        {/* ── TARJETA PRINCIPAL DE PASAJE Y ESCÁNER ── */}
        <View style={styles.mainCard}>
          <Text style={styles.balanceLabel}>TICKETS DISPONIBLES</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceNumber}>{balance.toFixed(2)}</Text>
            <Text style={styles.balanceUnit}>
              {balance === 1 ? 'ticket' : 'tickets'}
            </Text>
          </View>

          <Text style={styles.idText}>
            ID: {userProfile?.idNumber || 'V-00000000'}
          </Text>

          {/* BOTÓN PROMINENTE DE ESCANEAR Y PAGAR */}
          <Pressable style={styles.payBtn} onPress={() => router.push('/pay')}>
            <Ionicons name="scan" size={24} color="#FFFFFF" />
            <Text style={styles.payBtnText}>ESCANEAR QR PARA PAGAR</Text>
          </Pressable>
        </View>

        {/* ── BOTONES DE ACCIÓN SECUNDARIOS ── */}
        <View style={styles.actionsRow}>
          <Pressable
            style={styles.actionBtn}
            onPress={() => router.push('/(tabs)/topup')}
          >
            <MaterialCommunityIcons
              name="ticket-confirmation-outline"
              size={22}
              color={tokens.colors.primary}
            />
            <Text style={styles.actionBtnText}>Recargar Saldo</Text>
          </Pressable>

          <Pressable
            style={styles.actionBtn}
            onPress={() => router.push('/(tabs)/trips')}
          >
            <Ionicons
              name="receipt-outline"
              size={20}
              color={tokens.colors.primary}
            />
            <Text style={styles.actionBtnText}>Mis Viajes</Text>
          </Pressable>
        </View>
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
    padding: 18,
    paddingBottom: 110,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  liteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  liteBadgeText: {
    color: tokens.colors.primary,
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  greeting: {
    color: '#0F172A',
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  profileBtn: {
    padding: 2,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  balanceLabel: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    letterSpacing: 1,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
    marginBottom: 2,
  },
  balanceNumber: {
    color: tokens.colors.primary,
    fontSize: 48,
    fontFamily: tokens.typography.fontFamily.black,
  },
  balanceUnit: {
    color: '#64748B',
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.medium,
    marginLeft: 8,
  },
  idText: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    marginBottom: 18,
  },
  payBtn: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  actionBtnText: {
    color: '#0F172A',
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    marginLeft: 8,
  },
});
