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
import {
  getAllAffiliationRequests,
  rejectDriverRequest,
  rejectOwnerRequest,
  verifyDriverRequest,
  verifyOwnerRequest,
} from '@/lib/api';
import { tokens } from '@/theme/tokens';

export default function AdminOwnerRequestsScreen() {
  const { setIsOpen } = useAdminSidebar();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [activeRole, setActiveRole] = useState<'all' | 'owner' | 'driver'>('all');
  const [activeTab, setActiveTab] = useState<
    'pending' | 'approved' | 'rejected'
  >('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Estado para el modal de rechazo
  const [selectedReq, setSelectedReq] = useState<any | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const filteredReqs = useMemo(() => {
    let result = requests.filter((r) => r.status === activeTab);

    if (activeRole !== 'all') {
      result = result.filter((r) => r.roleType === activeRole);
    }

    if (searchQuery.trim().length > 0) {
      const cleanQuery = searchQuery.toLowerCase().trim();
      result = result.filter((r) => {
        const nameMatch = r.displayName?.toLowerCase().includes(cleanQuery);
        const emailMatch = r.email?.toLowerCase().includes(cleanQuery);
        const nationalIdMatch = r.nationalId
          ?.toLowerCase()
          .includes(cleanQuery);
        const businessNameMatch = r.businessName
          ?.toLowerCase()
          .includes(cleanQuery);
        const idNumberMatch = r.idNumber?.toLowerCase().includes(cleanQuery);
        return (
          nameMatch ||
          emailMatch ||
          nationalIdMatch ||
          businessNameMatch ||
          idNumberMatch
        );
      });
    }

    return result;
  }, [requests, activeTab, activeRole, searchQuery]);

  const counts = useMemo(() => {
    const roleFiltered =
      activeRole === 'all'
        ? requests
        : requests.filter((r) => r.roleType === activeRole);
    return {
      pending: roleFiltered.filter((r) => r.status === 'pending').length,
      approved: roleFiltered.filter((r) => r.status === 'approved').length,
      rejected: roleFiltered.filter((r) => r.status === 'rejected').length,
    };
  }, [requests, activeRole]);

  const fetchRequests = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const list = await getAllAffiliationRequests();
      setRequests(list);
    } catch (err) {
      console.warn('[AdminOwnerRequests] Error loading requests:', err);
      Alert.alert(
        'Error',
        'No se pudieron sincronizar las solicitudes de afiliación.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useFocusEffect(
    useCallback(() => {
      fetchRequests();
    }, [fetchRequests]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRequests(true);
  }, [fetchRequests]);
  const handleApprove = (req: any) => {
    const isDriver = req.roleType === 'driver';
    const title = isDriver ? 'Aprobar Conductor' : 'Aprobar Propietario';
    const message = isDriver
      ? `¿Deseas aprobar a ${req.displayName} como Conductor habilitado de la plataforma?`
      : `¿Deseas aprobar a ${req.displayName} como Propietario de vehículos?\n\nPodrá registrar unidades.`;

    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: isDriver ? 'Aprobar Conductor' : 'Aprobar Propietario',
        onPress: async () => {
          setLoading(true);
          try {
            if (isDriver) {
              await verifyDriverRequest(req.uuid, req.userUuid);
            } else {
              await verifyOwnerRequest(req.uuid, req.userUuid);
            }
            Alert.alert(
              'Éxito',
              `El usuario ${req.displayName} ha sido aprobado exitosamente.`,
            );
            fetchRequests();
          } catch (err: any) {
            console.warn('[AdminOwnerRequests] Error approving request:', err);
            Alert.alert(
              'Error',
              err.message || 'No se pudo aprobar la solicitud.',
            );
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleRejectInit = (req: any) => {
    setSelectedReq(req);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedReq) return;
    if (rejectReason.trim().length < 4) {
      Alert.alert(
        'Advertencia',
        'Por favor ingresa un motivo detallado (mínimo 4 caracteres).',
      );
      return;
    }

    setRejectModalVisible(false);
    setLoading(true);
    try {
      if (selectedReq.roleType === 'driver') {
        await rejectDriverRequest(selectedReq.uuid, rejectReason.trim());
      } else {
        await rejectOwnerRequest(selectedReq.uuid, rejectReason.trim());
      }
      Alert.alert('Rechazada', 'La solicitud ha sido rechazada.');
      fetchRequests();
    } catch (err: any) {
      console.warn('[AdminOwnerRequests] Error rejecting request:', err);
      Alert.alert('Error', err.message || 'No se pudo rechazar la solicitud.');
      setLoading(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <AppLoadingScreen message="Cargando solicitudes de afiliación..." />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Solicitudes de Afiliación"
        onMenu={() => setIsOpen(true)}
      />

      {/* Selector de Tipo: Todos | Propietarios | Conductores */}
      <View style={styles.roleFilterRow}>
        <Pressable
          style={[
            styles.roleChip,
            activeRole === 'all' && styles.roleChipActive,
          ]}
          onPress={() => setActiveRole('all')}
        >
          <Text
            style={[
              styles.roleChipText,
              activeRole === 'all' && styles.roleChipTextActive,
            ]}
          >
            Todos
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.roleChip,
            activeRole === 'owner' && styles.roleChipActive,
          ]}
          onPress={() => setActiveRole('owner')}
        >
          <Ionicons
            name="business"
            size={13}
            color={activeRole === 'owner' ? '#FFFFFF' : '#64748B'}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.roleChipText,
              activeRole === 'owner' && styles.roleChipTextActive,
            ]}
          >
            Propietarios
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.roleChip,
            activeRole === 'driver' && styles.roleChipActive,
          ]}
          onPress={() => setActiveRole('driver')}
        >
          <Ionicons
            name="car"
            size={13}
            color={activeRole === 'driver' ? '#FFFFFF' : '#64748B'}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.roleChipText,
              activeRole === 'driver' && styles.roleChipTextActive,
            ]}
          >
            Conductores
          </Text>
        </Pressable>
      </View>

      {/* Barra de Búsqueda */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={18}
          color="#94A3B8"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, cédula o licencia..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable
            onPress={() => setSearchQuery('')}
            style={styles.clearBtn}
          >
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </Pressable>
        )}
      </View>

      {/* Tabs */}
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
            Pendientes ({counts.pending})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'approved' && styles.tabActive]}
          onPress={() => setActiveTab('approved')}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'approved' && styles.tabLabelActive,
            ]}
          >
            Aprobadas ({counts.approved})
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
            Rechazadas ({counts.rejected})
          </Text>
        </Pressable>
      </View>

      {/* List */}
      <FlatList
        data={filteredReqs}
        keyExtractor={(item) => `${item.roleType}-${item.uuid}`}
        contentContainerStyle={[
          styles.listContent,
          filteredReqs.length === 0 && styles.listContentEmpty,
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
            <Ionicons name="file-tray-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>
              No hay solicitudes en esta sección.
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
          const isDriver = item.roleType === 'driver';
          const isApproved = item.status === 'approved';
          const isRejected = item.status === 'rejected';
          const dateStr = item.createdAt
            ? new Date(item.createdAt).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : '';

          return (
            <View style={styles.reqCard}>
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.avatar,
                    isDriver && { backgroundColor: '#ECFDF5' },
                  ]}
                >
                  <Ionicons
                    name={isDriver ? 'car' : 'business'}
                    size={20}
                    color={isDriver ? '#059669' : tokens.colors.primary}
                  />
                </View>
                <View style={styles.meta}>
                  <View style={styles.nameBadgeRow}>
                    <Text style={styles.userName}>{item.displayName}</Text>
                    <View
                      style={[
                        styles.roleBadge,
                        isDriver
                          ? styles.roleBadgeDriver
                          : styles.roleBadgeOwner,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleBadgeText,
                          isDriver
                            ? styles.roleBadgeTextDriver
                            : styles.roleBadgeTextOwner,
                        ]}
                      >
                        {isDriver ? 'CONDUCTOR' : 'PROPIETARIO'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.userEmail}>{item.email}</Text>
                </View>
                {dateStr ? <Text style={styles.dateText}>{dateStr}</Text> : null}
              </View>

              {/* Detalles de Usuario */}
              <View style={styles.detailsRow}>
                {item.nationalId && (
                  <Text style={styles.detailText}>
                    Cédula: {item.nationalId}
                  </Text>
                )}
                {item.phoneNumber && (
                  <Text style={styles.detailText}>
                    Tel: {item.phoneNumber}
                  </Text>
                )}
              </View>

              {/* Información comercial o de conducción */}
              <View
                style={[
                  styles.coopCard,
                  isDriver && { backgroundColor: '#F0FDF4' },
                ]}
              >
                <Text style={styles.coopCardTitle}>
                  {isDriver
                    ? 'INFORMACIÓN DE CONDUCCIÓN'
                    : 'AFILIACIÓN COMERCIAL'}
                </Text>
                <Text style={styles.coopName}>{item.businessName}</Text>
                <Text style={styles.coopRif}>
                  {isDriver ? 'Nº Documento / Licencia: ' : 'RIF / Cédula: '}
                  {item.idNumber}
                </Text>
              </View>

              {/* Estado Aprobado */}
              {isApproved && (
                <View style={styles.statusBadgeApproved}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color="#059669"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.statusBadgeApprovedText}>
                    Solicitud Aprobada • Cuenta Habilitada
                  </Text>
                </View>
              )}

              {/* Motivo de rechazo */}
              {isRejected && (
                <View style={styles.rejectionCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons
                      name="close-circle"
                      size={15}
                      color="#DC2626"
                      style={{ marginRight: 5 }}
                    />
                    <Text style={styles.rejectionTitle}>
                      SOLICITUD RECHAZADA:
                    </Text>
                  </View>
                  <Text style={styles.rejectionText}>
                    {item.rejectionReason || 'No cumple con los requisitos establecidos.'}
                  </Text>
                </View>
              )}

              {/* Acciones para Rechazadas: Reconsiderar */}
              {isRejected && (
                <View style={styles.actionsRow}>
                  <Pressable
                    style={[
                      styles.approveBtn,
                      isDriver && { backgroundColor: '#059669' },
                    ]}
                    onPress={() => handleApprove(item)}
                  >
                    <Ionicons
                      name="refresh-circle-outline"
                      size={18}
                      color="#FFFFFF"
                    />
                    <Text style={styles.approveBtnText}>
                      Reconsiderar y Aprobar
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Acciones para Pendientes */}
              {item.status === 'pending' && (
                <View style={styles.actionsRow}>
                  <Pressable
                    style={styles.rejectBtn}
                    onPress={() => handleRejectInit(item)}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={18}
                      color="#EF4444"
                    />
                    <Text style={styles.rejectBtnText}>Rechazar</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.approveBtn,
                      isDriver && { backgroundColor: '#059669' },
                    ]}
                    onPress={() => handleApprove(item)}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color="#FFFFFF"
                    />
                    <Text style={styles.approveBtnText}>
                      {isDriver ? 'Aprobar Conductor' : 'Aprobar Propietario'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
      />

      {/* Modal de Rechazo */}
      <Modal
        visible={rejectModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rechazar Solicitud</Text>
              <Pressable onPress={() => setRejectModalVisible(false)}>
                <Ionicons
                  name="close-circle-outline"
                  size={24}
                  color="#64748B"
                />
              </Pressable>
            </View>

            <Text style={styles.modalSub}>
              Ingresa el motivo del rechazo para informarle al solicitante (
              {selectedReq?.displayName}):
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Ej. Documentación no legible o inconsistente..."
              placeholderTextColor="#94A3B8"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
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
                onPress={handleRejectConfirm}
              >
                <Text style={styles.modalRejectConfirmText}>Rechazar</Text>
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
  roleFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    gap: 8,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleChipActive: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  roleChipText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
  },
  roleChipTextActive: {
    color: '#FFFFFF',
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeDriver: {
    backgroundColor: '#DCFCE7',
  },
  roleBadgeOwner: {
    backgroundColor: '#EFF6FF',
  },
  roleBadgeText: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    letterSpacing: 0.5,
  },
  roleBadgeTextDriver: {
    color: '#15803D',
  },
  roleBadgeTextOwner: {
    color: tokens.colors.primary,
  },
  modalSub: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 18,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: 20,
    marginTop: 8,
    paddingHorizontal: 12,
    height: 46,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: tokens.typography.fontFamily.medium,
    fontSize: 14,
    color: '#0F172A',
  },
  clearBtn: {
    padding: 4,
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
    padding: 16,
    paddingBottom: 80,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  reqCard: {
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
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
  },
  userName: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  userEmail: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    marginTop: 2,
  },
  dateText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#94A3B8',
  },
  detailsRow: {
    flexDirection: 'row',
    marginTop: 8,
    paddingLeft: 2,
  },
  detailText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginRight: 16,
  },
  coopCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  coopCardTitle: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  coopName: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#334155',
  },
  coopRif: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginTop: 1,
  },
  statusBadgeApproved: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  statusBadgeApprovedText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#065F46',
  },
  rejectionCard: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  rejectionTitle: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#991B1B',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  rejectionText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#B91C1C',
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF5F5',
    marginRight: 10,
  },
  rejectBtnText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#EF4444',
    marginLeft: 6,
  },
  approveBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 10,
    backgroundColor: tokens.colors.primary,
    shadowColor: '#1D5BD9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  approveBtnText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
    marginLeft: 6,
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
  modalSubtitle: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 18,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#0F172A',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 10,
  },
  modalCancelText: {
    fontFamily: tokens.typography.fontFamily.bold,
    fontSize: 14,
    color: '#475569',
  },
  modalRejectConfirmBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
  },
  modalRejectConfirmText: {
    fontFamily: tokens.typography.fontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
