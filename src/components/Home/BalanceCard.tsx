import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BalanceCardProps } from '@/interfaces';
import { tokens } from '@/theme/tokens';

export const BalanceCard = ({ balance, carnetId }: BalanceCardProps) => {
  const router = useRouter();
  const currentBalance =
    typeof balance === 'number' ? balance : parseFloat(balance as any) || 0;

  return (
    <LinearGradient
      colors={['#1E40AF', '#3B82F6', '#0EA5E9']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={styles.label}>FARES DISPONIBLES</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balance}>{currentBalance.toFixed(2)}</Text>
            <Text style={styles.currency}>
              {' '}
              {currentBalance === 1 ? 'fare' : 'fares'}
            </Text>
          </View>
          <Text style={styles.subLabel}>Toca para comprar más →</Text>
        </View>
        <Pressable
          style={styles.buyButton}
          onPress={() => router.push('/(tabs)/topup')}
        >
          <MaterialCommunityIcons
            name="ticket-confirmation"
            size={22}
            color="#FFFFFF"
          />
        </Pressable>
      </View>

      <View style={styles.bottomRow}>
        <View>
          <Text style={styles.labelSmall}>CARACAS MOVE ID</Text>
          <Text style={styles.idNumber}>
            {carnetId || '0000 • 0000 • 0000'}
          </Text>
        </View>
        <View style={styles.iconRow}>
          <View style={[styles.miniIcon, { backgroundColor: '#065F46' }]}>
            <Ionicons name="bus" size={14} color="#FFFFFF" />
          </View>
          <View
            style={[
              styles.miniIcon,
              { backgroundColor: '#1E40AF', marginLeft: 8 },
            ]}
          >
            <Ionicons name="scan" size={14} color="#FFF" />
          </View>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 30,
    padding: 24,
    height: 220,
    justifyContent: 'space-between',
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 15,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    letterSpacing: 1,
    marginBottom: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  balance: {
    color: '#FFFFFF',
    fontSize: 52,
    fontFamily: tokens.typography.fontFamily.black,
    lineHeight: 60,
  },
  currency: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    marginLeft: 4,
  },
  subLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    marginTop: 4,
  },
  buyButton: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  labelSmall: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    marginBottom: 2,
  },
  idNumber: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  iconRow: {
    flexDirection: 'row',
  },
  miniIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
