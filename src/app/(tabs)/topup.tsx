import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  BackendFareAccount,
  PaymentMethod,
  QuickAmount,
  TopupFormState,
} from '@/interfaces';
import {
  addAccountBalance,
  createFareAccount,
  getBackendProfile,
  getFareAccountByUserId,
} from '@/lib/api';
import { tokens } from '@/theme/tokens';

export default function TopupScreen() {
  const router = useRouter();
  
  // Estado del formulario
  const [amount, setAmount] = useState<TopupFormState['amount']>('50');
  const [selectedQuickAmount, setSelectedQuickAmount] =
    useState<TopupFormState['selectedQuickAmount']>(50);
  const [selectedMethod, setSelectedMethod] =
    useState<TopupFormState['selectedMethod']>('pago_movil');

  const [fareAccount, setFareAccount] = useState<BackendFareAccount | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  
  // Estados para el Modal de Pago
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'details' | 'processing' | 'success'>('details');

  // Pago Móvil Form
  const [pmBank, setPmBank] = useState('Banesco');
  const [pmPhone, setPmPhone] = useState('');
  const [pmIdNumber, setPmIdNumber] = useState('');
  const [pmReference, setPmReference] = useState('');

  // Tarjeta Form
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Cripto Form
  const [cryptoTxHash, setCryptoTxHash] = useState('');

  const fetchBalance = useCallback(async () => {
    try {
      const backendUser = await getBackendProfile();
      if (backendUser) {
        // Pre-llenar teléfono del perfil para Pago Móvil
        setPmPhone(backendUser.phoneNumber || '');
        
        let account;
        try {
          account = await getFareAccountByUserId(backendUser.id);
        } catch (_) {
          account = await createFareAccount(backendUser.id);
        }
        setFareAccount(account);
      }
    } catch (error) {
      console.error('[TopUp] Error fetching balance:', error);
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Abre el modal de detalles de pago
  const handleOpenDetails = () => {
    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert(
        'Monto Inválido',
        'Por favor ingresa un monto válido a recargar.',
      );
      return;
    }

    if (!fareAccount) {
      Alert.alert(
        'Error',
        'No se pudo cargar la cuenta de tarifa. Intente más tarde.',
      );
      return;
    }

    // Reiniciar inputs
    setPmReference('');
    setCardHolder('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setCryptoTxHash('');
    
    setPaymentStep('details');
    setShowPaymentModal(true);
  };

  // Validaciones y ejecución del cobro
  const handleConfirmPayment = async () => {
    // Validaciones específicas
    if (selectedMethod === 'pago_movil') {
      if (!/^(0412|0414|0424|0416|0426|0212)\d{7}$/.test(pmPhone.trim())) {
        Alert.alert('Atención', 'Por favor, ingresa un número de teléfono de Pago Móvil válido (11 dígitos).');
        return;
      }
      if (!/^\d{5,10}$/.test(pmIdNumber.trim())) {
        Alert.alert('Atención', 'Por favor, ingresa una cédula de identidad válida.');
        return;
      }
    } else if (selectedMethod === 'tarjeta') {
      if (cardHolder.trim().length < 3) {
        Alert.alert('Atención', 'Por favor, ingresa el nombre del titular de la tarjeta.');
        return;
      }
      const cleanCard = cardNumber.replace(/\s+/g, '');
      if (cleanCard.length < 15 || cleanCard.length > 16) {
        Alert.alert('Atención', 'Por favor, ingresa un número de tarjeta de crédito/débito válido.');
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
        Alert.alert('Atención', 'Por favor, ingresa una fecha de vencimiento válida (MM/AA).');
        return;
      }
      if (cardCvv.trim().length < 3 || cardCvv.trim().length > 4) {
        Alert.alert('Atención', 'Por favor, ingresa un código de seguridad (CVV) válido.');
        return;
      }
    }

    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (!fareAccount) return;

    try {
      setPaymentStep('processing');
      
      // Delay artificial para simular procesamiento bancario/pasarela (UX Premium)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const updatedAccount = await addAccountBalance(
        fareAccount.id,
        numericAmount,
      );
      setFareAccount(updatedAccount);
      setPaymentStep('success');
    } catch (error: any) {
      console.error('[TopUp] Error performing recharge:', error);
      Alert.alert('Error de Pago', error.message || 'No se pudo procesar la transacción bancaria.');
      setPaymentStep('details');
    }
  };

  const handleCloseSuccess = () => {
    setShowPaymentModal(false);
    setAmount('');
    setSelectedQuickAmount(null);
    fetchBalance();
  };

  // Formateadores rápidos de campos
  const handleCardNumberChange = (text: string) => {
    const cleanText = text.replace(/\D/g, '');
    const formatted = cleanText.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNumber(formatted);
  };

  const handleExpiryChange = (text: string) => {
    let cleanText = text.replace(/\D/g, '');
    if (cleanText.length > 2) {
      cleanText = `${cleanText.slice(0, 2)}/${cleanText.slice(2, 4)}`;
    }
    setCardExpiry(cleanText);
  };

  const paymentMethods: PaymentMethod[] = [
    {
      id: 'pago_movil',
      title: 'Pago Móvil',
      subtitle: 'Transferencia instantánea en Bs.',
      iconName: 'bank',
      iconBgColor: '#EFF6FF',
      iconColor: tokens.colors.primary,
    },
    {
      id: 'tarjeta',
      title: 'Tarjeta Débito/Crédito',
      subtitle: 'Visa / Mastercard / Nacional',
      iconName: 'credit-card',
      iconBgColor: '#ECFDF5',
      iconColor: '#10B981',
    },
    {
      id: 'cripto',
      title: 'USDT (Binance Pay)',
      subtitle: 'Criptomonedas instantáneo',
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
            {loadingBalance ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
                style={{ marginRight: 16 }}
              />
            ) : (
              <Text style={styles.balanceAmount}>
                {fareAccount
                  ? fareAccount.balance.toFixed(2).replace('.', ',')
                  : '0,00'}
              </Text>
            )}
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
              Billetera digital GoFare Caracas
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
            {([10, 25, 50, 100] as QuickAmount[]).map((val) => {
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
                  name={method.iconName as any}
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
            <Text style={styles.summaryLabel}>Comisión Pasarela (0%)</Text>
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
        <Pressable
          style={styles.mainButton}
          onPress={handleOpenDetails}
        >
          <Text style={styles.mainButtonText}>Pagar ahora</Text>
        </Pressable>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── MODAL STEP-BY-STEP DE PAGO ── */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (paymentStep !== 'processing') setShowPaymentModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Cabecera del modal */}
            {paymentStep !== 'processing' && (
              <View style={styles.modalHeader}>
                <Text style={styles.modalSheetTitle}>
                  {paymentStep === 'details' ? 'Detalles de Pago' : 'Comprobante de Recarga'}
                </Text>
                {paymentStep === 'details' && (
                  <Pressable onPress={() => setShowPaymentModal(false)} hitSlop={10}>
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </Pressable>
                )}
              </View>
            )}

            {/* PASO 1: Ingreso de detalles */}
            {paymentStep === 'details' && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {selectedMethod === 'pago_movil' && (
                  <View style={styles.formContainer}>
                    <Text style={styles.infoBox}>
                      Realice el Pago Móvil a los siguientes datos antes de confirmar: {'\n'}
                      <Text style={{ fontWeight: 'bold' }}>Banco: Banesco • RIF: J-48291048 • Teléfono: 0412-5551234</Text>
                    </Text>

                    <Text style={styles.modalInputLabel}>BANCO EMISOR</Text>
                    <View style={styles.bankPickerRow}>
                      {['Banesco', 'Mercantil', 'Provincial', 'Venezuela'].map((b) => (
                        <Pressable
                          key={b}
                          style={[styles.bankBubble, pmBank === b && styles.bankBubbleActive]}
                          onPress={() => setPmBank(b)}
                        >
                          <Text style={[styles.bankBubbleText, pmBank === b && styles.bankBubbleTextActive]}>
                            {b}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={styles.modalInputLabel}>TELÉFONO PAGO MÓVIL</Text>
                    <View style={styles.modalInputCard}>
                      <Ionicons name="call-outline" size={20} color={tokens.colors.primary} />
                      <View style={styles.modalInputDivider} />
                      <TextInput
                        style={styles.modalInput}
                        placeholder="ej. 04127177757"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                        maxLength={11}
                        value={pmPhone}
                        onChangeText={setPmPhone}
                      />
                    </View>

                    <Text style={styles.modalInputLabel}>CÉDULA DE IDENTIDAD</Text>
                    <View style={styles.modalInputCard}>
                      <Ionicons name="card-outline" size={20} color={tokens.colors.primary} />
                      <View style={styles.modalInputDivider} />
                      <TextInput
                        style={styles.modalInput}
                        placeholder="ej. 24810294"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        maxLength={10}
                        value={pmIdNumber}
                        onChangeText={setPmIdNumber}
                      />
                    </View>

                    <Text style={styles.modalInputLabel}>NÚMERO DE REFERENCIA (ÚLTIMOS 6 DÍGITOS)</Text>
                    <View style={styles.modalInputCard}>
                      <Ionicons name="receipt-outline" size={20} color={tokens.colors.primary} />
                      <View style={styles.modalInputDivider} />
                      <TextInput
                        style={styles.modalInput}
                        placeholder="ej. 829104"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        maxLength={6}
                        value={pmReference}
                        onChangeText={setPmReference}
                      />
                    </View>
                  </View>
                )}

                {selectedMethod === 'tarjeta' && (
                  <View style={styles.formContainer}>
                    <Text style={styles.modalInputLabel}>NOMBRE EN LA TARJETA</Text>
                    <View style={styles.modalInputCard}>
                      <Ionicons name="person-outline" size={20} color="#10B981" />
                      <View style={styles.modalInputDivider} />
                      <TextInput
                        style={styles.modalInput}
                        placeholder="ej. Carlos Pérez"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="words"
                        value={cardHolder}
                        onChangeText={setCardHolder}
                      />
                    </View>

                    <Text style={styles.modalInputLabel}>NÚMERO DE TARJETA</Text>
                    <View style={styles.modalInputCard}>
                      <Ionicons name="card-outline" size={20} color="#10B981" />
                      <View style={styles.modalInputDivider} />
                      <TextInput
                        style={styles.modalInput}
                        placeholder="0000 0000 0000 0000"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        maxLength={19}
                        value={cardNumber}
                        onChangeText={handleCardNumberChange}
                      />
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View style={{ width: '48%' }}>
                        <Text style={styles.modalInputLabel}>VENCIMIENTO</Text>
                        <View style={styles.modalInputCard}>
                          <TextInput
                            style={styles.modalInput}
                            placeholder="MM/AA"
                            placeholderTextColor="#94A3B8"
                            keyboardType="numeric"
                            maxLength={5}
                            value={cardExpiry}
                            onChangeText={handleExpiryChange}
                          />
                        </View>
                      </View>
                      <View style={{ width: '48%' }}>
                        <Text style={styles.modalInputLabel}>CVV</Text>
                        <View style={styles.modalInputCard}>
                          <TextInput
                            style={styles.modalInput}
                            placeholder="123"
                            placeholderTextColor="#94A3B8"
                            keyboardType="numeric"
                            secureTextEntry={true}
                            maxLength={4}
                            value={cardCvv}
                            onChangeText={setCardCvv}
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {selectedMethod === 'cripto' && (
                  <View style={[styles.formContainer, { alignItems: 'center' }]}>
                    <Text style={styles.binanceTitle}>USDT • Binance Pay</Text>
                    <View style={styles.qrContainer}>
                      <MaterialCommunityIcons name="qrcode" size={140} color="#A855F7" />
                    </View>

                    <View style={styles.payIdRow}>
                      <Text style={styles.payIdLabel}>Pay ID: </Text>
                      <Text style={styles.payIdValue}>28491048</Text>
                      <Pressable
                        style={styles.copyBtn}
                        onPress={() => Alert.alert('Copiado', 'Binance Pay ID copiado al portapapeles.')}
                      >
                        <Ionicons name="copy-outline" size={16} color="#A855F7" />
                      </Pressable>
                    </View>

                    <Text style={[styles.modalInputLabel, { alignSelf: 'flex-start', marginTop: 24 }]}>
                      CÓDIGO DE TRANSACCIÓN / HASH (USDT)
                    </Text>
                    <View style={styles.modalInputCard}>
                      <Ionicons name="link-outline" size={20} color="#A855F7" />
                      <View style={styles.modalInputDivider} />
                      <TextInput
                        style={styles.modalInput}
                        placeholder="ej. TX82910482910..."
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="none"
                        value={cryptoTxHash}
                        onChangeText={setCryptoTxHash}
                      />
                    </View>
                  </View>
                )}

                {/* Botón de confirmar en modal */}
                <Pressable style={styles.modalPayBtn} onPress={handleConfirmPayment}>
                  <Text style={styles.modalPayBtnText}>Confirmar y Recargar</Text>
                </Pressable>
              </ScrollView>
            )}

            {/* PASO 2: Procesando */}
            {paymentStep === 'processing' && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color={tokens.colors.primary} style={{ marginBottom: 20 }} />
                <Text style={styles.processingTitle}>Procesando Pago Seguro...</Text>
                <Text style={styles.processingSubtitle}>
                  Validando los fondos y actualizando tu billetera digital GoFare.
                </Text>
              </View>
            )}

            {/* PASO 3: Éxito */}
            {paymentStep === 'success' && (
              <View style={styles.successContainer}>
                <Ionicons name="checkmark-circle" size={80} color="#10B981" style={{ marginBottom: 16 }} />
                <Text style={styles.successTitle}>¡Recarga Exitosa!</Text>
                <Text style={styles.successSubtitle}>Los fondos han sido acreditados a tu cuenta de tarifa.</Text>

                <View style={styles.receiptCard}>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Monto Acreditado</Text>
                    <Text style={[styles.receiptValue, { color: tokens.colors.primary, fontWeight: 'bold' }]}>
                      Bs. {parseFloat(amount.replace(',', '.')).toFixed(2).replace('.', ',')}
                    </Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Método de Pago</Text>
                    <Text style={styles.receiptValue}>
                      {selectedMethod === 'pago_movil'
                        ? `Pago Móvil (${pmBank})`
                        : selectedMethod === 'tarjeta'
                          ? 'Tarjeta Débito/Crédito'
                          : 'Binance Pay (Crypto)'}
                    </Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Referencia</Text>
                    <Text style={styles.receiptValue}>
                      {selectedMethod === 'pago_movil'
                        ? pmReference
                        : selectedMethod === 'tarjeta'
                          ? 'TXN-CARD-OK'
                          : cryptoTxHash.slice(0, 10).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Fecha y Hora</Text>
                    <Text style={styles.receiptValue}>
                      {new Date().toLocaleString('es-VE')}
                    </Text>
                  </View>
                </View>

                <Pressable style={styles.receiptCloseBtn} onPress={handleCloseSuccess}>
                  <Text style={styles.receiptCloseBtnText}>Entendido</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
    paddingTop: 8,
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
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 16,
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
    color: tokens.colors.textDark,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 24,
  },
  quickAmountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAmountBtn: {
    backgroundColor: '#F1F5F9',
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
    color: '#475569',
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
    backgroundColor: '#FFFFFF',
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
    color: '#64748B',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
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
    marginTop: 16,
  },
  mainButtonText: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  summaryCard: {
    backgroundColor: '#F1F5F9',
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
    color: '#64748B',
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
  // Modal de Pago
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalSheetTitle: {
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
  },
  formContainer: {
    marginBottom: 16,
  },
  infoBox: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    padding: 16,
    borderRadius: 16,
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  modalInputLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  modalInputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalInputDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 12,
  },
  modalInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.medium,
    color: tokens.colors.textDark,
  },
  bankPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  bankBubble: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bankBubbleActive: {
    backgroundColor: '#DBEAFE',
    borderColor: tokens.colors.primary,
  },
  bankBubbleText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#475569',
  },
  bankBubbleTextActive: {
    color: tokens.colors.primary,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  binanceTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#F59E0B',
    marginBottom: 16,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  payIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  payIdLabel: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#475569',
  },
  payIdValue: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
    marginRight: 8,
  },
  copyBtn: {
    padding: 4,
  },
  modalPayBtn: {
    backgroundColor: tokens.colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  modalPayBtnText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  // Procesando Pago
  processingContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  processingTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
    marginBottom: 8,
  },
  processingSubtitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  // Éxito Pago
  successContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  successTitle: {
    fontSize: 22,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#10B981',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  receiptCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    width: '100%',
    marginBottom: 24,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  receiptLabel: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  receiptValue: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
  },
  receiptCloseBtn: {
    backgroundColor: tokens.colors.primary,
    width: '100%',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  receiptCloseBtnText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
});

