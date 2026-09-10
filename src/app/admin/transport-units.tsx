import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  approveVehicle,
  getAllDocuments,
  getAllTransportUnits,
  getVehicleDetail,
  rejectDocument,
  rejectVehicle,
  verifyDocument,
} from '@/lib/api';
import { tokens } from '@/theme/tokens';

export default function AdminTransportUnitsScreen() {
  const { setIsOpen } = useAdminSidebar();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [filteredUnits, setFilteredUnits] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<
    'all' | 'active' | 'inactive' | 'suspended' | 'rejected'
  >('all');
  const [selectedUnit, setSelectedUnit] = useState<any | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>(
    {},
  );

  const toggleExpand = (uuid: string) => {
    setExpandedUnits((prev) => ({
      ...prev,
      [uuid]: !prev[uuid],
    }));
  };

  const applyFilters = useCallback(
    (allUnits: any[], query: string, tab: typeof activeTab) => {
      let result = [...allUnits];

      // Filter by status tab
      if (tab === 'active') {
        result = result.filter(
          (u) =>
            (u.isActive === true || u.status === 'active') &&
            u.status !== 'suspended' &&
            u.status !== 'rejected',
        );
      } else if (tab === 'inactive') {
        result = result.filter(
          (u) =>
            (u.status === 'inactive' ||
              u.status === 'pending_review' ||
              u.status === 'pending' ||
              u.isActive === false) &&
            u.status !== 'suspended' &&
            u.status !== 'rejected',
        );
      } else if (tab === 'suspended') {
        result = result.filter(
          (u) => u.status === 'suspended' || u.status === 'suspendida',
        );
      } else if (tab === 'rejected') {
        result = result.filter(
          (u) =>
            (u.status === 'rejected' || u.status === 'rechazada') &&
            u.status !== 'suspended' &&
            u.status !== 'suspendida',
        );
      }

      // Filter by search query
      if (query.trim().length > 0) {
        const q = query.toLowerCase();
        result = result.filter((u) => {
          const plate = (u.plate || '').toLowerCase();
          const brand = (u.brand || '').toLowerCase();
          const model = (u.model || '').toLowerCase();
          const invite = (u.inviteCode || '').toLowerCase();
          const route = (u.routeNumber || '').toLowerCase();
          const ownerName = (
            u.owner?.displayName ||
            `${u.owner?.firstName || ''} ${u.owner?.lastName || ''}`
          )
            .trim()
            .toLowerCase();
          return (
            plate.includes(q) ||
            brand.includes(q) ||
            model.includes(q) ||
            invite.includes(q) ||
            route.includes(q) ||
            ownerName.includes(q)
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
        const [res, allDocs] = await Promise.all([
          getAllTransportUnits().catch(() => []),
          getAllDocuments().catch(() => []),
        ]);
        const safeDocs = Array.isArray(allDocs) ? allDocs : [];
        const unitsWithDocs = (Array.isArray(res) ? res : []).map((u: any) => {
          const vehicleDocs = safeDocs.filter(
            (doc: any) =>
              doc.vehicle?.uuid === u.uuid ||
              doc.vehicleUuid === u.uuid ||
              doc.vehicleId === u.uuid ||
              (doc.vehicle && doc.vehicle.plate === u.plate),
          );
          return {
            ...u,
            documents: vehicleDocs,
          };
        });
        setUnits(unitsWithDocs);
        applyFilters(unitsWithDocs, search, activeTab);
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

  useFocusEffect(
    useCallback(() => {
      fetchUnits();
    }, [fetchUnits]),
  );

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

      const detail = await getVehicleDetail(item.uuid).catch(() => null);

      setSelectedUnit({
        ...item,
        ...(detail || {}),
        documents: item.documents || [],
      });
    } catch (err) {
      console.warn('[AdminUnits] Error loading details:', err);
      setSelectedUnit({
        ...item,
        documents: item.documents || [],
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const executeRejectDocument = async (doc: any, reason: string) => {
    try {
      setDetailLoading(true);
      await rejectDocument(doc.uuid, reason);
      Alert.alert('Éxito', 'El documento ha sido rechazado.');

      // Actualizar estado local
      setSelectedUnit((prev: any) => {
        if (!prev) return prev;
        const updatedDocs = (prev.documents || []).map((d: any) =>
          d.uuid === doc.uuid
            ? { ...d, status: 'rejected', rejectionReason: reason }
            : d,
        );
        return { ...prev, documents: updatedDocs };
      });
      fetchUnits();
    } catch {
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
          ? 'Carnet de Circulación'
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
                    executeRejectDocument(
                      doc,
                      'El documento adjunto no es legible o es borroso.',
                    ),
                },
                {
                  text: 'Datos no coinciden',
                  onPress: () =>
                    executeRejectDocument(
                      doc,
                      'Los datos del documento no coinciden con el registro.',
                    ),
                },
                {
                  text: 'Documento vencido',
                  onPress: () =>
                    executeRejectDocument(
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

              // Actualizar estado local en memoria
              setSelectedUnit((prev: any) => {
                if (!prev) return prev;
                const updatedDocs = (prev.documents || []).map((d: any) =>
                  d.uuid === doc.uuid ? { ...d, status: 'verified' } : d,
                );
                return { ...prev, documents: updatedDocs };
              });
              fetchUnits();
            } catch {
              Alert.alert('Error', 'No se pudo aprobar el documento.');
            } finally {
              setDetailLoading(false);
            }
          },
        },
      ],
    );
  };

  const executeApproveVehicle = async (targetUnit: any) => {
    if (!targetUnit) return;
    try {
      setLoading(true);
      setDetailLoading(true);

      // 1. Aprobar el vehículo en el backend
      await approveVehicle(targetUnit.uuid);

      // 2. Obtener documentos vinculados (desde el estado o API)
      let docsToApprove = targetUnit.documents || [];
      if (!docsToApprove.length) {
        const allDocs = await getAllDocuments().catch(() => []);
        docsToApprove = (Array.isArray(allDocs) ? allDocs : []).filter(
          (doc: any) =>
            doc.vehicle?.uuid === targetUnit.uuid ||
            doc.vehicleUuid === targetUnit.uuid ||
            doc.vehicleId === targetUnit.uuid ||
            (doc.vehicle &&
              doc.vehicle.plate ===
                (targetUnit.plate || targetUnit.licensePlate)),
        );
      }

      // 3. Aprobar todos los documentos pendientes asociados al vehículo
      const pendingDocs = docsToApprove.filter(
        (d: any) => d.status === 'pending_review' || d.status === 'pending',
      );

      if (pendingDocs.length > 0) {
        await Promise.all(
          pendingDocs.map((doc: any) =>
            verifyDocument(doc.uuid).catch((e) =>
              console.warn(`[AdminUnits] Error approving doc ${doc.uuid}:`, e),
            ),
          ),
        );
      }

      const isReactivation =
        targetUnit.status === 'suspended' || targetUnit.status === 'suspendida';
      setIsDetailModalVisible(false);
      Alert.alert(
        isReactivation ? 'Unidad Reactivada' : 'Unidad Aprobada',
        isReactivation
          ? `La unidad ${targetUnit.plate || targetUnit.licensePlate} ha sido activada con éxito.`
          : `La unidad ${targetUnit.plate || targetUnit.licensePlate} y sus documentos adjuntos han sido aprobados con éxito.`,
      );
      await fetchUnits();
    } catch (err: any) {
      console.warn('[AdminUnits] Error approving vehicle:', err);
      Alert.alert('Error', err.message || 'No se pudo aprobar la unidad.');
    } finally {
      setLoading(false);
      setDetailLoading(false);
    }
  };

  const executeRejectVehicle = async (targetUnit: any, reason: string) => {
    if (!targetUnit) return;
    try {
      setLoading(true);
      setDetailLoading(true);

      // 1. Rechazar el vehículo en el backend
      await rejectVehicle(targetUnit.uuid);

      // 2. Obtener documentos vinculados
      let docsToReject = targetUnit.documents || [];
      if (!docsToReject.length) {
        const allDocs = await getAllDocuments().catch(() => []);
        docsToReject = (Array.isArray(allDocs) ? allDocs : []).filter(
          (doc: any) =>
            doc.vehicle?.uuid === targetUnit.uuid ||
            doc.vehicleUuid === targetUnit.uuid ||
            doc.vehicleId === targetUnit.uuid ||
            (doc.vehicle &&
              doc.vehicle.plate ===
                (targetUnit.plate || targetUnit.licensePlate)),
        );
      }

      // 3. Rechazar todos los documentos asociados al vehículo
      const activeOrPendingDocs = docsToReject.filter(
        (d: any) => d.status !== 'rejected',
      );

      if (activeOrPendingDocs.length > 0) {
        await Promise.all(
          activeOrPendingDocs.map((doc: any) =>
            rejectDocument(doc.uuid, reason).catch((e) =>
              console.warn(`[AdminUnits] Error rejecting doc ${doc.uuid}:`, e),
            ),
          ),
        );
      }

      const isSuspension =
        targetUnit.isActive === true || targetUnit.status === 'active';
      setIsDetailModalVisible(false);
      Alert.alert(
        isSuspension ? 'Unidad Suspendida' : 'Unidad Rechazada',
        isSuspension
          ? `La unidad ${targetUnit.plate || targetUnit.licensePlate} ha sido suspendida.`
          : `La unidad ${targetUnit.plate || targetUnit.licensePlate} y sus documentos adjuntos han sido rechazados.`,
      );
      await fetchUnits();
    } catch (err: any) {
      console.warn('[AdminUnits] Error rejecting vehicle:', err);
      Alert.alert('Error', err.message || 'No se pudo rechazar la unidad.');
    } finally {
      setLoading(false);
      setDetailLoading(false);
    }
  };

  const handleApproveUnit = (item: any) => {
    const plate = item.plate || item.licensePlate;
    Alert.alert(
      'Aprobar Unidad',
      `¿Deseas aprobar la unidad ${plate}?\n\nAl aprobar la unidad, también se verificarán y aprobarán automáticamente todos sus documentos adjuntos (Carnet de Circulación, RCV, etc.).`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar Unidad y Recaudos',
          onPress: () => executeApproveVehicle(item),
        },
      ],
    );
  };

  const handleReactivateUnit = (item: any) => {
    const plate = item.plate || item.licensePlate;
    Alert.alert(
      'Activar Unidad',
      `¿Deseas volver a activar la unidad ${plate}?\n\nLa unidad volverá al estado "Activa" y estará habilitada para operar en la plataforma.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Activar Unidad',
          onPress: () => executeApproveVehicle(item),
        },
      ],
    );
  };

  const handleRejectUnit = (item: any) => {
    const plate = item.plate || item.licensePlate;
    Alert.alert(
      'Rechazar Unidad',
      `¿Deseas rechazar la unidad ${plate}?\n\nAl rechazarla, se rechazarán también sus documentos adjuntos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar con Rechazo',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Motivo de Rechazo',
              'Selecciona la razón para rechazar la unidad y sus recaudos:',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Documentos no legibles / incompletos',
                  onPress: () =>
                    executeRejectVehicle(
                      item,
                      'Documentos adjuntos no legibles o incompletos.',
                    ),
                },
                {
                  text: 'Datos no coinciden',
                  onPress: () =>
                    executeRejectVehicle(
                      item,
                      'Los datos registrados no coinciden con los recaudos.',
                    ),
                },
                {
                  text: 'Documentación vencida',
                  onPress: () =>
                    executeRejectVehicle(
                      item,
                      'Los documentos del vehículo no se encuentran vigentes.',
                    ),
                },
              ],
            );
          },
        },
      ],
    );
  };

  const handleSuspendUnit = (item: any) => {
    const plate = item.plate || item.licensePlate;
    Alert.alert(
      'Suspender Unidad',
      `¿Estás seguro de que deseas suspender la unidad ${plate}?\n\nLa unidad pasará al estado "Suspendida" y quedará inhabilitada para operar en la plataforma.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Suspender Unidad',
          style: 'destructive',
          onPress: () =>
            executeRejectVehicle(
              item,
              'Unidad suspendida por el administrador.',
            ),
        },
      ],
    );
  };

  if (loading && !refreshing) {
    return <AppLoadingScreen message="Cargando unidades de transporte..." />;
  }

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
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
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

          <Pressable
            style={[styles.tab, activeTab === 'suspended' && styles.tabActive]}
            onPress={() => handleTabChange('suspended')}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'suspended' && styles.tabLabelActiveSuspended,
              ]}
            >
              Suspendidas
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tab, activeTab === 'rejected' && styles.tabActive]}
            onPress={() => handleTabChange('rejected')}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'rejected' && styles.tabLabelActiveRejected,
              ]}
            >
              Rechazadas
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* List */}
      <FlatList
        data={filteredUnits}
        keyExtractor={(item) => item.uuid}
        contentContainerStyle={[
          styles.listContent,
          filteredUnits.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[tokens.colors.primary]}
            tintColor={tokens.colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="bus-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>
              No se encontraron unidades de transporte.
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: '#94A3B8',
                fontFamily: tokens.typography.fontFamily.medium,
                marginTop: 6,
                textAlign: 'center',
              }}
            >
              Desliza hacia abajo para actualizar
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSuspended =
            item.status === 'suspended' || item.status === 'suspendida';
          const isRejected =
            (item.status === 'rejected' || item.status === 'rechazada') &&
            !isSuspended;
          const isActive =
            (item.isActive === true || item.status === 'active') &&
            !isRejected &&
            !isSuspended;

          const statusColor = isSuspended
            ? '#EA580C'
            : isRejected
              ? '#EF4444'
              : isActive
                ? '#10B981'
                : '#F59E0B';
          const statusText = isSuspended
            ? 'Suspendida'
            : isRejected
              ? 'Rechazada'
              : isActive
                ? 'Activa'
                : 'Pendiente';

          return (
            <View style={styles.unitCard}>
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.iconCircle,
                    isSuspended && { backgroundColor: '#FFEDD5' },
                    isRejected && { backgroundColor: '#FEE2E2' },
                  ]}
                >
                  <Ionicons
                    name="bus"
                    size={22}
                    color={
                      isSuspended
                        ? '#EA580C'
                        : isRejected
                          ? '#DC2626'
                          : tokens.colors.primary
                    }
                  />
                </View>
                <View style={styles.meta}>
                  <Text style={styles.plateText} numberOfLines={1}>
                    {item.brand} {item.model}
                  </Text>
                  <Text style={styles.brandText}>{item.plate}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: isSuspended
                        ? '#FFEDD5'
                        : isRejected
                          ? '#FEE2E2'
                          : `${statusColor}14`,
                    },
                  ]}
                >
                  <View
                    style={[styles.statusDot, { backgroundColor: statusColor }]}
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
                    {item.owner?.displayName ||
                      (item.owner?.firstName
                        ? `${item.owner.firstName} ${item.owner.lastName || ''}`.trim()
                        : 'No asignado')}
                  </Text>
                </View>
                {item.owner?.email ? (
                  <View style={styles.detailRow}>
                    <Ionicons
                      name="mail-outline"
                      size={14}
                      color="#64748B"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.detailVal}>{item.owner.email}</Text>
                  </View>
                ) : null}
              </View>

              {/* Desplegable de Datos Técnicos del Vehículo */}
              <Pressable
                style={styles.collapseToggle}
                onPress={() => toggleExpand(item.uuid)}
              >
                <View style={styles.collapseToggleLeft}>
                  <Ionicons
                    name="car-sport-outline"
                    size={15}
                    color={tokens.colors.primary}
                  />
                  <Text style={styles.collapseToggleText}>
                    {expandedUnits[item.uuid]
                      ? 'Ocultar datos del vehículo'
                      : 'Ver datos del vehículo'}
                  </Text>
                </View>
                <Ionicons
                  name={
                    expandedUnits[item.uuid] ? 'chevron-up' : 'chevron-down'
                  }
                  size={16}
                  color="#64748B"
                />
              </Pressable>

              {expandedUnits[item.uuid] && (
                <View style={styles.expandedSpecsContainer}>
                  <View style={styles.specGrid}>
                    <View style={styles.specItem}>
                      <Text style={styles.specLabel}>AÑO</Text>
                      <Text style={styles.specVal}>{item.year || 'N/A'}</Text>
                    </View>
                    <View style={styles.specItem}>
                      <Text style={styles.specLabel}>COLOR</Text>
                      <Text style={styles.specVal}>{item.color || 'N/A'}</Text>
                    </View>
                    <View style={styles.specItem}>
                      <Text style={styles.specLabel}>CAPACIDAD</Text>
                      <Text style={styles.specVal}>
                        {item.capacity ? `${item.capacity} pas.` : 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.specItem}>
                      <Text style={styles.specLabel}>LÍNEA / ASOC.</Text>
                      <Text style={styles.specVal} numberOfLines={1}>
                        {item.civilAssociation?.name || 'Particular / Ninguna'}
                      </Text>
                    </View>
                    {item.routeNumber ? (
                      <View style={styles.specItem}>
                        <Text style={styles.specLabel}>N° RUTA</Text>
                        <Text style={styles.specVal}>{item.routeNumber}</Text>
                      </View>
                    ) : null}
                  </View>

                  {item.inviteCode ? (
                    <View style={styles.codeContainerInside}>
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
                  ) : null}

                  {/* Documentos del Vehículo */}
                  <View style={styles.cardDocsSection}>
                    <Text style={styles.cardDocsTitle}>
                      DOCUMENTOS DEL VEHÍCULO
                    </Text>
                    {item.documents && item.documents.length > 0 ? (
                      item.documents.map((doc: any) => {
                        const isPending =
                          doc.status === 'pending_review' ||
                          doc.status === 'pending';
                        const isVerified = doc.status === 'verified';
                        const badgeColor = isVerified
                          ? '#059669'
                          : isPending
                            ? '#D97706'
                            : '#DC2626';
                        const badgeBg = isVerified
                          ? '#ECFDF5'
                          : isPending
                            ? '#FEF3C7'
                            : '#FEF2F2';
                        const statusLabel = isVerified
                          ? 'Aprobado'
                          : isPending
                            ? 'Pendiente'
                            : 'Rechazado';

                        return (
                          <Pressable
                            key={doc.uuid}
                            style={({ pressed }) => [
                              styles.cardDocItem,
                              pressed && { opacity: 0.7 },
                            ]}
                            onPress={() => handleManageDocument(doc)}
                          >
                            <View style={styles.cardDocLeft}>
                              <Ionicons
                                name={
                                  doc.type === 'titulo_propiedad' ||
                                  doc.type === 'carnet_circulacion'
                                    ? 'document-text-outline'
                                    : doc.type ===
                                        'seguro_responsabilidad_civil'
                                      ? 'shield-checkmark-outline'
                                      : 'newspaper-outline'
                                }
                                size={18}
                                color={tokens.colors.primary}
                              />
                              <View style={styles.cardDocMeta}>
                                <Text style={styles.cardDocName}>
                                  {doc.type === 'titulo_propiedad' ||
                                  doc.type === 'carnet_circulacion'
                                    ? 'Carnet de Circulación'
                                    : doc.type ===
                                        'seguro_responsabilidad_civil'
                                      ? 'Responsabilidad Civil (RCV)'
                                      : 'Revisión Técnica (INTT)'}
                                </Text>
                                <Text style={styles.cardDocNumber}>
                                  Nº: {doc.documentNumber || 'Sin número'}
                                </Text>
                              </View>
                            </View>
                            <View
                              style={[
                                styles.cardDocBadge,
                                { backgroundColor: badgeBg },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.cardDocBadgeText,
                                  { color: badgeColor },
                                ]}
                              >
                                {statusLabel}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })
                    ) : (
                      <Text style={styles.noDocsText}>
                        Sin documentos adjuntos
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {isSuspended && (
                <View style={styles.cardSuspensionBanner}>
                  <Ionicons
                    name="alert-circle"
                    size={14}
                    color="#EA580C"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.cardSuspensionBannerText}>
                    {item.suspensionReason
                      ? `Unidad suspendida: ${item.suspensionReason}`
                      : 'Unidad suspendida por el administrador'}
                  </Text>
                </View>
              )}

              {isRejected && (
                <View style={styles.cardRejectionBanner}>
                  <Ionicons
                    name="alert-circle"
                    size={14}
                    color="#DC2626"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.cardRejectionBannerText}>
                    {item.rejectionReason
                      ? `Unidad rechazada: ${item.rejectionReason}`
                      : 'Unidad rechazada por el administrador'}
                  </Text>
                </View>
              )}

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

                {!isActive && !isRejected && !isSuspended && (
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

                {isSuspended && (
                  <Pressable
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => handleReactivateUnit(item)}
                  >
                    <Ionicons
                      name="refresh-circle-outline"
                      size={16}
                      color="#059669"
                    />
                    <Text style={[styles.actionButtonText, styles.approveText]}>
                      Activar
                    </Text>
                  </Pressable>
                )}

                {isRejected && (
                  <Pressable
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => handleApproveUnit(item)}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={16}
                      color="#059669"
                    />
                    <Text style={[styles.actionButtonText, styles.approveText]}>
                      Aprobar
                    </Text>
                  </Pressable>
                )}

                {isActive && (
                  <Pressable
                    style={[styles.actionButton, styles.suspendButton]}
                    onPress={() => handleSuspendUnit(item)}
                  >
                    <Ionicons
                      name="pause-circle-outline"
                      size={16}
                      color="#EA580C"
                    />
                    <Text style={[styles.actionButtonText, styles.suspendText]}>
                      Suspender
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
      />

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
                    {selectedUnit.brand || selectedUnit.vehicleMake}{' '}
                    {selectedUnit.model || selectedUnit.vehicleModel}
                  </Text>
                  <Text style={styles.modalHeroBrand}>
                    {selectedUnit.plate || selectedUnit.licensePlate}
                  </Text>

                  {/* Badge de Estado */}
                  <View
                    style={[
                      styles.modalStatusBadge,
                      {
                        backgroundColor:
                          selectedUnit.status === 'suspended' ||
                          selectedUnit.status === 'suspendida'
                            ? '#FFEDD5'
                            : selectedUnit.status === 'rejected' ||
                                selectedUnit.status === 'rechazada'
                              ? '#FEE2E2'
                              : selectedUnit.isActive
                                ? '#D1FAE5'
                                : '#FEF3C7',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.modalStatusDot,
                        {
                          backgroundColor:
                            selectedUnit.status === 'suspended' ||
                            selectedUnit.status === 'suspendida'
                              ? '#EA580C'
                              : selectedUnit.status === 'rejected' ||
                                  selectedUnit.status === 'rechazada'
                                ? '#EF4444'
                                : selectedUnit.isActive
                                  ? '#10B981'
                                  : '#F59E0B',
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.modalStatusText,
                        {
                          color:
                            selectedUnit.status === 'suspended' ||
                            selectedUnit.status === 'suspendida'
                              ? '#EA580C'
                              : selectedUnit.status === 'rejected' ||
                                  selectedUnit.status === 'rechazada'
                                ? '#DC2626'
                                : selectedUnit.isActive
                                  ? '#059669'
                                  : '#D97706',
                        },
                      ]}
                    >
                      {selectedUnit.status === 'suspended' ||
                      selectedUnit.status === 'suspendida'
                        ? 'Suspendida'
                        : selectedUnit.status === 'rejected' ||
                            selectedUnit.status === 'rechazada'
                          ? 'Rechazada'
                          : selectedUnit.isActive
                            ? 'Activa'
                            : 'Pendiente'}
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
                    {selectedUnit.routeNumber ? (
                      <View style={styles.modalGridItem}>
                        <Text style={styles.gridLabel}>N° de Ruta</Text>
                        <Text style={styles.gridVal} numberOfLines={1}>
                          {selectedUnit.routeNumber}
                        </Text>
                      </View>
                    ) : null}
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
                                ? 'Carnet de Circulación'
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

            {selectedUnit &&
              !selectedUnit.isActive &&
              selectedUnit.status !== 'active' &&
              !detailLoading && (
                <View style={styles.modalActionRow}>
                  {selectedUnit.status !== 'suspended' &&
                    selectedUnit.status !== 'suspendida' &&
                    selectedUnit.status !== 'rejected' &&
                    selectedUnit.status !== 'rechazada' && (
                      <Pressable
                        style={[styles.modalActionBtn, styles.modalRejectBtn]}
                        onPress={() => handleRejectUnit(selectedUnit)}
                      >
                        <Ionicons
                          name="close-circle-outline"
                          size={18}
                          color="#DC2626"
                        />
                        <Text
                          style={[
                            styles.modalActionText,
                            styles.modalRejectText,
                          ]}
                        >
                          Rechazar
                        </Text>
                      </Pressable>
                    )}

                  <Pressable
                    style={[styles.modalActionBtn, styles.modalApproveBtn]}
                    onPress={() =>
                      selectedUnit.status === 'suspended' ||
                      selectedUnit.status === 'suspendida'
                        ? handleReactivateUnit(selectedUnit)
                        : handleApproveUnit(selectedUnit)
                    }
                  >
                    <Ionicons
                      name={
                        selectedUnit.status === 'suspended' ||
                        selectedUnit.status === 'suspendida'
                          ? 'refresh-circle-outline'
                          : 'checkmark-circle-outline'
                      }
                      size={18}
                      color="#059669"
                    />
                    <Text
                      style={[styles.modalActionText, styles.modalApproveText]}
                    >
                      {selectedUnit.status === 'suspended' ||
                      selectedUnit.status === 'suspendida'
                        ? 'Activar Unidad'
                        : 'Aprobar'}
                    </Text>
                  </Pressable>
                </View>
              )}

            {selectedUnit &&
              (selectedUnit.isActive || selectedUnit.status === 'active') &&
              !detailLoading && (
                <View style={styles.modalActionRow}>
                  <Pressable
                    style={[styles.modalActionBtn, styles.modalSuspendBtn]}
                    onPress={() => handleSuspendUnit(selectedUnit)}
                  >
                    <Ionicons
                      name="pause-circle-outline"
                      size={18}
                      color="#EA580C"
                    />
                    <Text
                      style={[styles.modalActionText, styles.modalSuspendText]}
                    >
                      Suspender Unidad
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
  tabsWrapper: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 14,
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
  tabLabelActiveSuspended: {
    color: '#EA580C',
  },
  tabLabelActiveRejected: {
    color: '#DC2626',
  },
  cardSuspensionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  cardSuspensionBannerText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#C2410C',
  },
  cardRejectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  cardRejectionBannerText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#991B1B',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
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
  collapseToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  collapseToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collapseToggleText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
    marginLeft: 8,
  },
  expandedSpecsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specItem: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  specLabel: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  specVal: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
    marginTop: 2,
  },
  codeContainerInside: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  cardDocsSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  cardDocsTitle: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  cardDocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  cardDocLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  cardDocMeta: {
    marginLeft: 8,
    flex: 1,
  },
  cardDocName: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
  },
  cardDocNumber: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginTop: 1,
  },
  cardDocBadge: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  cardDocBadgeText: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  noDocsText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 4,
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
  suspendButton: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FFEDD5',
  },
  suspendText: {
    color: '#EA580C',
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
  modalSuspendBtn: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FFEDD5',
  },
  modalSuspendText: {
    color: '#EA580C',
  },
});
