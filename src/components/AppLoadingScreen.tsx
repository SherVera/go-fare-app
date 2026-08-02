import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';

interface AppLoadingScreenProps {
  message?: string;
}

export function AppLoadingScreen({
  message = 'Cargando tu información...',
}: AppLoadingScreenProps) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.logoWrapper}>
          <Text style={styles.brandTitle}>GoFare</Text>
        </View>

        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={tokens.colors.primary} />
          <Text style={styles.loadingMessage}>{message}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 48,
  },
  brandTitle: {
    fontSize: 28,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
  },
  loaderContainer: {
    alignItems: 'center',
    gap: 16,
  },
  loadingMessage: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    textAlign: 'center',
  },
});
