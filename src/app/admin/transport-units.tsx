import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminSidebar } from '@/components/AdminSidebarContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { getAllTransportUnits } from '@/lib/api';
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
            Inactivas
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
            const statusColor = item.isActive ? '#10B981' : '#64748B';
            const statusText = item.isActive ? 'Activa' : 'Inactiva';

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
              </View>
            );
          }}
        />
      )}
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
});
