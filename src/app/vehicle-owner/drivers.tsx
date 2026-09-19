import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import type { MockDriver, MockVehicle } from '@/interfaces';
import {
  createBackendInviteCode,
  getBackendInviteCodes,
  getBackendProfile,
  getOwnerVehicles,
} from '@/lib/api';
import { tokens } from '@/theme/tokens';

export default function VehicleOwnerDrivers() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'invited'>('active');
  const [inviteFilter, setInviteFilter] = useState<
    'all' | 'used' | 'pending' | 'revoked'
  >('all');
  const [driverFilter, setDriverFilter] = useState<
    'all' | 'assigned' | 'unassigned'
  >('all');
  const [drivers, setDrivers] = useState<MockDriver[]>([]);
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

      // 1. Cargar vehículos reales del backend
      const realVehicles = await getOwnerVehicles().catch((err) => {
        console.warn('[Drivers] Error al obtener vehículos del backend:', err);
        return [];
      });
      setVehicles(realVehicles);

      // 2. Cargar invitaciones de la API real del backend
      const backendInvites = await getBackendInviteCodes().catch((err) => {
        console.warn(
          '[Drivers] Error al obtener invitaciones del backend:',
          err,
        );
        return [];
      });

      // 3. Mapear conductores reales a partir de las invitaciones canjeadas
      const realDrivers: MockDriver[] = backendInvites
        .filter((inv: any) => inv.driver)
        .map((inv: any) => ({
          id: inv.driver.id,
          name:
            inv.driver.displayName ||
            `${inv.driver.firstName || ''} ${inv.driver.lastName || ''}`.trim() ||
            'Conductor sin nombre',
          nationalId: inv.driver.nationalId || 'Sin cédula',
          phone: inv.driver.phoneNumber || inv.driver.phone || 'Sin teléfono',
          email: inv.driver.email || '',
          status: 'active',
        }));
      setDrivers(realDrivers);

      // Cargar mapeo local de teléfonos desde AsyncStorage para mostrar en pestaña "Invitados WA"
      const mapStr = await AsyncStorage.getItem('gofare_invited_phones_map');
      const phoneMap = mapStr ? JSON.parse(mapStr) : {};

      const enrichedInvites = backendInvites.map((inv: any) => {
        const matchedDriver =
          inv.driver ||
          realDrivers.find(
            (d) =>
              String(d.id) === String(inv.driverId || inv.driver_id) ||
              (d.driverUuid && d.driverUuid === inv.driverUuid),
          );
        return {
          ...inv,
          driver: matchedDriver || inv.driver,
          invitedPhone:
            phoneMap[inv.code] ||
            inv.driver?.phoneNumber ||
            inv.driver?.phone ||
            'Invitado sin número',
        };
      });

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

  const getDriverAssignment = useCallback(
    (driverId: string) => {
      const assignedVehicle = vehicles.find(
        (v) => v.assignedDriver?.id === driverId,
      );
      if (assignedVehicle) {
        return `${assignedVehicle.vehicleMake} ${assignedVehicle.vehicleModel} (${assignedVehicle.licensePlate})`;
      }
      return null;
    },
    [vehicles],
  );

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
      const redirectUrl = `https://www.swiftfare.app/auth/register?inviteCode=${code}`;
      const message = `¡Hola! El dueño de vehículo ${ownerName} te invita a registrarte como conductor en su flota de GoFare.

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

  const isUsedInvite = useCallback(
    (inv: any) =>
      Boolean(
        inv.used ||
          inv.usedAt ||
          inv.used_at ||
          inv.driver ||
          inv.driverId ||
          inv.driver_id,
      ),
    [],
  );

  const isRevokedInvite = useCallback(
    (inv: any) => Boolean(inv.revokedAt || inv.revoked_at),
    [],
  );

  const isPendingInvite = useCallback(
    (inv: any) => !isUsedInvite(inv) && !isRevokedInvite(inv),
    [isUsedInvite, isRevokedInvite],
  );

  const inviteCounts = useMemo(() => {
    let used = 0;
    let pending = 0;
    let revoked = 0;
    for (const inv of invitations) {
      if (isRevokedInvite(inv)) {
        revoked++;
      } else if (isUsedInvite(inv)) {
        used++;
      } else {
        pending++;
      }
    }
    return {
      all: invitations.length,
      used,
      pending,
      revoked,
    };
  }, [invitations, isUsedInvite, isRevokedInvite]);

  const driverCounts = useMemo(() => {
    let assigned = 0;
    let unassigned = 0;
    for (const d of drivers) {
      if (getDriverAssignment(d.id)) {
        assigned++;
      } else {
        unassigned++;
      }
    }
    return {
      all: drivers.length,
      assigned,
      unassigned,
    };
  }, [drivers, getDriverAssignment]);

  const filteredDrivers = drivers.filter((d) => {
    const isAssigned = Boolean(getDriverAssignment(d.id));
    if (driverFilter === 'assigned' && !isAssigned) return false;
    if (driverFilter === 'unassigned' && isAssigned) return false;

    const term = searchText.trim().toLowerCase();
    if (!term) return true;
    return (
      d.name.toLowerCase().includes(term) ||
      d.nationalId.toLowerCase().includes(term) ||
      d.email?.toLowerCase().includes(term) ||
      d.phone?.toLowerCase().includes(term)
    );
  });

  const filteredInvitations = invitations.filter((inv) => {
    if (inviteFilter === 'used' && !isUsedInvite(inv)) return false;
    if (inviteFilter === 'pending' && !isPendingInvite(inv)) return false;
    if (inviteFilter === 'revoked' && !isRevokedInvite(inv)) return false;

    const term = searchText.trim().toLowerCase();
    if (!term) return true;
    const driver = inv.driver;
    const driverName =
      driver?.displayName ||
      (driver?.firstName || driver?.lastName
        ? `${driver.firstName || ''} ${driver.lastName || ''}`.trim()
        : null) ||
      driver?.name;
    return (
      Boolean(inv.invitedPhone?.toLowerCase().includes(term)) ||
      Boolean(inv.code?.toLowerCase().includes(term)) ||
      Boolean(driverName?.toLowerCase().includes(term)) ||
      Boolean(driver?.nationalId?.toLowerCase().includes(term)) ||
      Boolean(driver?.email?.toLowerCase().includes(term)) ||
      Boolean(driver?.phone?.toLowerCase().includes(term)) ||
      Boolean(driver?.phoneNumber?.toLowerCase().includes(term))
    );
  });

  if (loading) {
    return <AppLoadingScreen message="Cargando directorio de conductores..." />;
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
              ? 'Buscar conductor por nombre, cédula o correo...'
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

      {/* Selector de Filtros por Chips */}
      <View style={styles.filterChipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsContent}
        >
          {activeTab === 'invited' ? (
            <>
              <Pressable
                style={[
                  styles.filterChip,
                  inviteFilter === 'all' && styles.filterChipActive,
                ]}
                onPress={() => setInviteFilter('all')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    inviteFilter === 'all' && styles.filterChipTextActive,
                  ]}
                >
                  Todos ({inviteCounts.all})
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.filterChip,
                  inviteFilter === 'used' && styles.filterChipActive,
                ]}
                onPress={() => setInviteFilter('used')}
              >
                <View
                  style={[styles.filterDot, { backgroundColor: '#10B981' }]}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    inviteFilter === 'used' && styles.filterChipTextActive,
                  ]}
                >
                  Usados ({inviteCounts.used})
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.filterChip,
                  inviteFilter === 'pending' && styles.filterChipActive,
                ]}
                onPress={() => setInviteFilter('pending')}
              >
                <View
                  style={[styles.filterDot, { backgroundColor: '#F59E0B' }]}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    inviteFilter === 'pending' && styles.filterChipTextActive,
                  ]}
                >
                  Pendientes ({inviteCounts.pending})
                </Text>
              </Pressable>

              {inviteCounts.revoked > 0 && (
                <Pressable
                  style={[
                    styles.filterChip,
                    inviteFilter === 'revoked' && styles.filterChipActive,
                  ]}
                  onPress={() => setInviteFilter('revoked')}
                >
                  <View
                    style={[styles.filterDot, { backgroundColor: '#EF4444' }]}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      inviteFilter === 'revoked' && styles.filterChipTextActive,
                    ]}
                  >
                    Revocados ({inviteCounts.revoked})
                  </Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              <Pressable
                style={[
                  styles.filterChip,
                  driverFilter === 'all' && styles.filterChipActive,
                ]}
                onPress={() => setDriverFilter('all')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    driverFilter === 'all' && styles.filterChipTextActive,
                  ]}
                >
                  Todos ({driverCounts.all})
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.filterChip,
                  driverFilter === 'assigned' && styles.filterChipActive,
                ]}
                onPress={() => setDriverFilter('assigned')}
              >
                <Ionicons
                  name="bus"
                  size={12}
                  color={
                    driverFilter === 'assigned'
                      ? tokens.colors.primary
                      : '#059669'
                  }
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    driverFilter === 'assigned' && styles.filterChipTextActive,
                  ]}
                >
                  Con unidad ({driverCounts.assigned})
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.filterChip,
                  driverFilter === 'unassigned' && styles.filterChipActive,
                ]}
                onPress={() => setDriverFilter('unassigned')}
              >
                <Ionicons
                  name="person-outline"
                  size={12}
                  color={
                    driverFilter === 'unassigned'
                      ? tokens.colors.primary
                      : '#64748B'
                  }
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    driverFilter === 'unassigned' &&
                      styles.filterChipTextActive,
                  ]}
                >
                  Sin unidad ({driverCounts.unassigned})
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
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
                {/* 1. Header con Avatar, Nombre y Badge de Estado */}
                <View style={styles.driverHeader}>
                  <View style={styles.driverAvatar}>
                    <Text style={styles.driverAvatarText}>
                      {item.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .substring(0, 2)}
                    </Text>
                  </View>
                  <View style={styles.driverHeaderInfo}>
                    <Text style={styles.driverName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.driverSubRole}>
                      Conductor Registrado
                    </Text>
                  </View>
                  <View style={styles.statusPill}>
                    <View style={styles.activeDot} />
                    <Text style={styles.activeText}>Activo</Text>
                  </View>
                </View>

                {/* 2. Caja de Metadatos estructurados */}
                <View style={styles.metaContainer}>
                  <View style={styles.metaRow}>
                    <View style={styles.metaIconBox}>
                      <Ionicons name="card-outline" size={13} color="#64748B" />
                    </View>
                    <Text style={styles.metaLabel}>Cédula:</Text>
                    <Text style={styles.metaValue}>{item.nationalId}</Text>
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.metaIconBox}>
                      <Ionicons name="call-outline" size={13} color="#64748B" />
                    </View>
                    <Text style={styles.metaLabel}>Teléfono:</Text>
                    <Text style={styles.metaValue}>{item.phone}</Text>
                  </View>

                  {item.email ? (
                    <View style={styles.metaRow}>
                      <View style={styles.metaIconBox}>
                        <Ionicons
                          name="mail-outline"
                          size={13}
                          color="#64748B"
                        />
                      </View>
                      <Text style={styles.metaLabel}>Correo:</Text>
                      <Text
                        style={styles.metaValue}
                        numberOfLines={1}
                        ellipsizeMode="middle"
                      >
                        {item.email}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* 3. Banner inferior de Asignación / Estado */}
                <View
                  style={[
                    styles.assignmentBanner,
                    assignment
                      ? styles.bannerAssigned
                      : styles.bannerUnassigned,
                  ]}
                >
                  <Ionicons
                    name={assignment ? 'bus' : 'time-outline'}
                    size={15}
                    color={assignment ? '#059669' : '#D97706'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.assignmentText,
                      assignment
                        ? styles.assignmentTextAssigned
                        : styles.assignmentTextUnassigned,
                    ]}
                    numberOfLines={1}
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

            const isUsed = Boolean(
              item.used ||
                item.usedAt ||
                item.used_at ||
                item.driver ||
                item.driverId ||
                item.driver_id,
            );
            const isRevoked = Boolean(item.revokedAt || item.revoked_at);

            // Conductor que canjeó la invitación
            const matchedDriver =
              item.driver ||
              drivers.find(
                (d) =>
                  String(d.id) ===
                    String(item.driverId || item.driver_id || item.driver) ||
                  (d.driverUuid && d.driverUuid === item.driverUuid),
              );

            const driverDisplayName =
              matchedDriver?.displayName ||
              (matchedDriver?.firstName || matchedDriver?.lastName
                ? `${matchedDriver.firstName || ''} ${matchedDriver.lastName || ''}`.trim()
                : null) ||
              matchedDriver?.name ||
              (isUsed ? 'Conductor asociado' : null);

            const driverNationalId =
              matchedDriver?.nationalId &&
              matchedDriver.nationalId !== 'Sin cédula'
                ? matchedDriver.nationalId
                : null;

            const driverPhone =
              matchedDriver?.phoneNumber ||
              matchedDriver?.phone ||
              (matchedDriver?.phone !== 'Sin teléfono'
                ? matchedDriver?.phone
                : null);

            const driverEmail = matchedDriver?.email || null;

            const driverVehicleAssignment = matchedDriver?.id
              ? getDriverAssignment(String(matchedDriver.id))
              : null;

            const usedAtDate = item.usedAt || item.used_at;
            const usedAtStr = usedAtDate
              ? new Date(usedAtDate).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : null;

            return (
              <View style={styles.driverCard}>
                <View style={styles.driverHeader}>
                  <View style={[styles.driverAvatar, styles.whatsappAvatar]}>
                    <Ionicons name="logo-whatsapp" size={20} color="#10B981" />
                  </View>
                  <View style={styles.driverHeaderInfo}>
                    <Text style={styles.driverName} numberOfLines={1}>
                      {item.invitedPhone}
                    </Text>
                    <Text style={styles.driverSubRole}>Enviado: {dateStr}</Text>
                  </View>

                  {isUsed ? (
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
                        Usado
                      </Text>
                    </View>
                  ) : isRevoked ? (
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: '#FEE2E2' },
                      ]}
                    >
                      <View
                        style={[
                          styles.activeDot,
                          { backgroundColor: '#EF4444' },
                        ]}
                      />
                      <Text style={[styles.activeText, { color: '#991B1B' }]}>
                        Revocado
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

                {/* Código de Invitación Card Box */}
                <View style={styles.inviteCodeBox}>
                  <Text style={styles.inviteCodeLabel}>CÓDIGO DE ENLACE</Text>
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeBadgeText}>{item.code}</Text>
                  </View>
                </View>

                {/* Detalle: Por quién fue usado */}
                {isUsed && (
                  <View style={styles.usedByCard}>
                    <View style={styles.usedByHeaderRow}>
                      <View style={styles.usedByTag}>
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color="#059669"
                        />
                        <Text style={styles.usedByTagText}>CANJEADO POR</Text>
                      </View>
                      {usedAtStr && (
                        <Text style={styles.usedAtText}>El {usedAtStr}</Text>
                      )}
                    </View>

                    <View style={styles.usedByDriverRow}>
                      <View style={styles.usedByAvatarCircle}>
                        <Text style={styles.usedByAvatarInitials}>
                          {(driverDisplayName || 'C')
                            .split(' ')
                            .map((n: string) => n[0])
                            .join('')
                            .substring(0, 2)
                            .toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.usedByDriverInfo}>
                        <Text style={styles.usedByDriverName} numberOfLines={1}>
                          {driverDisplayName}
                        </Text>
                        <View style={styles.usedByBadgesRow}>
                          {driverNationalId && (
                            <View style={styles.usedByBadgeItem}>
                              <Ionicons
                                name="card-outline"
                                size={11}
                                color="#64748B"
                              />
                              <Text style={styles.usedByBadgeText}>
                                {driverNationalId}
                              </Text>
                            </View>
                          )}
                          {driverPhone && driverPhone !== 'Sin teléfono' && (
                            <View style={styles.usedByBadgeItem}>
                              <Ionicons
                                name="call-outline"
                                size={11}
                                color="#64748B"
                              />
                              <Text style={styles.usedByBadgeText}>
                                {driverPhone}
                              </Text>
                            </View>
                          )}
                        </View>
                        {driverEmail ? (
                          <View
                            style={[styles.usedByBadgeItem, { marginTop: 4 }]}
                          >
                            <Ionicons
                              name="mail-outline"
                              size={11}
                              color="#64748B"
                            />
                            <Text
                              style={styles.usedByBadgeText}
                              numberOfLines={1}
                            >
                              {driverEmail}
                            </Text>
                          </View>
                        ) : null}
                        {driverVehicleAssignment ? (
                          <View
                            style={[
                              styles.usedByBadgeItem,
                              styles.usedByAssignmentBadge,
                            ]}
                          >
                            <Ionicons
                              name="bus-outline"
                              size={11}
                              color="#065F46"
                            />
                            <Text
                              style={styles.usedByAssignmentText}
                              numberOfLines={1}
                            >
                              {driverVehicleAssignment}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                )}
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Agregar Conductor</Text>
                <Pressable
                  onPress={() => setIsModalVisible(false)}
                  hitSlop={10}
                >
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
        </KeyboardAvoidingView>
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
    flexGrow: 1,
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
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  whatsappAvatar: {
    backgroundColor: '#ECFDF5',
    borderColor: '#D1FAE5',
  },
  driverAvatarText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  driverHeaderInfo: {
    flex: 1,
    marginRight: 8,
  },
  driverName: {
    fontSize: 15.5,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
    marginBottom: 2,
  },
  driverSubRole: {
    fontSize: 11.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  metaContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 7,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIconBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metaLabel: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    width: 58,
  },
  metaValue: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
  },
  assignmentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  bannerAssigned: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  bannerUnassigned: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  assignmentText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  assignmentTextAssigned: {
    color: '#065F46',
  },
  assignmentTextUnassigned: {
    color: '#B45309',
  },
  inviteCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  inviteCodeLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
    letterSpacing: 0.5,
  },
  codeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  codeBadgeText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
    letterSpacing: 1,
  },
  usedByCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  usedByHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  usedByTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  usedByTagText: {
    fontSize: 10.5,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#059669',
    letterSpacing: 0.5,
  },
  usedAtText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  usedByDriverRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  usedByAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  usedByAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  usedByDriverInfo: {
    flex: 1,
  },
  usedByDriverName: {
    fontSize: 13.5,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
    marginBottom: 2,
  },
  usedByBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  usedByBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  usedByBadgeText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  usedByAssignmentBadge: {
    marginTop: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignSelf: 'flex-start',
  },
  usedByAssignmentText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#065F46',
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
  filterChipsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 10,
  },
  filterChipsContent: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  filterChipText: {
    fontSize: 12.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  filterChipTextActive: {
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  filterDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
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
