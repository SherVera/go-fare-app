import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const BACKEND_JWT_KEY = 'backend_jwt';

// ── Token storage ────────────────────────────────────────────────────────────

export const getBackendJwt = () => AsyncStorage.getItem(BACKEND_JWT_KEY);
export const setBackendJwt = (token: string) =>
  AsyncStorage.setItem(BACKEND_JWT_KEY, token);
export const clearBackendJwt = () => AsyncStorage.removeItem(BACKEND_JWT_KEY);

// ── HTTP helpers ─────────────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const jwt = await getBackendJwt();
  return jwt ? { Authorization: `Bearer ${jwt}` } : {};
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[api] ${options.method ?? 'GET'} ${path} → ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export const apiGet = <T>(path: string) => request<T>(path);
export const apiPost = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });

// ── Firebase → Backend auth exchange ────────────────────────────────────────

export interface BackendUser {
  id: string;
  email?: string;
  displayName?: string;
  phoneNumber?: string;
  provider: string;
  profilePhoto?: string;
}

export interface BackendAuthResponse {
  user: BackendUser;
  token: string;
}

/**
 * Exchanges a Firebase ID token for a backend JWT.
 * Stores the JWT in AsyncStorage so subsequent API calls are authenticated.
 */
export async function syncWithBackend(
  firebaseUser: FirebaseAuthTypes.User,
): Promise<BackendAuthResponse> {
  const idToken = await firebaseUser.getIdToken();

  const response = await request<BackendAuthResponse>(
    '/api/v1/auth/firebase-login',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    },
  );

  await setBackendJwt(response.token);
  return response;
}
