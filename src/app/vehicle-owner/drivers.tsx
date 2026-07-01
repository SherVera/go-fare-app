import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Linking,
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
import type { MockDriver, MockVehicle } from '@/interfaces';
import {
  createBackendInviteCode,
  getBackendInviteCodes,
  getBackendProfile,
} from '@/lib/api';
import { tokens } from '@/theme/tokens';

const MOCK_DRIVERS_BASE: MockDriver[] = [
  {
    id: 'd1',
    name: 'Carlos Mendoza',
    nationalId: 'V-14.892.401',
    phone: '0412-5551234',
    status: 'active',
  },
  {
    id: 'd2',
    name: 'Ramón Delgado',
    nationalId: 'V-18.304.582',
    phone: '0414-9994567',
    status: 'active',
  },
  {
    id: 'd3',
    name: 'José Gregorio',
    nationalId: 'V-11.204.381',
    phone: '0424-3338888',
    status: 'active',
  },
  {
    id: 'd4',
    name: 'Luis Alejandro',
    nationalId: 'V-20.155.678',
    phone: '0416-8889900',
    status: 'active',
  },
  {
    id: 'd5',
    name: 'Pedro Infante',
    nationalId: 'V-13.444.555',
    phone: '0426-7771122',
    status: 'active',
  },
  {
    id: 'd6',
    name: 'Francisco Bello',
    nationalId: 'V-15.666.777',
    phone: '0412-9998877',
    status: 'active',
  },
  {
    id: 'd7',
    name: 'Manuel Salazar',
    nationalId: 'V-12.888.999',
    phone: '0414-6663322',
    status: 'active',
  },
];

const MOCK_VEHICLES_BASE: MockVehicle[] = [
  {
    uuid: '1',
    vehicleMake: 'Toyota',
    vehicleModel: 'Coaster Bus',
    vehicleYear: 2018,
    licensePlate: 'AB123CD',
    cooperativeName: 'Cooperativa Caracas Move R.L.',
    status: 'approved',
    createdAt: '24/05/2026',
    assignedDriver: MOCK_DRIVERS_BASE[0],
  },
  {
    uuid: '2',
    vehicleMake: 'Encava',
    vehicleModel: 'ENT-610',
    vehicleYear: 2015,
    licensePlate: 'XY987ZT',
    cooperativeName: 'Cooperativa Caracas Move R.L.',
    status: 'approved',
    createdAt: '25/05/2026',
    assignedDriver: MOCK_DRIVERS_BASE[1],
  },
  {
    uuid: '3',
    vehicleMake: 'Hyundai',
    vehicleModel: 'County',
    vehicleYear: 2017,
    licensePlate: 'HJ321OP',
    cooperativeName: 'Cooperativa Caracas Move R.L.',
    status: 'approved',
    createdAt: '26/05/2026',
  },
];

export default function VehicleOwnerDrivers() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'invited'>('active');
  const [drivers, setDrivers] = useState<MockDriver[]>(MOCK_DRIVERS_BASE);
  const [vehicles, setVehicles] = useState<MockVehicle[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scrollTimeoutRef = useRef<any>(null);

  const handleScroll = useCallback(
    (_event: any) => {
      // Deslizar el FAB a la derecha (ocultar)
      Animated.spring(slideAnim, {
        toValue: 100, // 100px a la derecha lo saca de la pantalla
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }).start();

      // Limpiar el timeout anterior
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Volver a mostrar el FAB (translateX = 0) tras 450ms de inactividad
      scrollTimeoutRef.current = setTimeout(() => {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }).start();
      }, 450);
    },
    [slideAnim],
  );

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Form State - Invitación por WhatsApp
  const [invitePhone, setInvitePhone] = useState('');
  const [invitePhoneError, setInvitePhoneError] = useState<string | undefined>(
    undefined,
  );
  const [sendingInvite, setSendingInvite] = useState(false);

  const loadDriversData = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Cargar vehículos de AsyncStorage
      const localVehiclesStr = await AsyncStorage.getItem(
        'mock_vehicle_requests',
      );
      const localVehicles: MockVehicle[] = localVehiclesStr
        ? JSON.parse(localVehiclesStr)
        : [];

      const deletedPlatesStr = await AsyncStorage.getItem(
        'mock_deleted_vehicle_plates',
      );
      const deletedPlates: string[] = deletedPlatesStr
        ? JSON.parse(deletedPlatesStr)
        : [];

      const mergedVehicles = [
        ...localVehicles,
        ...MOCK_VEHICLES_BASE.filter(
          (mv) =>
            !localVehicles.some((lv) => lv.licensePlate === mv.licensePlate),
        ),
      ].filter((v) => !deletedPlates.includes(v.licensePlate));

      setVehicles(mergedVehicles);

      // 2. Cargar conductores locales de AsyncStorage
      const localDriversStr = await AsyncStorage.getItem(
        'mock_cooperative_drivers',
      );
      const localDrivers: MockDriver[] = localDriversStr
        ? JSON.parse(localDriversStr)
        : [];

      const mergedDrivers = [
        ...localDrivers,
        ...MOCK_DRIVERS_BASE.filter(
          (md) => !localDrivers.some((ld) => ld.nationalId === md.nationalId),
        ),
      ];

      setDrivers(mergedDrivers);

      // 3. Cargar invitaciones de la API real del backend
      const backendInvites = await getBackendInviteCodes().catch((err) => {
        console.warn(
          '[Drivers] Error al obtener invitaciones del backend:',
          err,
        );
        return [];
      });

      // Cargar mapeo local de teléfonos desde AsyncStorage
      const mapStr = await AsyncStorage.getItem('gofare_invited_phones_map');
      const phoneMap = mapStr ? JSON.parse(mapStr) : {};

      const enrichedInvites = backendInvites.map((inv: any) => ({
        ...inv,
        invitedPhone:
          inv.driver?.phoneNumber ||
          phoneMap[inv.code] ||
          'Invitado sin número',
      }));

      setInvitations(enrichedInvites);
    } catch (err) {
      console.warn('[Drivers] Error loading drivers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDriversData();
    setRefreshing(false);
  }, [loadDriversData]);

  useFocusEffect(
    useCallback(() => {
      loadDriversData();
    }, [loadDriversData]),
  );

  const getDriverAssignment = (driverId: string) => {
    const assignedVehicle = vehicles.find(
      (v) => v.assignedDriver?.id === driverId,
    );
    if (assignedVehicle) {
      return `${assignedVehicle.vehicleMake} ${assignedVehicle.vehicleModel} (${assignedVehicle.licensePlate})`;
    }
    return null;
  };

  const handleSendInviteWhatsApp = async () => {
    if (!invitePhone.trim()) {
      setInvitePhoneError('El número de teléfono es requerido');
      return;
    }
    // Validación mínima de longitud para número telefónico
    if (invitePhone.trim().replace(/[^0-9]/g, '').length < 8) {
      setInvitePhoneError('Ingresa un número de teléfono válido');
      return;
    }

    try {
      setSendingInvite(true);
      setInvitePhoneError(undefined);

      const profile = await getBackendProfile().catch(() => null);
      const ownerName = profile?.displayName || 'Socio GoFare';

      // 1. Crear invitación real en el backend PostgreSQL
      const inviteResult = await createBackendInviteCode();
      const code = inviteResult.code;

      // Guardar el número en local (AsyncStorage) para el mapeo local
      const mapStr = await AsyncStorage.getItem('gofare_invited_phones_map');
      const phoneMap = mapStr ? JSON.parse(mapStr) : {};
      phoneMap[code] = invitePhone.trim();
      await AsyncStorage.setItem(
        'gofare_invited_phones_map',
        JSON.stringify(phoneMap),
      );

      // 2. Limpiar el número de teléfono para WhatsApp
      let cleanPhone = invitePhone.trim().replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) {
        // Asumimos código de país Venezuela (+58) por defecto si inicia con 0
        cleanPhone = `58${cleanPhone.substring(1)}`;
      }

      // 3. Construir mensaje de WhatsApp
      const redirectUrl = `https://go-fare-backend.onrender.com/api/v1/invite-codes/redirect/${code}`;
      const message = `¡Hola! El socio ${ownerName} te invita a registrarte como conductor en su flota de GoFare.

1. Registrate e inicia sesión en la aplicación.
2. Ingresa a este enlace para registrarte como conductor de mi flota:
${redirectUrl}

Tu código de invitación único es: *${code}*`;

      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

      // 4. Intentar abrir WhatsApp
      console.log('[WhatsApp] Abriendo enlace:', whatsappUrl);
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback a enlace web general de WhatsApp
        await Linking.openURL(
          `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`,
        );
      }

      Alert.alert(
        'Invitación Procesada',
        `Se ha generado el código ${code} y se abrirá WhatsApp para enviar la invitación al número ${invitePhone.trim()}.`,
      );

      setInvitePhone('');
      setIsModalVisible(false);
      loadDriversData();
    } catch (err: any) {
      console.error('[Drivers] Error sending invitation via WhatsApp:', err);
      Alert.alert(
        'Error',
        err.message || 'Ocurrió un error al procesar la invitación.',
      );
    } finally {
      setSendingInvite(false);
    }
  };

  const filteredDrivers = drivers.filter((d) => {
    const term = searchText.trim().toLowerCase();
    if (!term) return true;
    return (
      d.name.toLowerCase().includes(term) ||
      d.nationalId.toLowerCase().includes(term)
    );
  });

  const filteredInvitations = invitations.filter((inv) => {
    const term = searchText.trim().toLowerCase();
    if (!term) return true;
    return (
      inv.invitedPhone.toLowerCase().includes(term) ||
      inv.code.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ width: 40 }} />
        <Text style={styles.headerTitle}>Directorio de Conductores</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs Principales */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[
            styles.tabButton,
            activeTab === 'active' && styles.tabButtonActive,
          ]}
          onPress={() => {
            setActiveTab('active');
            setSearchText('');
          }}
        >
          <Ionicons
            name="people-outline"
            size={18}
            color={activeTab === 'active' ? tokens.colors.primary : '#64748B'}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'active' && styles.tabTextActive,
            ]}
          >
            Conductores ({drivers.length})
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tabButton,
            activeTab === 'invited' && styles.tabButtonActive,
          ]}
          onPress={() => {
            setActiveTab('invited');
            setSearchText('');
          }}
        >
          <Ionicons
            name="logo-whatsapp"
            size={18}
            color={activeTab === 'invited' ? tokens.colors.primary : '#64748B'}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'invited' && styles.tabTextActive,
            ]}
          >
            Invitados WA ({invitations.length})
          </Text>
        </Pressable>
      </View>

      {/* Buscador */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={20}
          color="#8594AB"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder={
            activeTab === 'active'
              ? 'Buscar conductor por nombre o cédula...'
              : 'Buscar invitación por teléfono o código...'
          }
          placeholderTextColor="#A1A1AA"
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="none"
        />
        {searchText.length > 0 && (
          <Pressable onPress={() => setSearchText('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color="#A1A1AA" />
          </Pressable>
        )}
      </View>

      {/* Lista Principal */}
      {activeTab === 'active' ? (
        <FlatList
          data={filteredDrivers}
          keyExtractor={(item) => item.id}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[tokens.colors.primary]}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons
                name="people-outline"
                size={64}
                color="#8594AB"
                style={{ marginBottom: 12 }}
              />
              <Text style={styles.emptyTitle}>Sin resultados</Text>
              <Text style={styles.emptySubtitle}>
                No se encontraron conductores registrados en la cooperativa.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const assignment = getDriverAssignment(item.id);

            return (
              <View style={styles.driverCard}>
                <View style={styles.driverMainRow}>
                  <View style={styles.driverAvatar}>
                    <Text style={styles.driverAvatarText}>
                      {item.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .substring(0, 2)}
                    </Text>
                  </View>
                  <View style={styles.driverDetails}>
                    <Text style={styles.driverName}>{item.name}</Text>
                    <Text style={styles.driverMeta}>
                      Cédula: {item.nationalId}
                    </Text>
                    <Text style={styles.driverMeta}>
                      Teléfono: {item.phone}
                    </Text>
                  </View>
                  <View style={styles.statusPill}>
                    <View style={styles.activeDot} />
                    <Text style={styles.activeText}>Activo</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.assignmentRow}>
                  <Ionicons
                    name={assignment ? 'bus-outline' : 'alert-circle-outline'}
                    size={16}
                    color={assignment ? tokens.colors.primary : '#D97706'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.assignmentText,
                      assignment ? { color: '#1E293B' } : { color: '#D97706' },
                    ]}
                  >
                    {assignment
                      ? `Operando: ${assignment}`
                      : 'Disponible (Sin unidad asignada)'}
                  </Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={<View style={{ height: 110 }} />}
        />
      ) : (
        <FlatList
          data={filteredInvitations}
          keyExtractor={(item) => item.code}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[tokens.colors.primary]}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons
                name="logo-whatsapp"
                size={64}
                color="#8594AB"
                style={{ marginBottom: 12 }}
              />
              <Text style={styles.emptyTitle}>Sin invitaciones</Text>
              <Text style={styles.emptySubtitle}>
                Aún no has enviado invitaciones por WhatsApp.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const dateStr = new Date(item.createdAt).toLocaleDateString(
              'es-ES',
              {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              },
            );

            return (
              <View style={styles.driverCard}>
                <View style={styles.driverMainRow}>
                  <View
                    style={[
                      styles.driverAvatar,
                      { backgroundColor: '#F0FDF4' },
                    ]}
                  >
                    <Ionicons name="logo-whatsapp" size={20} color="#10B981" />
                  </View>
                  <View style={styles.driverDetails}>
                    <Text style={styles.driverName}>{item.invitedPhone}</Text>
                    <Text style={styles.driverMeta}>
                      Código:{' '}
                      <Text style={styles.codeHighlight}>{item.code}</Text>
                    </Text>
                    <Text style={styles.driverMeta}>Enviado: {dateStr}</Text>
                  </View>

                  {item.used ? (
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: '#ECFDF5' },
                      ]}
                    >
                      <View
                        style={[
                          styles.activeDot,
                          { backgroundColor: '#10B981' },
                        ]}
                      />
                      <Text style={[styles.activeText, { color: '#065F46' }]}>
                        Canjeado
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: '#FEF3C7' },
                      ]}
                    >
                      <View
                        style={[
                          styles.activeDot,
                          { backgroundColor: '#F59E0B' },
                        ]}
                      />
                      <Text style={[styles.activeText, { color: '#92400E' }]}>
                        Pendiente
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
          ListFooterComponent={<View style={{ height: 110 }} />}
        />
      )}

      {/* FAB Registrar Conductor */}
      <Animated.View
        style={[
          styles.fab,
          {
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.fabPressable,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => setIsModalVisible(true)}
        >
          <Ionicons name="person-add" size={24} color="#FFFFFF" />
        </Pressable>
      </Animated.View>

      {/* Modal Registrar/Invitar Conductor */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agregar Conductor</Text>
              <Pressable onPress={() => setIsModalVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#8594AB" />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalForm}
              keyboardShouldPersistTaps="handled"
            >
              {/* Formulario Invitación por WhatsApp */}
              <View>
                <Text style={styles.inputLabel}>
                  NÚMERO DE TELÉFONO DEL CONDUCTOR
                </Text>
                <View
                  style={[
                    styles.inputCard,
                    invitePhoneError && styles.inputCardError,
                  ]}
                >
                  <Ionicons
                    name="call-outline"
                    size={20}
                    color="#8594AB"
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Ej. 04125556677"
                    placeholderTextColor="#A1A1AA"
                    keyboardType="phone-pad"
                    value={invitePhone}
                    onChangeText={(val) => {
                      setInvitePhone(val);
                      if (invitePhoneError) setInvitePhoneError(undefined);
                    }}
                    editable={!sendingInvite}
                  />
                </View>
                {invitePhoneError && (
                  <Text style={styles.errorText}>{invitePhoneError}</Text>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.submitBtn,
                    pressed && { opacity: 0.9 },
                    sendingInvite && { backgroundColor: '#94A3B8' },
                  ]}
                  onPress={handleSendInviteWhatsApp}
                  disabled={sendingInvite}
                >
                  {sendingInvite ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                      <Ionicons
                        name="logo-whatsapp"
                        size={20}
                        color="#FFFFFF"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.submitBtnText}>
                        Enviar por WhatsApp
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </ScrollView>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  headerAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  tabButtonActive: {
    backgroundColor: '#F0FDFA',
  },
  tabText: {
    fontSize: 13.5,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
  },
  tabTextActive: {
    color: tokens.colors.primary,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 8,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#18243E',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13.5,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#8594AB',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  driverMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#E6F4FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  driverAvatarText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 2,
  },
  driverMeta: {
    fontSize: 12.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
    marginBottom: 1,
  },
  codeHighlight: {
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  activeText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#065F46',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignmentText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
  },
  fab: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    backgroundColor: tokens.colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: '#1D5BD9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 99,
  },
  fabPressable: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  modalTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 18,
  },
  modalTabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  modalTabActive: {
    borderBottomColor: tokens.colors.primary,
  },
  modalTabText: {
    fontSize: 13.5,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
  },
  modalTabTextActive: {
    color: tokens.colors.primary,
  },
  modalForm: {
    paddingTop: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputCardError: {
    borderColor: '#EF4444',
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#18243E',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11.5,
    fontFamily: tokens.typography.fontFamily.medium,
    marginTop: -10,
    marginBottom: 14,
    paddingLeft: 4,
  },
  submitBtn: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 16,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#1D5BD9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
  },
  submitBtnText: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
});
