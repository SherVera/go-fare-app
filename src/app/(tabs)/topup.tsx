import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PaymentMethod, QuickAmount, TopupFormState } from '@/interfaces';
import { tokens } from '@/theme/tokens';

export default function TopupScreen() {
  const router = useRouter();
  // Estado del formulario — tipado con TopupFormState
  const [amount, setAmount] = useState<TopupFormState['amount']>('50');
  const [selectedQuickAmount, setSelectedQuickAmount] =
    useState<TopupFormState['selectedQuickAmount']>(50);
  const [selectedMethod, setSelectedMethod] =
    useState<TopupFormState['selectedMethod']>('pago_movil');

  // Métodos de pago disponibles — tipados con PaymentMethod[]
  const paymentMethods: PaymentMethod[] = [
    {
      id: 'pago_movil',
      title: 'Pago Móvil',
      subtitle: 'Transferencia instantánea',
      iconName: 'bank',
      iconBgColor: '#EFF6FF',
      iconColor: tokens.colors.primary,
    },
    {
      id: 'tarjeta',
      title: 'Tarjeta Débito/Crédito',
      subtitle: 'Mastercard •••• 8829',
      iconName: 'credit-card',
      iconBgColor: '#ECFDF5',
      iconColor: '#10B981',
    },
    {
      id: 'cripto',
      title: 'Criptomonedas',
      subtitle: 'Binance Pay / USDT',
      iconName: 'bitcoin',
      iconBgColor: '#FAF5FF',
      iconColor: '#A855F7',
    },
  ];

  const handleQuickAmount = (val: QuickAmount) => {
    setSelectedQuickAmount(val);
    setAmount(val.toString());
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={tokens.colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Recargar Saldo</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── BALANCE CARD ── */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo Actual</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.currencySymbol}>Bs. </Text>
            <Text style={styles.balanceAmount}>450,00</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Activo</Text>
            </View>
          </View>
          <View style={styles.lastRechargeRow}>
            <Ionicons
              name="time-outline"
              size={14}
              color="#E0E7FF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.lastRechargeText}>
              Última recarga: Hace 2 días
            </Text>
          </View>
        </View>

        {/* ── MONTO A RECARGAR ── */}
        <Text style={styles.sectionTitle}>MONTO A RECARGAR</Text>
        <View style={styles.amountContainer}>
          <View style={styles.inputWrapper}>
            <Text style={styles.currencyPrefix}>Bs.</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0,00"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={amount}
              onChangeText={(text) => {
                setAmount(text);
                setSelectedQuickAmount(null);
              }}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.quickAmountsRow}>
            {([10, 20, 50, 100] as QuickAmount[]).map((val) => {
              const isSelected = selectedQuickAmount === val;
              return (
                <Pressable
                  key={val}
                  style={[
                    styles.quickAmountBtn,
                    isSelected && styles.quickAmountBtnSelected,
                  ]}
                  onPress={() => handleQuickAmount(val)}
                >
                  <Text
                    style={[
                      styles.quickAmountText,
                      isSelected && styles.quickAmountTextSelected,
                    ]}
                  >
                    {val}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── MÉTODO DE PAGO ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>MÉTODO DE PAGO</Text>
          <Pressable>
            <Text style={styles.seeAllText}>Ver todos</Text>
          </Pressable>
        </View>

        {paymentMethods.map((method) => {
          const isSelected = selectedMethod === method.id;
          return (
            <Pressable
              key={method.id}
              style={[
                styles.methodCard,
                isSelected && styles.methodCardSelected,
              ]}
              onPress={() => setSelectedMethod(method.id)}
            >
              <View
                style={[
                  styles.methodIconWrapper,
                  { backgroundColor: method.iconBgColor },
                ]}
              >
                <MaterialCommunityIcons
                  name={method.iconName}
                  size={22}
                  color={method.iconColor}
                />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>{method.title}</Text>
                <Text style={styles.methodSubtitle}>{method.subtitle}</Text>
              </View>
              <View
                style={[
                  styles.radioOuter,
                  isSelected && {
                    borderColor: tokens.colors.primary,
                  },
                ]}
              >
                {isSelected && <View style={styles.radioInner} />}
              </View>
            </Pressable>
          );
        })}

        {/* ── RESUMEN TOTAL ── */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Monto Recarga</Text>
            <Text style={styles.summaryValue}>
              Bs.{' '}
              {amount
                ? parseFloat(amount.replace(',', '.'))
                    .toFixed(2)
                    .replace('.', ',')
                : '0,00'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Comisión (0%)</Text>
            <Text style={styles.summaryValue}>Bs. 0,00</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={[styles.summaryRow, { marginBottom: 0 }]}>
            <Text style={styles.summaryTotalLabel}>Total a pagar</Text>
            <Text style={styles.summaryTotalValue}>
              Bs.{' '}
              {amount
                ? parseFloat(amount.replace(',', '.'))
                    .toFixed(2)
                    .replace('.', ',')
                : '0,00'}
            </Text>
          </View>
        </View>

        {/* ── PAY BUTTON ── */}
        <Pressable style={styles.mainButton}>
          <Text style={styles.mainButtonText}>Pagar ahora</Text>
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
    backgroundColor: '#F8FAFC', // Light gray/blue to contrast with cards
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'transparent',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  balanceCard: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  balanceLabel: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#DBEAFE',
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  currencySymbol: {
    fontSize: 24,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  balanceAmount: {
    fontSize: 48,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
    marginRight: 12,
  },
  statusBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  lastRechargeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastRechargeText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#E0E7FF',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  amountContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  currencyPrefix: {
    fontSize: 32,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
    marginRight: 12,
  },
  amountInput: {
    flex: 1,
    fontSize: 48,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#D1D5DB', // Light color matching placeholder in image
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 24,
  },
  quickAmountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAmountBtn: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  quickAmountBtnSelected: {
    backgroundColor: tokens.colors.primary,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  quickAmountText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#374151',
  },
  quickAmountTextSelected: {
    color: '#FFFFFF',
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  methodCardSelected: {
    borderColor: tokens.colors.primary,
    backgroundColor: '#F8FAFC',
  },
  methodIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
    marginBottom: 4,
  },
  methodSubtitle: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#6B7280',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: tokens.colors.primary,
  },
  mainButton: {
    backgroundColor: tokens.colors.primary,
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  mainButtonText: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  summaryCard: {
    backgroundColor: '#F1F5F9', // The distinct gray background of the total card
    borderRadius: 24,
    padding: 24,
    marginTop: 8,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
  },
  summaryTotalValue: {
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
});
