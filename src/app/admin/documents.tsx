import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminSidebar } from '@/components/AdminSidebarContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { getAllDocuments, rejectDocument, verifyDocument } from '@/lib/api';
import { tokens } from '@/theme/tokens';

export default function AdminDocumentsScreen() {
  const _router = useRouter();
  const { setIsOpen } = useAdminSidebar();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<
    'pending' | 'verified' | 'rejected'
  >('pending');

  // Estado para el modal de rechazo
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const applyFilters = useCallback((allDocs: any[], tab: typeof activeTab) => {
    const statusMap = {
      pending: 'pending_review',
      verified: 'verified',
      rejected: 'rejected',
    };
    const targetStatus = statusMap[tab];
    const result = allDocs.filter((d) => d.status === targetStatus);
    setFilteredDocs(result);
  }, []);

  const fetchDocuments = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      try {
        const allDocs = await getAllDocuments();
        setDocuments(allDocs);
        applyFilters(allDocs, activeTab);
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
    },
    [activeTab, applyFilters],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDocuments(true);
  }, [fetchDocuments]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    applyFilters(documents, tab);
  };

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
              fetchDocuments();
            } catch (err: any) {
              console.warn('[AdminDocs] Error verifying doc:', err);
              Alert.alert(
                'Error',
                err.message || 'No se pudo aprobar el documento.',
              );
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

  const handleRejectConfirm = async () => {
    if (!selectedDoc) return;
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
      await rejectDocument(selectedDoc.uuid, rejectReason.trim());
      Alert.alert('Rechazado', 'El documento ha sido rechazado.');
      fetchDocuments();
    } catch (err: any) {
      console.warn('[AdminDocs] Error rejecting doc:', err);
      Alert.alert('Error', err.message || 'No se pudo rechazar el documento.');
      setLoading(false);
    }
  };

  const getDocTypeLabel = (type: string) => {
    switch (type) {
      case 'driver_license':
        return 'Licencia de Conducir';
      case 'medical_certificate':
        return 'Certificado Médico';
      case 'property_title':
        return 'Título de Propiedad';
      default:
        return 'Documento Legal';
    }
  };

  const getDocTypeIcon = (type: string) => {
    switch (type) {
      case 'driver_license':
        return 'card-outline';
      case 'medical_certificate':
        return 'medical-outline';
      case 'property_title':
        return 'business-outline';
      default:
        return 'document-text-outline';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Validar Documentos" onMenu={() => setIsOpen(true)} />

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
          style={[styles.tab, activeTab === 'verified' && styles.tabActive]}
          onPress={() => handleTabChange('verified')}
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
          onPress={() => handleTabChange('rejected')}
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

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={tokens.colors.primary} />
        </View>
      ) : filteredDocs.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>
            No hay documentos en esta sección.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredDocs}
          keyExtractor={(item) => item.uuid}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
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
              <View style={styles.docCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconCircle}>
                    <Ionicons
                      name={getDocTypeIcon(item.type)}
                      size={20}
                      color={tokens.colors.primary}
                    />
                  </View>
                  <View style={styles.meta}>
                    <Text style={styles.docTitle}>
                      {getDocTypeLabel(item.type)}
                    </Text>
                    <Text style={styles.docNum}>
                      Nro: {item.documentNumber || 'S/N'}
                    </Text>
                  </View>
                  <Text style={styles.dateText}>{dateStr}</Text>
                </View>

                {/* Info Propietario */}
                <View style={styles.ownerCard}>
                  <Text style={styles.ownerTitle}>PROPIETARIO</Text>
                  <Text style={styles.ownerName}>
                    {item.owner?.displayName || 'Usuario GoFare'}
                  </Text>
                  <Text style={styles.ownerEmail}>
                    {item.owner?.email || 'Sin correo'}
                  </Text>
                </View>

                {/* Detalles Adicionales en caso de Rechazo */}
                {item.status === 'rejected' && item.rejectionReason && (
                  <View style={styles.rejectionReasonCard}>
                    <Text style={styles.rejectionReasonTitle}>
                      MOTIVO DE RECHAZO:
                    </Text>
                    <Text style={styles.rejectionReasonText}>
                      {item.rejectionReason}
                    </Text>
                  </View>
                )}

                {/* Acciones */}
                {item.status === 'pending_review' && (
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
                      <Text style={styles.approveBtnText}>Aprobar</Text>
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
              Indica el motivo por el cual rechazas este documento:
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Ej. El documento está vencido o la foto está borrosa..."
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
    paddingBottom: 40,
  },
  docCard: {
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
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  meta: {
    flex: 1,
  },
  docTitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  docNum: {
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
  ownerCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  ownerTitle: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  ownerName: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#334155',
  },
  ownerEmail: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    marginTop: 1,
  },
  rejectionReasonCard: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
  },
  rejectionReasonTitle: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#991B1B',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  rejectionReasonText: {
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
    flex: 1,
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
