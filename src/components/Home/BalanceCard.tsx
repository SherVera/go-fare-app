import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLiteMode } from '@/context/LiteModeContext';
import type { BalanceCardProps } from '@/interfaces';
import { tokens } from '@/theme/tokens';

export const BalanceCard = ({ balance, carnetId }: BalanceCardProps) => {
  const router = useRouter();
  const { isLiteMode } = useLiteMode();
  const currentBalance =
    typeof balance === 'number' ? balance : parseFloat(balance as any) || 0;

  if (isLiteMode) {
    return (
      <View style={[styles.card, styles.liteCard]}>
        <View style={styles.topRow}>
          <View>
            <Text style={[styles.label, styles.liteLabel]}>TICKETS DISPONIBLES</Text>
            <View style={styles.balanceRow}>
              <Text style={[styles.balance, styles.liteBalance]}>
                {currentBalance.toFixed(2)}
              </Text>
              <Text style={[styles.currency, styles.liteCurrency]}>
                {' '}
                {currentBalance === 1 ? 'ticket' : 'tickets'}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.liteBuyButton}
            onPress={() => router.push('/(tabs)/topup')}
          >
            <MaterialCommunityIcons
              name="ticket-confirmation"
              size={20}
              color="#0EA5E9"
            />
            <Text style={styles.liteBuyText}>Comprar</Text>
          </Pressable>
        </View>

        <View style={styles.bottomRow}>
          <View>
            <Text style={[styles.labelSmall, styles.liteLabel]}>CARACAS MOVE ID</Text>
            <Text style={[styles.idNumber, styles.liteId]}>
              {carnetId || '0000 • 0000 • 0000'}
            </Text>
          </View>
          <View style={styles.liteBadge}>
            <Text style={styles.liteBadgeText}>⚡ LITE</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#1E40AF', '#3B82F6', '#0EA5E9']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={styles.label}>TICKETS DISPONIBLES</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balance}>{currentBalance.toFixed(2)}</Text>
            <Text style={styles.currency}>
              {' '}
              {currentBalance === 1 ? 'ticket' : 'tickets'}
            </Text>
          </View>
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
  liteCard: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 2,
    shadowOpacity: 0.1,
  },
  liteLabel: {
    color: '#94A3B8',
  },
  liteBalance: {
    color: '#38BDF8',
  },
  liteCurrency: {
    color: '#94A3B8',
  },
  liteBuyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  liteBuyText: {
    color: '#38BDF8',
    fontFamily: tokens.typography.fontFamily.bold,
    fontSize: 13,
    marginLeft: 6,
  },
  liteId: {
    color: '#F8FAFC',
  },
  liteBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liteBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.black,
    letterSpacing: 0.8,
  },
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
