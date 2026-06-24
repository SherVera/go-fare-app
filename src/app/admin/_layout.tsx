import { Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminSidebarProvider } from '@/components/AdminSidebarContext';

export default function AdminLayout() {
  return (
    <AdminSidebarProvider>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
        <AdminSidebar />
      </View>
    </AdminSidebarProvider>
  );
}
