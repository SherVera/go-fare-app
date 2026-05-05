import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_700Bold,
  Outfit_900Black,
} from '@expo-google-fonts/outfit';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const router = useRouter();
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const [loaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_700Bold,
    Outfit_900Black,
  });

  // 1. Escuchar el estado de autenticación de Firebase Nativo
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
      } else {
        // 🚧 Modo temporal: verificar si hay sesión por cédula guardada
        const tempAuth = await AsyncStorage.getItem('temp_auth');
        setIsAuthenticated(tempAuth === 'true');
      }
    });
    return unsubscribe;
  }, []);

  // 2. Guardián Global de Rutas (Auth Guard de Expo Router)
  useEffect(() => {
    // Esperamos a que las fuentes carguen y Firebase responda si hay sesión
    if (!loaded || isAuthenticated === null) return;

    // ¿El usuario está navegando dentro de la app principal?
    const inTabsGroup = segments[0] === '(tabs)';

    if (isAuthenticated && !inTabsGroup) {
      // Si tiene sesión activa pero está en el Landing o Login, forzar redirección al Perfil
      router.replace('/(tabs)' as any);
    } else if (!isAuthenticated && inTabsGroup) {
      // Si no tiene sesión pero intenta entrar a la App, expulsarlo al Landing
      router.replace('/landing');
    }
  }, [isAuthenticated, loaded, segments]);

  // 3. Ocultar la pantalla de carga solo cuando tengamos fuentes y sesión verificada
  useEffect(() => {
    if (loaded && isAuthenticated !== null) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isAuthenticated]);

  if (!loaded || isAuthenticated === null) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
