import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { clearBackendJwt, getBackendProfile } from '@/lib/api';
import { auth, sigOutAccount } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';
import { useAdminSidebar } from './AdminSidebarContext';

const STATS_CACHE_KEY = 'gofare_admin_dashboard_stats';

export function AdminSidebar() {
  const { isOpen, setIsOpen } = useAdminSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const { width } = Dimensions.get('window');

  // Sidebar width: 75% of screen width, max 280px
  const sidebarWidth = Math.min(width * 0.75, 290);

  const slideAnim = useRef(new Animated.Value(-sidebarWidth)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [pendingCounts, setPendingCounts] = useState<{
    pendingDocs: number;
    pendingOwners: number;
  }>({ pendingDocs: 0, pendingOwners: 0 });

  // Perfil del usuario autenticado
  const [userName, setUserName] = useState<string>(() => {
    const cu = auth.currentUser;
    return (
      cu?.displayName || (cu?.email ? cu.email.split('@')[0] : 'Administrador')
    );
  });
  const [userRole, setUserRole] = useState<string>(() => {
    const cu = auth.currentUser;
    return cu?.email || 'Soporte GoFare';
  });
  const [userInitial, setUserInitial] = useState<string>(() => {
    const cu = auth.currentUser;
    const name = cu?.displayName || (cu?.email ? cu.email.split('@')[0] : 'A');
    return name.charAt(0).toUpperCase();
  });

  useEffect(() => {
    if (isOpen) {
      // 1. Obtener de Firebase currentUser inmediato
      const cu = auth.currentUser;
      if (cu) {
        const name =
          cu.displayName ||
          (cu.email ? cu.email.split('@')[0] : 'Administrador');
        setUserName(name);
        setUserInitial(name.charAt(0).toUpperCase());
        if (cu.email) setUserRole(cu.email);
      }

      // 2. Obtener de caché local de perfil si existe
      AsyncStorage.getItem('gofare_cached_user_profile')
        .then((str) => {
          if (str) {
            const parsed = JSON.parse(str);
            const resolvedName =
              parsed.displayName ||
              parsed.fullName ||
              (parsed.firstName
                ? `${parsed.firstName} ${parsed.lastName || ''}`.trim()
                : null);
            if (resolvedName) {
              setUserName(resolvedName);
              setUserInitial(resolvedName.charAt(0).toUpperCase());
            }
            if (parsed.email) {
              setUserRole(parsed.email);
            }
          }
        })
        .catch(() => {});

      // 3. Consultar datos actualizados de backend
      getBackendProfile()
        .then((bUser) => {
          if (bUser) {
            const bName =
              bUser.displayName ||
              `${bUser.firstName || ''} ${bUser.lastName || ''}`.trim() ||
              bUser.email ||
              'Administrador';
            setUserName(bName);
            setUserInitial(bName.charAt(0).toUpperCase() || 'A');
            if (bUser.email) {
              setUserRole(bUser.email);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      AsyncStorage.getItem(STATS_CACHE_KEY)
        .then((str) => {
          if (str) {
            const parsed = JSON.parse(str);
            setPendingCounts({
              pendingDocs: parsed.pendingDocs || 0,
              pendingOwners: parsed.pendingOwners || 0,
            });
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

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
    try {
      Haptics.selectionAsync();
    } catch {}
    setIsOpen(false);
    // Switch to the target admin screen
    router.replace(route as any);
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Deseas salir del panel de administración de GoFare?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            setIsOpen(false);
            try {
              await sigOutAccount();
              await clearBackendJwt();
              router.replace('/login');
            } catch (err) {
              console.warn('[AdminSidebar] Error logging out:', err);
            }
          },
        },
      ],
    );
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
          label: 'Solicitudes de Afiliación',
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
                  const count =
                    item.id === 'documents'
                      ? pendingCounts.pendingDocs
                      : item.id === 'owner-requests'
                        ? pendingCounts.pendingOwners
                        : 0;

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
                      {count > 0 && (
                        <View style={styles.menuBadge}>
                          <Text style={styles.menuBadgeText}>{count}</Text>
                        </View>
                      )}
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
              <Text style={styles.avatarText}>{userInitial}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>
                {userName}
              </Text>
              <Text style={styles.profileRole} numberOfLines={1}>
                {userRole}
              </Text>
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
    flex: 1,
  },
  menuLabelActive: {
    color: tokens.colors.primary,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  menuBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 6,
  },
  menuBadgeText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
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
    flex: 1,
    justifyContent: 'center',
    marginRight: 6,
  },
  profileName: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  profileRole: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    marginTop: 1,
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
