import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
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
  deleteUser,
  getAllUsers,
  resolveRoleUuid,
  updateUserRoles,
} from '@/lib/api';
import { tokens } from '@/theme/tokens';

const userDateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export default function AdminUsersScreen() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const { setIsOpen } = useAdminSidebar();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<
    'all' | 'passenger' | 'driver' | 'transport_owner' | 'civil_association'
  >(
    role &&
      ['passenger', 'driver', 'transport_owner', 'civil_association'].includes(
        role,
      )
      ? (role as any)
      : 'all',
  );

  // Modal de detalles y acciones
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [actionsModalVisible, setActionsModalVisible] = useState(false);

  const roleCounts = useMemo(() => {
    let passenger = 0;
    let driver = 0;
    let transport_owner = 0;
    let civil_association = 0;

    for (const u of users) {
      if (!u) continue;
      const roles = (u as any).roles || [];
      const isOwner = roles.some((r: any) => r.name === 'transport_owner');
      const isDriver = roles.some((r: any) => r.name === 'driver');
      const isCivil = roles.some((r: any) => r.name === 'civil_association');

      if (isOwner) transport_owner++;
      else if (isDriver) driver++;
      else if (isCivil) civil_association++;
      else passenger++;
    }

    return {
      all: users.length,
      passenger,
      driver,
      transport_owner,
      civil_association,
    };
  }, [users]);

  const applyFilters = useCallback(
    (
      allUsers: any[],
      query: string,
      roleTab:
        | 'all'
        | 'passenger'
        | 'driver'
        | 'transport_owner'
        | 'civil_association',
    ) => {
      let result = [...allUsers];

      // Filtro de pestaña de rol
      if (roleTab !== 'all') {
        result = result.filter((u) => {
          const roles = (u as any).roles || [];
          const isOwner = roles.some((r: any) => r.name === 'transport_owner');
          const isDriver = roles.some((r: any) => r.name === 'driver');
          const isCivil = roles.some(
            (r: any) => r.name === 'civil_association',
          );

          if (roleTab === 'transport_owner') return isOwner;
          if (roleTab === 'driver') return isDriver;
          if (roleTab === 'civil_association') return isCivil;
          if (roleTab === 'passenger') return !isOwner && !isDriver && !isCivil;
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
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setRefreshing(true);
    await fetchUsers(true);
  }, [fetchUsers]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
    }, [fetchUsers]),
  );

  useEffect(() => {
    if (
      role &&
      [
        'all',
        'passenger',
        'driver',
        'transport_owner',
        'civil_association',
      ].includes(role)
    ) {
      setActiveTab(role as any);
      applyFilters(users, search, role as any);
    }
  }, [role, users, search, applyFilters]);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    applyFilters(users, text, activeTab);
  };

  const handleTabChange = (tab: typeof activeTab) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setActiveTab(tab);
    applyFilters(users, search, tab);
  };

  const handleUserSelect = (user: any) => {
    try {
      Haptics.selectionAsync();
    } catch {}
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
              try {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
              } catch {}
              Alert.alert(
                'Usuario Eliminado',
                'El registro ha sido eliminado del sistema exitosamente.',
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
    targetRole:
      | 'passenger'
      | 'driver'
      | 'transport_owner'
      | 'civil_association',
  ) => {
    if (!selectedUser) return;
    setActionsModalVisible(false);

    const targetLabel =
      targetRole === 'passenger'
        ? 'Pasajero'
        : targetRole === 'driver'
          ? 'Conductor'
          : targetRole === 'civil_association'
            ? 'Asociación Civil'
            : 'Socio (Dueño)';

    Alert.alert(
      'Cambiar Rol de Usuario',
      `¿Deseas asignar el rol de "${targetLabel}" a ${selectedUser.displayName || selectedUser.firstName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar Cambio',
          onPress: async () => {
            setLoading(true);
            try {
              const roleUuid = await resolveRoleUuid(targetRole);
              if (!roleUuid) {
                throw new Error(
                  'No se pudo resolver el identificador del rol en el servidor.',
                );
              }
              await updateUserRoles(selectedUser.uuid, [roleUuid]);
              try {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
              } catch {}
              Alert.alert(
                'Rol Actualizado',
                `El usuario ahora tiene el rol de ${targetLabel}.`,
              );
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

  if (loading && !refreshing) {
    return <AppLoadingScreen message="Cargando usuarios registrados..." />;
  }

  const roleTabItems = [
    { id: 'all' as const, label: 'Todos', count: roleCounts.all },
    { id: 'passenger' as const, label: 'Pasajeros', count: roleCounts.passenger },
    { id: 'driver' as const, label: 'Conductores', count: roleCounts.driver },
    { id: 'transport_owner' as const, label: 'Socios', count: roleCounts.transport_owner },
    { id: 'civil_association' as const, label: 'Asoc. Civiles', count: roleCounts.civil_association },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Gestionar Usuarios"
        subtitle={`${filteredUsers.length} registros encontrados`}
        onMenu={() => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch {}
          setIsOpen(true);
        }}
        rightAction={
          <Pressable
            style={styles.headerRefreshBtn}
            onPress={onRefresh}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="sync-outline" size={18} color="#64748B" />
          </Pressable>
        }
      />

      {/* Barra de Búsqueda */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={18}
            color="#64748B"
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre, correo, cédula o teléfono..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={handleSearchChange}
          />
          {search.length > 0 && (
            <Pressable
              onPress={() => handleSearchChange('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Pestañas de Filtrado con Conteo */}
      <View style={styles.tabsContainer}>
        <FlatList
          data={roleTabItems}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
          renderItem={({ item }) => {
            const isActive = activeTab === item.id;
            return (
              <Pressable
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                onPress={() => handleTabChange(item.id)}
              >
                <Text
                  style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                >
                  {item.label}
                </Text>
                <View
                  style={[
                    styles.tabCountBadge,
                    isActive && styles.tabCountBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabCountText,
                      isActive && styles.tabCountTextActive,
                    ]}
                  >
                    {item.count}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Listado de Usuarios */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.uuid || item.id}
        contentContainerStyle={[
          styles.listContent,
          filteredUsers.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
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
            <View style={styles.emptyIconCircle}>
              <Ionicons name="people-outline" size={36} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>Sin usuarios para mostrar</Text>
            <Text style={styles.emptySubtext}>
              {search.length > 0
                ? 'No encontramos coincidencias para tu búsqueda.'
                : 'No hay usuarios registrados en esta categoría.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const roles = item.roles || [];
          const isOwner = roles.some((r: any) => r.name === 'transport_owner');
          const isDriver = roles.some((r: any) => r.name === 'driver');
          const isCivil = roles.some(
            (r: any) => r.name === 'civil_association',
          );

          const roleText = isOwner
            ? 'Socio'
            : isDriver
              ? 'Conductor'
              : isCivil
                ? 'Asoc. Civil'
                : 'Pasajero';

          const roleColor = isOwner
            ? '#8B5CF6'
            : isDriver
              ? '#10B981'
              : isCivil
                ? '#EA580C'
                : '#3B82F6';

          const initial = (
            item.displayName ||
            item.firstName ||
            'U'
          )
            .charAt(0)
            .toUpperCase();

          const formattedCreated = item.createdAt
            ? userDateFormatter.format(new Date(item.createdAt))
            : null;

          return (
            <Pressable
              style={styles.userCard}
              onPress={() => handleUserSelect(item)}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.avatar,
                    { borderColor: `${roleColor}30`, borderWidth: 1.5 },
                  ]}
                >
                  <Text style={[styles.avatarText, { color: roleColor }]}>
                    {initial}
                  </Text>
                </View>

                <View style={styles.userMeta}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {item.displayName ||
                      `${item.firstName || ''} ${item.lastName || ''}`.trim() ||
                      'Usuario'}
                  </Text>
                  <Text style={styles.userEmail} numberOfLines={1}>
                    {item.email || 'Sin correo electrónico'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.roleBadge,
                    { backgroundColor: `${roleColor}14` },
                  ]}
                >
                  <Text style={[styles.roleBadgeText, { color: roleColor }]}>
                    {roleText}
                  </Text>
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.cardDetailsRow}>
                {item.nationalId ? (
                  <View style={styles.detailBadge}>
                    <Ionicons name="card-outline" size={13} color="#64748B" />
                    <Text style={styles.detailText}>{item.nationalId}</Text>
                  </View>
                ) : null}

                {item.phoneNumber ? (
                  <View style={styles.detailBadge}>
                    <Ionicons name="call-outline" size={13} color="#64748B" />
                    <Text style={styles.detailText}>{item.phoneNumber}</Text>
                  </View>
                ) : null}

                {formattedCreated ? (
                  <View style={styles.detailBadge}>
                    <Ionicons
                      name="calendar-outline"
                      size={13}
                      color="#94A3B8"
                    />
                    <Text style={styles.detailTextMuted}>
                      {formattedCreated}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />

      {/* Modal de Detalles y Acciones (Bottom Sheet) */}
      <Modal
        visible={actionsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActionsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdropPressable}
            onPress={() => setActionsModalVisible(false)}
          />

          <View style={styles.modalContent}>
            <View style={styles.modalDragIndicator} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Opciones de Usuario</Text>
                <Text style={styles.modalSub}>
                  Gestión de permisos y acceso
                </Text>
              </View>
              <Pressable
                onPress={() => setActionsModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            {selectedUser && (
              <View style={styles.modalUserCard}>
                <View style={styles.modalAvatarCircle}>
                  <Text style={styles.modalAvatarText}>
                    {(
                      selectedUser.displayName ||
                      selectedUser.firstName ||
                      'U'
                    )
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>
                <View style={styles.modalUserInfo}>
                  <Text style={styles.modalUserName} numberOfLines={1}>
                    {selectedUser.displayName ||
                      `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() ||
                      'Usuario'}
                  </Text>
                  <Text style={styles.modalUserEmail} numberOfLines={1}>
                    {selectedUser.email || 'Sin correo'}
                  </Text>
                  {selectedUser.nationalId && (
                    <Text style={styles.modalUserDoc}>
                      C.I: {selectedUser.nationalId}
                    </Text>
                  )}
                </View>
              </View>
            )}

            <Text style={styles.modalSectionLabel}>ASIGNAR NUEVO ROL</Text>
            <View style={styles.modalRolesGrid}>
              <Pressable
                style={styles.modalRoleBtn}
                onPress={() => handleChangeRole('passenger')}
              >
                <View
                  style={[styles.roleIconBox, { backgroundColor: '#EFF6FF' }]}
                >
                  <Ionicons name="person-outline" size={18} color="#2563EB" />
                </View>
                <Text style={styles.modalRoleBtnText}>Pasajero</Text>
              </Pressable>

              <Pressable
                style={styles.modalRoleBtn}
                onPress={() => handleChangeRole('driver')}
              >
                <View
                  style={[styles.roleIconBox, { backgroundColor: '#ECFDF5' }]}
                >
                  <Ionicons name="card-outline" size={18} color="#059669" />
                </View>
                <Text style={styles.modalRoleBtnText}>Conductor</Text>
              </Pressable>

              <Pressable
                style={styles.modalRoleBtn}
                onPress={() => handleChangeRole('transport_owner')}
              >
                <View
                  style={[styles.roleIconBox, { backgroundColor: '#F5F3FF' }]}
                >
                  <Ionicons name="bus-outline" size={18} color="#7C3AED" />
                </View>
                <Text style={styles.modalRoleBtnText}>Socio (Dueño)</Text>
              </Pressable>

              <Pressable
                style={styles.modalRoleBtn}
                onPress={() => handleChangeRole('civil_association')}
              >
                <View
                  style={[styles.roleIconBox, { backgroundColor: '#FFF7ED' }]}
                >
                  <Ionicons name="business-outline" size={18} color="#EA580C" />
                </View>
                <Text style={styles.modalRoleBtnText}>Asoc. Civil</Text>
              </Pressable>
            </View>

            <View style={styles.modalActionSeparator} />

            <Pressable
              style={styles.deleteUserBtn}
              onPress={handleDeleteUser}
            >
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
              <Text style={styles.deleteUserText}>Eliminar Usuario Permanentemente</Text>
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
  headerRefreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrapper: {
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
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
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#0F172A',
    height: '100%',
  },
  tabsContainer: {
    marginBottom: 12,
  },
  tabsScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: tokens.colors.primary,
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  tabLabelActive: {
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  tabCountBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabCountBadgeActive: {
    backgroundColor: tokens.colors.primary,
  },
  tabCountText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
  },
  tabCountTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
    gap: 10,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  userMeta: {
    flex: 1,
    marginRight: 10,
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
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  cardDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#334155',
  },
  detailTextMuted: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#94A3B8',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#334155',
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 240,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdropPressable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 20,
  },
  modalDragIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    marginTop: 1,
  },
  modalUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalAvatarText: {
    fontSize: 17,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  modalUserInfo: {
    flex: 1,
  },
  modalUserName: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  modalUserEmail: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    marginTop: 1,
  },
  modalUserDoc: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#059669',
    marginTop: 2,
  },
  modalSectionLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  modalRolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  modalRoleBtn: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  roleIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRoleBtnText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#334155',
  },
  modalActionSeparator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 16,
  },
  deleteUserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingVertical: 12,
  },
  deleteUserText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#DC2626',
  },
});
