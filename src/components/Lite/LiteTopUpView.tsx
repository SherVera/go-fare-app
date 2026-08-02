import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { topUpBalance } from '@/lib/api';
import { tokens } from '@/theme/tokens';

interface LiteTopUpViewProps {
  balance: number;
  fareUsd: number;
  bcvRate: number;
  onRefreshBalance: () => void;
}

export function LiteTopUpView({
  balance,
  fareUsd,
  bcvRate,
  onRefreshBalance,
}: LiteTopUpViewProps) {
  const router = useRouter();
  const [selectedQty, setSelectedQty] = useState<number>(1);
  const [reference, setReference] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const baseFareBs = fareUsd * bcvRate;
  const totalAmountBs = selectedQty * baseFareBs;

  const packages = [
    { qty: 1, label: '1 Ticket' },
    { qty: 5, label: '5 Tickets' },
    { qty: 10, label: '10 Tickets' },
  ];

  const handleConfirmTopUp = async () => {
    if (!/^\d{4,20}$/.test(reference.trim())) {
      Alert.alert(
        'Atención',
        'Ingresa los últimos dígitos del número de referencia.',
      );
      return;
    }
    if (!/^(04|02)\d{9}$/.test(phone.trim())) {
      Alert.alert(
        'Atención',
        'Ingresa un número de teléfono de Pago Móvil válido (11 dígitos).',
      );
      return;
    }
    if (!/^\d{5,10}$/.test(idNumber.trim())) {
      Alert.alert('Atención', 'Ingresa una cédula de identidad válida.');
      return;
    }

    try {
      setLoading(true);
      await topUpBalance({
        bsAmount: totalAmountBs,
        reference: reference.trim(),
        phone: phone.trim(),
        document: idNumber.trim(),
      });
      Alert.alert(
        '¡Recarga Exitosa!',
        `Se han acreditado los tickets a tu cuenta.`,
      );
      setReference('');
      onRefreshBalance();
    } catch (error: any) {
      Alert.alert(
        'Error de Pago',
        error.message ||
          'No se pudo verificar la referencia. Inténtalo de nuevo.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header Compacto Claro */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={tokens.colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Recargar Tickets</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Card Saldo Actual */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>TICKETS DISPONIBLES</Text>
          <Text style={styles.balanceVal}>{balance.toFixed(2)} tickets</Text>
        </View>

        {/* 1. Seleccionar Paquete */}
        <Text style={styles.sectionTitle}>1. CANTIDAD DE TICKETS</Text>
        <View style={styles.pkgRow}>
          {packages.map((pkg) => {
            const isSel = selectedQty === pkg.qty;
            const priceBs = pkg.qty * baseFareBs;
            return (
              <Pressable
                key={pkg.qty}
                style={[styles.pkgBtn, isSel && styles.pkgBtnActive]}
                onPress={() => setSelectedQty(pkg.qty)}
              >
                <Text style={[styles.pkgQty, isSel && styles.pkgQtyActive]}>
                  {pkg.label}
                </Text>
                <Text style={[styles.pkgPrice, isSel && styles.pkgPriceActive]}>
                  Bs. {priceBs.toFixed(2).replace('.', ',')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 2. Datos de Pago Móvil Receptor */}
        <Text style={styles.sectionTitle}>2. DATOS DE PAGO MÓVIL</Text>
        <View style={styles.bankDataCard}>
          <View style={styles.bankDataRow}>
            <Text style={styles.bankLabel}>Banco:</Text>
            <Text style={styles.bankVal}>Banesco (0134)</Text>
          </View>
          <View style={styles.bankDataRow}>
            <Text style={styles.bankLabel}>RIF / Cédula:</Text>
            <Text style={styles.bankVal}>J-50012345-0</Text>
          </View>
          <View style={styles.bankDataRow}>
            <Text style={styles.bankLabel}>Teléfono:</Text>
            <Text style={styles.bankVal}>0414-1234567</Text>
          </View>
        </View>

        {/* 3. Formulario Directo */}
        <Text style={styles.sectionTitle}>3. INGRESAR REFERENCIA</Text>

        <Text style={styles.inputLabel}>NÚMERO DE REFERENCIA</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 123456"
          placeholderTextColor="#94A3B8"
          keyboardType="numeric"
          value={reference}
          onChangeText={setReference}
        />

        <Text style={styles.inputLabel}>TELÉFONO EMISOR</Text>
        <TextInput
          style={styles.input}
          placeholder="04121234567"
          placeholderTextColor="#94A3B8"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <Text style={styles.inputLabel}>CÉDULA EMISOR</Text>
        <TextInput
          style={styles.input}
          placeholder="V-12345678"
          placeholderTextColor="#94A3B8"
          keyboardType="numeric"
          value={idNumber}
          onChangeText={setIdNumber}
        />

        {/* Botón de Confirmación Directa */}
        <Pressable
          style={[styles.submitBtn, loading && { opacity: 0.6 }]}
          onPress={handleConfirmTopUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={22}
                color="#FFFFFF"
              />
              <Text style={styles.submitBtnText}>
                RECARGAR BS. {totalAmountBs.toFixed(2).replace('.', ',')}
              </Text>
            </>
          )}
        </Pressable>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    marginRight: 12,
  },
  headerTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  balanceLabel: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  balanceVal: {
    color: tokens.colors.primary,
    fontSize: 26,
    fontFamily: tokens.typography.fontFamily.bold,
    marginTop: 4,
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 6,
  },
  pkgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  pkgBtn: {
    flex: 0.31,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pkgBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: tokens.colors.primary,
  },
  pkgQty: {
    color: '#0F172A',
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  pkgQtyActive: {
    color: tokens.colors.primary,
  },
  pkgPrice: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  pkgPriceActive: {
    color: tokens.colors.primary,
    fontFamily: tokens.typography.fontFamily.medium,
  },
  bankDataCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bankDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  bankLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  bankVal: {
    color: '#0F172A',
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  inputLabel: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0F172A',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 10,
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    marginLeft: 8,
  },
});
