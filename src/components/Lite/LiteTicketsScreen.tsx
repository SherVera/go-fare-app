import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { UserProfile } from '@/interfaces';
import { tokens } from '@/theme/tokens';

interface LiteTicketsScreenProps {
  userProfile: UserProfile | null;
}

export function LiteTicketsScreen({ userProfile }: LiteTicketsScreenProps) {
  const router = useRouter();

  const balance =
    typeof userProfile?.balance === 'number'
      ? userProfile.balance
      : parseFloat((userProfile?.balance as any) || '0') || 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Tickets</Text>
        <Text style={styles.subtitle}>
          Escanea el código QR en la unidad de transporte
        </Text>
      </View>

      {/* ── TARJETA PRINCIPAL PARA ESCANEAR Y PAGAR ── */}
      <View style={styles.payCard}>
        <View style={styles.iconContainer}>
          <Ionicons
            name="scan-circle"
            size={90}
            color={tokens.colors.primary}
          />
        </View>

        <Text style={styles.payTitle}>Escanear QR del Autobús</Text>
        <Text style={styles.payDescription}>
          Abre la cámara para leer el código QR del vehículo y confirmar el pago
          de tu pasaje de forma instantánea.
        </Text>

        <Pressable style={styles.scanBtn} onPress={() => router.push('/pay')}>
          <Ionicons name="camera-outline" size={22} color="#FFFFFF" />
          <Text style={styles.scanBtnText}>Abrir Escáner de Pasaje</Text>
        </Pressable>

        <View style={styles.balanceInfoRow}>
          <View>
            <Text style={styles.balanceLabel}>TICKETS DISPONIBLES</Text>
            <Text style={styles.balanceVal}>{balance.toFixed(2)}</Text>
          </View>
          <Pressable
            style={styles.buyBtn}
            onPress={() => router.push('/(tabs)/topup')}
          >
            <MaterialCommunityIcons
              name="ticket-confirmation-outline"
              size={18}
              color={tokens.colors.primary}
            />
            <Text style={styles.buyBtnText}>Recargar</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    color: '#0F172A',
    fontSize: 22,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  payCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  iconContainer: {
    marginBottom: 12,
  },
  payTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    marginBottom: 8,
  },
  payDescription: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  scanBtn: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 24,
  },
  scanBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    marginLeft: 10,
  },
  balanceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 16,
  },
  balanceLabel: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  balanceVal: {
    color: tokens.colors.primary,
    fontSize: 22,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  buyBtnText: {
    color: tokens.colors.primary,
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    marginLeft: 6,
  },
});
