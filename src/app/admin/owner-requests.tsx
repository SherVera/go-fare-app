import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  getAllOwnerRequests,
  rejectOwnerRequest,
  verifyOwnerRequest,
} from '@/lib/api';
import { tokens } from '@/theme/tokens';

export default function AdminOwnerRequestsScreen() {
  const _router = useRouter();
  const { setIsOpen } = useAdminSidebar();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [filteredReqs, setFilteredReqs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<
    'pending' | 'approved' | 'rejected'
  >('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Estado para el modal de rechazo
  const [selectedReq, setSelectedReq] = useState<any | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const applyFilters = useCallback(
    (allReqs: any[], tab: typeof activeTab, query: string) => {
      let result = allReqs.filter((r) => r.status === tab);

      if (query.trim().length > 0) {
        const cleanQuery = query.toLowerCase().trim();
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

      setFilteredReqs(result);
    },
    [],
  );

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAllOwnerRequests();
      setRequests(list);
      applyFilters(list, activeTab, searchQuery);
    } catch (err) {
      console.warn('[AdminOwnerRequests] Error loading requests:', err);
      Alert.alert(
        'Error',
        'No se pudieron sincronizar las solicitudes de socios.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, applyFilters, searchQuery]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRequests();
  }, [fetchRequests]);

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    applyFilters(requests, tab, searchQuery);
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    applyFilters(requests, activeTab, text);
  };

  const handleApprove = (req: any) => {
    Alert.alert(
      'Aprobar Solicitud',
      `¿Deseas aprobar a ${req.displayName} como Propietario?\n\nEsto le dará permisos para gestionar unidades y conductores de: ${req.businessName}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar Propietario',
          onPress: async () => {
            setLoading(true);
            try {
              await verifyOwnerRequest(req.uuid, req.userUuid);
              Alert.alert(
                'Éxito',
                'El usuario ha sido aprobado como Propietario de vehiculo con éxito.',
              );
              fetchRequests();
            } catch (err: any) {
              console.warn(
                '[AdminOwnerRequests] Error approving request:',
                err,
              );
              Alert.alert(
                'Error',
                err.message || 'No se pudo aprobar la solicitud.',
              );
              setLoading(false);
            }
          },
        },
      ],
    );
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
      await rejectOwnerRequest(selectedReq.uuid, rejectReason.trim());
      Alert.alert('Rechazada', 'La solicitud ha sido rechazada.');
      fetchRequests();
    } catch (err: any) {
      console.warn('[AdminOwnerRequests] Error rejecting request:', err);
      Alert.alert('Error', err.message || 'No se pudo rechazar la solicitud.');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Solicitudes de Propietarios"
        onMenu={() => setIsOpen(true)}
      />

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
          placeholder="Buscar por nombre o cédula..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={handleSearchChange}
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable
            onPress={() => handleSearchChange('')}
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
          onPress={() => handleTabChange('pending')}
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
          style={[styles.tab, activeTab === 'approved' && styles.tabActive]}
          onPress={() => handleTabChange('approved')}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'approved' && styles.tabLabelActive,
            ]}
          >
            Aprobadas
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'rejected' && styles.tabActive]}
          onPress={() => handleTabChange('rejected')}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'rejected' && styles.tabLabelActive,
            ]}
          >
            Rechazadas
          </Text>
        </Pressable>
      </View>

      {/* List */}
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={tokens.colors.primary} />
        </View>
      ) : filteredReqs.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="business-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>
            No hay solicitudes en esta sección.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredReqs}
          keyExtractor={(item) => item.uuid}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[tokens.colors.primary]}
              tintColor={tokens.colors.primary}
            />
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
              <View style={styles.reqCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(item.displayName || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.meta}>
                    <Text style={styles.userName}>{item.displayName}</Text>
                    <Text style={styles.userEmail}>{item.email}</Text>
                  </View>
                  <Text style={styles.dateText}>{dateStr}</Text>
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

                {/* Cooperativa / RIF */}
                <View style={styles.coopCard}>
                  <Text style={styles.coopCardTitle}>AFILIACIÓN COMERCIAL</Text>
                  <Text style={styles.coopName}>{item.businessName}</Text>
                  <Text style={styles.coopRif}>RIF: {item.idNumber}</Text>
                </View>

                {/* Motivo de rechazo */}
                {item.status === 'rejected' && item.rejectionReason && (
                  <View style={styles.rejectionCard}>
                    <Text style={styles.rejectionTitle}>
                      MOTIVO DE RECHAZO:
                    </Text>
                    <Text style={styles.rejectionText}>
                      {item.rejectionReason}
                    </Text>
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
                      style={styles.approveBtn}
                      onPress={() => handleApprove(item)}
                    >
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.approveBtnText}>
                        Aprobar Propietario
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

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

            <Text style={styles.modalSubtitle}>
              Indica el motivo por el cual rechazas al postulante:
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Ej. El RIF provisto no coincide o no es socio autorizado..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: 20,
    marginTop: 12,
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
    paddingHorizontal: 20,
    paddingBottom: 110, // Más padding para evitar que se tape con el tab bar flotante
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
