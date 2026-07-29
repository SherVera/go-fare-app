import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import * as SecureStore from 'expo-secure-store';
import { clearBackendJwt } from '@/lib/api';
import { auth, sigOutAccount } from '@/lib/firebase';

type AuthUser = FirebaseAuthTypes.User | null;

let resolveSession: ((user: AuthUser) => Promise<void>) | null = null;

/** Registrado desde `_layout.tsx` para poder re-evaluar fase (p. ej. tras onboarding). */
export function registerAuthSessionResolver(
  cb: (user: AuthUser) => Promise<void>,
) {
  resolveSession = cb;
}

/** Llama tras actualizar Firestore para que el guardián pase a `signed_in` si el perfil ya está completo. */
export async function refreshAuthSessionPhase() {
  await resolveSession?.(auth.currentUser ?? null);
}

/**
 * Cierra la sesión del usuario de forma completa y garantizada:
 * Limpia primero la caché local, credenciales, tokens JWT y bypasses antes de cerrar Firebase Auth.
 */
export async function purgeUserSessionAndLogout(): Promise<void> {
  try {
    await clearBackendJwt();
  } catch (e) {
    console.warn('[Logout] Error al limpiar JWT backend:', e);
  }
  try {
    await SecureStore.deleteItemAsync('savedEmail');
    await SecureStore.deleteItemAsync('savedPassword');
    await SecureStore.deleteItemAsync('user_role');
  } catch (e) {
    console.warn('[Logout] Error al eliminar ítems de SecureStore:', e);
  }
  try {
    await AsyncStorage.removeItem('gofare_cached_user_profile');
    await AsyncStorage.removeItem('temp_auth');
    await AsyncStorage.removeItem('phone_verified_bypass');
    await AsyncStorage.removeItem('auth_method');
    await AsyncStorage.removeItem('isBiometricsEnabled');
  } catch (e) {
    console.warn('[Logout] Error al eliminar ítems de AsyncStorage:', e);
  }

  try {
    await sigOutAccount();
  } catch (authError) {
    console.warn('[Logout] Error al cerrar sesión de Firebase:', authError);
  }
}
