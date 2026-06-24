import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { useAdminSidebar } from '@/components/AdminSidebarContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  getAllCivilAssociations,
  getAllUsers,
  registerCivilAssociation,
  resolveRoleUuid,
  updateCivilAssociationProfile,
  updateUserRoles,
} from '@/lib/api';
import { tokens } from '@/theme/tokens';

export default function AdminCivilAssociationsScreen() {
  const _router = useRouter();
  const { setIsOpen } = useAdminSidebar();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [associations, setAssociations] = useState<any[]>([]);
  const [filteredAssocs, setFilteredAssocs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<
    'all' | 'approved' | 'pending_review' | 'rejected' | 'suspended'
  >('all');

  // Modal de Detalles / Acciones
  const [selectedAssoc, setSelectedAssoc] = useState<any | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [editPosition, setEditPosition] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Modal de Registro
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [registerTab, setRegisterTab] = useState<'promote' | 'new'>('promote');

  // Formulario de Promoción
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [filteredAvailableUsers, setFilteredAvailableUsers] = useState<any[]>(
    [],
  );
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserToPromote, setSelectedUserToPromote] = useState<
    any | null
  >(null);
  const [promotePosition, setPromotePosition] = useState('Presidente');

  // Formulario de Nuevo Representante
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newNationalId, setNewNationalId] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPosition, setNewPosition] = useState('Presidente');

  const applyFilters = useCallback(
    (
      allList: any[],
      query: string,
      statusTab:
        | 'all'
        | 'approved'
        | 'pending_review'
        | 'rejected'
        | 'suspended',
    ) => {
      let result = [...allList];

      // Filtro por estado
      if (statusTab !== 'all') {
        result = result.filter((r) => r.status === statusTab);
      }

      // Filtro por búsqueda
      if (query.trim().length > 0) {
        const q = query.toLowerCase();
        result = result.filter((r) => {
          const name = (
            r.displayName || `${r.firstName || ''} ${r.lastName || ''}`
          ).toLowerCase();
          const email = (r.email || '').toLowerCase();
          const phone = (r.phoneNumber || '').toLowerCase();
          const id = (r.nationalId || '').toLowerCase();
          const pos = (r.position || '').toLowerCase();
          return (
            name.includes(q) ||
            email.includes(q) ||
            phone.includes(q) ||
            id.includes(q) ||
            pos.includes(q)
          );
        });
      }

      setFilteredAssocs(result);
    },
    [],
  );

  const fetchAssociations = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      try {
        const list = await getAllCivilAssociations();
        setAssociations(list);
        applyFilters(list, search, activeTab);
      } catch (err) {
        console.warn('[AdminCivilAssociations] Error loading:', err);
        Alert.alert(
          'Error',
          'No se pudo cargar la lista de asociaciones civiles.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applyFilters, search, activeTab],
  );

  const fetchAvailableUsers = async () => {
    try {
      const allUsers = await getAllUsers();
      // Filtrar usuarios que NO sean administradores y que NO tengan el rol civil_association
      const candidates = allUsers.filter((u: any) => {
        const roles = u.roles || [];
        const isAdmin = roles.some((r: any) => r.name === 'platform_admin');
        const isCivil = roles.some((r: any) => r.name === 'civil_association');
        return !isAdmin && !isCivil;
      });
      setAvailableUsers(candidates);
      setFilteredAvailableUsers(candidates);
    } catch (err) {
      console.warn('[AdminCivilAssociations] Error fetching candidates:', err);
    }
  };

  useEffect(() => {
    fetchAssociations();
  }, [fetchAssociations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAssociations(true);
  }, [fetchAssociations]);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    applyFilters(associations, text, activeTab);
  };

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    applyFilters(associations, search, tab);
  };

  const handleOpenDetails = (assoc: any) => {
    setSelectedAssoc(assoc);
    setEditPosition(assoc.position || '');
    setRejectionReason(assoc.rejectionReason || '');
    setDetailsModalVisible(true);
  };

  const handleSaveDetails = async () => {
    if (!selectedAssoc) return;
    setDetailsModalVisible(false);
    setLoading(true);
    try {
      await updateCivilAssociationProfile(selectedAssoc.uuid, {
        position: editPosition.trim(),
      });
      Alert.alert(
        'Éxito',
        'Los detalles de la asociación civil han sido actualizados.',
      );
      fetchAssociations();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo actualizar el perfil.');
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedAssoc) return;

    // Si se rechaza, validar motivo
    if (newStatus === 'rejected' && rejectionReason.trim().length < 4) {
      Alert.alert(
        'Motivo Requerido',
        'Por favor ingresa un motivo para el rechazo (mínimo 4 letras).',
      );
      return;
    }

    setDetailsModalVisible(false);
    setLoading(true);
    try {
      await updateCivilAssociationProfile(selectedAssoc.uuid, {
        status: newStatus,
        rejectionReason: newStatus === 'rejected' ? rejectionReason.trim() : '',
      });
      Alert.alert(
        'Éxito',
        `Estado cambiado a: ${newStatus === 'approved' ? 'Aprobado' : newStatus === 'rejected' ? 'Rechazado' : newStatus === 'suspended' ? 'Suspendido' : 'Pendiente'}`,
      );
      fetchAssociations();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo cambiar el estado.');
      setLoading(false);
    }
  };

  const handleRemoveRole = () => {
    if (!selectedAssoc) return;
    setDetailsModalVisible(false);

    Alert.alert(
      'Quitar Rol de Asoc. Civil',
      `¿Estás seguro de que deseas quitarle el rol de Asociación Civil a ${selectedAssoc.displayName}? Volverá a ser Pasajero común.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar Rol',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              if (selectedAssoc.uuid.startsWith('mock-ca-')) {
                // Es un mock local, lo eliminamos de la lista simulada
                const cached = await getAllCivilAssociations();
                const updated = cached.filter(
                  (m: any) => m.uuid !== selectedAssoc.uuid,
                );
                // AsyncStorage helper local save
                const mockKey = 'gofare_civil_assoc_mocks';
                const filteredMocks = updated.filter((r: any) =>
                  r.uuid.startsWith('mock-ca-'),
                );
                await AsyncStorage.setItem(
                  mockKey,
                  JSON.stringify(filteredMocks),
                );
              } else {
                // Es real, lo degradamos a Passenger (ID '1')
                const roleUuid = await resolveRoleUuid('passenger');
                if (!roleUuid) {
                  throw new Error(
                    'No se pudo resolver el ID de rol de pasajero.',
                  );
                }
                await updateUserRoles(selectedAssoc.uuid, [roleUuid]);

                // Limpiar metadatos
                const metaKey = 'gofare_civil_assoc_metadata';
                const metadataStr = await AsyncStorage.getItem(metaKey);
                if (metadataStr) {
                  const metadata = JSON.parse(metadataStr);
                  delete metadata[selectedAssoc.uuid];
                  await AsyncStorage.setItem(metaKey, JSON.stringify(metadata));
                }
              }
              Alert.alert('Éxito', 'Rol quitado correctamente.');
              fetchAssociations();
            } catch (err: any) {
              Alert.alert(
                'Error',
                err.message || 'No se pudo degradar el usuario.',
              );
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleOpenRegister = () => {
    fetchAvailableUsers();
    setSelectedUserToPromote(null);
    setPromotePosition('Presidente');
    setUserSearch('');

    // Reset new form
    setNewFirstName('');
    setNewLastName('');
    setNewEmail('');
    setNewNationalId('');
    setNewPhone('');
    setNewPosition('Presidente');

    setRegisterModalVisible(true);
  };

  const handleCandidateSearch = (text: string) => {
    setUserSearch(text);
    if (text.trim().length === 0) {
      setFilteredAvailableUsers(availableUsers);
    } else {
      const q = text.toLowerCase();
      const filtered = availableUsers.filter((u) => {
        const name = (
          u.displayName || `${u.firstName || ''} ${u.lastName || ''}`
        ).toLowerCase();
        const email = (u.email || '').toLowerCase();
        const nationalId = (u.nationalId || '').toLowerCase();
        return name.includes(q) || email.includes(q) || nationalId.includes(q);
      });
      setFilteredAvailableUsers(filtered);
    }
  };

  const handleRegisterPromote = async () => {
    if (!selectedUserToPromote) {
      Alert.alert('Error', 'Por favor selecciona un usuario de la lista.');
      return;
    }
    if (promotePosition.trim().length === 0) {
      Alert.alert('Error', 'Por favor ingresa un cargo/posición.');
      return;
    }

    setRegisterModalVisible(false);
    setLoading(true);
    try {
      await registerCivilAssociation({
        userUuid: selectedUserToPromote.uuid,
        position: promotePosition.trim(),
        status: 'approved',
      });
      Alert.alert(
        'Éxito',
        'Usuario promovido a Representante de Asociación Civil correctamente.',
      );
      fetchAssociations();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo promover al usuario.');
      setLoading(false);
    }
  };

  const handleRegisterNew = async () => {
    if (!newFirstName.trim() || !newEmail.trim() || !newNationalId.trim()) {
      Alert.alert('Error', 'Nombre, Correo y Cédula son obligatorios.');
      return;
    }
    if (newPosition.trim().length === 0) {
      Alert.alert('Error', 'Por favor ingresa un cargo/posición.');
      return;
    }

    setRegisterModalVisible(false);
    setLoading(true);
    try {
      await registerCivilAssociation({
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        email: newEmail.trim().toLowerCase(),
        nationalId: newNationalId.trim(),
        phoneNumber: newPhone.trim(),
        position: newPosition.trim(),
        status: 'approved',
      });
      Alert.alert('Éxito', 'Asociación Civil registrada localmente.');
      fetchAssociations();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo registrar.');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Asociaciones Civiles"
        onMenu={() => setIsOpen(true)}
      />

      {/* Estadísticas */}
      <View style={styles.statsRow}>
        <View style={styles.statMiniBox}>
          <Text style={styles.statMiniNum}>
            {associations.filter((a) => a.status === 'approved').length}
          </Text>
          <Text style={styles.statMiniLabel}>Aprobados</Text>
        </View>
        <View style={styles.statMiniBox}>
          <Text style={[styles.statMiniNum, { color: '#EA580C' }]}>
            {associations.filter((a) => a.status === 'pending_review').length}
          </Text>
          <Text style={styles.statMiniLabel}>Pendientes</Text>
        </View>
        <View style={styles.statMiniBox}>
          <Text style={[styles.statMiniNum, { color: '#EF4444' }]}>
            {associations.filter((a) => a.status === 'rejected').length}
          </Text>
          <Text style={styles.statMiniLabel}>Rechazados</Text>
        </View>
      </View>

      {/* Buscador */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={20}
          color="#94A3B8"
          style={{ marginRight: 10 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar representante, correo o cargo..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={handleSearchChange}
        />
        {search.length > 0 && (
          <Pressable onPress={() => handleSearchChange('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </Pressable>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <FlatList
          data={[
            { id: 'all', label: 'Todos' },
            { id: 'approved', label: 'Aprobados' },
            { id: 'pending_review', label: 'Pendientes' },
            { id: 'rejected', label: 'Rechazados' },
            { id: 'suspended', label: 'Suspendidos' },
          ]}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          renderItem={({ item }) => {
            const isActive = activeTab === item.id;
            return (
              <Pressable
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                onPress={() => handleTabChange(item.id as any)}
              >
                <Text
                  style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Listado */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={tokens.colors.primary} />
        </View>
      ) : filteredAssocs.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="business-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>No hay asociaciones registradas.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredAssocs}
          keyExtractor={(item) => item.uuid}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          renderItem={({ item }) => {
            const statusColor =
              item.status === 'approved'
                ? '#10B981'
                : item.status === 'pending_review'
                  ? '#EA580C'
                  : item.status === 'rejected'
                    ? '#EF4444'
                    : '#64748B';
            const statusLabel =
              item.status === 'approved'
                ? 'Aprobado'
                : item.status === 'pending_review'
                  ? 'Pendiente'
                  : item.status === 'rejected'
                    ? 'Rechazado'
                    : 'Suspendido';

            return (
              <Pressable
                style={styles.card}
                onPress={() => handleOpenDetails(item)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(item.displayName || item.firstName || 'C')
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.meta}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.displayName ||
                        `${item.firstName || ''} ${item.lastName || ''}`}
                    </Text>
                    <Text style={styles.subtext} numberOfLines={1}>
                      {item.email}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: `${statusColor}12` },
                    ]}
                  >
                    <Text
                      style={[styles.statusBadgeText, { color: statusColor }]}
                    >
                      {statusLabel}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.detail}>
                    <Ionicons
                      name="briefcase-outline"
                      size={14}
                      color="#64748B"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.detailText}>
                      Cargo: {item.position || 'Representante'}
                    </Text>
                  </View>
                  {item.nationalId && (
                    <View style={styles.detail}>
                      <Ionicons
                        name="card-outline"
                        size={14}
                        color="#64748B"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.detailText}>
                        Cédula: {item.nationalId}
                      </Text>
                    </View>
                  )}
                  {item.phoneNumber && (
                    <View style={styles.detail}>
                      <Ionicons
                        name="call-outline"
                        size={14}
                        color="#64748B"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.detailText}>
                        Telf: {item.phoneNumber}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Botón Flotante para Registrar */}
      <Pressable style={styles.fab} onPress={handleOpenRegister}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      {/* MODAL DETALLES Y ACCIONES */}
      <Modal
        visible={detailsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Acciones de Representante</Text>
              <Pressable onPress={() => setDetailsModalVisible(false)}>
                <Ionicons
                  name="close-circle-outline"
                  size={24}
                  color="#64748B"
                />
              </Pressable>
            </View>

            {selectedAssoc && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalInfoBox}>
                  <Text style={styles.modalInfoName}>
                    {selectedAssoc.displayName ||
                      `${selectedAssoc.firstName || ''} ${selectedAssoc.lastName || ''}`}
                  </Text>
                  <Text style={styles.modalInfoEmail}>
                    {selectedAssoc.email}
                  </Text>
                  {selectedAssoc.nationalId && (
                    <Text style={styles.modalInfoSub}>
                      Cédula: {selectedAssoc.nationalId}
                    </Text>
                  )}
                  <Text style={[styles.modalInfoSub, { marginTop: 4 }]}>
                    Estado Actual:{' '}
                    <Text style={{ fontWeight: 'bold' }}>
                      {selectedAssoc.status === 'approved'
                        ? 'Aprobado'
                        : selectedAssoc.status === 'pending_review'
                          ? 'Pendiente'
                          : selectedAssoc.status === 'rejected'
                            ? 'Rechazado'
                            : 'Suspendido'}
                    </Text>
                  </Text>
                </View>

                {/* Cargo */}
                <Text style={styles.modalLabel}>
                  CARGO / POSICIÓN DENTRO DE LA LÍNEA:
                </Text>
                <TextInput
                  style={styles.modalInput}
                  value={editPosition}
                  onChangeText={setEditPosition}
                  placeholder="Ej. Presidente, Secretario General..."
                  placeholderTextColor="#94A3B8"
                />

                <Pressable
                  style={styles.primarySaveBtn}
                  onPress={handleSaveDetails}
                >
                  <Text style={styles.primarySaveBtnText}>Guardar Cargo</Text>
                </Pressable>

                {/* Estado */}
                <Text style={[styles.modalLabel, { marginTop: 16 }]}>
                  CAMBIAR ESTADO DE APROBACIÓN:
                </Text>
                <View style={styles.statusButtonsGrid}>
                  <Pressable
                    style={[styles.statusBtn, { borderColor: '#10B981' }]}
                    onPress={() => handleStatusChange('approved')}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color="#10B981"
                    />
                    <Text style={[styles.statusBtnText, { color: '#10B981' }]}>
                      Aprobar
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.statusBtn, { borderColor: '#EA580C' }]}
                    onPress={() => handleStatusChange('pending_review')}
                  >
                    <Ionicons name="time-outline" size={18} color="#EA580C" />
                    <Text style={[styles.statusBtnText, { color: '#EA580C' }]}>
                      Pendiente
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.statusBtn, { borderColor: '#64748B' }]}
                    onPress={() => handleStatusChange('suspended')}
                  >
                    <Ionicons
                      name="pause-circle-outline"
                      size={18}
                      color="#64748B"
                    />
                    <Text style={[styles.statusBtnText, { color: '#64748B' }]}>
                      Suspender
                    </Text>
                  </Pressable>
                </View>

                <Text style={[styles.modalLabel, { marginTop: 10 }]}>
                  SI DESEAS RECHAZAR, INGRESA EL MOTIVO Y CONFIRMA:
                </Text>
                <TextInput
                  style={[styles.modalInput, { height: 60 }]}
                  multiline
                  numberOfLines={2}
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                  placeholder="Escribe el motivo del rechazo..."
                  placeholderTextColor="#94A3B8"
                />
                <Pressable
                  style={[
                    styles.statusBtn,
                    {
                      borderColor: '#EF4444',
                      alignSelf: 'stretch',
                      height: 44,
                      marginTop: 8,
                    },
                  ]}
                  onPress={() => handleStatusChange('rejected')}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={18}
                    color="#EF4444"
                  />
                  <Text style={[styles.statusBtnText, { color: '#EF4444' }]}>
                    Rechazar y Notificar
                  </Text>
                </Pressable>

                {/* Quitar Rol */}
                <View style={styles.divider} />
                <Pressable
                  style={styles.removeRoleBtn}
                  onPress={handleRemoveRole}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  <Text style={styles.removeRoleBtnText}>
                    Degradar y Quitar Rol de Asoc. Civil
                  </Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL REGISTRO NUEVO / PROMOVER */}
      <Modal
        visible={registerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRegisterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar Representante</Text>
              <Pressable onPress={() => setRegisterModalVisible(false)}>
                <Ionicons
                  name="close-circle-outline"
                  size={24}
                  color="#64748B"
                />
              </Pressable>
            </View>

            {/* Pestañas del Modal */}
            <View style={styles.modalSubtabs}>
              <Pressable
                style={[
                  styles.modalSubtab,
                  registerTab === 'promote' && styles.modalSubtabActive,
                ]}
                onPress={() => setRegisterTab('promote')}
              >
                <Text
                  style={[
                    styles.modalSubtabText,
                    registerTab === 'promote' && styles.modalSubtabTextActive,
                  ]}
                >
                  Promover Usuario
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalSubtab,
                  registerTab === 'new' && styles.modalSubtabActive,
                ]}
                onPress={() => setRegisterTab('new')}
              >
                <Text
                  style={[
                    styles.modalSubtabText,
                    registerTab === 'new' && styles.modalSubtabTextActive,
                  ]}
                >
                  Registrar Nuevo
                </Text>
              </Pressable>
            </View>

            {registerTab === 'promote' ? (
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>BUSCAR USUARIO EXISTENTE:</Text>
                <View style={styles.userSearchBox}>
                  <Ionicons
                    name="search"
                    size={16}
                    color="#94A3B8"
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    style={styles.userSearchInput}
                    placeholder="Buscar por nombre, correo o cédula..."
                    placeholderTextColor="#94A3B8"
                    value={userSearch}
                    onChangeText={handleCandidateSearch}
                  />
                </View>

                {selectedUserToPromote ? (
                  <View style={styles.selectedUserBanner}>
                    <View>
                      <Text style={styles.selectedUserText}>
                        Seleccionado:{' '}
                        <Text style={{ fontWeight: 'bold' }}>
                          {selectedUserToPromote.displayName ||
                            selectedUserToPromote.firstName}
                        </Text>
                      </Text>
                      <Text style={styles.selectedUserSub}>
                        {selectedUserToPromote.email}
                      </Text>
                    </View>
                    <Pressable onPress={() => setSelectedUserToPromote(null)}>
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </Pressable>
                  </View>
                ) : (
                  <FlatList
                    data={filteredAvailableUsers.slice(0, 10)} // Tomar solo los 10 primeros
                    keyExtractor={(item) => item.uuid}
                    style={styles.candidatesList}
                    renderItem={({ item }) => (
                      <Pressable
                        style={styles.candidateRow}
                        onPress={() => setSelectedUserToPromote(item)}
                      >
                        <View style={styles.candidateAvatar}>
                          <Text style={styles.candidateAvatarText}>
                            {(item.displayName || item.firstName || 'U')
                              .charAt(0)
                              .toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.candidateName}>
                            {item.displayName ||
                              `${item.firstName || ''} ${item.lastName || ''}`}
                          </Text>
                          <Text style={styles.candidateEmail}>
                            {item.email}
                          </Text>
                        </View>
                        <Ionicons
                          name="add-circle-outline"
                          size={20}
                          color={tokens.colors.primary}
                        />
                      </Pressable>
                    )}
                  />
                )}

                <Text style={[styles.modalLabel, { marginTop: 12 }]}>
                  CARGO DENTRO DE LA ASOCIACIÓN:
                </Text>
                <TextInput
                  style={styles.modalInput}
                  value={promotePosition}
                  onChangeText={setPromotePosition}
                  placeholder="Ej. Presidente, Secretario de Finanzas..."
                  placeholderTextColor="#94A3B8"
                />

                <Pressable
                  style={styles.primarySaveBtn}
                  onPress={handleRegisterPromote}
                >
                  <Text style={styles.primarySaveBtnText}>
                    Promover y Asignar Cargo
                  </Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
              >
                <Text style={styles.modalLabel}>NOMBRES:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newFirstName}
                  onChangeText={setNewFirstName}
                  placeholder="Nombres de pila"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.modalLabel}>APELLIDOS:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newLastName}
                  onChangeText={setNewLastName}
                  placeholder="Apellidos"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.modalLabel}>CORREO ELECTRÓNICO:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.modalLabel}>CÉDULA DE IDENTIDAD:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newNationalId}
                  onChangeText={setNewNationalId}
                  placeholder="Ej. V-12345678"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.modalLabel}>TELÉFONO DE CONTACTO:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newPhone}
                  onChangeText={setNewPhone}
                  keyboardType="phone-pad"
                  placeholder="Ej. 04141234567"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.modalLabel}>
                  CARGO / POSICIÓN DENTRO DE LA LÍNEA:
                </Text>
                <TextInput
                  style={styles.modalInput}
                  value={newPosition}
                  onChangeText={setNewPosition}
                  placeholder="Ej. Presidente, Coordinador General..."
                  placeholderTextColor="#94A3B8"
                />

                <Pressable
                  style={[styles.primarySaveBtn, { marginTop: 12 }]}
                  onPress={handleRegisterNew}
                >
                  <Text style={styles.primarySaveBtnText}>
                    Registrar como Asociación Civil
                  </Text>
                </Pressable>
              </ScrollView>
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 16,
    gap: 10,
  },
  statMiniBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  statMiniNum: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#10B981',
  },
  statMiniLabel: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#0F172A',
  },
  tabsContainer: {
    height: 38,
    marginBottom: 16,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: tokens.colors.primary,
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  meta: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  subtext: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  cardBody: {
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#94A3B8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '85%',
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
    color: '#0F172A',
  },
  modalInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  modalInfoName: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  modalInfoEmail: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    marginTop: 2,
  },
  modalInfoSub: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginTop: 6,
  },
  modalLabel: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#94A3B8',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    height: 46,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#0F172A',
    marginBottom: 12,
  },
  primarySaveBtn: {
    backgroundColor: tokens.colors.primary,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  primarySaveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  statusButtonsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  statusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: 10,
    height: 40,
    gap: 4,
  },
  statusBtnText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 20,
  },
  removeRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#EF4444',
    borderWidth: 1,
    height: 48,
    borderRadius: 10,
    gap: 8,
  },
  removeRoleBtnText: {
    color: '#EF4444',
    fontFamily: tokens.typography.fontFamily.bold,
    fontSize: 13,
  },
  modalSubtabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  modalSubtab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  modalSubtabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  modalSubtabText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
  },
  modalSubtabTextActive: {
    color: '#0F172A',
  },
  userSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  userSearchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#0F172A',
  },
  selectedUserBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  selectedUserText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#1E40AF',
  },
  selectedUserSub: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#1E40AF',
    marginTop: 2,
  },
  candidatesList: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 10,
    marginBottom: 12,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  candidateAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  candidateAvatarText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#475569',
  },
  candidateName: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  candidateEmail: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
  },
});
