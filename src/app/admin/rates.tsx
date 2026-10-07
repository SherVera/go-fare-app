import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminSidebar } from '@/components/AdminSidebarContext';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  getCurrentRates,
  getExternalBcvRate,
  updateBcvRate,
  updateFareValue,
} from '@/lib/api';
import { tokens } from '@/theme/tokens';

// Obtener fecha local YYYY-MM-DD
const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Convertir YYYY-MM-DD (o ISO) a DD/MM/AAAA
const formatDateToDdMmYyyy = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
};

// Convertir DD/MM/AAAA a YYYY-MM-DD
const formatDateToYyyyMmDd = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month}-${day}`;
  }
  return dateStr;
};

const PRESET_FARES = [0.2, 0.25, 0.3, 0.5];

export default function AdminRatesScreen() {
  const { setIsOpen } = useAdminSidebar();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingFare, setUpdatingFare] = useState(false);
  const [updatingBcv, setUpdatingBcv] = useState(false);
  const [fetchingExternal, setFetchingExternal] = useState(false);

  // Pestaña activa: 'fare' (Precio del Fare) o 'bcv' (Tasa BCV)
  const [activeTab, setActiveTab] = useState<'fare' | 'bcv'>('fare');

  // Tasas actuales en el sistema
  const [currentRates, setCurrentRates] = useState({
    fareUsdValue: 0.25,
    bcvRate: 40.0,
    bcvRateDate: new Date().toISOString().slice(0, 10),
  });

  // Valores de los formularios
  const [newFareValue, setNewFareValue] = useState('');
  const [newBcvRate, setNewBcvRate] = useState('');
  const [bcvRateDate, setBcvRateDate] = useState(
    formatDateToDdMmYyyy(new Date().toISOString().slice(0, 10)),
  );

  const fetchRates = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await getCurrentRates();
      setCurrentRates({
        fareUsdValue: data.fareUsdValue ?? 0.25,
        bcvRate: data.bcvRate ?? 40.0,
        bcvRateDate: data.bcvRateDate ?? getLocalDateString(),
      });
      setNewFareValue('');
      setNewBcvRate('');
      setBcvRateDate(formatDateToDdMmYyyy(getLocalDateString()));
    } catch (err) {
      console.warn('[AdminRates] Error fetching current rates:', err);
      Alert.alert('Error', 'No se pudieron sincronizar las tasas vigentes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setRefreshing(true);
    await fetchRates(true);
  }, [fetchRates]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  useFocusEffect(
    useCallback(() => {
      fetchRates();
    }, [fetchRates]),
  );

  const handleFetchExternalBcv = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setFetchingExternal(true);
    try {
      const result = await getExternalBcvRate();
      if (result?.rate) {
        setNewBcvRate(result.rate.toFixed(2));
        setBcvRateDate(formatDateToDdMmYyyy(getLocalDateString()));
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        Alert.alert(
          'Tasa Consultada con Éxito',
          `Se obtuvo la tasa oficial de ${result.rate.toFixed(2)} Bs/$ de la API del BCV. Presiona "Registrar Tasa" para aplicarla al sistema.`,
        );
      }
    } catch (err: any) {
      console.warn('[AdminRates] Error fetching external BCV:', err);
      Alert.alert(
        'Error de Conexión',
        err.message || 'No se pudo consultar la fuente externa del BCV.',
      );
    } finally {
      setFetchingExternal(false);
    }
  };

  const handleDateChange = (text: string) => {
    let cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 8) {
      cleaned = cleaned.slice(0, 8);
    }
    let formatted = '';
    if (cleaned.length > 0) {
      formatted += cleaned.slice(0, 2);
    }
    if (cleaned.length > 2) {
      formatted += `/${cleaned.slice(2, 4)}`;
    }
    if (cleaned.length > 4) {
      formatted += `/${cleaned.slice(4, 8)}`;
    }
    setBcvRateDate(formatted);
  };

  const handleSelectPresetFare = (val: number) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setNewFareValue(val.toString());
  };

  const handleUpdateFare = async () => {
    const parsed = parseFloat(newFareValue);
    if (Number.isNaN(parsed) || parsed <= 0) {
      Alert.alert(
        'Valor inválido',
        'El precio del fare debe ser un número positivo mayor que cero.',
      );
      return;
    }

    setUpdatingFare(true);
    try {
      await updateFareValue(parsed);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      Alert.alert(
        'Tarifa Actualizada',
        `El valor de 1 boleto digital ha sido establecido en $${parsed.toFixed(2)} USD.`,
      );
      await fetchRates();
    } catch (err: any) {
      console.warn('[AdminRates] Error updating fare value:', err);
      Alert.alert(
        'Error',
        err.message || 'No se pudo actualizar el precio del fare.',
      );
    } finally {
      setUpdatingFare(false);
    }
  };

  const handleUpdateBcv = async () => {
    const parsed = parseFloat(newBcvRate);
    if (Number.isNaN(parsed) || parsed <= 0) {
      Alert.alert(
        'Valor inválido',
        'La tasa BCV debe ser un número positivo mayor que cero.',
      );
      return;
    }

    if (isDuplicateRate) {
      Alert.alert(
        'Tasa Ya Registrada',
        `La tasa de ${currentRates.bcvRate.toFixed(2)} Bs/$ ya se encuentra registrada para la fecha ${bcvRateDate}.`,
      );
      return;
    }

    setUpdatingBcv(true);
    try {
      await updateBcvRate(parsed, formatDateToYyyyMmDd(bcvRateDate));
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      Alert.alert(
        'Tasa BCV Registrada',
        `La tasa oficial de ${parsed.toFixed(2)} Bs/$ ha sido registrada para la fecha ${bcvRateDate}.`,
      );
      await fetchRates();
    } catch (err: any) {
      console.warn('[AdminRates] Error updating BCV rate:', err);
      Alert.alert('Error', err.message || 'No se pudo registrar la tasa BCV.');
    } finally {
      setUpdatingBcv(false);
    }
  };

  // Previsualizaciones de cálculos
  const currentFareInBs = currentRates.fareUsdValue * currentRates.bcvRate;
  const enteredFare = parseFloat(newFareValue) || 0;
  const enteredBcv = parseFloat(newBcvRate) || 0;
  const newFareInBs = enteredFare * (enteredBcv || currentRates.bcvRate);

  const isDuplicateRate =
    enteredBcv > 0 &&
    Math.abs(enteredBcv - currentRates.bcvRate) < 0.001 &&
    formatDateToYyyyMmDd(bcvRateDate) === currentRates.bcvRateDate;

  const isBcvButtonDisabled =
    updatingBcv || !newBcvRate.trim() || isDuplicateRate;

  if (loading && !refreshing) {
    return <AppLoadingScreen message="Sincronizando tasas vigentes..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Tasas y Tarifas"
        subtitle="Control Cambiario y Pasajes"
        onMenu={() => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch {}
          setIsOpen(true);
        }}
        rightAction={
          <Pressable
            style={styles.headerRefreshBtn}
            onPress={onRefresh}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="sync-outline" size={18} color="#64748B" />
          </Pressable>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
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
          {/* Tarjeta de Resumen Ejecutivo y Conversión en Vivo */}
          <View style={styles.masterCard}>
            <View style={styles.masterCardHeader}>
              <View style={styles.masterBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#059669" />
                <Text style={styles.masterBadgeText}>Tarifa Vigente</Text>
              </View>
              <Text style={styles.masterDate}>
                {formatDateToDdMmYyyy(currentRates.bcvRateDate)}
              </Text>
            </View>

            <View style={styles.masterMainRow}>
              <View style={styles.masterRateCol}>
                <Text style={styles.masterLabel}>PRECIO UNITARIO</Text>
                <Text style={styles.masterValueUsd}>
                  ${currentRates.fareUsdValue.toFixed(2)}{' '}
                  <Text style={styles.masterUnit}>USD</Text>
                </Text>
                <Text style={styles.masterEquiv}>
                  ≈ {currentFareInBs.toFixed(2)} Bs. / boleto
                </Text>
              </View>

              <View style={styles.masterDivider} />

              <View style={styles.masterRateCol}>
                <Text style={styles.masterLabel}>TASA OFICIAL BCV</Text>
                <Text style={styles.masterValueBcv}>
                  {currentRates.bcvRate.toFixed(2)}
                </Text>
                <Text style={styles.masterBcvUnit}>Bolívares por Dólar</Text>
              </View>
            </View>

            {/* Simulador de Paquetes en Vivo */}
            <View style={styles.packagesSimulator}>
              <Text style={styles.simulatorTitle}>
                SIMULADOR DE RECARGA EN BOLÍVARES
              </Text>
              <View style={styles.packagesGrid}>
                {[1, 2, 5, 10].map((tickets) => {
                  const bsTotal = tickets * currentFareInBs;
                  return (
                    <View key={tickets} style={styles.packageChip}>
                      <Text style={styles.packageQty}>{tickets} {tickets === 1 ? 'Viaje' : 'Viajes'}</Text>
                      <Text style={styles.packagePrice}>
                        {bsTotal.toFixed(2)} Bs.
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Segmented Switcher */}
          <View style={styles.segmentedContainer}>
            <Pressable
              style={[
                styles.segmentBtn,
                activeTab === 'fare' && styles.segmentBtnActive,
              ]}
              onPress={() => {
                try {
                  Haptics.selectionAsync();
                } catch {}
                setActiveTab('fare');
              }}
            >
              <Ionicons
                name="ticket-outline"
                size={16}
                color={activeTab === 'fare' ? tokens.colors.primary : '#64748B'}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.segmentLabel,
                  activeTab === 'fare' && styles.segmentLabelActive,
                ]}
              >
                Precio del Fare (USD)
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.segmentBtn,
                activeTab === 'bcv' && styles.segmentBtnActive,
              ]}
              onPress={() => {
                try {
                  Haptics.selectionAsync();
                } catch {}
                setActiveTab('bcv');
              }}
            >
              <Ionicons
                name="cash-outline"
                size={16}
                color={activeTab === 'bcv' ? tokens.colors.primary : '#64748B'}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.segmentLabel,
                  activeTab === 'bcv' && styles.segmentLabelActive,
                ]}
              >
                Tasa BCV (Bs/$)
              </Text>
            </Pressable>
          </View>

          {/* SECCIÓN 1: AJUSTE DEL FARE */}
          {activeTab === 'fare' && (
            <View style={styles.formCard}>
              <View style={styles.cardHeaderRow}>
                <View
                  style={[
                    styles.cardHeaderIcon,
                    { backgroundColor: '#EFF6FF' },
                  ]}
                >
                  <Ionicons
                    name="pricetag-outline"
                    size={20}
                    color="#2563EB"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardHeaderTitle}>
                    Ajustar Precio del Pasaje
                  </Text>
                  <Text style={styles.cardHeaderSub}>
                    Modifica el costo de 1 boleto en dólares
                  </Text>
                </View>
              </View>

              {/* Botones de selección rápida */}
              <Text style={styles.presetLabel}>VALORES SUGERIDOS:</Text>
              <View style={styles.presetRow}>
                {PRESET_FARES.map((preset) => {
                  const isSelected =
                    parseFloat(newFareValue) === preset;
                  return (
                    <Pressable
                      key={preset}
                      style={[
                        styles.presetChip,
                        isSelected && styles.presetChipActive,
                      ]}
                      onPress={() => handleSelectPresetFare(preset)}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          isSelected && styles.presetChipTextActive,
                        ]}
                      >
                        ${preset.toFixed(2)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Nuevo Valor del Boleto (USD)
                </Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.currencyPrefix}>$</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={newFareValue}
                    onChangeText={setNewFareValue}
                    placeholder="0.25"
                    placeholderTextColor="#94A3B8"
                  />
                  <Text style={styles.currencySuffix}>USD</Text>
                </View>
              </View>

              {/* Previsualización del cambio */}
              {enteredFare > 0 && (
                <View style={styles.previewContainer}>
                  <Ionicons
                    name="calculator-outline"
                    size={18}
                    color="#1D4ED8"
                  />
                  <Text style={styles.previewText}>
                    Con esta tarifa, 1 boleto costará{' '}
                    <Text style={styles.previewBold}>
                      ${enteredFare.toFixed(2)} USD
                    </Text>{' '}
                    (aprox. {newFareInBs.toFixed(2)} Bs.)
                  </Text>
                </View>
              )}

              <Pressable
                style={[
                  styles.submitButton,
                  updatingFare && styles.submitButtonDisabled,
                ]}
                onPress={handleUpdateFare}
                disabled={updatingFare}
              >
                {updatingFare ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>
                      Guardar Tarifa del Fare
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* SECCIÓN 2: AJUSTE TASA BCV */}
          {activeTab === 'bcv' && (
            <View style={styles.formCard}>
              <View style={styles.cardHeaderRow}>
                <View
                  style={[
                    styles.cardHeaderIcon,
                    { backgroundColor: '#ECFDF5' },
                  ]}
                >
                  <Ionicons
                    name="trending-up-outline"
                    size={20}
                    color="#059669"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardHeaderTitle}>
                    Ajustar Tasa Oficial BCV
                  </Text>
                  <Text style={styles.cardHeaderSub}>
                    Establece el tipo de cambio oficial en Bolívares
                  </Text>
                </View>
              </View>

              {/* Botón de Sincronización Automática con DolarAPI */}
              <Pressable
                style={styles.syncBcvBtn}
                onPress={handleFetchExternalBcv}
                disabled={fetchingExternal}
              >
                {fetchingExternal ? (
                  <ActivityIndicator size="small" color="#059669" />
                ) : (
                  <>
                    <Ionicons
                      name="cloud-download-outline"
                      size={18}
                      color="#059669"
                    />
                    <Text style={styles.syncBcvText}>
                      Consultar Tasa Oficial BCV del Día
                    </Text>
                  </>
                )}
              </Pressable>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Tasa Oficial en Bolívares por Dólar (Bs/$)
                </Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[styles.textInput, { paddingLeft: 16 }]}
                    keyboardType="numeric"
                    value={newBcvRate}
                    onChangeText={setNewBcvRate}
                    placeholder="Ej: 42.50"
                    placeholderTextColor="#94A3B8"
                  />
                  <Text style={styles.currencySuffix}>Bs / USD</Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Fecha de Vigencia de la Tasa (DD/MM/AAAA)
                </Text>
                <View style={[styles.inputWrapper, { paddingLeft: 16 }]}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color="#64748B"
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    style={[styles.textInput, { paddingLeft: 0 }]}
                    value={bcvRateDate}
                    onChangeText={handleDateChange}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor="#94A3B8"
                    maxLength={10}
                  />
                </View>
              </View>

              <Pressable
                style={[
                  styles.submitButton,
                  { backgroundColor: '#059669' },
                  isBcvButtonDisabled && styles.submitButtonDisabled,
                ]}
                onPress={handleUpdateBcv}
                disabled={isBcvButtonDisabled}
              >
                {updatingBcv ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color={isBcvButtonDisabled ? '#94A3B8' : '#FFFFFF'}
                    />
                    <Text
                      style={[
                        styles.submitButtonText,
                        isBcvButtonDisabled && { color: '#94A3B8' },
                      ]}
                    >
                      {isDuplicateRate
                        ? 'Tasa Ya Registrada para esta Fecha'
                        : 'Registrar Tasa BCV'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* Espaciador inferior */}
          <View style={{ height: 110 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerRefreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  masterCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  masterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  masterBadgeText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#059669',
  },
  masterDate: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  masterMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  masterRateCol: {
    flex: 1,
  },
  masterDivider: {
    width: 1,
    height: 48,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 16,
  },
  masterLabel: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  masterValueUsd: {
    fontSize: 22,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  masterUnit: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  masterEquiv: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#059669',
    marginTop: 2,
  },
  masterValueBcv: {
    fontSize: 22,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  masterBcvUnit: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    marginTop: 2,
  },
  packagesSimulator: {
    marginTop: 14,
  },
  simulatorTitle: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  packagesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  packageChip: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  packageQty: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginBottom: 2,
  },
  packagePrice: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentLabel: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  segmentLabelActive: {
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  cardHeaderSub: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    marginTop: 1,
  },
  presetLabel: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  presetChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: tokens.colors.primary,
  },
  presetChipText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#475569',
  },
  presetChipTextActive: {
    color: tokens.colors.primary,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#334155',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
  },
  currencyPrefix: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#475569',
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#0F172A',
    height: '100%',
  },
  currencySuffix: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#94A3B8',
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  previewText: {
    flex: 1,
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#1E40AF',
    lineHeight: 18,
  },
  previewBold: {
    fontFamily: tokens.typography.fontFamily.bold,
  },
  syncBcvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 18,
  },
  syncBcvText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#059669',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tokens.colors.primary,
    borderRadius: 14,
    height: 48,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
});
