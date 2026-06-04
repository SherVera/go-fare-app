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
import { ScreenHeader } from '@/components/ScreenHeader';
import { deleteUser, getAllUsers, updateUserRoles } from '@/lib/api';
import { tokens } from '@/theme/tokens';

export default function AdminUsersScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<
    'all' | 'passenger' | 'driver' | 'transport_owner'
  >('all');

  // Estado para el modal de detalles/acciones
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [actionsModalVisible, setActionsModalVisible] = useState(false);

  const applyFilters = useCallback(
    (
      allUsers: any[],
      query: string,
      roleTab: 'all' | 'passenger' | 'driver' | 'transport_owner',
    ) => {
      let result = [...allUsers];

      // Filtro de pestaña de rol
      if (roleTab !== 'all') {
        result = result.filter((u) => {
          const roles = (u as any).roles || [];
          const isOwner = roles.some((r: any) => r.name === 'transport_owner');
          const isDriver = roles.some((r: any) => r.name === 'driver');

          if (roleTab === 'transport_owner') return isOwner;
          if (roleTab === 'driver') return isDriver;
          if (roleTab === 'passenger') return !isOwner && !isDriver;
          return false;
        });
      }

      // Filtro de búsqueda
      if (query.trim().length > 0) {
        const q = query.toLowerCase();
        result = result.filter((u) => {
          const name = (
            u.displayName || `${u.firstName || ''} ${u.lastName || ''}`
          ).toLowerCase();
          const email = (u.email || '').toLowerCase();
          const phone = (u.phoneNumber || '').toLowerCase();
          const id = (u.nationalId || '').toLowerCase();
          return (
            name.includes(q) ||
            email.includes(q) ||
            phone.includes(q) ||
            id.includes(q)
          );
        });
      }

      setFilteredUsers(result);
    },
    [],
  );

  const fetchUsers = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      try {
        const allUsers = await getAllUsers();
        setUsers(allUsers);
        applyFilters(allUsers, search, activeTab);
      } catch (err) {
        console.warn('[AdminUsers] Error loading users:', err);
        Alert.alert(
          'Error',
          'No se pudo obtener la lista de usuarios del servidor.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applyFilters, search, activeTab],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers(true);
  }, [fetchUsers]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    applyFilters(users, text, activeTab);
  };

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    applyFilters(users, search, tab);
  };

  const handleUserSelect = (user: any) => {
    setSelectedUser(user);
    setActionsModalVisible(true);
  };

  const handleDeleteUser = () => {
    if (!selectedUser) return;
    setActionsModalVisible(false);

    Alert.alert(
      'Eliminar Usuario',
      `¿Estás seguro de que deseas eliminar permanentemente a ${selectedUser.displayName || selectedUser.firstName}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deleteUser(selectedUser.uuid);
              Alert.alert(
                'Éxito',
                'El usuario ha sido eliminado correctamente.',
              );
              fetchUsers();
            } catch (err: any) {
              console.warn('[AdminUsers] Error deleting user:', err);
              Alert.alert(
                'Error',
                err.message || 'No se pudo eliminar el usuario.',
              );
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleChangeRole = (
    targetRole: 'passenger' | 'driver' | 'transport_owner',
  ) => {
    if (!selectedUser) return;
    setActionsModalVisible(false);

    // Mapear nombres a UUIDs/IDs típicos del backend
    // ID 1: passenger, ID 2: driver, ID 3: transport_owner
    const roleIdMap = {
      passenger: '1',
      driver: '2',
      transport_owner: '3',
    };

    Alert.alert(
      'Cambiar Rol',
      `¿Deseas cambiar el rol de ${selectedUser.displayName || selectedUser.firstName} a ${
        targetRole === 'passenger'
          ? 'Pasajero'
          : targetRole === 'driver'
            ? 'Conductor'
            : 'Socio'
      }?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setLoading(true);
            try {
              const roleId = roleIdMap[targetRole];
              await updateUserRoles(selectedUser.uuid, [roleId]);
              Alert.alert('Éxito', 'El rol del usuario ha sido actualizado.');
              fetchUsers();
            } catch (err: any) {
              console.warn('[AdminUsers] Error updating role:', err);
              Alert.alert(
                'Error',
                err.message || 'No se pudo cambiar el rol del usuario.',
              );
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Gestionar Usuarios" onBack={() => router.back()} />

      {/* Barra de búsqueda */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={20}
          color="#94A3B8"
          style={{ marginRight: 10 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, correo, cédula..."
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

      {/* Pestañas de filtrado por rol */}
      <View style={styles.tabsContainer}>
        <FlatList
          data={[
            { id: 'all', label: 'Todos' },
            { id: 'passenger', label: 'Pasajeros' },
            { id: 'driver', label: 'Conductores' },
            { id: 'transport_owner', label: 'Socios' },
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

      {/* Listado de usuarios */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={tokens.colors.primary} />
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="people-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>No se encontraron usuarios.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.uuid}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          renderItem={({ item }) => {
            const roles = item.roles || [];
            const isOwner = roles.some(
              (r: any) => r.name === 'transport_owner',
            );
            const isDriver = roles.some((r: any) => r.name === 'driver');
            const roleText = isOwner
              ? 'Socio'
              : isDriver
                ? 'Conductor'
                : 'Pasajero';
            const roleColor = isOwner
              ? '#8B5CF6'
              : isDriver
                ? '#10B981'
                : '#3B82F6';

            return (
              <Pressable
                style={styles.userCard}
                onPress={() => handleUserSelect(item)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(item.displayName || item.firstName || 'U')
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userMeta}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {item.displayName ||
                        `${item.firstName || ''} ${item.lastName || ''}`}
                    </Text>
                    <Text style={styles.userEmail} numberOfLines={1}>
                      {item.email || 'Sin correo electrónico'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.roleBadge,
                      { backgroundColor: `${roleColor}12` },
                    ]}
                  >
                    <Text style={[styles.roleBadgeText, { color: roleColor }]}>
                      {roleText}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  {item.nationalId && (
                    <View style={styles.bodyDetail}>
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
                    <View style={styles.bodyDetail}>
                      <Ionicons
                        name="call-outline"
                        size={14}
                        color="#64748B"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.detailText}>
                        Teléfono: {item.phoneNumber}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Modal de Acciones */}
      <Modal
        visible={actionsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActionsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Opciones de Usuario</Text>
              <Pressable onPress={() => setActionsModalVisible(false)}>
                <Ionicons
                  name="close-circle-outline"
                  size={24}
                  color="#64748B"
                />
              </Pressable>
            </View>

            {selectedUser && (
              <View style={styles.modalUserDetail}>
                <Text style={styles.modalUserName}>
                  {selectedUser.displayName ||
                    `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`}
                </Text>
                <Text style={styles.modalUserEmail}>
                  {selectedUser.email || 'Sin correo'}
                </Text>
              </View>
            )}

            <Text style={styles.modalSubtitle}>CAMBIAR ROL A:</Text>
            <View style={styles.modalActionsGrid}>
              <Pressable
                style={styles.modalActionBtn}
                onPress={() => handleChangeRole('passenger')}
              >
                <Ionicons name="person-outline" size={20} color="#3B82F6" />
                <Text style={styles.modalActionBtnText}>Pasajero</Text>
              </Pressable>

              <Pressable
                style={styles.modalActionBtn}
                onPress={() => handleChangeRole('driver')}
              >
                <Ionicons name="card-outline" size={20} color="#10B981" />
                <Text style={styles.modalActionBtnText}>Conductor</Text>
              </Pressable>

              <Pressable
                style={styles.modalActionBtn}
                onPress={() => handleChangeRole('transport_owner')}
              >
                <Ionicons name="bus-outline" size={20} color="#8B5CF6" />
                <Text style={styles.modalActionBtnText}>Socio (Dueño)</Text>
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>ACCIONES DE CUENTA:</Text>
            <Pressable
              style={styles.deleteActionBtn}
              onPress={handleDeleteUser}
            >
              <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
              <Text style={styles.deleteActionText}>
                Eliminar Cuenta Permanentemente
              </Text>
            </Pressable>
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
    paddingBottom: 40,
  },
  userCard: {
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
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#475569',
  },
  userMeta: {
    flex: 1,
    marginRight: 8,
  },
  userName: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  userEmail: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    marginTop: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  cardBody: {
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  bodyDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    marginTop: 4,
  },
  detailText: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
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
  modalUserDetail: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  modalUserName: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  modalUserEmail: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    marginTop: 2,
  },
  modalSubtitle: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#94A3B8',
    letterSpacing: 1.1,
    marginBottom: 12,
  },
  modalActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalActionBtn: {
    width: '31%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionBtnText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#475569',
    marginTop: 6,
  },
  deleteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    height: 50,
    borderRadius: 12,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  deleteActionText: {
    color: '#FFFFFF',
    fontFamily: tokens.typography.fontFamily.bold,
    fontSize: 14,
    marginLeft: 8,
  },
});
