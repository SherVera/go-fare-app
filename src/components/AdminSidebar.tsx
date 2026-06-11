import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { clearBackendJwt } from '@/lib/api';
import { sigOutAccount } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';
import { useAdminSidebar } from './AdminSidebarContext';

export function AdminSidebar() {
  const { isOpen, setIsOpen } = useAdminSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const { width } = Dimensions.get('window');

  // Sidebar width: 75% of screen width, max 280px
  const sidebarWidth = Math.min(width * 0.75, 280);

  const slideAnim = useRef(new Animated.Value(-sidebarWidth)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -sidebarWidth,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldRender(false);
      });
    }
  }, [isOpen, sidebarWidth, slideAnim, fadeAnim]);

  const handleNavigate = (route: string) => {
    setIsOpen(false);
    // Switch to the target admin screen
    router.replace(route as any);
  };

  const handleLogout = async () => {
    setIsOpen(false);
    try {
      await sigOutAccount();
      await clearBackendJwt();
    } catch (err) {
      console.warn('[AdminSidebar] Error logging out:', err);
    }
  };

  const menuSections = [
    {
      title: 'Principal',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: 'grid',
          route: '/admin/dashboard',
        },
      ],
    },
    {
      title: 'Seguridad y Usuarios',
      items: [
        {
          id: 'users',
          label: 'Usuarios',
          icon: 'people',
          route: '/admin/users',
        },
        {
          id: 'civil-associations',
          label: 'Asoc. Civiles',
          icon: 'business',
          route: '/admin/civil-associations',
        },
      ],
    },
    {
      title: 'Flota y Control',
      items: [
        {
          id: 'documents',
          label: 'Documentos',
          icon: 'document-text',
          route: '/admin/documents',
        },
        {
          id: 'transport-units',
          label: 'Unidades',
          icon: 'bus',
          route: '/admin/transport-units',
        },
        {
          id: 'owner-requests',
          label: 'Solicitudes Socios',
          icon: 'file-tray-full',
          route: '/admin/owner-requests',
        },
      ],
    },
    {
      title: 'Finanzas',
      items: [
        {
          id: 'rates',
          label: 'Tasas y Tarifas',
          icon: 'trending-up',
          route: '/admin/rates',
        },
      ],
    },
  ];

  if (!shouldRender) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Backdrop overlay */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable
          style={styles.backdropPressable}
          onPress={() => setIsOpen(false)}
        />
      </Animated.View>

      {/* Sidebar Content Card */}
      <Animated.View
        style={[
          styles.sidebarCard,
          {
            width: sidebarWidth,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {/* Header Section */}
        <View style={styles.sidebarHeader}>
          <View style={styles.logoWrapper}>
            <Ionicons name="shield-checkmark" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.headerTextWrapper}>
            <Text style={styles.logoTitle}>GoFare Admin</Text>
            <Text style={styles.logoSubtitle}>Consola de Control</Text>
          </View>
        </View>

        {/* Navigation Items List grouped by sections */}
        <ScrollView
          style={styles.menuScroll}
          contentContainerStyle={styles.menuScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {menuSections.map((section, secIdx) => (
            <View
              key={section.title}
              style={[styles.sectionContainer, secIdx > 0 && { marginTop: 14 }]}
            >
              <Text style={styles.sectionHeader}>{section.title}</Text>
              <View style={styles.sectionItems}>
                {section.items.map((item) => {
                  const isActive = pathname === item.route;
                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.menuItem,
                        isActive && styles.menuItemActive,
                      ]}
                      onPress={() => handleNavigate(item.route)}
                    >
                      <Ionicons
                        name={
                          isActive
                            ? (item.icon as any)
                            : (`${item.icon}-outline` as any)
                        }
                        size={20}
                        color={isActive ? tokens.colors.primary : '#64748B'}
                        style={styles.menuIcon}
                      />
                      <Text
                        style={[
                          styles.menuLabel,
                          isActive && styles.menuLabelActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Footer Section (User Profile and Logout) */}
        <View style={styles.sidebarFooter}>
          <View style={styles.profileRow}>
            <View style={styles.profileAvatar}>
              <Text style={styles.avatarText}>A</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>Administrador</Text>
              <Text style={styles.profileRole}>Soporte GoFare</Text>
            </View>
          </View>

          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Cerrar Sesión</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    zIndex: 9998,
  },
  backdropPressable: {
    flex: 1,
  },
  sidebarCard: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 9999,
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 25,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 36,
    paddingHorizontal: 4,
  },
  logoWrapper: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTextWrapper: {
    justifyContent: 'center',
  },
  logoTitle: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  logoSubtitle: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  menuScroll: {
    flex: 1,
    marginVertical: 4,
  },
  menuScrollContent: {
    paddingBottom: 16,
  },
  sectionContainer: {
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 9,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    marginBottom: 6,
    paddingHorizontal: 12,
  },
  sectionItems: {
    gap: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  menuItemActive: {
    backgroundColor: '#EFF6FF',
  },
  menuIcon: {
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
  },
  menuLabelActive: {
    color: tokens.colors.primary,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  sidebarFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 18,
    gap: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  profileAvatar: {
    width: 38,
    height: 38,
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
  profileInfo: {
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#334155',
  },
  profileRole: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#94A3B8',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  logoutText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#EF4444',
    marginLeft: 8,
  },
});
