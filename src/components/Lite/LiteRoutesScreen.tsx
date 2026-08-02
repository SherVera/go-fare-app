import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';

interface RouteData {
  id: string;
  code: string;
  name: string;
  origin: string;
  destination: string;
  fare: string;
  status: 'Activa' | 'Frecuencia Alta';
  stopsCount: number;
}

const LITE_ROUTES: RouteData[] = [
  {
    id: '1',
    code: 'R-01',
    name: 'Plaza Venezuela - Chacaíto - Petare',
    origin: 'Plaza Venezuela',
    destination: 'Petare',
    fare: '1 Ticket (Bs. 15.00)',
    status: 'Activa',
    stopsCount: 12,
  },
  {
    id: '2',
    code: 'R-02',
    name: 'Cátedra - Parque Central - Silencio',
    origin: 'Cátedra',
    destination: 'El Silencio',
    fare: '1 Ticket (Bs. 15.00)',
    status: 'Frecuencia Alta',
    stopsCount: 8,
  },
  {
    id: '3',
    code: 'R-03',
    name: 'La Hoyada - El Valle - Coche',
    origin: 'La Hoyada',
    destination: 'Coche',
    fare: '1 Ticket (Bs. 15.00)',
    status: 'Activa',
    stopsCount: 10,
  },
  {
    id: '4',
    code: 'R-04',
    name: 'Baruta - Las Mercedes - Chacao',
    origin: 'Baruta',
    destination: 'Chacao',
    fare: '1 Ticket (Bs. 15.00)',
    status: 'Activa',
    stopsCount: 14,
  },
];

export function LiteRoutesScreen() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRoutes = LITE_ROUTES.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.destination.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Rutas y Líneas</Text>
        <Text style={styles.subtitle}>Directorio ultraligero sin mapas</Text>
      </View>

      {/* ── BUSCADOR DE RUTAS LITE ── */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar origen, destino o línea..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </Pressable>
        )}
      </View>

      {/* ── LISTA DE RUTAS ── */}
      <FlatList
        data={filteredRoutes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.routeCard}>
            <View style={styles.routeHeader}>
              <View style={styles.codeBadge}>
                <Text style={styles.codeText}>{item.code}</Text>
              </View>
              <Text style={styles.statusBadge}>{item.status}</Text>
            </View>

            <Text style={styles.routeName}>{item.name}</Text>

            <View style={styles.originDestRow}>
              <Ionicons name="navigate-outline" size={14} color="#0EA5E9" />
              <Text style={styles.originDestText}>
                {item.origin} ➔ {item.destination}
              </Text>
            </View>

            <View style={styles.footerRow}>
              <View style={styles.infoPill}>
                <Ionicons
                  name="bus-outline"
                  size={12}
                  color="#94A3B8"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.infoPillText}>
                  {item.stopsCount} paradas
                </Text>
              </View>

              <View style={styles.fareBadge}>
                <Text style={styles.fareText}>{item.fare}</Text>
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    color: '#0F172A',
    fontSize: 22,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  searchInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    marginLeft: 10,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeBadge: {
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.25)',
  },
  codeText: {
    color: '#0EA5E9',
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  statusBadge: {
    color: '#10B981',
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  routeName: {
    color: '#0F172A',
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    marginBottom: 6,
  },
  originDestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  originDestText: {
    color: '#64748B',
    fontSize: 13,
    marginLeft: 6,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoPillText: {
    color: '#64748B',
    fontSize: 11,
  },
  fareBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  fareText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
  },
});
