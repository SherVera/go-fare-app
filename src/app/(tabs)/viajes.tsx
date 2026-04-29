import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { tokens } from '@/theme/tokens';
import { StatusBar } from 'expo-status-bar';

export default function ViajesScreen() {
  const [activeFilter, setActiveFilter] = useState('Todos');
  const filters = ['Todos', 'Este mes', 'Este año'];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Pressable hitSlop={10} style={styles.menuBtn}>
          <Ionicons name="menu" size={28} color={tokens.colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Gofair</Text>
        <Image
          source={{ uri: 'https://i.pravatar.cc/150?img=11' }}
          style={styles.avatar}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* ── TITULO ── */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Viajes</Text>
          <Text style={styles.pageSubtitle}>Revisa tu actividad y gastos de transporte.</Text>
        </View>

        {/* ── FILTROS ── */}
        <View style={styles.filtersContainer}>
          {filters.map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <Pressable
                key={filter}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── RESUMEN CARDS ── */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCardWhite}>
            <View style={styles.summaryIconWhiteBg}>
              <MaterialCommunityIcons name="cash" size={24} color={tokens.colors.primary} />
            </View>
            <Text style={styles.summaryLabelGrey}>GASTO TOTAL</Text>
            <Text style={styles.summaryValueDark}>Bs. 450,00</Text>
          </View>
          
          <View style={styles.summaryCardBlue}>
            <View style={styles.summaryIconBlueBg}>
              <Ionicons name="bus" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.summaryLabelLight}>VIAJES REALIZADOS</Text>
            <Text style={styles.summaryValueLight}>32</Text>
          </View>
        </View>

        {/* ── LISTA RECIENTES ── */}
        <Text style={styles.sectionTitle}>RECIENTES</Text>

        <View style={[styles.tripCard, styles.tripCardActive]}>
          <View style={[styles.tripIconWrapper, { backgroundColor: '#E0E7FF' }]}>
            <Ionicons name="bus" size={20} color={tokens.colors.primary} />
          </View>
          <View style={styles.tripInfo}>
            <Text style={styles.tripTitle}>Chacao - Las Mercedes</Text>
            <View style={styles.tripSubtitleRow}>
              <Text style={styles.tripSubtitle}>Hoy, 08:45 AM</Text>
              <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}>
                <View style={[styles.badgeDot, { backgroundColor: tokens.colors.primary }]} />
                <Text style={[styles.badgeText, { color: tokens.colors.primary }]}>EN CURSO</Text>
              </View>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={[styles.priceCurrency, { color: tokens.colors.primary }]}>Bs.</Text>
            <Text style={[styles.priceAmount, { color: tokens.colors.primary }]}>15,00</Text>
          </View>
        </View>

        <View style={styles.tripCard}>
          <View style={[styles.tripIconWrapper, { backgroundColor: '#ECFDF5' }]}>
            <MaterialCommunityIcons name="train" size={22} color="#0F766E" />
          </View>
          <View style={styles.tripInfo}>
            <Text style={styles.tripTitle}>Palo Verde - Propatria</Text>
            <View style={styles.tripSubtitleRow}>
              <Text style={styles.tripSubtitle}>Ayer, 17:30 PM</Text>
              <View style={[styles.badge, { backgroundColor: '#F3F4F6' }]}>
                <View style={[styles.badgeDot, { backgroundColor: '#9CA3AF' }]} />
                <Text style={[styles.badgeText, { color: '#6B7280' }]}>COMPLETADO</Text>
              </View>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={[styles.priceCurrency, { color: tokens.colors.primary }]}>Bs.</Text>
            <Text style={[styles.priceAmount, { color: '#4B5563' }]}>10,00</Text>
          </View>
        </View>

        <View style={styles.tripCard}>
          <View style={[styles.tripIconWrapper, { backgroundColor: '#EEF2FF' }]}>
            <MaterialCommunityIcons name="bus-multiple" size={22} color="#6366F1" />
          </View>
          <View style={styles.tripInfo}>
            <Text style={styles.tripTitle}>Altamira - El Hatillo</Text>
            <View style={styles.tripSubtitleRow}>
              <Text style={styles.tripSubtitle}>12 Oct, 10:15 AM</Text>
              <View style={[styles.badge, { backgroundColor: '#F3F4F6' }]}>
                <View style={[styles.badgeDot, { backgroundColor: '#9CA3AF' }]} />
                <Text style={[styles.badgeText, { color: '#6B7280' }]}>COMPLETADO</Text>
              </View>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={[styles.priceCurrency, { color: '#6B7280' }]}>Bs.</Text>
            <Text style={[styles.priceAmount, { color: '#4B5563' }]}>25,00</Text>
          </View>
        </View>

        <View style={styles.tripCard}>
          <View style={[styles.tripIconWrapper, { backgroundColor: '#E0E7FF' }]}>
            <Ionicons name="bus" size={20} color={tokens.colors.primary} />
          </View>
          <View style={styles.tripInfo}>
            <Text style={styles.tripTitle}>La Paz - Montalbán</Text>
            <View style={styles.tripSubtitleRow}>
              <Text style={styles.tripSubtitle}>11 Oct, 14:20 PM</Text>
              <View style={[styles.badge, { backgroundColor: '#F3F4F6' }]}>
                <View style={[styles.badgeDot, { backgroundColor: '#9CA3AF' }]} />
                <Text style={[styles.badgeText, { color: '#6B7280' }]}>COMPLETADO</Text>
              </View>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={[styles.priceCurrency, { color: '#6B7280' }]}>Bs.</Text>
            <Text style={[styles.priceAmount, { color: '#4B5563' }]}>15,00</Text>
          </View>
        </View>

        {/* ── MAPA RUTA FRECUENTE ── */}
        <View style={styles.mapCard}>
          {/* Usamos un placeholder genérico de mapa estético porque no hay assets de mapa en el repo */}
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80' }}
            style={styles.mapImage}
          />
          <View style={styles.mapOverlay}>
            <Text style={styles.mapText}>
              Tu ruta más frecuente: <Text style={styles.mapTextHighlight}>Chacao - Mercedes</Text>
            </Text>
          </View>
        </View>

        {/* Extra space for absolute tabs */}
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  menuBtn: {
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  titleSection: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 32,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.textDark,
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.regular,
    color: tokens.colors.textGray,
  },
  filtersContainer: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  filterTab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#E2E8F0',
    borderRadius: 24,
    marginRight: 12,
  },
  filterTabActive: {
    backgroundColor: tokens.colors.primary,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  filterText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#4B5563',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontFamily: tokens.typography.fontFamily.bold,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 36,
  },
  summaryCardWhite: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  summaryCardBlue: {
    flex: 1,
    backgroundColor: tokens.colors.primary,
    borderRadius: 24,
    padding: 20,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  summaryIconWhiteBg: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
  },
  summaryIconBlueBg: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
  },
  summaryLabelGrey: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValueDark: {
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.textDark,
  },
  summaryLabelLight: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValueLight: {
    fontSize: 24,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#6B7280',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  tripCardActive: {
    borderColor: '#E0E7FF',
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.primary,
  },
  tripIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  tripInfo: {
    flex: 1,
    marginRight: 8,
  },
  tripTitle: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
    marginBottom: 6,
  },
  tripSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  tripSubtitle: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#9CA3AF',
    marginRight: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  priceContainer: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    minWidth: 45,
  },
  priceCurrency: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    marginBottom: -2,
  },
  priceAmount: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.black,
  },
  mapCard: {
    height: 160,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: '#E2E8F0',
  },
  mapImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    opacity: 0.8,
  },
  mapOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  mapText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  mapTextHighlight: {
    color: '#93C5FD', // light blue to pop on dark overlay
  },
});
