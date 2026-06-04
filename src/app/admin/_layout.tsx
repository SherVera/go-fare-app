import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';

export default function AdminLayout() {
  const insets = useSafeAreaInsets();

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
          shadowColor: '#1E293B',
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
          title: 'DASHBOARD',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'grid' : 'grid-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'USUARIOS',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: 'DOCUMENTOS',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'document-text' : 'document-text-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="transport-units"
        options={{
          title: 'UNIDADES',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'bus' : 'bus-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="owner-requests"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
