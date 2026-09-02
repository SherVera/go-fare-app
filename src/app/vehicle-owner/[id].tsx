import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
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
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import {
  deleteVehicle,
  getAllDocuments,
  getBackendInviteCodes,
  getVehicleDetail,
  submitLegalDocument,
} from '@/lib/api';
import { setClipboardText } from '@/lib/clipboard';
import { tokens } from '@/theme/tokens';

interface MockDriver {
  id: string;
  name: string;
  nationalId: string;
  phone: string;
  status: 'active' | 'inactive';
}

interface MockVehicle {
  uuid: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  licensePlate: string;
  color?: string;
  capacity?: number;
  cooperativeName?: string;
  inviteCode?: string;
  documents?: any[];
  status: 'approved' | 'pending' | 'rejected';
  createdAt: string;
  adminNotes?: string;
  assignedDriver?: MockDriver;
  totalEarnings?: number;
  tripsCount?: number;
}

export default function VehicleDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [vehicle, setVehicle] = useState<MockVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDriverModalVisible, setIsDriverModalVisible] = useState(false);
  const [drivers, setDrivers] = useState<MockDriver[]>([]);

  // Estados para reenvío de documento rechazado
  const [reuploadModalVisible, setReuploadModalVisible] = useState(false);
  const [docToReupload, setDocToReupload] = useState<any | null>(null);
  const [newDocNumber, setNewDocNumber] = useState('');
  const [reuploadLoading, setReuploadLoading] = useState(false);

  // Cargar conductores reales del backend (de invitaciones canjeadas)
  const loadAssociatedDrivers = useCallback(async () => {
    try {
      const invites = await getBackendInviteCodes().catch(() => []);
      const realDrivers = invites
        .filter((inv: any) => inv.driver)
        .map((inv: any) => ({
          id: inv.driver.id,
          name:
            inv.driver.displayName ||
            `${inv.driver.firstName} ${inv.driver.lastName}`.trim() ||
            'Conductor sin nombre',
          nationalId: inv.driver.nationalId || 'Sin cédula',
          phone: inv.driver.phoneNumber || 'Sin teléfono',
          status: 'active' as const,
        }));
      setDrivers(realDrivers);
    } catch (err) {
      console.warn('[Details] Error loading associated drivers:', err);
    }
  }, []);

  // Cargar datos del vehículo y documentos desde el backend
  const loadVehicle = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        if (!id) return;
        const [found, allDocs] = await Promise.all([
          getVehicleDetail(id),
          getAllDocuments().catch(() => []),
        ]);
        if (found) {
          const vehicleDocs = (Array.isArray(allDocs) ? allDocs : []).filter(
            (d: any) =>
              d.vehicle?.uuid === found.uuid ||
              d.vehicleUuid === found.uuid ||
              d.vehicleId === found.uuid ||
              (d.vehicle && d.vehicle.plate === found.licensePlate),
          );
          setVehicle({
            ...found,
            documents:
              vehicleDocs.length > 0 ? vehicleDocs : found.documents || [],
          });
        }
      } catch (err) {
        console.warn('[Details] Error loading vehicle details:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadVehicle(true), loadAssociatedDrivers()]);
  }, [loadVehicle, loadAssociatedDrivers]);

  useEffect(() => {
    loadVehicle();
    loadAssociatedDrivers();
  }, [loadVehicle, loadAssociatedDrivers]);

  useFocusEffect(
    useCallback(() => {
      loadVehicle();
      loadAssociatedDrivers();
    }, [loadVehicle, loadAssociatedDrivers]),
  );

  const handleStartReupload = (doc: any) => {
    setDocToReupload(doc);
    setNewDocNumber(doc.documentNumber || '');
    setReuploadModalVisible(true);
  };

  const handleConfirmReupload = async () => {
    if (!docToReupload || !vehicle) return;
    if (!newDocNumber.trim()) {
      Alert.alert(
        'Campo Requerido',
        'Por favor ingresa el número actualizado del documento o póliza.',
      );
      return;
    }

    try {
      setReuploadLoading(true);
      await submitLegalDocument({
        type: docToReupload.type,
        vehicleUuid: vehicle.uuid,
        documentNumber: newDocNumber.trim(),
        fileUrl: `https://storage.gofare.com/docs/${docToReupload.type}_${Date.now()}.pdf`,
      });

      setReuploadModalVisible(false);
      Alert.alert(
        'Recaudo Reenviado',
        'El documento ha sido cargado nuevamente y enviado a revisión de la administración.',
      );
      await loadVehicle();
    } catch (err: any) {
      console.warn('[Details] Error re-uploading document:', err);
      Alert.alert('Error', err.message || 'No se pudo reenviar el documento.');
    } finally {
      setReuploadLoading(false);
    }
  };

  // Actualizar o desvincular conductor asignado
  const handleAssignDriver = async (driver: MockDriver | undefined) => {
    if (!vehicle) return;

    try {
      const updatedVehicle = { ...vehicle, assignedDriver: driver };
      setVehicle(updatedVehicle);
      setIsDriverModalVisible(false);

      Alert.alert(
        driver ? 'Conductor Actualizado' : 'Conductor Desvinculado',
        driver
          ? `Se ha asignado a ${driver.name} como conductor de esta unidad.`
          : 'Se ha quitado y desvinculado al conductor de esta unidad exitosamente.',
      );
    } catch (err) {
      console.error('[Details] Error updating driver:', err);
      Alert.alert(
        'Error',
        'No se pudo actualizar el conductor. Intente de nuevo.',
      );
    }
  };

  // Confirmar quitar conductor
  const handleConfirmRemoveDriver = () => {
    if (!vehicle?.assignedDriver) return;

    if (!isApproved) {
      Alert.alert(
        'Operación no permitida',
        'No puedes modificar el conductor asignado hasta que la unidad esté aprobada.',
      );
      return;
    }

    Alert.alert(
      'Quitar Conductor',
      `¿Estás seguro de que deseas quitar a ${vehicle.assignedDriver.name} como conductor de esta unidad?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar Conductor',
          style: 'destructive',
          onPress: () => handleAssignDriver(undefined),
        },
      ],
    );
  };

  // Eliminar vehículo (dar de baja)
  const handleDeleteVehicle = () => {
    if (!vehicle) return;

    Alert.alert(
      'Dar de Baja Unidad',
      '¿Estás seguro de que deseas dar de baja este vehículo? Esta acción eliminará permanentemente la unidad y desvinculará a su conductor.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar Baja',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteVehicle(vehicle.uuid);
              Alert.alert(
                'Baja Exitosa',
                'El vehículo ha sido removido de la flota.',
                [
                  {
                    text: 'Aceptar',
                    onPress: () => router.replace('/vehicle-owner/dashboard'),
                  },
                ],
              );
            } catch (err) {
              console.error('[Details] Error deleting vehicle:', err);
              Alert.alert('Error', 'No se pudo dar de baja la unidad.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  if (loading && !refreshing) {
    return <AppLoadingScreen message="Cargando detalles de la unidad..." />;
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#18243E" />
          </Pressable>
          <Text style={styles.headerTitle}>Unidad No Encontrada</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={[styles.center, { padding: 32 }]}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color="#EF4444"
            style={{ marginBottom: 12 }}
          />
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorSubtitle}>
            La unidad solicitada no existe o fue dada de baja previamente.
          </Text>
          <Pressable
            style={styles.errorBtn}
            onPress={() => router.replace('/vehicle-owner/dashboard')}
          >
            <Text style={styles.errorBtnText}>Volver al Panel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isApproved = vehicle.status === 'approved';
  const isPending = vehicle.status === 'pending';
  const isRejected = vehicle.status === 'rejected';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={15}
        >
          <Ionicons name="arrow-back" size={24} color="#18243E" />
        </Pressable>
        <Text style={styles.headerTitle}>Detalle de Unidad</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[tokens.colors.primary]}
          />
        }
      >
        {/* ── TARJETA PRINCIPAL VEHÍCULO ── */}
        <View style={styles.vehicleMainCard}>
          <View style={styles.vehicleBrandRow}>
            <View style={styles.vehicleIconContainer}>
              <Ionicons name="bus" size={32} color="#FFFFFF" />
            </View>
            <View style={styles.vehicleTitleBlock}>
              <Text style={styles.vehicleModelText}>
                {vehicle.vehicleMake} {vehicle.vehicleModel}
              </Text>
              <Text style={styles.vehicleCoopText}>
                {vehicle.cooperativeName}
              </Text>
            </View>
          </View>

          <View style={styles.horizontalDivider} />

          <View style={styles.specGrid}>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>MATRÍCULA / PLACA</Text>
              <Text style={styles.specValue}>{vehicle.licensePlate}</Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>AÑO DE FABRICACIÓN</Text>
              <Text style={styles.specValue}>{vehicle.vehicleYear}</Text>
            </View>
          </View>

          <View style={styles.specGrid}>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>COLOR</Text>
              <Text style={styles.specValue}>
                {vehicle.color || 'No especificado'}
              </Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>CAPACIDAD</Text>
              <Text style={styles.specValue}>
                {vehicle.capacity
                  ? `${vehicle.capacity} pasajeros`
                  : 'No especificada'}
              </Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>ESTADO DE REVISIÓN:</Text>
            <View
              style={[
                styles.statusBadge,
                isApproved && styles.badgeApproved,
                isPending && styles.badgePending,
                isRejected && styles.badgeRejected,
              ]}
            >
              <Ionicons
                name={
                  isApproved
                    ? 'checkmark-circle'
                    : isPending
                      ? 'time'
                      : 'close-circle'
                }
                size={16}
                color={
                  isApproved ? '#16A34A' : isPending ? '#D97706' : '#DC2626'
                }
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.statusText,
                  isApproved && { color: '#16A34A' },
                  isPending && { color: '#D97706' },
                  isRejected && { color: '#DC2626' },
                ]}
              >
                {isApproved
                  ? 'Aprobada para operar'
                  : isPending
                    ? 'Revisión Pendiente'
                    : 'Rechazada'}
              </Text>
            </View>
          </View>

          {/* Código de Invitación si está disponible */}
          {vehicle.inviteCode && (
            <View style={styles.inviteCodeCardBlock}>
              <View style={styles.inviteCodeHeader}>
                <Ionicons name="key-outline" size={16} color="#D97706" />
                <Text style={styles.inviteCodeLabel}>
                  CÓDIGO DE INVITACIÓN CONDUCTOR
                </Text>
              </View>
              <View style={styles.inviteCodeRow}>
                <Text style={styles.inviteCodeValue}>{vehicle.inviteCode}</Text>
                <Pressable
                  style={styles.inviteCodeCopyBtn}
                  onPress={() =>
                    setClipboardText(
                      vehicle.inviteCode || '',
                      'Código de Invitación',
                    )
                  }
                  hitSlop={8}
                >
                  <Ionicons
                    name="copy-outline"
                    size={16}
                    color={tokens.colors.primary}
                  />
                  <Text style={styles.inviteCodeCopyText}>Copiar</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* ── ALERTA DE DOCUMENTOS RECHAZADOS ── */}
        {(isRejected ||
          (vehicle.documents || []).some(
            (d: any) => d.status === 'rejected',
          )) && (
          <View style={styles.rejectedBanner}>
            <View style={styles.rejectedHeader}>
              <Ionicons
                name="alert-circle"
                size={22}
                color="#DC2626"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.rejectedTitle}>
                Atención: Documentos Rechazados
              </Text>
            </View>
            <Text style={styles.rejectedNotes}>
              {vehicle.adminNotes ||
                'Uno o más recaudos adjuntos de esta unidad fueron rechazados por el administrador. Revisa los motivos a continuación y vuelve a cargar los documentos corregidos para activar tu unidad.'}
            </Text>
          </View>
        )}

        {/* ── DOCUMENTOS REGISTRADOS ── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons
              name="document-text-outline"
              size={22}
              color={tokens.colors.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.sectionCardTitle}>Documentos del Vehículo</Text>
          </View>

          {vehicle.documents && vehicle.documents.length > 0 ? (
            vehicle.documents.map((doc: any, idx: number) => {
              const isDocPending =
                doc.status === 'pending_review' || doc.status === 'pending';
              const isDocVerified = doc.status === 'verified';
              const isDocRejected = doc.status === 'rejected';
              const docBadgeBg = isDocVerified
                ? '#ECFDF5'
                : isDocPending
                  ? '#FEF3C7'
                  : '#FEF2F2';
              const docBadgeColor = isDocVerified
                ? '#059669'
                : isDocPending
                  ? '#D97706'
                  : '#DC2626';
              const docStatusText = isDocVerified
                ? 'Aprobado'
                : isDocPending
                  ? 'En Revisión'
                  : 'Rechazado';

              return (
                <View key={doc.uuid || `doc-${idx}`} style={styles.docItemCard}>
                  <View style={styles.docItemMainRow}>
                    <View style={styles.docItemLeft}>
                      <View style={styles.docIconCircle}>
                        <Ionicons
                          name={
                            doc.type === 'titulo_propiedad' ||
                            doc.type === 'carnet_circulacion'
                              ? 'document-text'
                              : doc.type === 'seguro_responsabilidad_civil'
                                ? 'shield-checkmark'
                                : 'newspaper'
                          }
                          size={18}
                          color={tokens.colors.primary}
                        />
                      </View>
                      <View style={styles.docItemMeta}>
                        <Text style={styles.docItemTitle}>
                          {doc.type === 'titulo_propiedad' ||
                          doc.type === 'carnet_circulacion'
                            ? 'Carnet de Circulación'
                            : doc.type === 'seguro_responsabilidad_civil'
                              ? 'Responsabilidad Civil (RCV)'
                              : 'Revisión Técnica (INTT)'}
                        </Text>
                        <Text style={styles.docItemSub}>
                          Nº: {doc.documentNumber || 'Sin número'}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[styles.docBadge, { backgroundColor: docBadgeBg }]}
                    >
                      <Text
                        style={[styles.docBadgeText, { color: docBadgeColor }]}
                      >
                        {docStatusText}
                      </Text>
                    </View>
                  </View>

                  {/* Motivo de Rechazo */}
                  {isDocRejected && (
                    <View style={styles.docRejectionReasonBox}>
                      <Text style={styles.docRejectionReasonLabel}>
                        MOTIVO DEL RECHAZO:
                      </Text>
                      <Text style={styles.docRejectionReasonText}>
                        {doc.rejectionReason ||
                          'El documento no cumple con los requerimientos necesarios o no es legible.'}
                      </Text>
                    </View>
                  )}

                  {/* Botón para volver a cargar el recaudo */}
                  {isDocRejected && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.reuploadDocBtn,
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => handleStartReupload(doc)}
                    >
                      <Ionicons
                        name="cloud-upload-outline"
                        size={16}
                        color="#DC2626"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.reuploadDocBtnText}>
                        Volver a Cargar Documento
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.noDocsBlock}>
              <Ionicons
                name="information-circle-outline"
                size={22}
                color="#8594AB"
                style={{ marginBottom: 4 }}
              />
              <Text style={styles.noDocsText}>
                Documentos registrados en proceso de verificación por la
                administración.
              </Text>
            </View>
          )}
        </View>

        {/* ── MOTIVO DE RECHAZO (SI APLICA) ── */}
        {isRejected && vehicle.adminNotes && (
          <View style={styles.rejectedBanner}>
            <View style={styles.rejectedHeader}>
              <Ionicons
                name="alert-circle"
                size={20}
                color="#DC2626"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.rejectedTitle}>
                Motivo del Rechazo Administrativo
              </Text>
            </View>
            <Text style={styles.rejectedNotes}>{vehicle.adminNotes}</Text>
            <View style={styles.rejectedAlertBox}>
              <Text style={styles.rejectedAlertText}>
                Para corregir esto, debes dar de baja esta unidad y volver a
                registrarla adjuntando documentos legibles y nítidos.
              </Text>
            </View>
          </View>
        )}

        {/* ── GESTIÓN DE CONDUCTOR (SI ESTÁ APROBADO O PENDIENTE) ── */}
        {!isRejected && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons
                name="person-circle-outline"
                size={22}
                color={tokens.colors.primary}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.sectionCardTitle}>Conductor Asignado</Text>
            </View>

            {vehicle.assignedDriver ? (
              <View style={styles.driverInfoBlock}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {vehicle.assignedDriver.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </Text>
                </View>
                <View style={styles.driverDetails}>
                  <Text style={styles.driverNameText}>
                    {vehicle.assignedDriver.name}
                  </Text>
                  <Text style={styles.driverMetaText}>
                    Cédula: {vehicle.assignedDriver.nationalId}
                  </Text>
                  <Text style={styles.driverMetaText}>
                    Teléfono: {vehicle.assignedDriver.phone}
                  </Text>
                </View>
                <View style={styles.driverActionsRow}>
                  <Pressable
                    style={styles.driverActionBtn}
                    onPress={() => {
                      if (isApproved) {
                        setIsDriverModalVisible(true);
                      } else {
                        Alert.alert(
                          'Operación no permitida',
                          'No puedes modificar el conductor asignado hasta que la unidad esté aprobada.',
                        );
                      }
                    }}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="create-outline"
                      size={18}
                      color={tokens.colors.primary}
                    />
                  </Pressable>
                  <Pressable
                    style={styles.driverRemoveBtn}
                    onPress={handleConfirmRemoveDriver}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.noDriverBlock}>
                <Text style={styles.noDriverText}>
                  No hay un conductor asignado a este vehículo.
                </Text>
                {isApproved ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.assignBtn,
                      pressed && { opacity: 0.88 },
                    ]}
                    onPress={() => setIsDriverModalVisible(true)}
                  >
                    <Ionicons
                      name="person-add-outline"
                      size={16}
                      color="#FFFFFF"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.assignBtnText}>Asignar Conductor</Text>
                  </Pressable>
                ) : (
                  <View style={styles.pendingDriverWarning}>
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color="#D97706"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.pendingDriverWarningText}>
                      Debes esperar a que la unidad sea aprobada para poder
                      asignarle un conductor.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── INGRESOS Y ESTADÍSTICAS (SI ESTÁ APROBADO) ── */}
        {isApproved && (
          <>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons
                  name="analytics"
                  size={22}
                  color={tokens.colors.primary}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.sectionCardTitle}>
                  Rendimiento Financiero
                </Text>
              </View>

              <View style={styles.financialStatsRow}>
                <View style={styles.finStatBox}>
                  <Text style={styles.finStatLabel}>INGRESOS TOTALES</Text>
                  <Text style={styles.finStatValue}>
                    {(vehicle.totalEarnings ?? 0).toFixed(2)} Bs
                  </Text>
                </View>
                <View style={styles.verticalDivider} />
                <View style={styles.finStatBox}>
                  <Text style={styles.finStatLabel}>VIAJES REALIZADOS</Text>
                  <Text style={styles.finStatValue}>
                    {vehicle.tripsCount ?? 0} viajes
                  </Text>
                </View>
              </View>
            </View>

            {/* ── HISTORIAL DE VIAJES RECIENTES ── */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons
                  name="time-outline"
                  size={22}
                  color={tokens.colors.primary}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.sectionCardTitle}>Historial Reciente</Text>
              </View>

              <View style={styles.emptyTripsWrapper}>
                <Ionicons
                  name="document-text-outline"
                  size={32}
                  color="#94A3B8"
                  style={{ marginBottom: 6 }}
                />
                <Text style={styles.emptyTripsText}>
                  No hay viajes registrados para este vehículo
                </Text>
              </View>
            </View>
          </>
        )}

        {/* ── ACCIONES DE UNIDAD ── */}
        <Pressable
          style={({ pressed }) => [
            styles.deleteBtn,
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleDeleteVehicle}
        >
          <Ionicons
            name="trash-outline"
            size={18}
            color="#DC2626"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.deleteBtnText}>
            Dar de Baja Unidad (Retirar de Flota)
          </Text>
        </Pressable>

        {/* Padding final */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── MODAL SELECCIONAR CONDUCTOR ── */}
      <Modal
        visible={isDriverModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDriverModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Asignar Conductor</Text>
              <Pressable
                onPress={() => setIsDriverModalVisible(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={24} color="#8594AB" />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={true}
            >
              {drivers.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Ionicons
                    name="people-outline"
                    size={36}
                    color="#8594AB"
                    style={{ marginBottom: 8 }}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      color: '#64748B',
                      fontFamily: tokens.typography.fontFamily.medium,
                      textAlign: 'center',
                    }}
                  >
                    No tienes conductores asociados.
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: '#8594AB',
                      fontFamily: tokens.typography.fontFamily.regular,
                      textAlign: 'center',
                      marginTop: 2,
                    }}
                  >
                    Invita a un conductor desde la sección de Conductores.
                  </Text>
                </View>
              ) : (
                drivers.map((driver) => {
                  const isSelected = vehicle.assignedDriver?.id === driver.id;

                  return (
                    <Pressable
                      key={driver.id}
                      style={[
                        styles.driverSelectItem,
                        isSelected && styles.driverSelectItemActive,
                      ]}
                      onPress={() => handleAssignDriver(driver)}
                    >
                      <View style={styles.driverSelectInfo}>
                        <Text
                          style={[
                            styles.driverSelectName,
                            isSelected && { color: tokens.colors.primary },
                          ]}
                        >
                          {driver.name}
                        </Text>
                        <Text style={styles.driverSelectMeta}>
                          Cédula: {driver.nationalId}
                        </Text>
                        <Text style={styles.driverSelectMeta}>
                          Telf: {driver.phone}
                        </Text>
                      </View>
                      {isSelected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={tokens.colors.primary}
                        />
                      ) : (
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color="#8594AB"
                        />
                      )}
                    </Pressable>
                  );
                })
              )}

              {vehicle.assignedDriver && (
                <Pressable
                  style={styles.unassignOptionBtn}
                  onPress={() => {
                    setIsDriverModalVisible(false);
                    setTimeout(() => {
                      handleConfirmRemoveDriver();
                    }, 250);
                  }}
                >
                  <Ionicons
                    name="person-remove-outline"
                    size={18}
                    color="#DC2626"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.unassignOptionText}>
                    Quitar / Desvincular Conductor Actual
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL RECARGAR / CORREGIR DOCUMENTO ── */}
      <Modal
        visible={reuploadModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setReuploadModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cargar Nuevo Documento</Text>
              <Pressable onPress={() => setReuploadModalVisible(false)}>
                <Ionicons
                  name="close-circle-outline"
                  size={24}
                  color="#64748B"
                />
              </Pressable>
            </View>

            {docToReupload && (
              <>
                <Text style={styles.modalSubtitle}>
                  Ingresa los datos actualizados para{' '}
                  <Text
                    style={{
                      fontFamily: tokens.typography.fontFamily.bold,
                      color: '#0F172A',
                    }}
                  >
                    {docToReupload.type === 'titulo_propiedad' ||
                    docToReupload.type === 'carnet_circulacion'
                      ? 'Carnet de Circulación'
                      : docToReupload.type === 'seguro_responsabilidad_civil'
                        ? 'Responsabilidad Civil (RCV)'
                        : 'Revisión Técnica (INTT)'}
                  </Text>
                  :
                </Text>

                <Text style={styles.inputLabel}>
                  NÚMERO DE DOCUMENTO / PÓLIZA
                </Text>
                <TextInput
                  style={styles.reuploadInput}
                  placeholder="Ej. 01-44-98765432 o INTT-12345"
                  placeholderTextColor="#94A3B8"
                  value={newDocNumber}
                  onChangeText={setNewDocNumber}
                  autoCapitalize="characters"
                />

                <View style={styles.reuploadActionsRow}>
                  <Pressable
                    style={styles.modalCancelBtn}
                    onPress={() => setReuploadModalVisible(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancelar</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.modalSubmitBtn,
                      reuploadLoading && { opacity: 0.6 },
                    ]}
                    onPress={handleConfirmReupload}
                    disabled={reuploadLoading}
                  >
                    {reuploadLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons
                          name="cloud-upload"
                          size={16}
                          color="#FFFFFF"
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.modalSubmitText}>
                          Enviar a Revisión
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </>
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
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  vehicleMainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  vehicleBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  vehicleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  vehicleTitleBlock: {
    flex: 1,
  },
  vehicleModelText: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#18243E',
    marginBottom: 2,
  },
  vehicleCoopText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
  },
  horizontalDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 16,
  },
  specGrid: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  specBox: {
    flex: 1,
  },
  specLabel: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  specValue: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  statusLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeApproved: {
    backgroundColor: '#DCFCE7',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  badgeRejected: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  inviteCodeCardBlock: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  inviteCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  inviteCodeLabel: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#B45309',
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteCodeValue: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#92400E',
    letterSpacing: 0.8,
  },
  inviteCodeCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  inviteCodeCopyText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
    marginLeft: 4,
  },
  docItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docItemMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  docItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  docIconCircle: {
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
  docItemTitle: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  docItemSub: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
    marginTop: 2,
  },
  docBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  docBadgeText: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  docRejectionReasonBox: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  docRejectionReasonLabel: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#991B1B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  docRejectionReasonText: {
    fontSize: 11.5,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#B91C1C',
    lineHeight: 16,
  },
  reuploadDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  reuploadDocBtnText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#DC2626',
  },
  noDocsBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  noDocsText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
    textAlign: 'center',
    marginTop: 4,
  },
  rejectedBanner: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
  },
  rejectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rejectedTitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#991B1B',
  },
  rejectedNotes: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#991B1B',
    lineHeight: 18,
    marginBottom: 12,
  },
  rejectedAlertBox: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
    padding: 10,
    borderRadius: 8,
  },
  rejectedAlertText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#B91C1C',
    lineHeight: 15,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionCardTitle: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
  },
  driverInfoBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  driverAvatarText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
  },
  driverDetails: {
    flex: 1,
  },
  driverNameText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 2,
  },
  driverMetaText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
  },
  driverActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driverActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverRemoveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDriverBlock: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  noDriverText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
    marginBottom: 12,
  },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  assignBtnText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  financialStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  finStatBox: {
    flex: 1,
    alignItems: 'center',
  },
  finStatLabel: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    marginBottom: 4,
  },
  finStatValue: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
  },
  verticalDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E2E8F0',
  },
  tripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 12,
  },
  tripIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tripMeta: {
    flex: 1,
  },
  tripRoute: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 2,
  },
  tripDate: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
  },
  tripAmount: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#16A34A',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 8,
  },
  deleteBtnText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#DC2626',
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 4,
  },
  errorSubtitle: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorBtn: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  errorBtnText: {
    color: '#FFFFFF',
    fontFamily: tokens.typography.fontFamily.bold,
    fontSize: 14,
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
  modalScroll: {
    maxHeight: 250,
  },
  driverSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    marginBottom: 10,
  },
  driverSelectItemActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: tokens.colors.primary,
  },
  driverSelectInfo: {
    flex: 1,
  },
  driverSelectName: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    marginBottom: 2,
  },
  driverSelectMeta: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#8594AB',
  },
  unassignOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  unassignOptionText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#DC2626',
  },
  pendingDriverWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  pendingDriverWarningText: {
    flex: 1,
    fontSize: 13,
    color: '#B45309',
    fontFamily: tokens.typography.fontFamily.medium,
    lineHeight: 18,
  },
  emptyTripsWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginTop: 8,
  },
  emptyTripsText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  reuploadInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
    marginBottom: 16,
  },
  reuploadActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
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
  modalSubmitBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    backgroundColor: tokens.colors.primary,
  },
  modalSubmitText: {
    fontFamily: tokens.typography.fontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});
