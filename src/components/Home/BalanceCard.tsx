import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/theme/tokens';

export const BalanceCard = () => {
  return (
    <LinearGradient
      colors={['#1E40AF', '#3B82F6', '#EAB308']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={styles.label}>SALDO DISPONIBLE</Text>
          <Text style={styles.balance}>
            482,50 <Text style={styles.currency}>Bs</Text>
          </Text>
        </View>
        <Pressable style={styles.nfcButton}>
          <MaterialCommunityIcons name="nfc" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.bottomRow}>
        <View>
          <Text style={styles.labelSmall}>CARACAS MOVE ID</Text>
          <Text style={styles.idNumber}>4892 • 3012 • 8821</Text>
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
  balance: {
    color: '#FFFFFF',
    fontSize: 42,
    fontFamily: tokens.typography.fontFamily.black,
  },
  currency: {
    fontSize: 22,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  nfcButton: {
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
