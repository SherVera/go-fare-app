import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PaymentMethod } from '@/interfaces';
import {
  createFareAccount,
  getBackendProfile,
  getCurrentRates,
  getFareAccountByUserId,
  topUpBalance,
} from '@/lib/api';
import { tokens } from '@/theme/tokens';

const RECHARGE_PACKAGES_BLUEPRINT = [
  { tickets: 1, discount: 0, tag: null, label: '1 Fare' },
  { tickets: 2, discount: 0, tag: null, label: '2 Fares' },
  { tickets: 5, discount: 0, tag: null, label: '5 Fares' },
  { tickets: 10, discount: 0, tag: 'POPULAR', label: '10 Fares' },
];

const PAYMENT_METHODS: PaymentMethod[] = [
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

export default function TopUpBalanceScreen() {
  const router = useRouter();

  // Estado de tasas de cambio dinámicas (valores por defecto iniciales)
  const [fareUsd, setFareUsd] = useState(0.25);
  const [bcvRate, setBcvRate] = useState(40.0);

  // Tickets seleccionados
  const [selectedTickets, setSelectedTickets] = useState(1);

  // Generar paquetes dinámicos basados en la tasa actual de la DB y valor USD del Fare
  const packages = React.useMemo(() => {
    const baseFareBs = fareUsd * bcvRate;
    return RECHARGE_PACKAGES_BLUEPRINT.map((pkg) => {
      const grossAmount = pkg.tickets * baseFareBs;
      const netAmount = grossAmount * (1 - pkg.discount);
      const savings = grossAmount - netAmount;

      let tagText = pkg.tag;
      if (pkg.tag?.startsWith('AHORRA')) {
        tagText = `${pkg.tag}${savings.toFixed(2).replace('.', ',')}`;
      }

      return {
        tickets: pkg.tickets,
        amount: netAmount,
        label: pkg.label,
        desc: `Bs. ${netAmount.toFixed(2).replace('.', ',')}`,
        tag: tagText,
      };
    });
  }, [fareUsd, bcvRate]);

  // Derivar el paquete seleccionado
  const selectedPkg = React.useMemo(() => {
    return packages.find((p) => p.tickets === selectedTickets) || packages[0];
  }, [packages, selectedTickets]);

  const [selectedMethod, setSelectedMethod] = useState<string>('pago_movil');

  // Estado del saldo del usuario
  const [balance, setBalance] = useState(0.0);
  const [loadingBalance, setLoadingBalance] = useState(true);

  // Perfil del usuario y cuenta
  const [userId, setUserId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  // Modal de pago
  const [showModal, setShowModal] = useState(false);
  const [payStep, setPayStep] = useState<'details' | 'processing' | 'success'>(
    'details',
  );

  // Estado para pull to refresh
  const [refreshing, setRefreshing] = useState(false);

  // Campos de Pago Móvil
  const [pmBank, setPmBank] = useState('Banesco');
  const [pmPhone, setPmPhone] = useState('');
  const [pmIdNumber, setPmIdNumber] = useState('');
  const [pmReference, setPmReference] = useState('');

  // Campos de Tarjeta
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Campos de Cripto
  const [cryptoTxHash, setCryptoTxHash] = useState('');

  const loadUserData = useCallback(async () => {
    try {
      // Consultar tasas actuales en la base de datos
      try {
        const rates = await getCurrentRates();
        if (rates) {
          setFareUsd(rates.fareUsdValue);
          setBcvRate(rates.bcvRate);
        }
      } catch (rateErr) {
        console.warn('[TopUp] Error fetching rates:', rateErr);
      }

      const backendUser = await getBackendProfile();
      if (backendUser) {
        setUserId(backendUser.id);
        setPmPhone(backendUser.phoneNumber || '');

        let account = null;
        try {
          account = await getFareAccountByUserId(backendUser.id);
        } catch (_) {
          try {
            account = await createFareAccount(backendUser.id);
          } catch (createErr) {
            console.warn('[TopUp] Error creating fare account:', createErr);
          }
        }

        if (account) {
          setAccountId(account.id);
          setBalance(Number(account.balance));
        }
      }
    } catch (err) {
      console.warn('[TopUp] Error loading user data:', err);
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  }, [loadUserData]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const handleOpenModal = () => {
    if (!userId || !accountId) {
      Alert.alert('Error', 'No se pudo cargar tu perfil. Intenta de nuevo.');
      return;
    }
    // Resetear campos
    setPmReference('');
    setCardHolder('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setCryptoTxHash('');
    setPayStep('details');
    setShowModal(true);
  };

  const handleConfirmPurchase = async () => {
    // Validaciones
    if (selectedMethod === 'pago_movil') {
      if (!/^(04|02)\d{9}$/.test(pmPhone.trim())) {
        Alert.alert(
          'Atención',
          'Ingresa un número de Pago Móvil válido (11 dígitos).',
        );
        return;
      }
      if (!/^\d{5,10}$/.test(pmIdNumber.trim())) {
        Alert.alert('Atención', 'Ingresa una cédula válida.');
        return;
      }
      if (!/^\d{4,20}$/.test(pmReference.trim())) {
        Alert.alert(
          'Atención',
          'Ingresa el número de referencia del Pago Móvil.',
        );
        return;
      }
    } else if (selectedMethod === 'tarjeta') {
      const cleanCard = cardNumber.replace(/\s+/g, '');
      if (
        cardHolder.trim().length < 3 ||
        cleanCard.length < 15 ||
        cleanCard.length > 16
      ) {
        Alert.alert('Atención', 'Verifica los datos de tu tarjeta.');
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
        Alert.alert('Atención', 'Fecha de vencimiento inválida (MM/AA).');
        return;
      }
      if (cardCvv.trim().length < 3) {
        Alert.alert('Atención', 'CVV inválido.');
        return;
      }
    }

    if (!userId || !accountId) return;

    // Por ahora solo Pago Móvil tiene verificación real en el backend.
    if (selectedMethod !== 'pago_movil') {
      Alert.alert(
        'Método no disponible',
        'Por ahora solo la recarga por Pago Móvil está habilitada.',
      );
      return;
    }

    try {
      setPayStep('processing');

      // Recarga real: el backend verifica la referencia contra la tesorería
      // y acredita según el monto confirmado por el banco.
      const result = await topUpBalance({
        bsAmount: selectedPkg.amount,
        reference: pmReference.trim(),
        phone: pmPhone.trim(),
        document: pmIdNumber.trim(),
      });
      setBalance(Number(result.balanceFares));
      setPayStep('success');
    } catch (error: any) {
      console.error('[TopUp] Purchase error:', error);
      Alert.alert(
        'Error de Recarga',
        error.message ||
          'No pudimos verificar tu pago. Revisa la referencia e intenta nuevamente.',
      );
      setPayStep('details');
    }
  };

  const handleCloseSuccess = () => {
    setShowModal(false);
    loadUserData();
  };

  const handleCardNumberChange = (text: string) => {
    const clean = text.replace(/\D/g, '');
    setCardNumber(clean.replace(/(\d{4})(?=\d)/g, '$1 '));
  };

  const handleExpiryChange = (text: string) => {
    let clean = text.replace(/\D/g, '');
    if (clean.length > 2) clean = `${clean.slice(0, 2)}/${clean.slice(2, 4)}`;
    setCardExpiry(clean);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={tokens.colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Comprar Fares</Text>
      </View>

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
        {/* Tarjeta de Saldo Disponible */}
        <LinearGradient
          colors={['#1E40AF', '#3B82F6', '#0EA5E9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ticketCard}
        >
          <View style={styles.ticketCardTop}>
            <View>
              <Text style={styles.ticketCardLabel}>FARES DISPONIBLES</Text>
              {loadingBalance ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                  style={{ marginTop: 8 }}
                />
              ) : (
                <Text style={styles.ticketCardCount}>{balance.toFixed(2)}</Text>
              )}
              <Text style={styles.ticketCardSub}>
                {balance.toFixed(2)}{' '}
                {balance === 1
                  ? 'fare activo listo para usar'
                  : 'fares activos listos para usar'}
              </Text>
            </View>
            <View style={styles.ticketIconWrapper}>
              <MaterialCommunityIcons
                name="ticket-confirmation"
                size={40}
                color="rgba(255,255,255,0.9)"
              />
            </View>
          </View>

          <View style={styles.ticketCardDivider} />

          <View style={styles.ticketCardBottom}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color="rgba(255,255,255,0.7)"
            />
            <Text style={styles.ticketCardNote}>
              {'  '}Los fares son divisibles y se descuentan según la tarifa de
              la ruta.
            </Text>
          </View>
        </LinearGradient>

        {/* Selector de paquetes */}
        <Text style={styles.sectionTitle}>SELECCIONA TU PAQUETE</Text>
        <View style={styles.packagesGrid}>
          {packages.map((pkg) => {
            const isSelected = selectedTickets === pkg.tickets;
            return (
              <Pressable
                key={pkg.tickets}
                style={[styles.pkgCard, isSelected && styles.pkgCardSelected]}
                onPress={() => setSelectedTickets(pkg.tickets)}
              >
                {pkg.tag && (
                  <View
                    style={[styles.pkgTag, isSelected && styles.pkgTagSelected]}
                  >
                    <Text
                      style={[
                        styles.pkgTagText,
                        isSelected && styles.pkgTagTextSelected,
                      ]}
                    >
                      {pkg.tag}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.pkgIconWrapper,
                    isSelected && styles.pkgIconWrapperSelected,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="ticket"
                    size={26}
                    color={isSelected ? '#FFFFFF' : tokens.colors.primary}
                  />
                  {pkg.tickets > 1 && (
                    <Text
                      style={[
                        styles.pkgQtyOverlay,
                        isSelected && { color: tokens.colors.primary },
                      ]}
                    >
                      x{pkg.tickets}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.pkgLabel,
                    isSelected && styles.pkgLabelSelected,
                  ]}
                >
                  {pkg.label}
                </Text>
                <Text
                  style={[
                    styles.pkgPrice,
                    isSelected && styles.pkgPriceSelected,
                  ]}
                >
                  {pkg.desc}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Método de Pago */}
        <Text style={styles.sectionTitle}>MÉTODO DE PAGO</Text>
        {PAYMENT_METHODS.map((method) => {
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
                  isSelected && { borderColor: tokens.colors.primary },
                ]}
              >
                {isSelected && <View style={styles.radioInner} />}
              </View>
            </Pressable>
          );
        })}

        {/* Resumen */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Paquete seleccionado</Text>
            <Text style={styles.summaryValue}>{selectedPkg.label}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Comisión Pasarela (0%)</Text>
            <Text style={styles.summaryValue}>Bs. 0,00</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={[styles.summaryRow, { marginBottom: 0 }]}>
            <Text style={styles.summaryTotalLabel}>Total a pagar</Text>
            <Text style={styles.summaryTotalValue}>
              Bs. {selectedPkg.amount.toFixed(2).replace('.', ',')}
            </Text>
          </View>
        </View>

        {/* Botón principal */}
        <Pressable style={styles.mainButton} onPress={handleOpenModal}>
          <MaterialCommunityIcons
            name="ticket-confirmation"
            size={20}
            color="#FFFFFF"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.mainButtonText}>
            Comprar Fares — Bs.{' '}
            {selectedPkg.amount.toFixed(2).replace('.', ',')}
          </Text>
        </Pressable>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Modal de pago */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (payStep !== 'processing') setShowModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Header del modal */}
            {payStep !== 'processing' && (
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {payStep === 'details'
                    ? 'Confirmar Compra'
                    : '¡Compra Exitosa!'}
                </Text>
                {payStep === 'details' && (
                  <Pressable onPress={() => setShowModal(false)} hitSlop={10}>
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </Pressable>
                )}
              </View>
            )}

            {/* PASO 1: Detalles de pago */}
            {payStep === 'details' && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Resumen de compra */}
                <View style={styles.purchaseSummaryBox}>
                  <MaterialCommunityIcons
                    name="ticket-confirmation"
                    size={32}
                    color={tokens.colors.primary}
                  />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.purchaseSummaryTitle}>
                      Compra de Fares
                    </Text>
                    <Text style={styles.purchaseSummaryPrice}>
                      {selectedPkg.label}
                    </Text>
                  </View>
                </View>

                {/* Formulario según método */}
                {selectedMethod === 'pago_movil' && (
                  <View style={styles.formContainer}>
                    <Text style={styles.infoBox}>
                      Realiza el Pago Móvil a los datos y luego ingresa la
                      referencia:{'\n'}
                      <Text style={{ fontWeight: 'bold' }}>
                        Banco: Banesco • RIF: J-48291048 • Tel: 0412-5551234
                      </Text>
                    </Text>

                    <Text style={styles.inputLabel}>BANCO EMISOR</Text>
                    <View style={styles.bankPickerRow}>
                      {['Banesco', 'Mercantil', 'Provincial', 'Venezuela'].map(
                        (b) => (
                          <Pressable
                            key={b}
                            style={[
                              styles.bankBubble,
                              pmBank === b && styles.bankBubbleActive,
                            ]}
                            onPress={() => setPmBank(b)}
                          >
                            <Text
                              style={[
                                styles.bankBubbleText,
                                pmBank === b && styles.bankBubbleTextActive,
                              ]}
                            >
                              {b}
                            </Text>
                          </Pressable>
                        ),
                      )}
                    </View>

                    <Text style={styles.inputLabel}>TELÉFONO</Text>
                    <TextInput
                      style={styles.inputField}
                      placeholder="04XX-XXXXXXX"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                      value={pmPhone}
                      onChangeText={setPmPhone}
                    />

                    <Text style={styles.inputLabel}>CÉDULA DE IDENTIDAD</Text>
                    <TextInput
                      style={styles.inputField}
                      placeholder="Ej: 12345678"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      value={pmIdNumber}
                      onChangeText={setPmIdNumber}
                    />

                    <Text style={styles.inputLabel}>NÚMERO DE REFERENCIA</Text>
                    <TextInput
                      style={styles.inputField}
                      placeholder="Ej: 00123456"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      value={pmReference}
                      onChangeText={setPmReference}
                    />
                  </View>
                )}

                {selectedMethod === 'tarjeta' && (
                  <View style={styles.formContainer}>
                    <Text style={styles.inputLabel}>TITULAR DE LA TARJETA</Text>
                    <TextInput
                      style={styles.inputField}
                      placeholder="Nombre como aparece en la tarjeta"
                      placeholderTextColor="#9CA3AF"
                      value={cardHolder}
                      onChangeText={setCardHolder}
                      autoCapitalize="words"
                    />
                    <Text style={styles.inputLabel}>NÚMERO DE TARJETA</Text>
                    <TextInput
                      style={styles.inputField}
                      placeholder="XXXX XXXX XXXX XXXX"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      value={cardNumber}
                      onChangeText={handleCardNumberChange}
                      maxLength={19}
                    />
                    <View style={styles.twoColRow}>
                      <View style={styles.twoColItem}>
                        <Text style={styles.inputLabel}>VENCIMIENTO</Text>
                        <TextInput
                          style={styles.inputField}
                          placeholder="MM/AA"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="number-pad"
                          value={cardExpiry}
                          onChangeText={handleExpiryChange}
                          maxLength={5}
                        />
                      </View>
                      <View style={styles.twoColItem}>
                        <Text style={styles.inputLabel}>CVV</Text>
                        <TextInput
                          style={styles.inputField}
                          placeholder="123"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="number-pad"
                          value={cardCvv}
                          onChangeText={setCardCvv}
                          maxLength={4}
                          secureTextEntry
                        />
                      </View>
                    </View>
                  </View>
                )}

                {selectedMethod === 'cripto' && (
                  <View style={styles.formContainer}>
                    <Text style={styles.infoBox}>
                      Envía exactamente{' '}
                      <Text style={{ fontWeight: 'bold' }}>
                        {(selectedPkg.amount / bcvRate).toFixed(4)} USDT
                      </Text>{' '}
                      a la dirección de Binance Pay y pega el hash de la
                      transacción.
                    </Text>
                    <Text style={styles.inputLabel}>HASH DE TRANSACCIÓN</Text>
                    <TextInput
                      style={styles.inputField}
                      placeholder="0x..."
                      placeholderTextColor="#9CA3AF"
                      value={cryptoTxHash}
                      onChangeText={setCryptoTxHash}
                      autoCapitalize="none"
                    />
                  </View>
                )}

                <Pressable
                  style={styles.confirmBtn}
                  onPress={handleConfirmPurchase}
                >
                  <Text style={styles.confirmBtnText}>
                    Confirmar Compra — Bs.{' '}
                    {selectedPkg.amount.toFixed(2).replace('.', ',')}
                  </Text>
                </Pressable>
                <View style={{ height: 24 }} />
              </ScrollView>
            )}

            {/* PASO 2: Procesando */}
            {payStep === 'processing' && (
              <View style={styles.processingContainer}>
                <ActivityIndicator
                  size="large"
                  color={tokens.colors.primary}
                  style={{ marginBottom: 20 }}
                />
                <Text style={styles.processingTitle}>
                  Procesando tu Compra...
                </Text>
                <Text style={styles.processingSubtitle}>
                  Verificando pago y acreditando los fares a tu cuenta.
                </Text>
              </View>
            )}

            {/* PASO 3: Éxito */}
            {payStep === 'success' && (
              <View style={styles.successContainer}>
                <View style={styles.successIconWrapper}>
                  <Ionicons name="checkmark-circle" size={80} color="#10B981" />
                </View>
                <Text style={styles.successTitle}>¡Compra Exitosa!</Text>
                <Text style={styles.successSubtitle}>
                  Tus nuevos fares disponibles son{' '}
                  <Text
                    style={{
                      fontFamily: tokens.typography.fontFamily.black,
                      color: tokens.colors.primary,
                    }}
                  >
                    {balance.toFixed(2)} {balance === 1 ? 'fare' : 'fares'}
                  </Text>
                  .
                </Text>

                {/* Mini-ticket de comprobante */}
                <View style={styles.receiptBox}>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>FARES ACREDITADOS</Text>
                    <Text style={styles.receiptValue}>{selectedPkg.label}</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>TOTAL PAGADO</Text>
                    <Text style={styles.receiptValue}>
                      Bs. {selectedPkg.amount.toFixed(2).replace('.', ',')}
                    </Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>MÉTODO</Text>
                    <Text style={styles.receiptValue}>
                      {
                        PAYMENT_METHODS.find((m) => m.id === selectedMethod)
                          ?.title
                      }
                    </Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>ESTADO</Text>
                    <Text style={[styles.receiptValue, { color: '#10B981' }]}>
                      CONFIRMADO ✓
                    </Text>
                  </View>
                </View>

                <Pressable
                  style={styles.successBtn}
                  onPress={handleCloseSuccess}
                >
                  <Text style={styles.successBtnText}>¡Listo, Gracias!</Text>
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
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: { marginRight: 12 },
  headerTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },

  // Tarjeta de boletos activos
  ticketCard: {
    borderRadius: 28,
    padding: 24,
    marginBottom: 28,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  ticketCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketCardLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.black,
    letterSpacing: 1,
    marginBottom: 4,
  },
  ticketCardCount: {
    color: '#FFFFFF',
    fontSize: 56,
    fontFamily: tokens.typography.fontFamily.black,
    lineHeight: 64,
  },
  ticketCardSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    marginTop: 4,
  },
  ticketIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketCardDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 16,
  },
  ticketCardBottom: { flexDirection: 'row', alignItems: 'center' },
  ticketCardNote: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.regular,
    flex: 1,
  },

  // Paquetes
  sectionTitle: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 1,
    marginBottom: 14,
    marginTop: 4,
  },
  packagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  pkgCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  pkgCardSelected: {
    borderColor: tokens.colors.primary,
    backgroundColor: '#EFF6FF',
  },
  pkgTag: {
    position: 'absolute',
    top: 10,
    right: -1,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pkgTagSelected: { backgroundColor: tokens.colors.primary },
  pkgTagText: {
    fontSize: 8,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#92400E',
    letterSpacing: 0.3,
  },
  pkgTagTextSelected: { color: '#FFFFFF' },
  pkgIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    marginTop: 8,
    position: 'relative',
  },
  pkgIconWrapperSelected: { backgroundColor: tokens.colors.primary },
  pkgQtyOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -6,
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 3,
    overflow: 'hidden',
  },
  pkgLabel: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#334155',
    marginBottom: 4,
    textAlign: 'center',
  },
  pkgLabelSelected: { color: tokens.colors.primary },
  pkgPrice: {
    fontSize: 17,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#1E293B',
  },
  pkgPriceSelected: { color: tokens.colors.primary },
  pkgPerUnit: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#94A3B8',
    marginTop: 2,
  },
  pkgPerUnitSelected: { color: '#60A5FA' },

  // Métodos de pago
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  methodCardSelected: {
    borderColor: tokens.colors.primary,
    backgroundColor: '#F0F9FF',
  },
  methodIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  methodInfo: { flex: 1 },
  methodTitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
    marginBottom: 2,
  },
  methodSubtitle: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: tokens.colors.primary,
  },

  // Resumen
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    marginTop: 8,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
  },
  summaryDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },
  summaryTotalLabel: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
  },
  summaryTotalValue: {
    fontSize: 17,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
  },

  // Botón principal
  mainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: 18,
    height: 58,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  mainButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 8,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
  },

  // Resumen en modal
  purchaseSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  purchaseSummaryTitle: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
    marginBottom: 2,
  },
  purchaseSummaryPrice: {
    fontSize: 22,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
  },

  // Formulario
  formContainer: { marginBottom: 8 },
  infoBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 14,
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#1E293B',
    lineHeight: 18,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 12,
  },
  inputField: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    fontFamily: tokens.typography.fontFamily.medium,
    fontSize: 15,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bankPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  bankBubble: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bankBubbleActive: {
    backgroundColor: '#EFF6FF',
    borderColor: tokens.colors.primary,
  },
  bankBubbleText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
  },
  bankBubbleTextActive: { color: tokens.colors.primary },
  twoColRow: { flexDirection: 'row', gap: 12 },
  twoColItem: { flex: 1 },

  // Botón de confirmar
  confirmBtn: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 18,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
  },

  // Procesando
  processingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  processingTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
    marginBottom: 8,
  },
  processingSubtitle: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // Éxito
  successContainer: { alignItems: 'center', paddingBottom: 32 },
  successIconWrapper: { marginVertical: 20 },
  successTitle: {
    fontSize: 24,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#1E293B',
    marginBottom: 6,
  },
  successSubtitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  receiptBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  receiptLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  receiptValue: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
  },
  successBtn: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 18,
    height: 56,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  successBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
  },
});
