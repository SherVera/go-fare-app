import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminSidebar } from '@/components/AdminSidebarContext';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { getAllDocuments, rejectDocument, verifyDocument } from '@/lib/api';
import { tokens } from '@/theme/tokens';

const isVehicleDocType = (type: string) => {
  const vehicleTypes = [
    'titulo_propiedad',
    'carnet_circulacion',
    'property_title',
    'seguro_responsabilidad_civil',
    'revision_tecnica_intt',
    'concesion_ruta',
    'patente_municipal',
    'seguro_soat',
  ];
  return vehicleTypes.includes(type);
};

const getDocTypeLabel = (type: string) => {
  switch (type) {
    case 'titulo_propiedad':
    case 'carnet_circulacion':
    case 'property_title':
      return 'Carnet de Circulación';
    case 'seguro_responsabilidad_civil':
      return 'Responsabilidad Civil (RCV)';
    case 'revision_tecnica_intt':
      return 'Revisión Técnica (INTT)';
    case 'concesion_ruta':
      return 'Concesión de Ruta';
    case 'patente_municipal':
      return 'Patente Municipal';
    case 'seguro_soat':
      return 'Póliza SOAT';
    case 'driver_license':
    case 'licencia_conducir':
      return 'Licencia de Conducir';
    case 'medical_certificate':
    case 'certificado_medico':
      return 'Certificado Médico';
    case 'cedula_identidad':
    case 'id_card':
      return 'Cédula de Identidad';
    case 'antecedentes_penales':
      return 'Antecedentes Penales';
    case 'seguro_vida':
      return 'Seguro de Vida';
    default:
      return 'Documento Legal';
  }
};

const getDocTypeIcon = (type: string) => {
  switch (type) {
    case 'titulo_propiedad':
    case 'carnet_circulacion':
    case 'property_title':
      return 'document-text-outline';
    case 'seguro_responsabilidad_civil':
      return 'shield-checkmark-outline';
    case 'revision_tecnica_intt':
      return 'build-outline';
    case 'concesion_ruta':
      return 'map-outline';
    case 'patente_municipal':
      return 'business-outline';
    case 'driver_license':
    case 'licencia_conducir':
      return 'card-outline';
    case 'medical_certificate':
    case 'certificado_medico':
      return 'medkit-outline';
    case 'cedula_identidad':
    case 'id_card':
      return 'id-card-outline';
    case 'antecedentes_penales':
      return 'shield-outline';
    default:
      return 'document-text-outline';
  }
};

interface VehicleGroup {
  key: string;
  vehicle: any;
  owner: any;
  documents: any[];
}

interface UserGroup {
  key: string;
  owner: any;
  documents: any[];
}

export default function AdminDocumentsScreen() {
  const { setIsOpen } = useAdminSidebar();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);

  // Categoría: 'vehicles' (Unidades) o 'users' (Usuarios/Conductores)
  const [category, setCategory] = useState<'vehicles' | 'users'>('vehicles');

  // Estado del filtro: 'pending' | 'verified' | 'rejected'
  const [activeTab, setActiveTab] = useState<
    'pending' | 'verified' | 'rejected'
  >('pending');

  // Estado para el modal de rechazo
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const fetchDocuments = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const allDocs = await getAllDocuments();
      setDocuments(allDocs);
    } catch (err) {
      console.warn('[AdminDocs] Error loading documents:', err);
      Alert.alert(
        'Error',
        'No se pudieron sincronizar los documentos legales.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDocuments(true);
  }, [fetchDocuments]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useFocusEffect(
    useCallback(() => {
      fetchDocuments();
    }, [fetchDocuments]),
  );

  // Filtrar documentos según el estado seleccionado
  const filteredByStatus = useMemo(() => {
    const statusMap = {
      pending: 'pending_review',
      verified: 'verified',
      rejected: 'rejected',
    };
    const targetStatus = statusMap[activeTab];
    return documents.filter((d) => d.status === targetStatus);
  }, [documents, activeTab]);

  // Agrupación por Vehículo (Unidades)
  const vehicleGroups = useMemo<VehicleGroup[]>(() => {
    const map = new Map<string, VehicleGroup>();

    filteredByStatus
      .filter((d) => Boolean(d.vehicle || isVehicleDocType(d.type)))
      .forEach((d) => {
        const vKey =
          d.vehicle?.uuid ||
          d.vehicle?.plate ||
          d.vehicleId ||
          `veh-owner-${d.owner?.uuid || 'unassigned'}`;
        if (!map.has(vKey)) {
          map.set(vKey, {
            key: vKey,
            vehicle: d.vehicle || {
              plate: d.vehicle?.plate || 'Sin Placa',
              brand: d.vehicle?.brand || 'Vehículo',
              model: d.vehicle?.model || '',
              year: d.vehicle?.year,
              color: d.vehicle?.color,
            },
            owner: d.owner || {
              displayName: 'Socio GoFare',
              email: 'Sin correo',
            },
            documents: [],
          });
        }
        map.get(vKey)?.documents.push(d);
      });

    return Array.from(map.values());
  }, [filteredByStatus]);

  // Agrupación por Usuario (Conductores / Personas)
  const userGroups = useMemo<UserGroup[]>(() => {
    const map = new Map<string, UserGroup>();

    filteredByStatus
      .filter((d) => !d.vehicle && !isVehicleDocType(d.type))
      .forEach((d) => {
        const uKey = d.owner?.uuid || d.owner?.id || 'sin_usuario';
        if (!map.has(uKey)) {
          map.set(uKey, {
            key: uKey,
            owner: d.owner || {
              displayName: 'Usuario GoFare',
              email: 'Sin correo',
              phoneNumber: 'Sin teléfono',
            },
            documents: [],
          });
        }
        map.get(uKey)?.documents.push(d);
      });

    return Array.from(map.values());
  }, [filteredByStatus]);

  // Conteo total para badges en el selector de categoría
  const countVehicleDocs = useMemo(() => {
    const statusMap = {
      pending: 'pending_review',
      verified: 'verified',
      rejected: 'rejected',
    };
    const targetStatus = statusMap[activeTab];
    return documents.filter(
      (d) =>
        (Boolean(d.vehicle) || isVehicleDocType(d.type)) &&
        d.status === targetStatus,
    ).length;
  }, [documents, activeTab]);

  const countUserDocs = useMemo(() => {
    const statusMap = {
      pending: 'pending_review',
      verified: 'verified',
      rejected: 'rejected',
    };
    const targetStatus = statusMap[activeTab];
    return documents.filter(
      (d) =>
        !d.vehicle && !isVehicleDocType(d.type) && d.status === targetStatus,
    ).length;
  }, [documents, activeTab]);

  const handleApprove = (doc: any) => {
    Alert.alert(
      'Aprobar Documento',
      `¿Deseas verificar y aprobar este documento (${getDocTypeLabel(doc.type)})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar',
          onPress: async () => {
            setLoading(true);
            try {
              await verifyDocument(doc.uuid);
              Alert.alert(
                'Éxito',
                'El documento ha sido verificado y aprobado.',
              );
              await fetchDocuments(true);
            } catch (err: any) {
              console.warn('[AdminDocs] Error verifying doc:', err);
              Alert.alert(
                'Error',
                err.message || 'No se pudo aprobar el documento.',
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleRejectInit = (doc: any) => {
    setSelectedDoc(doc);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const handleRejectConfirm = async (reasonOverride?: string) => {
    const finalReason = (reasonOverride || rejectReason).trim();
    if (!selectedDoc) return;
    if (finalReason.length < 3) {
      Alert.alert(
        'Advertencia',
        'Por favor selecciona o ingresa un motivo de rechazo.',
      );
      return;
    }

    setRejectModalVisible(false);
    setLoading(true);
    try {
      await rejectDocument(selectedDoc.uuid, finalReason);
      Alert.alert('Rechazado', 'El documento ha sido rechazado.');
      await fetchDocuments(true);
    } catch (err: any) {
      console.warn('[AdminDocs] Error rejecting doc:', err);
      Alert.alert('Error', err.message || 'No se pudo rechazar el documento.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !refreshing) {
    return <AppLoadingScreen message="Cargando recaudos y documentos..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Validar Documentos" onMenu={() => setIsOpen(true)} />

      {/* ── 1. SELECTOR DE CATEGORÍA: VEHÍCULOS VS USUARIOS ── */}
      <View style={styles.categorySelectorWrapper}>
        <Pressable
          style={[
            styles.categoryBtn,
            category === 'vehicles' && styles.categoryBtnActive,
          ]}
          onPress={() => setCategory('vehicles')}
        >
          <Ionicons
            name="bus-outline"
            size={18}
            color={category === 'vehicles' ? tokens.colors.primary : '#64748B'}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.categoryBtnText,
              category === 'vehicles' && styles.categoryBtnTextActive,
            ]}
          >
            Documentos de Vehículo
          </Text>
          {countVehicleDocs > 0 && (
            <View
              style={[
                styles.categoryCountBadge,
                category === 'vehicles' && styles.categoryCountBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryCountText,
                  category === 'vehicles' && styles.categoryCountTextActive,
                ]}
              >
                {countVehicleDocs}
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={[
            styles.categoryBtn,
            category === 'users' && styles.categoryBtnActive,
          ]}
          onPress={() => setCategory('users')}
        >
          <Ionicons
            name="person-outline"
            size={18}
            color={category === 'users' ? tokens.colors.primary : '#64748B'}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.categoryBtnText,
              category === 'users' && styles.categoryBtnTextActive,
            ]}
          >
            Documentos de Usuario
          </Text>
          {countUserDocs > 0 && (
            <View
              style={[
                styles.categoryCountBadge,
                category === 'users' && styles.categoryCountBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryCountText,
                  category === 'users' && styles.categoryCountTextActive,
                ]}
              >
                {countUserDocs}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* ── 2. TABS DE ESTADO (PENDIENTES, APROBADOS, RECHAZADOS) ── */}
      <View style={styles.tabsContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'pending' && styles.tabLabelActive,
            ]}
          >
            Pendientes
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'verified' && styles.tabActive]}
          onPress={() => setActiveTab('verified')}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'verified' && styles.tabLabelActive,
            ]}
          >
            Aprobados
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'rejected' && styles.tabActive]}
          onPress={() => setActiveTab('rejected')}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'rejected' && styles.tabLabelActive,
            ]}
          >
            Rechazados
          </Text>
        </Pressable>
      </View>

      {/* ── 3. LISTADO AGRUPADO ── */}
      {category === 'vehicles' ? (
        <FlatList
          data={vehicleGroups}
          keyExtractor={(item) => item.key}
          contentContainerStyle={[
            styles.listContent,
            vehicleGroups.length === 0 && styles.listContentEmpty,
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
                No hay documentos de vehículos en esta sección.
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
            return (
              <View style={styles.groupCard}>
                {/* Encabezado de la Unidad */}
                <View style={styles.groupHeader}>
                  <View style={styles.groupHeaderIcon}>
                    <Ionicons name="bus" size={20} color="#FFFFFF" />
                  </View>
                  <View style={styles.groupHeaderMeta}>
                    <Text style={styles.groupHeaderTitle}>
                      {item.vehicle?.brand || item.vehicle?.model
                        ? `${item.vehicle.brand || ''} ${item.vehicle.model || ''}`.trim()
                        : 'Unidad de Transporte'}
                    </Text>
                    <Text style={styles.groupHeaderSubtitle}>
                      {item.vehicle?.plate || 'Sin Placa'}
                    </Text>
                  </View>
                  <View style={styles.docCountPill}>
                    <Text style={styles.docCountPillText}>
                      {item.documents.length}{' '}
                      {item.documents.length === 1 ? 'documento' : 'documentos'}
                    </Text>
                  </View>
                </View>

                {/* Socio Responsable */}
                <View style={styles.ownerRowInside}>
                  <Ionicons
                    name="person-circle-outline"
                    size={16}
                    color="#64748B"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.ownerRowText} numberOfLines={1}>
                    Propietario:{' '}
                    <Text
                      style={{
                        fontFamily: tokens.typography.fontFamily.bold,
                        color: '#1E293B',
                      }}
                    >
                      {item.owner?.displayName || 'Socio GoFare'}
                    </Text>{' '}
                    ({item.owner?.email || 'Sin correo'})
                  </Text>
                </View>

                <View style={styles.divider} />

                {/* Lista de Documentos de este Vehículo */}
                <View style={styles.docsListBlock}>
                  <Text style={styles.docsSectionMiniTitle}>
                    DOCUMENTOS DE LA UNIDAD
                  </Text>
                  {item.documents.map((doc) => {
                    const isVerified = doc.status === 'verified';
                    const isRejected = doc.status === 'rejected';
                    const isPending =
                      doc.status === 'pending_review' ||
                      doc.status === 'pending';

                    const dateStr = doc.createdAt
                      ? new Date(doc.createdAt).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '';

                    return (
                      <View key={doc.uuid} style={styles.docItemInsideCard}>
                        <View style={styles.docItemMain}>
                          <View style={styles.docItemIconCircle}>
                            <Ionicons
                              name={getDocTypeIcon(doc.type)}
                              size={20}
                              color={tokens.colors.primary}
                            />
                          </View>
                          <View style={styles.docItemMeta}>
                            <Text style={styles.docItemName}>
                              {getDocTypeLabel(doc.type)}
                            </Text>
                            <Text style={styles.docItemNumber}>
                              Nro: {doc.documentNumber || 'Sin número'}
                            </Text>
                            {dateStr ? (
                              <Text style={styles.docItemDate}>
                                Registrado: {dateStr}
                              </Text>
                            ) : null}
                          </View>

                          {/* Badge de Estado */}
                          <View
                            style={[
                              styles.statusBadgeMini,
                              isVerified && styles.badgeVerified,
                              isRejected && styles.badgeRejected,
                              isPending && styles.badgePending,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeMiniText,
                                isVerified && { color: '#059669' },
                                isRejected && { color: '#DC2626' },
                                isPending && { color: '#D97706' },
                              ]}
                            >
                              {isVerified
                                ? 'Aprobado'
                                : isRejected
                                  ? 'Rechazado'
                                  : 'Pendiente'}
                            </Text>
                          </View>
                        </View>

                        {/* Motivo de Rechazo si aplica */}
                        {isRejected && doc.rejectionReason && (
                          <View style={styles.rejectionReasonCard}>
                            <Text style={styles.rejectionReasonTitle}>
                              MOTIVO DE RECHAZO:
                            </Text>
                            <Text style={styles.rejectionReasonText}>
                              {doc.rejectionReason}
                            </Text>
                          </View>
                        )}

                        {/* Botones de Acción */}
                        {isPending && (
                          <View style={styles.itemActionRow}>
                            <Pressable
                              style={styles.itemRejectBtn}
                              onPress={() => handleRejectInit(doc)}
                            >
                              <Ionicons
                                name="close-circle-outline"
                                size={16}
                                color="#EF4444"
                              />
                              <Text style={styles.itemRejectBtnText}>
                                Rechazar
                              </Text>
                            </Pressable>

                            <Pressable
                              style={styles.itemApproveBtn}
                              onPress={() => handleApprove(doc)}
                            >
                              <Ionicons
                                name="checkmark-circle-outline"
                                size={16}
                                color="#FFFFFF"
                              />
                              <Text style={styles.itemApproveBtnText}>
                                Aprobar
                              </Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          }}
        />
      ) : (
        /* ── CATEGORÍA: DOCUMENTOS DE USUARIO ── */
        <FlatList
          data={userGroups}
          keyExtractor={(item) => item.key}
          contentContainerStyle={[
            styles.listContent,
            userGroups.length === 0 && styles.listContentEmpty,
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
              <Ionicons name="person-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                No hay documentos de usuarios en esta sección.
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
            return (
              <View style={styles.groupCard}>
                {/* Encabezado del Usuario */}
                <View style={styles.groupHeader}>
                  <View
                    style={[
                      styles.groupHeaderIcon,
                      { backgroundColor: '#3B82F6' },
                    ]}
                  >
                    <Ionicons name="person" size={20} color="#FFFFFF" />
                  </View>
                  <View style={styles.groupHeaderMeta}>
                    <Text style={styles.groupHeaderTitle}>
                      {item.owner?.displayName || 'Usuario GoFare'}
                    </Text>
                    <Text style={styles.groupHeaderSubtitle}>
                      {item.owner?.email ||
                        item.owner?.phoneNumber ||
                        'Conductor / Socio'}
                    </Text>
                  </View>
                  <View style={styles.docCountPill}>
                    <Text style={styles.docCountPillText}>
                      {item.documents.length}{' '}
                      {item.documents.length === 1 ? 'documento' : 'documentos'}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Lista de Documentos del Usuario */}
                <View style={styles.docsListBlock}>
                  <Text style={styles.docsSectionMiniTitle}>
                    DOCUMENTOS PERSONALES
                  </Text>
                  {item.documents.map((doc) => {
                    const isVerified = doc.status === 'verified';
                    const isRejected = doc.status === 'rejected';
                    const isPending =
                      doc.status === 'pending_review' ||
                      doc.status === 'pending';

                    const dateStr = doc.createdAt
                      ? new Date(doc.createdAt).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '';

                    return (
                      <View key={doc.uuid} style={styles.docItemInsideCard}>
                        <View style={styles.docItemMain}>
                          <View style={styles.docItemIconCircle}>
                            <Ionicons
                              name={getDocTypeIcon(doc.type)}
                              size={20}
                              color={tokens.colors.primary}
                            />
                          </View>
                          <View style={styles.docItemMeta}>
                            <Text style={styles.docItemName}>
                              {getDocTypeLabel(doc.type)}
                            </Text>
                            <Text style={styles.docItemNumber}>
                              Nro: {doc.documentNumber || 'Sin número'}
                            </Text>
                            {dateStr ? (
                              <Text style={styles.docItemDate}>
                                Registrado: {dateStr}
                              </Text>
                            ) : null}
                          </View>

                          {/* Badge de Estado */}
                          <View
                            style={[
                              styles.statusBadgeMini,
                              isVerified && styles.badgeVerified,
                              isRejected && styles.badgeRejected,
                              isPending && styles.badgePending,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeMiniText,
                                isVerified && { color: '#059669' },
                                isRejected && { color: '#DC2626' },
                                isPending && { color: '#D97706' },
                              ]}
                            >
                              {isVerified
                                ? 'Aprobado'
                                : isRejected
                                  ? 'Rechazado'
                                  : 'Pendiente'}
                            </Text>
                          </View>
                        </View>

                        {/* Motivo de Rechazo si aplica */}
                        {isRejected && doc.rejectionReason && (
                          <View style={styles.rejectionReasonCard}>
                            <Text style={styles.rejectionReasonTitle}>
                              MOTIVO DE RECHAZO:
                            </Text>
                            <Text style={styles.rejectionReasonText}>
                              {doc.rejectionReason}
                            </Text>
                          </View>
                        )}

                        {/* Botones de Acción */}
                        {isPending && (
                          <View style={styles.itemActionRow}>
                            <Pressable
                              style={styles.itemRejectBtn}
                              onPress={() => handleRejectInit(doc)}
                            >
                              <Ionicons
                                name="close-circle-outline"
                                size={16}
                                color="#EF4444"
                              />
                              <Text style={styles.itemRejectBtnText}>
                                Rechazar
                              </Text>
                            </Pressable>

                            <Pressable
                              style={styles.itemApproveBtn}
                              onPress={() => handleApprove(doc)}
                            >
                              <Ionicons
                                name="checkmark-circle-outline"
                                size={16}
                                color="#FFFFFF"
                              />
                              <Text style={styles.itemApproveBtnText}>
                                Aprobar
                              </Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ── 4. MODAL DE RECHAZO CON MOTIVOS RÁPIDOS ── */}
      <Modal
        visible={rejectModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rechazar Documento</Text>
              <Pressable onPress={() => setRejectModalVisible(false)}>
                <Ionicons
                  name="close-circle-outline"
                  size={24}
                  color="#64748B"
                />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Selecciona o escribe el motivo por el cual rechazas este
              documento:
            </Text>

            {/* Motivos Rápidos */}
            <View style={styles.quickReasonsRow}>
              <Pressable
                style={styles.quickReasonChip}
                onPress={() =>
                  handleRejectConfirm('Documento no legible o foto borrosa.')
                }
              >
                <Text style={styles.quickReasonText}>Foto Borrosa</Text>
              </Pressable>
              <Pressable
                style={styles.quickReasonChip}
                onPress={() =>
                  handleRejectConfirm('Los datos no coinciden con el registro.')
                }
              >
                <Text style={styles.quickReasonText}>Datos No Coinciden</Text>
              </Pressable>
              <Pressable
                style={styles.quickReasonChip}
                onPress={() =>
                  handleRejectConfirm(
                    'El documento ha expirado o no está vigente.',
                  )
                }
              >
                <Text style={styles.quickReasonText}>Documento Vencido</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Escribe otro motivo detallado si es necesario..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              value={rejectReason}
              onChangeText={setRejectReason}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>

              <Pressable
                style={styles.modalRejectConfirmBtn}
                onPress={() => handleRejectConfirm()}
              >
                <Text style={styles.modalRejectConfirmText}>
                  Confirmar Rechazo
                </Text>
              </Pressable>
            </View>
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
  categorySelectorWrapper: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 10,
    backgroundColor: '#EEF2F6',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  categoryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  categoryBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryBtnText: {
    fontSize: 11.5,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
  },
  categoryBtnTextActive: {
    color: tokens.colors.primary,
  },
  categoryCountBadge: {
    backgroundColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    marginLeft: 6,
  },
  categoryCountBadgeActive: {
    backgroundColor: '#DBEAFE',
  },
  categoryCountText: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#475569',
  },
  categoryCountTextActive: {
    color: tokens.colors.primary,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
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
    paddingBottom: 110,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupHeaderMeta: {
    flex: 1,
  },
  groupHeaderTitle: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#0F172A',
  },
  groupHeaderSubtitle: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginTop: 1,
  },
  docCountPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  docCountPillText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#475569',
  },
  ownerRowInside: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 12,
  },
  ownerRowText: {
    fontSize: 11.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  docsListBlock: {},
  docsSectionMiniTitle: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  docItemInsideCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
  },
  docItemMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  docItemIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  docItemMeta: {
    flex: 1,
  },
  docItemName: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E293B',
  },
  docItemNumber: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginTop: 1,
  },
  docItemDate: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#94A3B8',
    marginTop: 2,
  },
  statusBadgeMini: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgeVerified: {
    backgroundColor: '#ECFDF5',
  },
  badgeRejected: {
    backgroundColor: '#FEF2F2',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeMiniText: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  rejectionReasonCard: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  rejectionReasonTitle: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#991B1B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rejectionReasonText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#B91C1C',
    lineHeight: 15,
  },
  itemActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  itemRejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  itemRejectBtnText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#EF4444',
    marginLeft: 4,
  },
  itemApproveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 8,
    backgroundColor: tokens.colors.primary,
  },
  itemApproveBtnText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
    marginLeft: 4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#94A3B8',
    textAlign: 'center',
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
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 18,
  },
  quickReasonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  quickReasonChip: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickReasonText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#DC2626',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#0F172A',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalCancelText: {
    fontFamily: tokens.typography.fontFamily.bold,
    fontSize: 13,
    color: '#475569',
  },
  modalRejectConfirmBtn: {
    flex: 1.3,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
  },
  modalRejectConfirmText: {
    fontFamily: tokens.typography.fontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});
