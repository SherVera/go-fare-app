import { Ionicons } from '@expo/vector-icons';
import { Tabs, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { PendingApprovalScreen } from '@/components/PendingApprovalScreen';
import { getBackendProfile, getMyTransportOwnerProfile } from '@/lib/api';
import { tokens } from '@/theme/tokens';

export default function VehicleOwnerLayout() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);

  const checkApprovalStatus = useCallback(async () => {
    try {
      // 1. Consultar estado real del dueño de vehículo en PostgreSQL (GET /transport-owners/me)
      const ownerProfile = await getMyTransportOwnerProfile();
      if (
        ownerProfile &&
        (ownerProfile.uuid || ownerProfile.id || ownerProfile.status)
      ) {
        setIsApproved(ownerProfile.status === 'approved');
        return;
      }

      // 2. Fallback: perfil general y roles
      const profile = await getBackendProfile();
      const roles = (profile as any)?.roles || [];
      const isAdmin = roles.some(
        (r: any) =>
          (r?.name || r || '').toLowerCase() === 'platform_admin' ||
          (r?.name || r || '').toLowerCase() === 'admin',
      );
      if (isAdmin) {
        setIsApproved(true);
        return;
      }

      const ownerObj =
        (profile as any)?.transportOwner || (profile as any)?.transport_owner;
      const status =
        ownerObj?.status ||
        (profile as any)?.ownerStatus ||
        (profile as any)?.status;

      setIsApproved(status === 'approved');
    } catch (err) {
      console.warn('[VehicleOwnerLayout] Error checking approval status:', err);
      setIsApproved((prev) => (prev !== null ? prev : false));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkApprovalStatus();
  }, [checkApprovalStatus]);

  useFocusEffect(
    useCallback(() => {
      checkApprovalStatus();
    }, [checkApprovalStatus]),
  );

  if (loading) {
    return <AppLoadingScreen message="Verificando estado de tu cuenta..." />;
  }

  if (isApproved === false) {
    return (
      <PendingApprovalScreen
        onApproved={() => {
          setIsApproved(true);
        }}
      />
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tokens.colors.primary,
        tabBarInactiveTintColor: tokens.colors.textGray,
        tabBarLabelStyle: {
          fontFamily: tokens.typography.fontFamily.bold,
          fontSize: 10,
          marginBottom: Platform.OS === 'android' ? 8 : 4,
        },
        tabBarStyle: {
          height: 70 + (insets.bottom > 0 ? insets.bottom : 15),
          paddingBottom: insets.bottom > 0 ? insets.bottom : 15,
          paddingTop: 12,
          borderTopWidth: 0,
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 35,
          borderTopRightRadius: 35,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.08,
          shadowRadius: 15,
          elevation: 20,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'BUSES',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'bus' : 'bus-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'INGRESOS',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'analytics' : 'analytics-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="drivers"
        options={{
          title: 'CONDUCTORES',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'PERFIL',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      {/* Ocultar la pantalla dinámica del menú de pestañas */}
      <Tabs.Screen
        name="[id]"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
