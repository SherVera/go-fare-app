import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminSidebar } from '@/components/AdminSidebarContext';
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

export default function AdminRatesScreen() {
  const _router = useRouter();
  const { setIsOpen } = useAdminSidebar();

  const [loading, setLoading] = useState(true);
  const [updatingFare, setUpdatingFare] = useState(false);
  const [updatingBcv, setUpdatingBcv] = useState(false);

  // Pestaña activa: 'fare' (Precio del Fare) o 'bcv' (Tasa BCV)
  const [activeTab, setActiveTab] = useState<'fare' | 'bcv'>('fare');

  // Tasas actuales en el sistema
  const [currentRates, setCurrentRates] = useState({
    fareUsdValue: 0.25,
    bcvRate: 40.0,
    bcvRateDate: new Date().toISOString().slice(0, 10),
  });

  // Tasa sugerida por la API externa (DolarApi)
  const [apiSuggestedRate, setApiSuggestedRate] = useState<{
    rate: number;
    date: string;
  } | null>(null);
  // Valores de los formularios
  const [newFareValue, setNewFareValue] = useState('');
  const [newBcvRate, setNewBcvRate] = useState('');
  const [bcvRateDate, setBcvRateDate] = useState(
    formatDateToDdMmYyyy(new Date().toISOString().slice(0, 10)),
  );

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
      formatted += '/' + cleaned.slice(2, 4);
    }
    if (cleaned.length > 4) {
      formatted += '/' + cleaned.slice(4, 8);
    }
    setBcvRateDate(formatted);
  };

  const fetchRates = useCallback(async () => {
    setLoading(true);
    setApiSuggestedRate(null);
    try {
      // 1. Obtener tasas del sistema
      const data = await getCurrentRates();
      setCurrentRates(data);
      setNewFareValue(data.fareUsdValue.toFixed(2));
      setNewBcvRate(data.bcvRate.toFixed(2));
      setBcvRateDate(
        formatDateToDdMmYyyy(data.bcvRateDate || getLocalDateString()),
      );

      // 2. Consultar la API externa para la tasa oficial del BCV SOLO si no es la de hoy
      const todayStr = getLocalDateString();
      const registeredDate = (data.bcvRateDate || '').split('T')[0] || todayStr;

      if (registeredDate !== todayStr) {
        console.log(
          '[AdminRates] La tasa registrada es anterior a hoy. Consultando tasa externa...',
        );
        const apiData = await getExternalBcvRate();
        if (apiData) {
          setApiSuggestedRate(apiData);

          // Si la tasa guardada en el sistema es diferente de la de internet,
          // autocompletamos el campo de edición para facilitarle el registro al administrador
          if (data.bcvRate !== apiData.rate) {
            setNewBcvRate(apiData.rate.toFixed(2));
            setBcvRateDate(formatDateToDdMmYyyy(apiData.date));
          }
        }
      } else {
        console.log(
          '[AdminRates] La tasa registrada ya es la más reciente (hoy). Se omite consulta a la API.',
        );
      }
    } catch (err) {
      console.warn('[AdminRates] Error fetching current rates:', err);
      Alert.alert('Error', 'No se pudieron sincronizar las tasas vigentes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const handleUpdateFare = async () => {
    const parsed = parseFloat(newFareValue);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert(
        'Valor inválido',
        'El precio del fare debe ser un número positivo mayor que cero.',
      );
      return;
    }

    setUpdatingFare(true);
    try {
      await updateFareValue(parsed);
      Alert.alert(
        'Éxito',
        'El valor del fare en USD ha sido actualizado exitosamente.',
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
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert(
        'Valor inválido',
        'La tasa BCV debe ser un número positivo mayor que cero.',
      );
      return;
    }

    // Validar formato de fecha DD/MM/AAAA
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(bcvRateDate)) {
      Alert.alert(
        'Fecha inválida',
        'La fecha debe estar en formato DD/MM/AAAA.',
      );
      return;
    }

    setUpdatingBcv(true);
    try {
      await updateBcvRate(parsed, formatDateToYyyyMmDd(bcvRateDate));
      Alert.alert(
        'Éxito',
        'La tasa BCV oficial del día ha sido registrada exitosamente.',
      );
      await fetchRates();
    } catch (err: any) {
      console.warn('[AdminRates] Error updating BCV rate:', err);
      Alert.alert('Error', err.message || 'No se pudo registrar la tasa BCV.');
    } finally {
      setUpdatingBcv(false);
    }
  };

  const applySuggestedRateValues = () => {
    if (apiSuggestedRate) {
      setNewBcvRate(apiSuggestedRate.rate.toFixed(2));
      setBcvRateDate(formatDateToDdMmYyyy(apiSuggestedRate.date));
      Alert.alert(
        'Aplicado',
        'Se cargó la tasa oficial sugerida al formulario.',
      );
    }
  };

  // Previsualizaciones de cálculos
  const currentFareInBs = currentRates.fareUsdValue * currentRates.bcvRate;
  const enteredFare = parseFloat(newFareValue) || 0;
  const enteredBcv = parseFloat(newBcvRate) || 0;
  const newFareInBs = enteredFare * (enteredBcv || currentRates.bcvRate);

  // Validaciones del botón registrar BCV
  const isBcvAlreadyRegistered =
    currentRates.bcvRateDate === getLocalDateString();
  const inputMatchesSystem =
    enteredBcv === currentRates.bcvRate &&
    formatDateToYyyyMmDd(bcvRateDate) === currentRates.bcvRateDate;
  const isBcvButtonDisabled =
    updatingBcv || (isBcvAlreadyRegistered && inputMatchesSystem);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Tasas y Tarifas" onMenu={() => setIsOpen(true)} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={tokens.colors.primary} />
          <Text style={styles.loadingText}>
            Sincronizando tasas vigentes...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Tasas y Tarifas" onMenu={() => setIsOpen(true)} />

      {/* Tabs / Secciones */}
      <View style={styles.tabsContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'fare' && styles.tabActive]}
          onPress={() => setActiveTab('fare')}
        >
          <Ionicons
            name="ticket-outline"
            size={16}
            color={activeTab === 'fare' ? tokens.colors.primary : '#64748B'}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'fare' && styles.tabLabelActive,
            ]}
          >
            Precio del Fare
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'bcv' && styles.tabActive]}
          onPress={() => setActiveTab('bcv')}
        >
          <Ionicons
            name="cash-outline"
            size={16}
            color={activeTab === 'bcv' ? tokens.colors.primary : '#64748B'}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'bcv' && styles.tabLabelActive,
            ]}
          >
            Tasa BCV (Bs/$)
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* SECCIÓN 1: PRECIO DEL FARE */}
          {activeTab === 'fare' && (
            <View style={styles.tabSection}>
              {/* Tarjeta Informativa del Fare */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>
                  Valor del Fare en el Sistema
                </Text>

                <View style={styles.summaryItem}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: '#DBEAFE' },
                    ]}
                  >
                    <Ionicons name="ticket" size={26} color="#1D4ED8" />
                  </View>
                  <View style={styles.summaryInfo}>
                    <Text style={styles.summaryLabel}>
                      Tarifa Actual del Fare
                    </Text>
                    <Text style={styles.summaryValue}>
                      ${currentRates.fareUsdValue.toFixed(2)} USD
                    </Text>
                    <Text style={styles.summarySubtext}>
                      Valor referencial de 1 ticket digital
                    </Text>
                  </View>
                </View>

                <View style={[styles.conversionAlert, { marginTop: 16 }]}>
                  <Ionicons
                    name="calculator-outline"
                    size={18}
                    color="#1E40AF"
                  />
                  <Text style={styles.conversionText}>
                    En bolívares equivale a:{' '}
                    <Text style={styles.boldText}>
                      {currentFareInBs.toFixed(2)} Bs.
                    </Text>
                  </Text>
                </View>
              </View>

              {/* Formulario de ajuste del Fare */}
              <View style={styles.formCard}>
                <View style={styles.cardHeader}>
                  <Ionicons
                    name="options-outline"
                    size={20}
                    color={tokens.colors.primary}
                  />
                  <Text style={styles.cardHeaderTitle}>
                    Ajustar Precio del Fare
                  </Text>
                </View>

                <Text style={styles.cardDescription}>
                  El fare es la unidad monetaria virtual de GoFare. Ajustar su
                  valor en USD modificará el costo de recarga de todos los
                  pasajeros en base a la tasa de cambio.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Nuevo Valor del Fare (USD)
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
                    <Text style={styles.previewText}>
                      Previsualización: 1 Fare costará{' '}
                      <Text style={styles.previewBold}>
                        ${enteredFare.toFixed(2)} USD
                      </Text>
                      {enteredBcv || currentRates.bcvRate
                        ? ` (~${newFareInBs.toFixed(2)} Bs.)`
                        : ''}
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
                        Guardar Precio del Fare
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* SECCIÓN 2: TASA DE CAMBIO BCV */}
          {activeTab === 'bcv' && (
            <View style={styles.tabSection}>
              {/* Tarjeta Informativa de la Tasa BCV */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Tasa BCV en el Sistema</Text>

                <View style={styles.summaryItem}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: '#D1FAE5' },
                    ]}
                  >
                    <Ionicons name="cash" size={26} color="#0F766E" />
                  </View>
                  <View style={styles.summaryInfo}>
                    <Text style={styles.summaryLabel}>
                      Tasa de Cambio Registrada
                    </Text>
                    <Text style={styles.summaryValue}>
                      {currentRates.bcvRate.toFixed(2)} Bs/$
                    </Text>
                    <Text style={styles.summarySubtext}>
                      Vigente para la fecha:{' '}
                      {formatDateToDdMmYyyy(currentRates.bcvRateDate)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Sugerencia de Tasa BCV (DolarApi) */}
              {apiSuggestedRate && (
                <View style={styles.suggestionBanner}>
                  <View style={styles.suggestionHeader}>
                    <Ionicons
                      name="cloud-download"
                      size={20}
                      color="#065F46"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.suggestionTitle}>
                      Tasa Oficial Detectada (Internet)
                    </Text>
                  </View>

                  <Text style={styles.suggestionBody}>
                    El valor más reciente publicado por el BCV es de{' '}
                    <Text style={styles.boldText}>
                      {apiSuggestedRate.rate.toFixed(2)} Bs/$
                    </Text>{' '}
                    (tasa para la fecha{' '}
                    <Text style={styles.boldText}>
                      {formatDateToDdMmYyyy(apiSuggestedRate.date)}
                    </Text>
                    ).
                  </Text>

                  {currentRates.bcvRate !== apiSuggestedRate.rate ? (
                    <View style={styles.suggestionActionBox}>
                      <Text style={styles.suggestionSubtitle}>
                        La tasa del sistema difiere de la oficial en internet.
                      </Text>
                      <Pressable
                        style={styles.applySuggestionBtn}
                        onPress={applySuggestedRateValues}
                      >
                        <Ionicons
                          name="checkmark-done-outline"
                          size={14}
                          color="#065F46"
                        />
                        <Text style={styles.applySuggestionBtnText}>
                          Cargar tasa de Internet
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.suggestionActionBox}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#059669"
                      />
                      <Text
                        style={[
                          styles.suggestionSubtitle,
                          {
                            color: '#059669',
                            fontFamily: tokens.typography.fontFamily.bold,
                          },
                        ]}
                      >
                        El sistema ya se encuentra sincronizado con la tasa
                        oficial.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Formulario de ajuste de BCV */}
              <View style={styles.formCard}>
                <View style={styles.cardHeader}>
                  <Ionicons
                    name="trending-up-outline"
                    size={20}
                    color="#10B981"
                  />
                  <Text style={styles.cardHeaderTitle}>
                    Ajustar Tasa del Dólar (BCV)
                  </Text>
                </View>

                <Text style={styles.cardDescription}>
                  Modifica la tasa de cambio oficial en Bolívares por cada Dólar
                  (USD) para las recargas de pasajes vigentes en la fecha
                  indicada.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Tasa de Cambio Oficial (Bs/USD)
                  </Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={[styles.textInput, { paddingLeft: 16 }]}
                      keyboardType="numeric"
                      value={newBcvRate}
                      onChangeText={setNewBcvRate}
                      placeholder="40.00"
                      placeholderTextColor="#94A3B8"
                    />
                    <Text style={styles.currencySuffix}>Bs / $</Text>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Fecha de la Tasa (DD/MM/AAAA)
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
                    { backgroundColor: '#10B981' },
                    isBcvButtonDisabled && {
                      backgroundColor: '#CBD5E1',
                      shadowOpacity: 0,
                      elevation: 0,
                    },
                  ]}
                  onPress={handleUpdateBcv}
                  disabled={isBcvButtonDisabled}
                >
                  {updatingBcv ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="cloud-upload-outline"
                        size={18}
                        color={isBcvButtonDisabled ? '#94A3B8' : '#FFFFFF'}
                      />
                      <Text
                        style={[
                          styles.submitButtonText,
                          isBcvButtonDisabled && { color: '#94A3B8' },
                        ]}
                      >
                        {isBcvAlreadyRegistered && inputMatchesSystem
                          ? 'Tasa Registrada al Día'
                          : 'Registrar Tasa'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          )}
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
  },
  tabLabelActive: {
    color: tokens.colors.primary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 40,
  },
  tabSection: {
    gap: 20,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
    marginTop: 2,
  },
  summarySubtext: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#94A3B8',
    marginTop: 1,
  },
  conversionAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  conversionText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#1E40AF',
  },
  boldText: {
    fontFamily: tokens.typography.fontFamily.bold,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  cardDescription: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#475569',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    height: 48,
    backgroundColor: '#F8FAFC',
  },
  currencyPrefix: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#475569',
    paddingLeft: 16,
    paddingRight: 4,
  },
  currencySuffix: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#94A3B8',
    paddingRight: 16,
    paddingLeft: 8,
  },
  textInput: {
    flex: 1,
    height: '100%',
    paddingLeft: 8,
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#0F172A',
  },
  previewContainer: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  previewText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#475569',
  },
  previewBold: {
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary,
    height: 48,
    borderRadius: 12,
    gap: 8,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  suggestionBanner: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  suggestionTitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#065F46',
  },
  suggestionBody: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#065F46',
    lineHeight: 18,
  },
  suggestionActionBox: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.5)',
  },
  suggestionSubtitle: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#047857',
    flex: 1,
    marginRight: 10,
  },
  applySuggestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  applySuggestionBtnText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#065F46',
  },
});
