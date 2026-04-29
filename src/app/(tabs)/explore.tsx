import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '@/theme/tokens';
import { Button } from '@/components/Button';

export default function ExploreScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="checkmark-circle" size={80} color={tokens.colors.iconGreen} />
        </View>
        <Text style={styles.title}>¡Sesión Iniciada!</Text>
        <Text style={styles.subtitle}>
          Bienvenido al panel principal de GoFare.
        </Text>

        <Button
          title="Volver"
          onPress={() => router.back()}
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
  },
  iconContainer: {
    marginBottom: tokens.spacing.lg,
  },
  title: {
    fontSize: tokens.typography.sizes.xl,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.textDark,
    marginBottom: tokens.spacing.sm,
  },
  subtitle: {
    fontSize: tokens.typography.sizes.md,
    fontFamily: tokens.typography.fontFamily.regular,
    color: tokens.colors.textGray,
    textAlign: 'center',
    marginBottom: tokens.spacing.xxl,
  },
  button: {
    width: '100%',
  },
});
