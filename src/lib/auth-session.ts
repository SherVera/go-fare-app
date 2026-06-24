import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { auth } from '@/lib/firebase';

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
