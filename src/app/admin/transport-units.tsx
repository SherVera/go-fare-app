import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
  getAllTransportUnits,
  toggleTransportUnitStatus,
  approveVehicle,
  rejectVehicle,
  getVehicleDetail,
  getAllDocuments,
  verifyDocument,
  rejectDocument,
} from '@/lib/api';
import { tokens } from '@/theme/tokens';

export default function AdminTransportUnitsScreen() {
  const _router = useRouter();
  const { setIsOpen } = useAdminSidebar();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [filteredUnits, setFilteredUnits] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'inactive'>(
    'all',
  );
  const [selectedUnit, setSelectedUnit] = useState<any | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const applyFilters = useCallback(
    (allUnits: any[], query: string, tab: typeof activeTab) => {
      let result = [...allUnits];

      // Filter by status tab
      if (tab === 'active') {
        result = result.filter((u) => u.isActive === true);
      } else if (tab === 'inactive') {
        result = result.filter((u) => u.isActive === false);
      }

      // Filter by search query
      if (query.trim().length > 0) {
        const q = query.toLowerCase();
        result = result.filter((u) => {
          const plate = (u.plate || '').toLowerCase();
          const brand = (u.brand || '').toLowerCase();
          const model = (u.model || '').toLowerCase();
          const invite = (u.inviteCode || '').toLowerCase();
          const owner = (u.owner?.displayName || '').toLowerCase();
          return (
            plate.includes(q) ||
            brand.includes(q) ||
            model.includes(q) ||
            invite.includes(q) ||
            owner.includes(q)
          );
        });
      }

      setFilteredUnits(result);
    },
    [],
  );

  const fetchUnits = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      try {
        const res = await getAllTransportUnits();
        setUnits(res);
        applyFilters(res, search, activeTab);
      } catch (err) {
        console.warn('[AdminUnits] Error fetching units:', err);
        Alert.alert(
          'Error',
          'No se pudieron cargar las unidades de transporte.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab, applyFilters, search],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUnits(true);
  }, [fetchUnits]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    applyFilters(units, text, activeTab);
  };

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    applyFilters(units, search, tab);
  };

  const handleShowDetails = async (item: any) => {
    try {
      setDetailLoading(true);
      setSelectedUnit(null);
      setIsDetailModalVisible(true);

      // 1. Obtener detalles técnicos de la unidad
      const detail = await getVehicleDetail(item.uuid);

      // 2. Obtener todos los documentos y filtrar por este vehículo
      const allDocs = await getAllDocuments();
      let vehicleDocs = allDocs.filter(
        (doc: any) =>
          doc.vehicle?.uuid === item.uuid ||
          doc.vehicleUuid === item.uuid ||
          doc.vehicleId === item.uuid,
      );

      // Si no tiene documentos en caché local, los generamos dinámicamente para pruebas sin modificar backend
      if (vehicleDocs.length === 0) {
        vehicleDocs = [
          {
            uuid: `mock-doc-tp-${item.uuid}`,
            type: 'titulo_propiedad',
            documentNumber: `TP-${item.plate || '9999'}`,
            fileUrl: 'https://gofare.app/manual-entry.pdf',
            status: item.isActive ? 'verified' : 'pending_review',
            vehicleUuid: item.uuid,
            vehicle: { uuid: item.uuid },
          },
          {
            uuid: `mock-doc-rcv-${item.uuid}`,
            type: 'seguro_responsabilidad_civil',
            documentNumber: `RCV-${item.plate || '9999'}`,
            fileUrl: 'https://gofare.app/manual-entry.pdf',
            status: item.isActive ? 'verified' : 'pending_review',
            vehicleUuid: item.uuid,
            vehicle: { uuid: item.uuid },
          },
          {
            uuid: `mock-doc-rev-${item.uuid}`,
            type: 'revision_tecnica_intt',
            documentNumber: `INTT-${item.plate || '9999'}`,
            fileUrl: 'https://gofare.app/manual-entry.pdf',
            status: item.isActive ? 'verified' : 'pending_review',
            vehicleUuid: item.uuid,
            vehicle: { uuid: item.uuid },
          },
        ];

        // Persistir en AsyncStorage para que reflejen cambios en la UI de Documentos del Admin
        try {
          const cached = await AsyncStorage.getItem('mock_admin_documents');
          const docs = cached ? JSON.parse(cached) : [];
          const filteredDocs = docs.filter(
            (d: any) => !d.uuid.includes(item.uuid),
          );
          await AsyncStorage.setItem(
            'mock_admin_documents',
            JSON.stringify([...filteredDocs, ...vehicleDocs]),
          );
        } catch (_) {}
      }

      setSelectedUnit({
        ...item,
        ...detail,
        documents: vehicleDocs,
      });
    } catch (err) {
      console.warn('[AdminUnits] Error loading details:', err);
      setSelectedUnit({
        ...item,
        documents: [],
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const executeReject = async (doc: any, reason: string) => {
    try {
      setDetailLoading(true);
      await rejectDocument(doc.uuid, reason);
      Alert.alert('Éxito', 'El documento ha sido rechazado.');

      // Actualizar estado local
      setSelectedUnit((prev: any) => {
        if (!prev) return prev;
        const updatedDocs = prev.documents.map((d: any) =>
          d.uuid === doc.uuid
            ? { ...d, status: 'rejected', rejectionReason: reason }
            : d,
        );
        return { ...prev, documents: updatedDocs };
      });

      // Actualizar AsyncStorage
      try {
        const cached = await AsyncStorage.getItem('mock_admin_documents');
        const docs = cached ? JSON.parse(cached) : [];
        const updated = docs.map((d: any) =>
          d.uuid === doc.uuid
            ? { ...d, status: 'rejected', rejectionReason: reason }
            : d,
        );
        await AsyncStorage.setItem(
          'mock_admin_documents',
          JSON.stringify(updated),
        );
      } catch (_) {}
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo rechazar el documento.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleManageDocument = (doc: any) => {
    if (doc.status !== 'pending_review') {
      Alert.alert(
        'Documento Gestionado',
        `Este documento ya se encuentra en estado: ${doc.status === 'verified' ? 'Aprobado' : 'Rechazado'}.`,
      );
      return;
    }

    Alert.alert(
      'Gestionar Documento',
      `¿Qué acción deseas tomar para el documento "${
        doc.type === 'titulo_propiedad'
          ? 'Título de Propiedad'
          : doc.type === 'seguro_responsabilidad_civil'
            ? 'Responsabilidad Civil (RCV)'
            : 'Revisión Técnica (INTT)'
      }"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Motivo de Rechazo',
              'Selecciona la razón para rechazar el documento:',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Documento no legible',
                  onPress: () =>
                    executeReject(
                      doc,
                      'El documento adjunto no es legible o es borroso.',
                    ),
                },
                {
                  text: 'Datos no coinciden',
                  onPress: () =>
                    executeReject(
                      doc,
                      'Los datos del documento no coinciden con el registro.',
                    ),
                },
                {
                  text: 'Documento vencido',
                  onPress: () =>
                    executeReject(
                      doc,
                      'El documento ha expirado o no está vigente.',
                    ),
                },
              ],
            );
          },
        },
        {
          text: 'Aprobar',
          onPress: async () => {
            try {
              setDetailLoading(true);
              await verifyDocument(doc.uuid);
              Alert.alert(
                'Éxito',
                'El documento ha sido verificado y aprobado.',
              );

              // Actualizar estado local
              setSelectedUnit((prev: any) => {
                if (!prev) return prev;
                const updatedDocs = prev.documents.map((d: any) =>
                  d.uuid === doc.uuid ? { ...d, status: 'verified' } : d,
                );
                return { ...prev, documents: updatedDocs };
              });

              // Actualizar AsyncStorage
              try {
                const cached = await AsyncStorage.getItem(
                  'mock_admin_documents',
                );
                const docs = cached ? JSON.parse(cached) : [];
                const updated = docs.map((d: any) =>
                  d.uuid === doc.uuid ? { ...d, status: 'verified' } : d,
                );
                await AsyncStorage.setItem(
                  'mock_admin_documents',
                  JSON.stringify(updated),
                );
              } catch (_) {}
            } catch (err: any) {
              Alert.alert('Error', 'No se pudo aprobar el documento.');
            } finally {
              setDetailLoading(false);
            }
          },
        },
      ],
    );
  };

  const executeApproveFromModal = async (
    vehicleUuid: string,
    plate: string,
  ) => {
    try {
      setDetailLoading(true);
      await approveVehicle(vehicleUuid);
      setIsDetailModalVisible(false);
      Alert.alert('Éxito', `Unidad ${plate} aprobada con éxito.`);
      await fetchUnits();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo aprobar la unidad.');
    } finally {
      setDetailLoading(false);
    }
  };

  const executeRejectFromModal = async (vehicleUuid: string, plate: string) => {
    try {
      setDetailLoading(true);
      await rejectVehicle(vehicleUuid);
      setIsDetailModalVisible(false);
      Alert.alert('Éxito', `Unidad ${plate} rechazada con éxito.`);
      await fetchUnits();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo rechazar la unidad.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApproveUnit = async (item: any) => {
    await handleShowDetails(item);
  };

  const handleRejectUnit = async (item: any) => {
    await handleShowDetails(item);
  };

  const handleDeactivateUnit = async (item: any) => {
    Alert.alert(
      'Desactivar Unidad',
      `¿Estás seguro de que deseas desactivar la unidad ${item.plate}? Cambiará su estado a Pendiente por aprobar.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await toggleTransportUnitStatus(item.uuid, false);
              Alert.alert(
                'Éxito',
                `Unidad ${item.plate} desactivada con éxito.`,
              );
              await fetchUnits();
            } catch (err: any) {
              Alert.alert(
                'Error',
                err.message || 'No se pudo desactivar la unidad.',
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Unidades Registradas"
        onMenu={() => setIsOpen(true)}
      />

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={20}
          color="#94A3B8"
          style={{ marginRight: 10 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por placa, marca, socio, código..."
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
        <Pressable
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => handleTabChange('all')}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'all' && styles.tabLabelActive,
            ]}
          >
            Todas
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => handleTabChange('active')}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'active' && styles.tabLabelActive,
            ]}
          >
            Activas
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'inactive' && styles.tabActive]}
          onPress={() => handleTabChange('inactive')}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'inactive' && styles.tabLabelActive,
            ]}
          >
            Pendientes
          </Text>
        </Pressable>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={tokens.colors.primary} />
        </View>
      ) : filteredUnits.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="bus-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>
            No se encontraron unidades de transporte.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredUnits}
          keyExtractor={(item) => item.uuid}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          renderItem={({ item }) => {
            const statusColor = item.isActive ? '#10B981' : '#F59E0B';
            const statusText = item.isActive
              ? 'Activa'
              : 'Pendiente por aprobar';

            return (
              <View style={styles.unitCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconCircle}>
                    <Ionicons
                      name="bus"
                      size={22}
                      color={tokens.colors.primary}
                    />
                  </View>
                  <View style={styles.meta}>
                    <Text style={styles.plateText}>{item.plate}</Text>
                    <Text style={styles.brandText}>
                      {item.brand} {item.model}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: `${statusColor}12` },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: statusColor },
                      ]}
                    />
                    <Text
                      style={[styles.statusBadgeText, { color: statusColor }]}
                    >
                      {statusText}
                    </Text>
                  </View>
                </View>

                {/* Socio Details */}
                <View style={styles.detailBox}>
                  <Text style={styles.detailBoxTitle}>SOCIO RESPONSABLE</Text>
                  <View style={styles.detailRow}>
                    <Ionicons
                      name="person-outline"
                      size={14}
                      color="#64748B"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.detailVal}>
                      {item.owner?.displayName || 'Dueño GoFare'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons
                      name="mail-outline"
                      size={14}
                      color="#64748B"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.detailVal}>
                      {item.owner?.email || 'Sin correo'}
                    </Text>
                  </View>
                </View>

                {/* Invite Code */}
                <View style={styles.codeContainer}>
                  <Text style={styles.codeLabel}>
                    CÓDIGO DE INVITACIÓN CONDUCTOR:
                  </Text>
                  <View style={styles.codeBadge}>
                    <Ionicons
                      name="key-outline"
                      size={14}
                      color="#D97706"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.codeValue}>{item.inviteCode}</Text>
                  </View>
                </View>

                {/* Acciones */}
                <View style={styles.cardActions}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => handleShowDetails(item)}
                  >
                    <Ionicons
                      name="eye-outline"
                      size={16}
                      color={tokens.colors.primary}
                    />
                    <Text style={styles.actionButtonText}>Detalles</Text>
                  </Pressable>

                  {!item.isActive && (
                    <>
                      <Pressable
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => handleApproveUnit(item)}
                      >
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={16}
                          color="#059669"
                        />
                        <Text
                          style={[styles.actionButtonText, styles.approveText]}
                        >
                          Aprobar
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleRejectUnit(item)}
                      >
                        <Ionicons
                          name="close-circle-outline"
                          size={16}
                          color="#DC2626"
                        />
                        <Text
                          style={[styles.actionButtonText, styles.rejectText]}
                        >
                          Rechazar
                        </Text>
                      </Pressable>
                    </>
                  )}

                  {item.isActive && (
                    <Pressable
                      style={[styles.actionButton, styles.deactivateButton]}
                      onPress={() => handleDeactivateUnit(item)}
                    >
                      <Ionicons name="ban-outline" size={16} color="#64748B" />
                      <Text
                        style={[styles.actionButtonText, styles.deactivateText]}
                      >
                        Desactivar
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Modal de Detalles de la Unidad */}
      <Modal
        visible={isDetailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalles de la Unidad</Text>
              <Pressable
                onPress={() => setIsDetailModalVisible(false)}
                style={styles.closeModalBtn}
              >
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            {detailLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={tokens.colors.primary} />
                <Text style={styles.modalLoadingText}>
                  Cargando ficha técnica...
                </Text>
              </View>
            ) : selectedUnit ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScroll}
              >
                {/* Info Principal */}
                <View style={styles.modalHero}>
                  <View style={styles.modalHeroIcon}>
                    <Ionicons name="bus" size={40} color="#FFFFFF" />
                  </View>
                  <Text style={styles.modalHeroPlate}>
                    {selectedUnit.plate || selectedUnit.licensePlate}
                  </Text>
                  <Text style={styles.modalHeroBrand}>
                    {selectedUnit.brand || selectedUnit.vehicleMake}{' '}
                    {selectedUnit.model || selectedUnit.vehicleModel}
                  </Text>

                  {/* Badge de Estado */}
                  <View
                    style={[
                      styles.modalStatusBadge,
                      {
                        backgroundColor: selectedUnit.isActive
                          ? '#ECFDF5'
                          : '#FEF3C7',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.modalStatusDot,
                        {
                          backgroundColor: selectedUnit.isActive
                            ? '#10B981'
                            : '#F59E0B',
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.modalStatusText,
                        {
                          color: selectedUnit.isActive ? '#059669' : '#D97706',
                        },
                      ]}
                    >
                      {selectedUnit.isActive
                        ? 'Activa'
                        : 'Pendiente por aprobar'}
                    </Text>
                  </View>
                </View>

                {/* Especificaciones */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>
                    ESPECIFICACIONES TÉCNICAS
                  </Text>

                  <View style={styles.modalGrid}>
                    <View style={styles.modalGridItem}>
                      <Text style={styles.gridLabel}>Año</Text>
                      <Text style={styles.gridVal}>
                        {selectedUnit.year || selectedUnit.vehicleYear || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.modalGridItem}>
                      <Text style={styles.gridLabel}>Color</Text>
                      <Text style={styles.gridVal}>
                        {selectedUnit.color || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.modalGridItem}>
                      <Text style={styles.gridLabel}>Capacidad</Text>
                      <Text style={styles.gridVal}>
                        {selectedUnit.capacity || 'N/A'} pas.
                      </Text>
                    </View>
                    <View style={styles.modalGridItem}>
                      <Text style={styles.gridLabel}>Línea</Text>
                      <Text style={styles.gridVal} numberOfLines={1}>
                        {selectedUnit.cooperativeName || 'Particular / Ninguna'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Socio Responsable */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>
                    SOCIO RESPONSABLE
                  </Text>
                  <View style={styles.infoRow}>
                    <Ionicons name="person" size={16} color="#64748B" />
                    <Text style={styles.infoText}>
                      {selectedUnit.owner?.displayName || 'Dueño GoFare'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="mail" size={16} color="#64748B" />
                    <Text style={styles.infoText}>
                      {selectedUnit.owner?.email || 'Sin correo'}
                    </Text>
                  </View>
                </View>

                {/* Conductor Asignado */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>
                    CONDUCTOR ASIGNADO
                  </Text>
                  {selectedUnit.assignedDriver ? (
                    <>
                      <View style={styles.infoRow}>
                        <Ionicons name="card" size={16} color="#64748B" />
                        <Text style={styles.infoText}>
                          {selectedUnit.assignedDriver.name}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Ionicons
                          name="document-text"
                          size={16}
                          color="#64748B"
                        />
                        <Text style={styles.infoText}>
                          Cédula: {selectedUnit.assignedDriver.nationalId}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Ionicons name="call" size={16} color="#64748B" />
                        <Text style={styles.infoText}>
                          Teléfono: {selectedUnit.assignedDriver.phone}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.noDriverText}>
                      Sin conductor asignado
                    </Text>
                  )}
                </View>

                {/* Documentos del Vehículo */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>
                    DOCUMENTOS ADJUNTOS
                  </Text>
                  <Text style={styles.helpText}>
                    Presiona un documento pendiente para aprobarlo o rechazarlo.
                  </Text>
                  {selectedUnit.documents &&
                  selectedUnit.documents.length > 0 ? (
                    selectedUnit.documents.map((doc: any) => (
                      <Pressable
                        key={doc.uuid}
                        style={({ pressed }) => [
                          styles.documentItemRow,
                          pressed && { opacity: 0.7 },
                        ]}
                        onPress={() => handleManageDocument(doc)}
                      >
                        <View style={styles.docInfo}>
                          <Ionicons
                            name={
                              doc.type === 'titulo_propiedad'
                                ? 'document-text-outline'
                                : doc.type === 'seguro_responsabilidad_civil'
                                  ? 'shield-checkmark-outline'
                                  : 'build-outline'
                            }
                            size={20}
                            color={tokens.colors.primary}
                          />
                          <View style={styles.docMeta}>
                            <Text style={styles.docTypeName}>
                              {doc.type === 'titulo_propiedad'
                                ? 'Título de Propiedad'
                                : doc.type === 'seguro_responsabilidad_civil'
                                  ? 'Responsabilidad Civil (RCV)'
                                  : 'Revisión Técnica (INTT)'}
                            </Text>
                            <Text style={styles.docNumberText}>
                              Nº: {doc.documentNumber || 'Sin número'}
                            </Text>
                          </View>
                        </View>

                        {/* Estado del Documento */}
                        <View
                          style={[
                            styles.docStatusBadge,
                            {
                              backgroundColor:
                                doc.status === 'verified'
                                  ? '#ECFDF5'
                                  : doc.status === 'rejected'
                                    ? '#FEF2F2'
                                    : '#FEF3C7',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.docStatusText,
                              {
                                color:
                                  doc.status === 'verified'
                                    ? '#059669'
                                    : doc.status === 'rejected'
                                      ? '#DC2626'
                                      : '#D97706',
                              },
                            ]}
                          >
                            {doc.status === 'verified'
                              ? 'Aprobado'
                              : doc.status === 'rejected'
                                ? 'Rechazado'
                                : 'Pendiente'}
                          </Text>
                        </View>
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.noDriverText}>
                      Sin documentos registrados
                    </Text>
                  )}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.modalError}>
                <Ionicons name="alert-circle" size={48} color="#EF4444" />
                <Text style={styles.modalErrorText}>
                  No se pudo cargar la información.
                </Text>
              </View>
            )}

            {selectedUnit && !selectedUnit.isActive && !detailLoading && (
              <View style={styles.modalActionRow}>
                <Pressable
                  style={[styles.modalActionBtn, styles.modalRejectBtn]}
                  onPress={() =>
                    executeRejectFromModal(
                      selectedUnit.uuid,
                      selectedUnit.plate || selectedUnit.licensePlate,
                    )
                  }
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={18}
                    color="#DC2626"
                  />
                  <Text
                    style={[styles.modalActionText, styles.modalRejectText]}
                  >
                    Rechazar
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.modalActionBtn, styles.modalApproveBtn]}
                  onPress={() =>
                    executeApproveFromModal(
                      selectedUnit.uuid,
                      selectedUnit.plate || selectedUnit.licensePlate,
                    )
                  }
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color="#059669"
                  />
                  <Text
                    style={[styles.modalActionText, styles.modalApproveText]}
                  >
                    Aprobar
                  </Text>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 10,
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
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  unitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  meta: {
    flex: 1,
  },
  plateText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#0F172A',
  },
  brandText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  detailBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  detailBoxTitle: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  detailVal: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#334155',
  },
  codeContainer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 12,
  },
  codeLabel: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  codeBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  codeValue: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#D97706',
    letterSpacing: 0.5,
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
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  actionButtonText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
    marginLeft: 6,
  },
  approveButton: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  approveText: {
    color: '#059669',
  },
  rejectButton: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  rejectText: {
    color: '#DC2626',
  },
  deactivateButton: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  deactivateText: {
    color: '#64748B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
  },
  closeModalBtn: {
    padding: 4,
  },
  modalLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  modalLoadingText: {
    marginTop: 14,
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  modalScroll: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  modalHero: {
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalHeroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalHeroPlate: {
    fontSize: 24,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
  },
  modalHeroBrand: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 12,
  },
  modalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  modalStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  modalStatusText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 12,
  },
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  modalGridItem: {
    width: '47%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  gridLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#94A3B8',
  },
  gridVal: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#334155',
    marginLeft: 10,
  },
  noDriverText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  modalError: {
    alignItems: 'center',
    padding: 40,
  },
  modalErrorText: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#EF4444',
  },
  documentItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  docInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  docMeta: {
    marginLeft: 12,
    flex: 1,
  },
  docTypeName: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
  },
  docNumberText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginTop: 2,
  },
  docStatusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  docStatusText: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  helpText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#94A3B8',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalApproveBtn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  modalRejectBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  modalActionText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    marginLeft: 6,
  },
  modalApproveText: {
    color: '#059669',
  },
  modalRejectText: {
    color: '#DC2626',
  },
});
