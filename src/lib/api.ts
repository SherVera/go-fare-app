import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type {
  BackendFareAccount,
  BackendTicket,
  BackendUser,
  FirebaseEmailRegisterDto,
  FirebaseIssuedCredentialsDto,
} from '@/interfaces';
import { auth, sigOutAccount } from './firebase';

let resolvedBaseUrl = process.env.EXPO_PUBLIC_API_URL;

// Sanitización automática: asegurar que siempre contenga el prefijo /api/v1 requerido por el backend NestJS
if (resolvedBaseUrl && !resolvedBaseUrl.includes('/api/v1')) {
  const cleanUrl = resolvedBaseUrl.endsWith('/')
    ? resolvedBaseUrl.slice(0, -1)
    : resolvedBaseUrl;
  resolvedBaseUrl = `${cleanUrl}/api/v1`;
}

export const BASE_URL = resolvedBaseUrl;
console.log('[API] Resolved BASE_URL:', BASE_URL);
const GOFARE_JWT_KEY = 'gofare_jwt_token';
const BACKEND_JWT_KEY = 'backend_jwt';

/**
 * Guarda el token JWT de GoFare en el almacenamiento local cifrado de forma segura.
 */
export async function saveGoFareToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(GOFARE_JWT_KEY, token);
    await SecureStore.setItemAsync(BACKEND_JWT_KEY, token);
  } catch (error) {
    console.error('[API] Error al guardar el token JWT en SecureStore:', error);
  }
}

/**
 * Obtiene el token JWT de GoFare desde el almacenamiento local cifrado de forma segura.
 */
export async function getGoFareToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(GOFARE_JWT_KEY);
  } catch (error) {
    console.error('[API] Error al obtener el token JWT de SecureStore:', error);
    return null;
  }
}

/**
 * Elimina el token JWT de GoFare del almacenamiento local cifrado de forma segura.
 */
export async function clearGoFareToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(GOFARE_JWT_KEY);
    await SecureStore.deleteItemAsync(BACKEND_JWT_KEY);
  } catch (error) {
    console.error(
      '[API] Error al eliminar el token JWT de SecureStore:',
      error,
    );
  }
}

// Mapeos de compatibilidad para la rama dev
export const getBackendJwt = getGoFareToken;
export const setBackendJwt = saveGoFareToken;
export const clearBackendJwt = clearGoFareToken;

export interface BackendAuthResponse {
  user: BackendUser;
  token: string;
}

/**
 * Intercambia un ID token de Firebase por el token JWT del backend.
 */
export async function syncWithBackend(
  firebaseUser: FirebaseAuthTypes.User | null,
): Promise<BackendAuthResponse> {
  if (!firebaseUser) {
    throw new Error('Usuario de Firebase no autenticado.');
  }

  let idToken = '';
  try {
    idToken = await firebaseUser.getIdToken();
  } catch (tErr) {
    console.warn('[API] error al obtener idToken, usando fallback:', tErr);
    idToken = 'mock-id-token-bypass';
  }

  if (
    !idToken ||
    idToken === 'mock-id-token-bypass' ||
    idToken.startsWith('mock-')
  ) {
    // Bypass de autenticación para desarrollo:
    await saveGoFareToken('mock-gofare-jwt-token-bypass');
    return {
      token: 'mock-gofare-jwt-token-bypass',
      user: {
        id: `local-usr-${firebaseUser.uid}`,
        uuid: `local-usr-${firebaseUser.uid}`,
        email:
          firebaseUser.email ||
          (firebaseUser.phoneNumber
            ? `${firebaseUser.phoneNumber.replace('+', '')}@gofare.app`
            : 'usuario@gofare.app'),
        phoneNumber: firebaseUser.phoneNumber || undefined,
        firstName: firebaseUser.displayName
          ? firebaseUser.displayName.split(' ')[0]
          : 'Usuario',
        lastName: firebaseUser.displayName
          ? firebaseUser.displayName.split(' ').slice(1).join(' ') || 'GoFare'
          : 'GoFare',
        displayName:
          firebaseUser.displayName ||
          (firebaseUser.phoneNumber
            ? `Usuario ${firebaseUser.phoneNumber}`
            : 'Usuario GoFare'),
        provider: 'phone',
        providerId: firebaseUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }

  try {
    const response = await loginWithFirebaseToken(idToken);
    return response;
  } catch (err: any) {
    console.warn(
      '[API] syncWithBackend falló la conexión con el servidor backend, usando fallback local resiliente:',
      err?.message || err,
    );
    await saveGoFareToken('mock-gofare-jwt-token-bypass');
    return {
      token: 'mock-gofare-jwt-token-bypass',
      user: {
        id: `local-usr-${firebaseUser.uid}`,
        uuid: `local-usr-${firebaseUser.uid}`,
        email:
          firebaseUser.email ||
          (firebaseUser.phoneNumber
            ? `${firebaseUser.phoneNumber.replace('+', '')}@gofare.app`
            : 'usuario@gofare.app'),
        phoneNumber: firebaseUser.phoneNumber || undefined,
        firstName: firebaseUser.displayName
          ? firebaseUser.displayName.split(' ')[0]
          : 'Usuario',
        lastName: firebaseUser.displayName
          ? firebaseUser.displayName.split(' ').slice(1).join(' ') || 'GoFare'
          : 'GoFare',
        displayName:
          firebaseUser.displayName ||
          (firebaseUser.phoneNumber
            ? `Usuario ${firebaseUser.phoneNumber}`
            : 'Usuario GoFare'),
        provider: firebaseUser.providerData?.[0]?.providerId || 'phone',
        providerId: firebaseUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }
}

function sanitizeNumericFields(data: any): any {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(sanitizeNumericFields);
  }
  if (typeof data === 'object') {
    const copy = { ...data };
    for (const key in copy) {
      if (Object.hasOwn(copy, key)) {
        if (copy[key] && typeof copy[key] === 'object') {
          copy[key] = sanitizeNumericFields(copy[key]);
        }
      }
    }
    if (
      'balance' in copy &&
      copy.balance !== undefined &&
      copy.balance !== null
    ) {
      copy.balance = Number(copy.balance);
    }
    if ('price' in copy && copy.price !== undefined && copy.price !== null) {
      copy.price = Number(copy.price);
    }
    if ('amount' in copy && copy.amount !== undefined && copy.amount !== null) {
      copy.amount = Number(copy.amount);
    }
    if ('uuid' in copy && copy.uuid) {
      copy.id = copy.uuid;
    }
    return copy;
  }
  return data;
}

/**
 * Wrapper de fetch con tiempo de espera (timeout) para evitar que las peticiones se queden colgadas indefinidamente.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 120000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al conectar con el servidor.');
    }
    throw err;
  }
}

/**
 * Decodifica de forma segura la fecha de expiración (exp) en segundos de un JWT.
 */
function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    if (typeof atob === 'function') {
      const jsonStr = atob(base64);
      const parsed = JSON.parse(jsonStr);
      return typeof parsed.exp === 'number' ? parsed.exp : null;
    }
    return null;
  } catch {
    return null;
  }
}

let activeJwtRefreshPromise: Promise<string | null> | null = null;

/**
 * Renueva automáticamente el token JWT del backend utilizando Firebase Auth.
 */
export async function refreshBackendJwt(): Promise<string | null> {
  const fbUser = auth.currentUser;
  if (!fbUser) return null;

  if (activeJwtRefreshPromise) {
    return activeJwtRefreshPromise;
  }

  activeJwtRefreshPromise = (async () => {
    try {
      console.log('[API] Renovando token JWT de backend con Firebase...');
      const freshIdToken = await fbUser.getIdToken(true);
      if (!freshIdToken) return null;
      const result = await loginWithFirebaseToken(freshIdToken);
      if (result?.token) {
        console.log('[API] Token JWT renovado exitosamente.');
        return result.token;
      }
    } catch (err: any) {
      console.warn(
        '[API] Error al auto-renovar token JWT:',
        err?.message || err,
      );
    } finally {
      activeJwtRefreshPromise = null;
    }
    return null;
  })();

  return activeJwtRefreshPromise;
}

/**
 * Retorna un token JWT válido. Si el token en SecureStore expiró o no existe,
 * intenta renovarlo proactivamente mediante Firebase Auth antes de enviar la petición.
 */
export async function getValidGoFareToken(): Promise<string | null> {
  let token = await getGoFareToken();

  if (token === 'mock-gofare-jwt-token-bypass') {
    return token;
  }

  if (token) {
    const exp = decodeJwtExp(token);
    if (exp) {
      const expMs = exp * 1000;
      // Si faltan menos de 45 segundos para que expire, renovar proactivamente
      if (Date.now() >= expMs - 45000) {
        console.log(
          '[API] El token JWT ha expirado o está por expirar. Renovando...',
        );
        token = null;
      }
    }
  }

  if (!token && auth.currentUser) {
    token = await refreshBackendJwt();
  }

  return token;
}

/**
 * Wrapper personalizado para peticiones fetch que añade automáticamente la cabecera
 * de autorización Bearer si hay un token disponible, y maneja auto-renovación y reintentos.
 */
async function fetchWithAuth(
  path: string,
  options: RequestInit = {},
  timeoutMs?: number,
  isRetry = false,
): Promise<any> {
  const token = await getValidGoFareToken();

  if (token === 'mock-gofare-jwt-token-bypass') {
    // Interceptor de desarrollo para usuarios de bypass telefónico (offline / local)
    if (
      path === '/auth/profile' &&
      (options.method === 'GET' || !options.method)
    ) {
      const fbUser = auth.currentUser;
      const fbEmail =
        fbUser?.email ||
        (fbUser?.phoneNumber
          ? `${fbUser.phoneNumber.replace('+', '')}@gofare.app`
          : 'usuario@gofare.app');
      const fbName =
        fbUser?.displayName ||
        (fbUser?.phoneNumber
          ? `Usuario ${fbUser.phoneNumber}`
          : 'Usuario GoFare');
      const nameParts = fbName.split(' ');
      let mockProfile = {
        id: `local-usr-${fbUser?.uid || 'active'}`,
        uuid: `local-usr-${fbUser?.uid || 'active'}`,
        email: fbEmail,
        phoneNumber: fbUser?.phoneNumber || '+584120000000',
        firstName: nameParts[0] || 'Usuario',
        lastName: nameParts.slice(1).join(' ') || 'GoFare',
        displayName: fbName,
        nationalId: '',
        provider: fbUser?.providerData?.[0]?.providerId || 'phone',
        providerId: fbUser?.uid || 'mock-phone',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        const cachedMock = await AsyncStorage.getItem('mock_user_profile_data');
        if (cachedMock) {
          mockProfile = { ...mockProfile, ...JSON.parse(cachedMock) };
        }
      } catch {}
      return mockProfile;
    }

    if (path.startsWith('/users/') && options.method === 'PUT') {
      const body = JSON.parse((options.body as string) || '{}');
      const fbUser = auth.currentUser;
      const fbEmail =
        fbUser?.email ||
        (fbUser?.phoneNumber
          ? `${fbUser.phoneNumber.replace('+', '')}@gofare.app`
          : 'usuario@gofare.app');
      const fbName =
        fbUser?.displayName ||
        (fbUser?.phoneNumber
          ? `Usuario ${fbUser.phoneNumber}`
          : 'Usuario GoFare');
      const nameParts = fbName.split(' ');
      let mockProfile = {
        id: `local-usr-${fbUser?.uid || 'active'}`,
        uuid: `local-usr-${fbUser?.uid || 'active'}`,
        email: fbEmail,
        phoneNumber: fbUser?.phoneNumber || '+584120000000',
        firstName: nameParts[0] || 'Usuario',
        lastName: nameParts.slice(1).join(' ') || 'GoFare',
        displayName: fbName,
        nationalId: '',
        provider: fbUser?.providerData?.[0]?.providerId || 'phone',
        providerId: fbUser?.uid || 'mock-phone',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        const cachedMock = await AsyncStorage.getItem('mock_user_profile_data');
        if (cachedMock) {
          mockProfile = { ...mockProfile, ...JSON.parse(cachedMock) };
        }
      } catch {}

      const updatedProfile = {
        ...mockProfile,
        displayName: body.displayName || mockProfile.displayName,
        firstName: body.firstName || mockProfile.firstName,
        lastName: body.lastName || mockProfile.lastName,
        phoneNumber: body.phoneNumber || mockProfile.phoneNumber,
        nationalId: body.nationalId || mockProfile.nationalId,
        updatedAt: new Date().toISOString(),
      };

      try {
        await AsyncStorage.setItem(
          'mock_user_profile_data',
          JSON.stringify(updatedProfile),
        );
      } catch {}
      return updatedProfile;
    }

    if (path.startsWith('/fare/accounts/user/')) {
      return {
        id: 'local-acc-mock',
        balance: 100.0,
        userId: 'local-usr-mock',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    if (path === '/fare/me/top-up') {
      const body = JSON.parse((options.body as string) || '{}');
      const account = await getLocalFareAccount('local-usr-mock');
      const fareUsd = 0.25;
      const bcvRate = 40.0;
      const baseFareBs = fareUsd * bcvRate;
      const faresCredited = Math.max(
        1,
        Math.round((body.bsAmount || 10) / baseFareBs),
      );

      // Simulación probabilística del 70% de aprobación (según especificación de Sherman)
      const isApproved = Math.random() < 0.7;
      if (!isApproved) {
        throw new Error(
          'Rechazo bancario (simulado): La referencia no pudo ser verificada por la tesorería o ya fue utilizada.',
        );
      }

      account.balance += faresCredited;
      account.updatedAt = new Date().toISOString();
      await saveLocalFareAccount(account);

      const transactions = await getLocalTransactions(account.id);
      transactions.unshift({
        id: `tx-${Date.now()}`,
        accountId: account.id,
        amount: faresCredited,
        type: 'credit',
        description: `Recarga Pago Móvil Ref: ${body.reference || 'N/A'}`,
        createdAt: new Date().toISOString(),
      });
      await saveLocalTransactions(account.id, transactions);

      return {
        balanceFares: account.balance,
        faresCredited,
        bsAmount: body.bsAmount || 0,
      };
    }

    if (path.startsWith('/fare/transactions')) return [];
    if (path.startsWith('/tickets')) return [];
    if (path.startsWith('/rates/current')) {
      try {
        const cached = await AsyncStorage.getItem('gofare_rates_cache');
        if (cached) return JSON.parse(cached);
      } catch {}
      return {
        fareUsdValue: 0.25,
        bcvRate: 721.35,
        bcvRateDate: new Date().toISOString().slice(0, 10),
      };
    }

    if (path.startsWith('/rates/bcv') && options.method === 'POST') {
      const body = JSON.parse((options.body as string) || '{}');
      const targetDate = body.rateDate || new Date().toISOString().slice(0, 10);
      let current = {
        fareUsdValue: 0.25,
        bcvRate: Number(body.rate) || 40.0,
        bcvRateDate: targetDate,
      };
      try {
        const cached = await AsyncStorage.getItem('gofare_rates_cache');
        if (cached) {
          current = {
            ...JSON.parse(cached),
            bcvRate: Number(body.rate) || 40.0,
            bcvRateDate: targetDate,
          };
        }
      } catch {}
      await AsyncStorage.setItem('gofare_rates_cache', JSON.stringify(current));
      return current;
    }

    if (path.startsWith('/rates/fare-value') && options.method === 'POST') {
      const body = JSON.parse((options.body as string) || '{}');
      let current = {
        fareUsdValue: Number(body.usdValue) || 0.25,
        bcvRate: 721.35,
        bcvRateDate: new Date().toISOString().slice(0, 10),
      };
      try {
        const cached = await AsyncStorage.getItem('gofare_rates_cache');
        if (cached) {
          current = {
            ...JSON.parse(cached),
            fareUsdValue: Number(body.usdValue) || 0.25,
          };
        }
      } catch {}
      await AsyncStorage.setItem('gofare_rates_cache', JSON.stringify(current));
      return current;
    }

    if (path.startsWith('/rates/bcv/external')) {
      return {
        rate: 721.35,
        source: 'dolarapi',
        fetchedAt: new Date().toISOString(),
      };
    }

    return {};
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${BASE_URL}${path}`,
      {
        ...options,
        headers,
      },
      timeoutMs || 45000,
    );
  } catch (netErr: any) {
    // Si falla por timeout o error transitorio de red en una petición GET (ej. Render despertando), reintentar una vez
    const method = (options.method || 'GET').toUpperCase();
    if (!isRetry && method === 'GET') {
      console.log(
        `[API] Reintentando ${path} tras error de conexión (${netErr?.message || 'timeout'})...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return fetchWithAuth(path, options, timeoutMs, true);
    }
    throw netErr;
  }

  // Si la respuesta es No Content (204), retornamos null directamente
  if (response.status === 204) {
    return null;
  }

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Si obtenemos 401 Unauthorized y no hemos reintentado todavía:
    // Intentar renovar el token con Firebase y reintentar la petición de inmediato
    if (response.status === 401 && !isRetry && auth.currentUser) {
      console.log(
        `[API] 401 Unauthorized en ${path}. Intentando auto-renovar JWT y reintentar...`,
      );
      await clearGoFareToken();
      const freshToken = await refreshBackendJwt();
      if (freshToken) {
        return fetchWithAuth(path, options, timeoutMs, true);
      }
    }

    const errorMessage =
      responseData.message || `Error del servidor (${response.status})`;

    // Si persiste el 401 después de intentar renovar, limpiar sesión
    if (response.status === 401) {
      await clearGoFareToken();
      try {
        await sigOutAccount();
      } catch (logoutError) {
        console.warn(
          '[API] Error al forzar cierre de sesión tras 401:',
          logoutError,
        );
      }
    }

    throw new Error(errorMessage);
  }

  return sanitizeNumericFields(responseData);
}

// ─── MÉTODOS DE LA API ───────────────────────────────────────────────────────

/**
 * Registra un nuevo usuario en Firebase y el backend con un rol predeterminado.
 */
export async function registerWithEmail(
  dto: FirebaseEmailRegisterDto,
): Promise<FirebaseIssuedCredentialsDto> {
  try {
    const response = await fetchWithTimeout(
      `${BASE_URL}/auth/register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dto),
      },
      30000,
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const rawMessage = errorData.message;
      const formattedMessage = Array.isArray(rawMessage)
        ? rawMessage.join(', ')
        : typeof rawMessage === 'string'
          ? rawMessage
          : 'Error en el registro con el servidor backend.';
      throw new Error(formattedMessage);
    }

    return response.json();
  } catch (err: any) {
    if (
      err?.message === 'Network request failed' ||
      err?.name === 'TypeError' ||
      err?.message?.includes('agotado')
    ) {
      throw new Error(
        'No se pudo conectar con el servidor de autenticación. Por favor, verifica tu conexión a internet o intenta nuevamente.',
      );
    }
    throw err;
  }
}

/**
 * Busca un usuario en la base de datos PostgreSQL por su número de teléfono
 * y retorna el correo electrónico asociado para permitir inicio de sesión por teléfono + contraseña.
 */
export async function findEmailByPhone(
  phoneInput: string,
): Promise<string | null> {
  const cleaned = phoneInput.trim().replace(/[^0-9]/g, '');
  if (!cleaned || cleaned.length < 7) return null;

  const phoneDigits = cleaned.startsWith('0') ? cleaned.slice(1) : cleaned;
  const e164 = `+58${phoneDigits}`;
  const localWithZero = `0${phoneDigits}`;

  try {
    const response = await fetchWithTimeout(
      `${BASE_URL}/users`,
      { method: 'GET' },
      10000,
    );
    if (!response.ok) return null;
    const users: BackendUser[] = await response.json();
    if (!Array.isArray(users)) return null;

    const matchedUser = users.find((u) => {
      const uPhone = (u.phoneNumber || (u as any).phone_number || '').trim();
      if (!uPhone) return false;
      const uClean = uPhone.replace(/[^0-9]/g, '');
      return (
        uPhone === e164 ||
        uPhone === localWithZero ||
        uClean.endsWith(phoneDigits) ||
        phoneDigits.endsWith(uClean)
      );
    });

    return matchedUser?.email || null;
  } catch (err) {
    console.warn(
      '[findEmailByPhone] Error al buscar correo por teléfono:',
      err,
    );
    return null;
  }
}

/**
 * Crea un usuario directamente en PostgreSQL.
 * Permite guardar el phoneNumber en la creación inicial del usuario local.
 */
export async function createBackendUser(data: {
  provider: 'local' | 'google' | 'phone';
  providerId: string;
  email?: string;
  phoneNumber?: string;
  phone_number?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  roleIds?: string[];
}): Promise<BackendUser> {
  const cleanDto: Record<string, any> = {
    provider: data.provider,
    providerId: data.providerId,
  };

  if (data.email) cleanDto.email = data.email.trim();
  const phone = (data.phoneNumber || data.phone_number || '').trim();
  if (phone) cleanDto.phoneNumber = phone;
  if (data.firstName) cleanDto.firstName = data.firstName.trim();
  if (data.lastName) cleanDto.lastName = data.lastName.trim();
  if (data.displayName) cleanDto.displayName = data.displayName.trim();
  if (data.roleIds && data.roleIds.length > 0) cleanDto.roleIds = data.roleIds;

  const response = await fetchWithTimeout(
    `${BASE_URL}/users`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cleanDto),
    },
    30000,
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || 'Error al crear el usuario en el backend.',
    );
  }

  const user = await response.json();
  if (user) {
    user.id = user.uuid || user.id;
  }
  return user;
}

/**
 * Elimina un usuario de la base de datos PostgreSQL.
 */
export async function deleteBackendUser(userId: string): Promise<void> {
  await fetchWithAuth(`/users/${userId}`, {
    method: 'DELETE',
  });
}

/**
 * Envía un correo de verificación de email usando la API REST de Firebase Identity Toolkit.
 * Funciona con el idToken devuelto por el backend, sin necesidad de sesión nativa ni SHA-1.
 */
export async function sendFirebaseVerificationEmail(
  idToken: string,
): Promise<void> {
  const FIREBASE_API_KEY = Platform.select({
    ios:
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY_IOS ||
      'AIzaSyAptMIEEKqMB6M1K3IjWeaWxL6Ihi4RxL4',
    android:
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY_ANDROID ||
      'AIzaSyA9khlhufDxwggM-qC0acy9wmou1mrEtOQ',
    default:
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY_ANDROID ||
      'AIzaSyA9khlhufDxwggM-qC0acy9wmou1mrEtOQ',
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (Platform.OS === 'android') {
    headers['X-Android-Package'] = 'com.gofare.app';
  } else if (Platform.OS === 'ios') {
    headers['X-Ios-Bundle-Identifier'] = 'com.gofare.app';
  }

  const response = await fetchWithTimeout(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        requestType: 'VERIFY_EMAIL',
        idToken,
      }),
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.warn(
      '[API] Error al enviar correo de verificación:',
      JSON.stringify(errorData),
    );
    // No lanzamos error — el registro ya fue exitoso, el correo es opcional
  }
}

/**
 * Intercambia el ID Token de Firebase por el token JWT de la aplicación GoFare.
 */
export async function loginWithFirebaseToken(
  firebaseIdToken: string,
): Promise<{ token: string; user: BackendUser }> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${firebaseIdToken}`,
      },
    },
    30000,
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || 'Error en autenticación con el servidor.',
    );
  }

  const data = await response.json();
  if (data.token) {
    await saveGoFareToken(data.token);
  }
  if (data.user) {
    data.user.id = data.user.uuid || data.user.id;
  }
  return data;
}

/**
 * Obtiene el perfil del usuario autenticado actual desde el backend.
 */
export async function getBackendProfile(): Promise<BackendUser> {
  const responseData = await fetchWithAuth('/auth/profile');
  const user = responseData?.user || responseData;
  if (user) {
    user.id = user.uuid || user.id;
  }
  return user;
}

/**
 * Actualiza la cédula (nationalId) del usuario autenticado en PostgreSQL y sincroniza el claim de Firebase.
 */
export async function updateOwnNationalId(
  nationalId: string,
): Promise<BackendUser> {
  const token = await getGoFareToken();
  if (token === 'mock-gofare-jwt-token-bypass') {
    const fbUser = auth.currentUser;
    return {
      id: `local-usr-${fbUser?.uid || 'mock'}`,
      uuid: `local-usr-${fbUser?.uid || 'mock'}`,
      email: fbUser?.email || 'usuario@gofare.app',
      nationalId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;
  }

  const responseData = await fetchWithAuth('/auth/me/national-id', {
    method: 'PATCH',
    body: JSON.stringify({ nationalId }),
  });
  const user = responseData?.user || responseData;
  if (user) {
    user.id = user.uuid || user.id;
  }
  return user;
}

/**
 * Admin: Actualiza el número de teléfono de un usuario en Firebase Auth y en PostgreSQL (sin OTP).
 */
export async function adminUpdatePhone(
  userUuid: string,
  phoneNumber: string,
): Promise<BackendUser> {
  const token = await getGoFareToken();
  if (token === 'mock-gofare-jwt-token-bypass') {
    return {
      id: userUuid,
      uuid: userUuid,
      phoneNumber,
    } as any;
  }

  const responseData = await fetchWithAuth(`/auth/users/${userUuid}/phone`, {
    method: 'PATCH',
    body: JSON.stringify({ phoneNumber }),
  });
  const user = responseData?.user || responseData;
  if (user) {
    user.id = user.uuid || user.id;
  }
  return user;
}

/**
 * Actualiza los datos del usuario en el backend.
 */
export async function updateBackendProfile(
  userId: string,
  data: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    nationalId?: string;
  },
): Promise<BackendUser> {
  const token = await getGoFareToken();
  if (token === 'mock-gofare-jwt-token-bypass') {
    const responseData = await fetchWithAuth(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const user = responseData?.user || responseData;
    if (user) {
      user.id = user.uuid || user.id;
    }
    return user;
  }

  // Si se proporciona la cédula (nationalId), actualizarla via el endpoint dedicado del backend (PATCH /auth/me/national-id)
  if (data.nationalId) {
    try {
      await updateOwnNationalId(data.nationalId);
    } catch (natErr) {
      console.warn(
        '[updateBackendProfile] Error al actualizar nationalId:',
        natErr,
      );
    }
  }

  // Si se proporciona el teléfono (phoneNumber), intentar actualizarlo usando el endpoint PATCH /auth/users/:uuid/phone
  if (data.phoneNumber) {
    try {
      await adminUpdatePhone(userId, data.phoneNumber);
    } catch (phoneErr) {
      console.log(
        '[updateBackendProfile] PATCH /auth/users/:uuid/phone saltado (requiere rol admin o verificación OTP):',
        phoneErr,
      );
    }
  }

  // Se omiten phoneNumber y nationalId del cuerpo de la petición PUT /users/:id
  // porque el backend (UpdateUserDto) tiene ValidationPipe(forbidNonWhitelisted: true) y los rechaza con error 400.
  const whitelistedData: Partial<{
    displayName: string;
    firstName: string;
    lastName: string;
  }> = {};

  if (data.displayName !== undefined) {
    whitelistedData.displayName = data.displayName;
    const parts = data.displayName.trim().split(' ');
    whitelistedData.firstName = data.firstName || parts[0] || '';
    whitelistedData.lastName =
      data.lastName || parts.slice(1).join(' ') || parts[0] || '';
  } else {
    if (data.firstName !== undefined) {
      whitelistedData.firstName = data.firstName;
    }
    if (data.lastName !== undefined) {
      whitelistedData.lastName = data.lastName;
    }
  }

  const responseData = await fetchWithAuth(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(whitelistedData),
  });
  const user = responseData?.user || responseData;
  if (user) {
    user.id = user.uuid || user.id;
  }
  return user;
}

const LOCAL_FARE_ACCOUNT_PREFIX = 'gofare_local_fare_account_';
const LOCAL_TICKETS_PREFIX = 'gofare_local_tickets_';
const LOCAL_TRANSACTIONS_PREFIX = 'gofare_local_transactions_';

function isPhoneVerificationError(error: any): boolean {
  const msg = error?.message || '';
  return (
    msg.includes('phone/link') ||
    msg.includes('phone number') ||
    msg.includes('auth/phone/link')
  );
}

async function getLocalFareAccount(
  userId: string,
): Promise<BackendFareAccount> {
  const key = `${LOCAL_FARE_ACCOUNT_PREFIX}${userId}`;
  const data = await AsyncStorage.getItem(key);
  if (data) {
    const acc = JSON.parse(data);
    if (acc.balance === 100.0) {
      acc.balance = 0.0;
      await AsyncStorage.setItem(key, JSON.stringify(acc));
    }
    return acc;
  }
  const newAccount: BackendFareAccount = {
    id: `local-acc-${userId}`,
    userId,
    balance: 0.0, // Saldo inicial de 0 pasajes para pruebas locales
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(key, JSON.stringify(newAccount));
  return newAccount;
}

async function saveLocalFareAccount(
  account: BackendFareAccount,
): Promise<void> {
  const key = `${LOCAL_FARE_ACCOUNT_PREFIX}${account.userId}`;
  await AsyncStorage.setItem(key, JSON.stringify(account));
}

async function getLocalTickets(userId: string): Promise<BackendTicket[]> {
  const key = `${LOCAL_TICKETS_PREFIX}${userId}`;
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

async function saveLocalTickets(
  userId: string,
  tickets: BackendTicket[],
): Promise<void> {
  const key = `${LOCAL_TICKETS_PREFIX}${userId}`;
  await AsyncStorage.setItem(key, JSON.stringify(tickets));
}

async function getLocalTransactions(accountId: string): Promise<any[]> {
  const key = `${LOCAL_TRANSACTIONS_PREFIX}${accountId}`;
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

async function saveLocalTransactions(
  accountId: string,
  transactions: any[],
): Promise<void> {
  const key = `${LOCAL_TRANSACTIONS_PREFIX}${accountId}`;
  await AsyncStorage.setItem(key, JSON.stringify(transactions));
}

/**
 * Obtiene la cuenta de tarifa del usuario por su ID de usuario del backend.
 */
export async function getFareAccountByUserId(
  userId: string,
): Promise<BackendFareAccount> {
  try {
    return await fetchWithAuth(`/fare/accounts/user/${userId}`);
  } catch (err: any) {
    if (isPhoneVerificationError(err)) {
      console.log(
        '[API] Fallback a cuenta de tarifa local por requerimiento de teléfono.',
      );
      return await getLocalFareAccount(userId);
    }
    throw err;
  }
}

/**
 * Crea una nueva cuenta de tarifa para un usuario.
 */
export async function createFareAccount(
  userId: string,
): Promise<BackendFareAccount> {
  try {
    return await fetchWithAuth('/fare/accounts', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        balance: 0,
        isActive: true,
      }),
    });
  } catch (err: any) {
    if (isPhoneVerificationError(err)) {
      console.log('[API] Creando cuenta de tarifa local (mock).');
      return await getLocalFareAccount(userId);
    }
    throw err;
  }
}

/**
 * Añade saldo a la cuenta de tarifa del usuario.
 */
export async function addAccountBalance(
  accountId: string,
  amount: number,
): Promise<BackendFareAccount> {
  try {
    return await fetchWithAuth(`/fare/accounts/${accountId}/add-balance`, {
      method: 'POST',
      body: JSON.stringify({
        amount,
        description: 'Recarga saldo por la App Móvil',
      }),
    });
  } catch (err: any) {
    if (isPhoneVerificationError(err) || accountId.startsWith('local-')) {
      const userId = accountId.replace('local-acc-', '');
      const account = await getLocalFareAccount(userId);
      account.balance += amount;
      account.updatedAt = new Date().toISOString();
      await saveLocalFareAccount(account);

      // Registrar transacción local
      const transactions = await getLocalTransactions(accountId);
      transactions.unshift({
        id: `tx-${Date.now()}`,
        accountId,
        amount,
        type: 'credit',
        description: 'Recarga saldo por la App Móvil (Local)',
        createdAt: new Date().toISOString(),
      });
      await saveLocalTransactions(accountId, transactions);

      return account;
    }
    throw err;
  }
}

/**
 * Recarga real vía Pago Móvil / C2P: el backend verifica la referencia contra
 * la tesorería (POST /fare/me/top-up) y acredita solo si el pago es válido.
 */
export async function topUpBalance(data: {
  bsAmount: number;
  reference: string;
  phone?: string;
  document?: string;
  bankCode?: string;
}): Promise<{
  balanceFares: number;
  faresCredited: number;
  bsAmount: number;
}> {
  const cleanBsAmount = Math.round((Number(data.bsAmount) || 0) * 100) / 100;
  return await fetchWithAuth('/fare/me/top-up', {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      bsAmount: cleanBsAmount,
    }),
  });
}

/**
 * Deduce saldo de la cuenta de tarifa del usuario.
 */
export async function deductAccountBalance(
  accountId: string,
  amount: number,
): Promise<BackendFareAccount> {
  try {
    return await fetchWithAuth(`/fare/accounts/${accountId}/deduct-balance`, {
      method: 'POST',
      body: JSON.stringify({
        amount,
        description: 'Débito automático por viaje',
      }),
    });
  } catch (err: any) {
    if (isPhoneVerificationError(err) || accountId.startsWith('local-')) {
      const userId = accountId.replace('local-acc-', '');
      const account = await getLocalFareAccount(userId);
      if (account.balance < amount) {
        throw new Error('Saldo Insuficiente');
      }
      account.balance -= amount;
      account.updatedAt = new Date().toISOString();
      await saveLocalFareAccount(account);

      // Registrar transacción local
      const transactions = await getLocalTransactions(accountId);
      transactions.unshift({
        id: `tx-${Date.now()}`,
        accountId,
        amount,
        type: 'debit',
        description: 'Débito automático por viaje (Local)',
        createdAt: new Date().toISOString(),
      });
      await saveLocalTransactions(accountId, transactions);

      return account;
    }
    throw err;
  }
}

/**
 * Crea una transacción de tarifa en el backend (descuenta saldo y asocia ticket).
 */
export async function createFareTransaction(transactionData: {
  fareAccountId: string;
  amount: number;
  type: 'credit' | 'debit';
  transactionType: 'payment' | 'refund' | 'transfer' | 'ticket_purchase';
  description: string;
  ticketId?: string;
}): Promise<any> {
  try {
    return await fetchWithAuth('/fare/transactions', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  } catch (err: any) {
    if (
      isPhoneVerificationError(err) ||
      transactionData.fareAccountId.startsWith('local-')
    ) {
      // Mock local
      const userId = transactionData.fareAccountId.replace('local-acc-', '');
      const account = await getLocalFareAccount(userId);

      if (transactionData.type === 'debit') {
        if (account.balance < transactionData.amount) {
          throw new Error('Saldo Insuficiente');
        }
        account.balance -= transactionData.amount;
      } else {
        account.balance += transactionData.amount;
      }
      account.updatedAt = new Date().toISOString();
      await saveLocalFareAccount(account);

      const transactions = await getLocalTransactions(
        transactionData.fareAccountId,
      );
      const newTx = {
        id: `tx-${Date.now()}`,
        accountId: transactionData.fareAccountId,
        amount: transactionData.amount,
        type: transactionData.type,
        transactionType: transactionData.transactionType,
        description: transactionData.description,
        ticketId: transactionData.ticketId,
        createdAt: new Date().toISOString(),
      };
      transactions.unshift(newTx);
      await saveLocalTransactions(transactionData.fareAccountId, transactions);

      return newTx;
    }
    throw err;
  }
}

/**
 * Obtiene los boletos / viajes de un usuario por su ID del backend.
 */
export async function getUserTickets(userId: string): Promise<BackendTicket[]> {
  try {
    // Sincronizar boletos locales si existen y el backend está disponible (con teléfono verificado)
    try {
      const localTickets = await getLocalTickets(userId);
      if (localTickets.length > 0) {
        // Limpiar el almacenamiento local inmediatamente para evitar llamadas concurrentes duplicadas
        await saveLocalTickets(userId, []);
        console.log(
          `[API] Sincronizando ${localTickets.length} boletos locales al backend...`,
        );

        const failedTickets: BackendTicket[] = [];
        for (const localTkt of localTickets) {
          try {
            await fetchWithAuth('/tickets', {
              method: 'POST',
              body: JSON.stringify({
                userId,
                qrCode: localTkt.qrCode.startsWith('local-qr-')
                  ? undefined
                  : localTkt.qrCode,
                price: localTkt.price,
                status: localTkt.status,
                route: localTkt.route || 'General',
                origin: localTkt.origin || 'Origen',
                destination: localTkt.destination || 'Destino',
              }),
            });
          } catch (postErr) {
            console.warn(
              '[API] Error al sincronizar boleto individual:',
              postErr,
            );
            failedTickets.push(localTkt);
          }
        }

        // Si falló la subida de algún boleto, restaurarlos localmente
        if (failedTickets.length > 0) {
          await saveLocalTickets(userId, failedTickets);
        } else {
          console.log(
            '[API] Sincronización de boletos locales finalizada con éxito.',
          );
        }
      }
    } catch (syncErr) {
      console.warn('[API] Error al sincronizar boletos locales:', syncErr);
    }

    return await fetchWithAuth(`/tickets/user/${userId}`);
  } catch (err: any) {
    if (isPhoneVerificationError(err)) {
      return await getLocalTickets(userId);
    }
    throw err;
  }
}

/**
 * Obtiene el historial de transacciones de la cuenta de tarifa.
 */
export async function getAccountTransactions(
  accountId: string,
): Promise<any[]> {
  try {
    return await fetchWithAuth(`/fare/transactions?accountId=${accountId}`);
  } catch (err: any) {
    if (isPhoneVerificationError(err) || accountId.startsWith('local-')) {
      return await getLocalTransactions(accountId);
    }
    throw err;
  }
}

/**
 * Crea un boleto para el usuario en el backend.
 */
export async function createTicket(ticketData: {
  userId: string;
  qrCode?: string;
  price: number;
  status?: string;
  route?: string;
  origin?: string;
  destination?: string;
}): Promise<BackendTicket> {
  try {
    return await fetchWithAuth('/tickets', {
      method: 'POST',
      body: JSON.stringify({
        ...ticketData,
        status: ticketData.status || 'active',
      }),
    });
  } catch (err: any) {
    if (isPhoneVerificationError(err)) {
      const newTicket: BackendTicket = {
        id: `local-tkt-${Date.now()}`,
        userId: ticketData.userId,
        qrCode: ticketData.qrCode || `local-qr-${Date.now()}`,
        price: ticketData.price,
        status: (ticketData.status as any) || 'active',
        route: ticketData.route || 'General',
        origin: ticketData.origin || 'Origen',
        destination: ticketData.destination || 'Destino',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const tickets = await getLocalTickets(ticketData.userId);
      tickets.unshift(newTicket);
      await saveLocalTickets(ticketData.userId, tickets);

      // Guardar también en la lista global simulada para polling local en el mismo dispositivo
      try {
        const globalStr = await AsyncStorage.getItem('mock_global_tickets');
        const globalTickets = globalStr ? JSON.parse(globalStr) : [];
        globalTickets.unshift(newTicket);
        await AsyncStorage.setItem(
          'mock_global_tickets',
          JSON.stringify(globalTickets),
        );
      } catch (storageErr) {
        console.warn('[API] Error saving global mock ticket:', storageErr);
      }

      return newTicket;
    }
    throw err;
  }
}

/**
 * Obtiene todos los boletos del sistema (usado por el conductor para recibir cobros en tiempo real).
 */
export async function getTickets(): Promise<BackendTicket[]> {
  try {
    return await fetchWithAuth('/tickets');
  } catch (err: any) {
    if (isPhoneVerificationError(err) || err.message?.includes('Network')) {
      try {
        const globalStr = await AsyncStorage.getItem('mock_global_tickets');
        return globalStr ? JSON.parse(globalStr) : [];
      } catch (_) {
        return [];
      }
    }
    throw err;
  }
}

/**
 * Obtiene la información de un boleto por su código QR único.
 */
export async function getTicketByQr(qrCode: string): Promise<BackendTicket> {
  try {
    return await fetchWithAuth(`/tickets/qr/${qrCode}`);
  } catch (err: any) {
    // Buscar en boletos locales si falla
    const user = auth.currentUser;
    if (user) {
      const tickets = await getLocalTickets(user.uid);
      const found = tickets.find((t) => t.qrCode === qrCode);
      if (found) return found;
    }
    throw err;
  }
}

/**
 * Valida un boleto utilizando su código QR en una unidad (lo marca como usado).
 */
export async function validateTicketByQr(
  qrCode: string,
): Promise<BackendTicket> {
  try {
    return await fetchWithAuth(`/tickets/validate/${qrCode}`, {
      method: 'POST',
    });
  } catch (err: any) {
    const user = auth.currentUser;
    if (user) {
      const tickets = await getLocalTickets(user.uid);
      const found = tickets.find((t) => t.qrCode === qrCode);
      if (found) {
        found.status = 'used';
        found.updatedAt = new Date().toISOString();
        await saveLocalTickets(user.uid, tickets);
        return found;
      }
    }
    throw err;
  }
}

/**
 * Actualiza los campos de un boleto existente (status, qrCode, route, etc.).
 * Usado en el nuevo modelo de pasajes para marcar un boleto activo como usado
 * cuando el pasajero escanea el QR de la unidad de transporte.
 */
export async function updateTicket(
  uuid: string,
  data: Partial<{
    status: string;
    qrCode: string;
    route: string;
    usedAt: string;
  }>,
): Promise<BackendTicket> {
  try {
    return await fetchWithAuth(`/tickets/${uuid}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  } catch (err: any) {
    // Fallback local: actualizar en AsyncStorage si el backend no responde
    const user = auth.currentUser;
    if (user) {
      const tickets = await getLocalTickets(user.uid);
      const idx = tickets.findIndex((t) => t.id === uuid);
      if (idx !== -1) {
        tickets[idx] = {
          ...tickets[idx],
          ...data,
          status: (data.status ||
            tickets[idx].status) as BackendTicket['status'],
          updatedAt: new Date().toISOString(),
        };
        await saveLocalTickets(user.uid, tickets);
        return tickets[idx];
      }
    }
    throw err;
  }
}

/**
 * Envía una solicitud para registrarse como dueño de vehículo.
 */
export async function submitVehicleOwnerRequest(requestData: {
  businessName: string;
  idNumber: string;
}): Promise<any> {
  const payload = {
    legalName: requestData.businessName,
    rif: requestData.idNumber,
  };

  const currentUser = auth.currentUser;
  const userEmail = currentUser?.email?.toLowerCase().trim();
  const userUid = currentUser?.uid;

  // Guardar en almacenamiento persistente local como respaldo
  try {
    const raw = await AsyncStorage.getItem('gofare_submitted_owner_requests');
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({
      uuid: userUid || `req-${Date.now()}`,
      userUuid: userUid,
      email: userEmail,
      displayName: requestData.businessName,
      businessName: requestData.businessName,
      idNumber: requestData.idNumber,
      nationalId: requestData.idNumber,
      status: 'pending',
      createdAt: new Date().toISOString(),
      roleType: 'owner',
    });
    await AsyncStorage.setItem(
      'gofare_submitted_owner_requests',
      JSON.stringify(list),
    );
  } catch {}

  try {
    return await fetchWithAuth('/transport-owners/me/application', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    try {
      return await fetchWithAuth('/transport-owners/application', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      try {
        return await fetchWithAuth('/transport-owners', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch (err3) {
        console.warn('[API] Fallback de solicitud guardada localmente:', err3);
        return { success: true, local: true };
      }
    }
  }
}

/**
 * Obtiene el perfil de dueño de transporte del usuario autenticado (GET /transport-owners/me).
 */
export async function getMyTransportOwnerProfile(): Promise<any> {
  try {
    return await fetchWithAuth('/transport-owners/me');
  } catch {
    return null;
  }
}

/**
 * Registra un vehículo real en el backend (POST /vehicles). Lo asocia
 * opcionalmente a una línea de transporte (`lineUuid`).
 */
export async function submitVehicleRequest(requestData: {
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  licensePlate: string;
  cooperativeUuid?: string;
  vehicleColor?: string;
  capacity?: number;
}): Promise<any> {
  const payload: Record<string, any> = {
    plate: requestData.licensePlate.trim().toUpperCase(),
    brand: requestData.vehicleMake.trim(),
    model: requestData.vehicleModel.trim(),
    year: requestData.vehicleYear,
    color: requestData.vehicleColor?.trim(),
    capacity: requestData.capacity,
  };

  if (requestData.cooperativeUuid) {
    payload.civilAssociationUuid = requestData.cooperativeUuid;
  }

  return await fetchWithAuth('/vehicles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Obtiene las unidades de transporte (vehículos) del socio autenticado directamente del backend.
 */
export async function getOwnerVehicles(): Promise<any[]> {
  try {
    const list = await fetchWithAuth('/vehicles/my');
    const rawList = Array.isArray(list)
      ? list
      : list?.data || list?.items || list?.vehicles || [];

    if (Array.isArray(rawList)) {
      return rawList.map((v: any) => {
        let appStatus: 'approved' | 'pending' | 'rejected' = 'pending';
        if (v.status === 'active') {
          appStatus = 'approved';
        } else if (v.status === 'rejected' || v.status === 'suspended') {
          appStatus = 'rejected';
        } else if (v.status === 'inactive') {
          appStatus = 'pending';
        }

        return {
          uuid: v.uuid,
          vehicleMake: v.brand,
          vehicleModel: v.model,
          vehicleYear: v.year,
          licensePlate: v.plate,
          color: v.color,
          capacity: v.capacity,
          cooperativeName: v.civilAssociation?.name,
          assignedDriver: v.assignedDriver,
          status: appStatus,
          createdAt: v.createdAt
            ? new Date(v.createdAt).toLocaleDateString('es-VE')
            : '',
          totalEarnings: v.totalEarnings ?? 0,
          tripsCount: v.tripsCount ?? 0,
        };
      });
    }
  } catch (error) {
    console.warn('[API] Error al consultar /vehicles/my del backend:', error);
  }

  return [];
}

/**
 * Obtiene el detalle de un vehículo por su UUID directamente del backend.
 */
export async function getVehicleDetail(uuid: string): Promise<any> {
  try {
    const v = await fetchWithAuth(`/vehicles/${uuid}`);
    if (v) {
      let appStatus: 'approved' | 'pending' | 'rejected' = 'pending';
      if (v.status === 'active') {
        appStatus = 'approved';
      } else if (v.status === 'rejected' || v.status === 'suspended') {
        appStatus = 'rejected';
      } else if (v.status === 'inactive') {
        appStatus = 'pending';
      }

      return {
        uuid: v.uuid,
        vehicleMake: v.brand,
        vehicleModel: v.model,
        vehicleYear: v.year,
        licensePlate: v.plate,
        color: v.color,
        capacity: v.capacity,
        cooperativeName: v.civilAssociation?.name,
        assignedDriver: v.assignedDriver,
        inviteCode: v.inviteCode,
        rawStatus: v.status,
        documents: v.documents || v.legalDocuments || [],
        status: appStatus,
        createdAt: v.createdAt
          ? new Date(v.createdAt).toLocaleDateString('es-VE')
          : '',
        totalEarnings: v.totalEarnings ?? 0,
        tripsCount: v.tripsCount ?? 0,
        photoUrl: v.photoUrl,
        routeNumber: v.routeNumber,
      };
    }
  } catch (err) {
    console.warn(
      '[API] Error al obtener detalle de vehículo desde backend:',
      err,
    );
  }

  return null;
}

/**
 * Da de baja un vehículo por su UUID directamente en el backend.
 */
export async function deleteVehicle(uuid: string): Promise<any> {
  return await fetchWithAuth(`/vehicles/${uuid}`, {
    method: 'DELETE',
  });
}

/**
 * Registra un nuevo documento legal de conductor o vehículo.
 */
export async function submitLegalDocument(requestData: {
  type: string;
  fileUrl: string;
  vehicleUuid?: string;
  documentNumber?: string;
  issuedAt?: string;
  expiresAt?: string;
}): Promise<any> {
  try {
    const cached = await AsyncStorage.getItem('mock_admin_documents');
    const docs = cached ? JSON.parse(cached) : [];
    const newDoc = {
      uuid: `mock-doc-${Date.now()}-${Math.random()}`,
      type: requestData.type,
      documentNumber: requestData.documentNumber,
      fileUrl: requestData.fileUrl,
      issuedAt: requestData.issuedAt,
      expiresAt: requestData.expiresAt,
      status: 'pending_review',
      createdAt: new Date().toISOString(),
      vehicleUuid: requestData.vehicleUuid,
      vehicle: {
        uuid: requestData.vehicleUuid,
      },
      owner: {
        uuid: 'me',
        displayName: 'Mi Usuario',
      },
    };
    docs.unshift(newDoc);
    await AsyncStorage.setItem('mock_admin_documents', JSON.stringify(docs));
  } catch (storageErr) {
    console.warn('[API] Error al guardar documento localmente:', storageErr);
  }

  const payload: Record<string, any> = {
    type: requestData.type,
    fileUrl: requestData.fileUrl,
  };
  if (requestData.vehicleUuid) payload.vehicleUuid = requestData.vehicleUuid;
  if (requestData.documentNumber)
    payload.documentNumber = requestData.documentNumber;
  if (requestData.issuedAt) payload.issuedAt = requestData.issuedAt;
  if (requestData.expiresAt) payload.expiresAt = requestData.expiresAt;

  return await fetchWithAuth('/legal-documents', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Líneas de transporte activas (GET /transport-lines), para el selector
 * al registrar un vehículo. Reemplaza a las "cooperativas" simuladas.
 */
export async function getCooperatives(): Promise<
  { uuid: string; name: string; code?: string }[]
> {
  return await fetchWithAuth('/transport-lines');
}

/**
 * Vincula un número de teléfono verificado en Firebase al usuario actual en el backend.
 */
export async function linkPhoneNumber(
  firebasePhoneToken: string,
): Promise<{ token: string; user: BackendUser }> {
  const data = await fetchWithAuth('/auth/phone/link', {
    method: 'POST',
    body: JSON.stringify({ firebasePhoneToken }),
  });
  if (data?.token) {
    await saveGoFareToken(data.token);
  }
  return data;
}

/**
 * Obtiene boletos usados recientes filtrados por ruta/unidad para el conductor.
 * Consulta la tabla `tickets` (status=used) del backend PostgreSQL — sin Firebase.
 * @param routeKeywords - Lista de palabras clave (placa, id de ruta) para filtrar
 * @param sinceTimestamp - Solo tickets actualizados después de este timestamp (ms)
 */
export async function getUsedTicketsByRoute(
  routeKeywords: string[],
  sinceTimestamp: number,
): Promise<BackendTicket[]> {
  try {
    // Obtener todos los tickets con status=used del backend (tabla pública de tickets)
    const allTickets = await fetchWithAuth('/tickets?status=used');
    if (!Array.isArray(allTickets)) return [];

    const keywords = routeKeywords.map((k) => k.toLowerCase());

    return allTickets.filter((t: BackendTicket) => {
      // Filtrar por tiempo: solo tickets del turno actual
      const ticketMs = new Date(t.updatedAt || t.createdAt).getTime();
      if (ticketMs < sinceTimestamp - 10_000) return false;

      // Filtrar por coincidencia de ruta o código QR con la unidad del conductor
      const qr = (t.qrCode || '').toLowerCase();
      const route = (t.route || '').toLowerCase();
      return keywords.some(
        (kw) => qr.includes(kw) || route.includes(kw) || kw.includes(qr),
      );
    });
  } catch (err: any) {
    // Fallback: leer desde AsyncStorage si el backend no responde
    if (
      isPhoneVerificationError(err) ||
      err.message?.includes('Network') ||
      err.message?.includes('timeout')
    ) {
      try {
        const globalStr = await AsyncStorage.getItem('mock_global_tickets');
        const all: BackendTicket[] = globalStr ? JSON.parse(globalStr) : [];
        const keywords = routeKeywords.map((k) => k.toLowerCase());
        return all.filter((t) => {
          const ticketMs = new Date(t.updatedAt || t.createdAt).getTime();
          if (ticketMs < sinceTimestamp - 10_000) return false;
          const qr = (t.qrCode || '').toLowerCase();
          const route = (t.route || '').toLowerCase();
          return keywords.some(
            (kw) => qr.includes(kw) || route.includes(kw) || kw.includes(qr),
          );
        });
      } catch (_) {
        return [];
      }
    }
    console.warn('[API] getUsedTicketsByRoute error:', err);
    return [];
  }
}

/**
 * Obtiene la lista completa de usuarios registrados.
 * @returns Lista de usuarios (BackendUser[])
 */
export async function getAllUsers(): Promise<BackendUser[]> {
  try {
    const res = await fetchWithAuth('/users');
    const raw = Array.isArray(res)
      ? res
      : res?.data || res?.users || res?.items || [];
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.warn('[API] Error al obtener usuarios del backend:', err);
    return [];
  }
}

export async function getAllTransactions(): Promise<any[]> {
  try {
    const res = await fetchWithAuth('/fare/transactions');
    const raw = Array.isArray(res)
      ? res
      : res?.data || res?.transactions || res?.items || [];
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.warn('[API] Error al obtener transacciones:', err);
    return [];
  }
}

/**
 * Elimina un usuario por su ID de la plataforma.
 * @param id - Identificador UUID del usuario
 */
export async function deleteUser(id: string): Promise<void> {
  await fetchWithAuth(`/users/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Actualiza los roles asignados a un usuario.
 * @param id - Identificador UUID del usuario
 * @param roleIds - Lista de IDs numéricos de roles (como string)
 */
export async function updateUserRoles(
  id: string,
  roleIds: string[],
): Promise<any> {
  return fetchWithAuth(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ roleIds }),
  });
}

const CIVIL_ASSOC_METADATA_KEY = 'gofare_civil_assoc_metadata';

export async function getRoles(): Promise<any[]> {
  try {
    return await fetchWithAuth('/roles');
  } catch (err) {
    console.warn('[API] Error al obtener roles del backend:', err);
    return [];
  }
}

export async function resolveRoleUuid(
  roleName: string,
): Promise<string | null> {
  try {
    const roles = await getRoles();
    const found = roles.find((r: any) => r.name === roleName);
    if (found) return found.uuid || found.id;
  } catch (_) {}

  // Fallback: buscar en los usuarios existentes
  try {
    const users = await getAllUsers();
    for (const u of users) {
      const roles = (u as any).roles || [];
      const found = roles.find((r: any) => r.name === roleName);
      if (found) return found.uuid || found.id;
    }
  } catch (_) {}

  return null;
}

export async function getCivilAssociationsMetadata(): Promise<
  Record<string, { position: string; status: string }>
> {
  try {
    const str = await AsyncStorage.getItem(CIVIL_ASSOC_METADATA_KEY);
    return str ? JSON.parse(str) : {};
  } catch (_) {
    return {};
  }
}

export async function saveCivilAssociationMetadata(
  userUuid: string,
  position: string,
  status: string,
): Promise<void> {
  try {
    const metadata = await getCivilAssociationsMetadata();
    metadata[userUuid] = { position, status };
    await AsyncStorage.setItem(
      CIVIL_ASSOC_METADATA_KEY,
      JSON.stringify(metadata),
    );
  } catch (err) {
    console.warn('[API] Error al guardar metadatos de asociación civil:', err);
  }
}

export async function getAllCivilAssociations(): Promise<any[]> {
  try {
    const res = await fetchWithAuth('/civil-associations');
    const raw = Array.isArray(res) ? res : res?.data || res?.items || [];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((ca: any) => ({
        uuid: ca.uuid,
        displayName:
          ca.user?.displayName ||
          `${ca.user?.firstName || ''} ${ca.user?.lastName || ''}`.trim() ||
          ca.name ||
          'Asociación Civil',
        email: ca.user?.email,
        nationalId: ca.user?.nationalId,
        phoneNumber: ca.user?.phoneNumber,
        position: ca.position,
        status: ca.status,
        createdAt: ca.createdAt,
      }));
    }
  } catch {}

  try {
    const users = await getAllUsers();
    return users
      .filter((u: any) => {
        const roles = u.roles || [];
        return (
          roles.some((r: any) => r.name === 'civil_association') ||
          u.civilAssociation != null
        );
      })
      .map((u: any) => ({
        uuid: u.uuid,
        displayName:
          u.displayName ||
          `${u.firstName || ''} ${u.lastName || ''}`.trim() ||
          'Asociación Civil',
        email: u.email,
        nationalId: u.nationalId,
        phoneNumber: u.phoneNumber,
        position: u.civilAssociation?.position,
        status: u.civilAssociation?.status || 'approved',
        createdAt: u.createdAt,
      }));
  } catch (err) {
    console.warn('[API] Error al obtener asociaciones civiles:', err);
    return [];
  }
}

export async function registerCivilAssociation(data: {
  userUuid?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  nationalId?: string;
  position: string;
  status: string;
}): Promise<any> {
  if (data.userUuid) {
    const roleUuid = await resolveRoleUuid('civil_association');
    if (roleUuid) {
      await updateUserRoles(data.userUuid, [roleUuid]);
    }
    return { success: true, userUuid: data.userUuid };
  }

  return await fetchWithAuth('/civil-associations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCivilAssociationProfile(
  uuid: string,
  data: {
    position?: string;
    status?: string;
    rejectionReason?: string;
  },
): Promise<any> {
  return await fetchWithAuth(`/civil-associations/${uuid}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Obtiene los documentos legales del usuario autenticado (dueño de vehículo / conductor).
 */
export async function getMyLegalDocuments(): Promise<any[]> {
  try {
    const res = await fetchWithAuth('/legal-documents/my');
    const raw = Array.isArray(res)
      ? res
      : res?.data || res?.documents || res?.items || [];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw;
    }
  } catch (err) {
    console.warn('[API] Error al consultar /legal-documents/my:', err);
  }

  try {
    const cached = await AsyncStorage.getItem('mock_admin_documents');
    const docs = cached ? JSON.parse(cached) : [];
    return Array.isArray(docs) ? docs : [];
  } catch (_) {
    return [];
  }
}

/**
 * Obtiene la lista de todos los documentos presentados en la plataforma directamente del backend.
 * Si el usuario no tiene permisos de administrador (403), consulta sus propios documentos (/legal-documents/my).
 */
export async function getAllDocuments(): Promise<any[]> {
  try {
    const res = await fetchWithAuth('/legal-documents');
    const raw = Array.isArray(res)
      ? res
      : res?.data || res?.documents || res?.items || [];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw;
    }
  } catch (_err) {
    // Si no es admin (ej. 403 Forbidden), intentar obtener los documentos propios
    try {
      const myRes = await fetchWithAuth('/legal-documents/my');
      const myRaw = Array.isArray(myRes)
        ? myRes
        : myRes?.data || myRes?.documents || myRes?.items || [];
      if (Array.isArray(myRaw) && myRaw.length > 0) {
        return myRaw;
      }
    } catch (_) {}
  }

  try {
    const cached = await AsyncStorage.getItem('mock_admin_documents');
    const docs = cached ? JSON.parse(cached) : [];
    return Array.isArray(docs) ? docs : [];
  } catch (_) {
    return [];
  }
}

/**
 * Aprueba un documento de conductor/dueño directamente en el backend.
 */
export async function verifyDocument(uuid: string): Promise<any> {
  return await fetchWithAuth(`/legal-documents/${uuid}/verify`, {
    method: 'PATCH',
  });
}

/**
 * Rechaza un documento con un motivo en el backend.
 */
export async function rejectDocument(
  uuid: string,
  reason: string,
): Promise<any> {
  return await fetchWithAuth(`/legal-documents/${uuid}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

/**
 * Obtiene todas las unidades de transporte registradas directamente del backend.
 */
export async function getAllTransportUnits(): Promise<any[]> {
  try {
    const res = await fetchWithAuth('/vehicles');
    const rawList = Array.isArray(res)
      ? res
      : res?.data || res?.items || res?.vehicles || [];

    if (Array.isArray(rawList)) {
      return rawList.map((u: any) => ({
        uuid: u.uuid,
        plate: u.plate,
        brand: u.brand,
        model: u.model,
        year: u.year,
        color: u.color,
        capacity: u.capacity,
        inviteCode: u.inviteCode,
        isActive: u.status === 'active',
        status: u.status,
        owner: u.owner,
        civilAssociation: u.civilAssociation,
        createdAt: u.createdAt,
        rejectionReason: u.rejectionReason || u.rejection_reason,
      }));
    }
  } catch (err) {
    console.warn('[API] Error fetching transport units from backend:', err);
  }

  return [];
}

/**
 * Modifica el estado de activación de una unidad de transporte (aprobación/desaprobación de admin).
 */
export async function toggleTransportUnitStatus(
  uuid: string,
  isActive: boolean,
): Promise<any> {
  return await fetchWithAuth(`/vehicles/${uuid}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

/**
 * Normaliza el estado de aprobación proveniente de los modelos del backend (ProfileStatus enum).
 */
function normalizeProfileStatus(
  rawStatus?: string,
): 'pending' | 'approved' | 'rejected' | 'suspended' {
  const s = String(rawStatus || '').toLowerCase();
  if (s === 'approved' || s === 'aprobado' || s === 'verified') {
    return 'approved';
  }
  if (
    s === 'suspended' ||
    s === 'suspendido' ||
    s === 'inactivo' ||
    s === 'inactive'
  ) {
    return 'suspended';
  }
  if (s === 'rejected' || s === 'rechazado') {
    return 'rejected';
  }
  return 'pending'; // 'pending_review', 'not_applied', etc.
}

/**
 * Obtiene todas las solicitudes de registro de dueños de vehículos directamente del backend.
 */
export async function getAllOwnerRequests(): Promise<any[]> {
  const rawOwners: any[] = [];

  // 1. Endpoints de transport-owners y civil-associations por cada estado en backend
  const statusList = [
    'pending_review',
    'approved',
    'rejected',
    'suspended',
    'not_applied',
  ];
  const endpoints = [
    ...statusList.map((s) => `/transport-owners?status=${s}`),
    ...statusList.map((s) => `/civil-associations?status=${s}`),
    '/transport-owners',
    '/civil-associations',
    '/transport-owners/applications',
    '/admin/transport-owners',
  ];

  await Promise.all(
    endpoints.map(async (ep) => {
      try {
        const res = await fetchWithAuth(ep);
        const items = Array.isArray(res)
          ? res
          : res?.data || res?.items || res?.owners || [];
        if (Array.isArray(items) && items.length > 0) {
          rawOwners.push(...items);
        }
      } catch (_) {}
    }),
  );

  // 2. Usuarios con rol transport_owner o civil_association
  try {
    const users = await getAllUsers();
    for (const u of users) {
      const roles = (u as any).roles || [];
      const hasOwnerRole =
        (Array.isArray(roles) &&
          roles.some((r: any) => {
            const rName = (
              typeof r === 'string' ? r : r?.name || r?.code || r?.slug || ''
            ).toLowerCase();
            return (
              rName.includes('owner') ||
              rName.includes('propietario') ||
              rName.includes('civil')
            );
          })) ||
        (u as any).role === 'transport_owner' ||
        (u as any).role === 'civil_association' ||
        (u as any).role === 'owner' ||
        (u as any).transportOwner != null ||
        (u as any).transport_owner != null ||
        (u as any).civilAssociation != null ||
        (u as any).isTransportOwner === true;

      if (hasOwnerRole) {
        const ownerProfile =
          (u as any).transportOwner ||
          (u as any).transport_owner ||
          (u as any).civilAssociation ||
          {};
        rawOwners.push({
          uuid: ownerProfile.uuid || u.uuid || (u as any).id,
          userUuid: u.uuid || (u as any).id,
          user: u,
          legalName:
            ownerProfile.legalName ||
            ownerProfile.name ||
            u.displayName ||
            `${u.firstName || ''} ${u.lastName || ''}`.trim(),
          rif: ownerProfile.rif || u.nationalId,
          status:
            ownerProfile.status || (u as any).ownerStatus || (u as any).status,
          submittedAt: ownerProfile.submittedAt || (u as any).createdAt,
          rejectionReason: ownerProfile.rejectionReason,
        });
      }
    }
  } catch (_) {}

  // 3. Deduplicación y normalización
  const seenMap = new Map<string, any>();

  for (const o of rawOwners) {
    const userUuid = o.user?.uuid || o.user?.id || o.userUuid;
    const uuid = o.uuid || o.id;
    const email = (o.user?.email || o.email || '').toLowerCase().trim();
    const displayName = (
      o.user?.displayName ||
      `${o.user?.firstName || ''} ${o.user?.lastName || ''}`.trim() ||
      o.displayName ||
      o.legalName ||
      'Dueño de Vehículo'
    ).trim();
    const idNumber =
      o.rif || o.user?.nationalId || o.nationalId || o.idNumber || 'Sin RIF';

    const dedupeKey = (
      email ||
      userUuid ||
      uuid ||
      idNumber ||
      displayName
    ).toLowerCase();

    const status = normalizeProfileStatus(o.status);

    const normalizedItem = {
      uuid: uuid || dedupeKey,
      userUuid: userUuid || uuid,
      roleType: 'owner',
      displayName,
      email: email || 'Sin correo',
      nationalId: idNumber,
      phoneNumber: o.user?.phoneNumber || o.phoneNumber,
      businessName: o.legalName || o.businessName || 'Propietario Particular',
      idNumber,
      status,
      createdAt: o.submittedAt || o.createdAt || new Date().toISOString(),
      rejectionReason: o.rejectionReason,
    };

    if (!seenMap.has(dedupeKey)) {
      seenMap.set(dedupeKey, normalizedItem);
    } else {
      const existing = seenMap.get(dedupeKey);
      if (
        existing.status === 'pending' &&
        (status === 'approved' || status === 'rejected')
      ) {
        seenMap.set(dedupeKey, {
          ...existing,
          ...normalizedItem,
          status,
          rejectionReason: o.rejectionReason,
        });
      }
    }
  }

  return Array.from(seenMap.values());
}

/**
 * Obtiene todas las solicitudes de registro de conductores directamente del backend.
 */
export async function getAllDriverRequests(): Promise<any[]> {
  const rawDrivers: any[] = [];

  // 1. Endpoints de drivers en backend
  const endpoints = ['/drivers', '/drivers/applications', '/admin/drivers'];
  for (const ep of endpoints) {
    try {
      const res = await fetchWithAuth(ep);
      const items = Array.isArray(res)
        ? res
        : res?.data || res?.items || res?.drivers || [];
      if (Array.isArray(items)) {
        rawDrivers.push(...items);
      }
    } catch (_) {}
  }

  // 2. Usuarios con rol driver
  try {
    const users = await getAllUsers();
    for (const u of users) {
      const roles = (u as any).roles || [];
      const hasDriverRole =
        (Array.isArray(roles) &&
          roles.some((r: any) => {
            const rName = (
              typeof r === 'string' ? r : r?.name || r?.code || r?.slug || ''
            ).toLowerCase();
            return (
              rName.includes('driver') ||
              rName.includes('conductor') ||
              rName.includes('chofer')
            );
          })) ||
        (u as any).role === 'driver' ||
        (u as any).driver != null ||
        (u as any).driverProfile != null ||
        (u as any).driver_profile != null ||
        (u as any).isDriver === true;

      if (hasDriverRole) {
        const driverProfile =
          (u as any).driver ||
          (u as any).driverProfile ||
          (u as any).driver_profile ||
          {};
        rawDrivers.push({
          uuid: driverProfile.uuid || u.uuid || (u as any).id,
          userUuid: u.uuid || (u as any).id,
          user: u,
          displayName:
            u.displayName ||
            `${u.firstName || ''} ${u.lastName || ''}`.trim() ||
            'Conductor',
          licenseNumber:
            driverProfile.licenseNumber || u.nationalId || 'Sin licencia',
          licenseCategory: driverProfile.licenseCategory,
          status:
            driverProfile.status ||
            (u as any).driverStatus ||
            (u as any).status,
          submittedAt: driverProfile.submittedAt || (u as any).createdAt,
          rejectionReason: driverProfile.rejectionReason,
        });
      }
    }
  } catch (_) {}

  // 3. Deduplicación y normalización
  const seenMap = new Map<string, any>();

  for (const d of rawDrivers) {
    const userUuid = d.user?.uuid || d.user?.id || d.userUuid;
    const uuid = d.uuid || d.id;
    const email = (d.user?.email || d.email || '').toLowerCase().trim();
    const displayName = (
      d.user?.displayName ||
      `${d.user?.firstName || ''} ${d.user?.lastName || ''}`.trim() ||
      d.displayName ||
      'Conductor'
    ).trim();
    const idNumber =
      d.licenseNumber ||
      d.user?.nationalId ||
      d.nationalId ||
      d.idNumber ||
      'Sin licencia';

    const dedupeKey = (
      email ||
      userUuid ||
      uuid ||
      idNumber ||
      displayName
    ).toLowerCase();

    const status = normalizeProfileStatus(d.status);

    const normalizedItem = {
      uuid: uuid || dedupeKey,
      userUuid: userUuid || uuid,
      roleType: 'driver',
      displayName,
      email: email || 'Sin correo',
      nationalId: d.user?.nationalId || d.nationalId || idNumber,
      phoneNumber: d.user?.phoneNumber || d.phoneNumber,
      businessName: d.licenseCategory
        ? `Licencia Cat. ${d.licenseCategory}`
        : 'Conductor de Unidad',
      idNumber,
      licenseCategory: d.licenseCategory,
      status,
      createdAt: d.submittedAt || d.createdAt || new Date().toISOString(),
      rejectionReason: d.rejectionReason,
    };

    if (!seenMap.has(dedupeKey)) {
      seenMap.set(dedupeKey, normalizedItem);
    } else {
      const existing = seenMap.get(dedupeKey);
      if (
        existing.status === 'pending' &&
        (status === 'approved' || status === 'rejected')
      ) {
        seenMap.set(dedupeKey, {
          ...existing,
          ...normalizedItem,
          status,
          rejectionReason: d.rejectionReason,
        });
      }
    }
  }

  return Array.from(seenMap.values());
}

/**
 * Obtiene de forma unificada las solicitudes de Dueños y Conductores.
 */
export async function getAllAffiliationRequests(): Promise<any[]> {
  const [owners, drivers] = await Promise.all([
    getAllOwnerRequests().catch(() => []),
    getAllDriverRequests().catch(() => []),
  ]);
  return [...owners, ...drivers].sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime(),
  );
}

/**
 * Aprueba una solicitud de dueño de vehículo en el backend.
 */
export async function verifyOwnerRequest(
  requestUuid: string,
  userUuid?: string,
): Promise<any> {
  let res: any;
  try {
    res = await fetchWithAuth(`/transport-owners/${requestUuid}/approve`, {
      method: 'PATCH',
    });
  } catch (_) {
    try {
      res = await fetchWithAuth(`/civil-associations/${requestUuid}/approve`, {
        method: 'PATCH',
      });
    } catch (_) {
      try {
        res = await fetchWithAuth(`/transport-owners/${requestUuid}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'approved' }),
        });
      } catch (_) {}
    }
  }

  if (userUuid || requestUuid) {
    const targetUserUuid = userUuid || requestUuid;
    try {
      const roleUuid = await resolveRoleUuid('transport_owner');
      if (roleUuid) {
        await updateUserRoles(targetUserUuid, [roleUuid]);
      }
    } catch (roleErr) {
      console.warn('[API] verifyOwnerRequest role update:', roleErr);
    }
  }

  return res || { success: true };
}

/**
 * Rechaza una solicitud de dueño de vehículo en el backend.
 */
export async function rejectOwnerRequest(
  requestUuid: string,
  reason: string,
): Promise<any> {
  try {
    return await fetchWithAuth(`/transport-owners/${requestUuid}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  } catch (_) {
    try {
      return await fetchWithAuth(`/civil-associations/${requestUuid}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      });
    } catch (_) {
      try {
        return await fetchWithAuth(`/transport-owners/${requestUuid}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'rejected', rejectionReason: reason }),
        });
      } catch (_) {}
    }
  }
}

/**
 * Aprueba una solicitud de conductor en el backend.
 */
export async function verifyDriverRequest(
  requestUuid: string,
  userUuid?: string,
): Promise<any> {
  try {
    await fetchWithAuth(`/drivers/${requestUuid}/approve`, {
      method: 'PATCH',
    });
  } catch (_) {
    const targetUserUuid = userUuid || requestUuid;
    try {
      const roleUuid = await resolveRoleUuid('driver');
      if (roleUuid) {
        await updateUserRoles(targetUserUuid, [roleUuid]);
      }
    } catch (_) {}
  }
  return { success: true };
}

/**
 * Rechaza una solicitud de conductor con un motivo en el backend.
 */
export async function rejectDriverRequest(
  requestUuid: string,
  reason: string,
): Promise<any> {
  try {
    return await fetchWithAuth(`/drivers/${requestUuid}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  } catch (_) {}
  return { success: true };
}

/**
 * Suspende la cuenta de un dueño de vehículo con motivo administrativo.
 */
export async function suspendOwnerRequest(
  requestUuid: string,
  reason: string,
): Promise<any> {
  try {
    return await fetchWithAuth(`/transport-owners/${requestUuid}/suspend`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  } catch (_) {
    try {
      return await fetchWithAuth(`/transport-owners/${requestUuid}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'suspended', rejectionReason: reason }),
      });
    } catch (_) {}
  }
  return { success: true };
}

/**
 * Suspende la cuenta de un conductor con motivo administrativo.
 */
export async function suspendDriverRequest(
  requestUuid: string,
  reason: string,
): Promise<any> {
  try {
    return await fetchWithAuth(`/drivers/${requestUuid}/suspend`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  } catch (_) {
    try {
      return await fetchWithAuth(`/drivers/${requestUuid}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'suspended', rejectionReason: reason }),
      });
    } catch (_) {}
  }
  return { success: true };
}

/**
 * Obtiene las tasas actuales del fare y BCV del backend.
 */
export async function getCurrentRates(): Promise<{
  fareUsdValue: number;
  bcvRate: number;
  bcvRateDate: string;
}> {
  try {
    return await fetchWithAuth('/rates/current');
  } catch (error) {
    console.warn('[API] getCurrentRates falló, usando datos simulados:', error);
    // Intentar leer de AsyncStorage si falló el backend o estamos offline
    try {
      const cached = await AsyncStorage.getItem('gofare_rates_cache');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}
    return {
      fareUsdValue: 0.25,
      bcvRate: 721.35,
      bcvRateDate: new Date().toISOString().slice(0, 10),
    };
  }
}

/**
 * Registra el valor del fare en USD.
 */
export async function updateFareValue(usdValue: number): Promise<any> {
  // Guardar en el backend (lanzará un error si falla)
  const result = await fetchWithAuth('/rates/fare-value', {
    method: 'POST',
    body: JSON.stringify({ usdValue }),
  });

  // Si tiene éxito, actualizamos la caché local de lectura
  try {
    const current = await getCurrentRates();
    const updated = { ...current, fareUsdValue: usdValue };
    await AsyncStorage.setItem('gofare_rates_cache', JSON.stringify(updated));
  } catch (err) {
    console.warn('[API] Error guardando caché local de rates:', err);
  }

  return result;
}

/**
 * Registra la tasa BCV del día.
 */
export async function updateBcvRate(
  rate: number,
  rateDate?: string,
): Promise<any> {
  const targetDate = rateDate ?? new Date().toISOString().slice(0, 10);

  // Guardar en el backend (lanzará un error si falla)
  const result = await fetchWithAuth('/rates/bcv', {
    method: 'POST',
    body: JSON.stringify({ rate, rateDate: targetDate }),
  });

  // Si tiene éxito, actualizamos la caché local de lectura
  try {
    const current = await getCurrentRates();
    const updated = { ...current, bcvRate: rate, bcvRateDate: targetDate };
    await AsyncStorage.setItem('gofare_rates_cache', JSON.stringify(updated));
  } catch (err) {
    console.warn('[API] Error guardando caché local de rates:', err);
  }

  return result;
}

/**
 * Consulta la tasa BCV oficial sugerida desde la fuente externa (DolarAPI) a través del backend (GET /rates/bcv/external).
 */
export async function getExternalBcvRate(): Promise<{
  rate: number;
  source: string;
  fetchedAt: string;
}> {
  return await fetchWithAuth('/rates/bcv/external');
}

/**
 * Obtiene el resumen/preview de un cobro de viaje antes de confirmar decodificando el QR.
 */
export async function previewRide(qr: string): Promise<{
  sessionUuid: string;
  vehiclePlate: string;
  routeName: string;
  fareCost: number;
  fareUsdValue: number;
  bcvRate: number;
  bsAmount: number;
  balanceFares: number;
  sufficient: boolean;
  driverName?: string;
  driverDoc?: string;
  unitNumber?: string;
  vehicleModel?: string;
}> {
  let qrMeta: any = null;
  let rawQrToken = qr;

  if (
    qr &&
    (qr.startsWith('{') || qr.includes('driverName') || qr.includes('sid'))
  ) {
    try {
      qrMeta = JSON.parse(qr);
      if (qrMeta.qr) {
        rawQrToken = qrMeta.qr;
      }
    } catch {}
  }

  // 1. Ejecutar la vista previa enviando el token extraído del QR al backend
  let result: any = null;
  try {
    result = await fetchWithAuth('/rides/preview', {
      method: 'POST',
      body: JSON.stringify({ qr: rawQrToken }),
    });
  } catch (_pErr) {
    result = await fetchWithAuth('/rides/preview', {
      method: 'POST',
      body: JSON.stringify({ qr }),
    });
  }

  // 2. Extraer de manera 100% dinámica los datos del conductor según el QR escaneado
  if (result) {
    const sessionUuid =
      result.sessionUuid || qrMeta?.sid || qrMeta?.sessionUuid;
    const vehiclePlate =
      result.vehiclePlate || qrMeta?.plate || qrMeta?.vehiclePlate;

    if (qrMeta?.driverName) {
      result.driverName = formatUserProfileName(qrMeta.driverName);
    }
    if (qrMeta?.driverDoc) {
      result.driverDoc = qrMeta.driverDoc;
    }

    if (!result.driverName && (sessionUuid || vehiclePlate)) {
      const resolved = await resolveDriverAndVehicleFromBackend(
        sessionUuid,
        vehiclePlate,
      );
      if (resolved.driverName) result.driverName = resolved.driverName;
      if (resolved.driverDoc) result.driverDoc = resolved.driverDoc;
      if (resolved.unitNumber) result.unitNumber = resolved.unitNumber;
      if (resolved.vehicleModel) result.vehicleModel = resolved.vehicleModel;
    }
  }

  return result;
}

/**
 * Confirma y procesa el cobro del viaje (debitando los Fares correspondientes).
 */
export async function confirmRide(qr: string): Promise<{
  rideUuid: string;
  fareCost: number;
  bsAmount: number;
  balanceFares: number;
}> {
  let rawQrToken = qr;

  if (
    qr &&
    (qr.startsWith('{') || qr.includes('driverName') || qr.includes('sid'))
  ) {
    try {
      const parsed = JSON.parse(qr);
      if (parsed.qr) {
        rawQrToken = parsed.qr;
      }
    } catch {}
  }

  try {
    return await fetchWithAuth('/rides/confirm', {
      method: 'POST',
      body: JSON.stringify({ qr: rawQrToken }),
    });
  } catch (_cErr) {
    return await fetchWithAuth('/rides/confirm', {
      method: 'POST',
      body: JSON.stringify({ qr }),
    });
  }
}

// ─── SESIONES DE CAJA (TURNOS DEL CONDUCTOR) ──────────────────────────────────

/**
 * Obtiene la sesión de caja (turno) activa del conductor autenticado.
 */
export async function getCurrentSession(): Promise<any> {
  try {
    const session = await fetchWithAuth('/cash-sessions/me/current');
    if (session?.uuid) {
      await AsyncStorage.setItem(
        'gofare_active_cash_session',
        JSON.stringify(session),
      );
      return session;
    }
  } catch (err) {
    console.warn(
      '[API] getCurrentSession error, falling back to cached session:',
      err,
    );
  }

  try {
    const stored = await AsyncStorage.getItem('gofare_active_cash_session');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.status !== 'closed') {
        return parsed;
      }
    }
  } catch {}

  return null;
}

/**
 * Obtiene los detalles de una sesión de caja específica por su UUID (para datos de conductor/vehículo).
 */
export async function getCashSessionByUuid(sessionUuid: string): Promise<any> {
  try {
    return await fetchWithAuth(`/cash-sessions/${sessionUuid}`);
  } catch {
    return null;
  }
}

/**
 * Consulta la API de vehículos del backend para encontrar la unidad por su placa y obtener datos reales del vehículo y conductor.
 */
export async function getVehicleByPlate(plate: string): Promise<any> {
  if (!plate) return null;
  try {
    const vehicles = await fetchWithAuth('/vehicles');
    if (Array.isArray(vehicles)) {
      const match = vehicles.find(
        (v: any) =>
          v.plate?.toLowerCase() === plate.toLowerCase() ||
          v.licensePlate?.toLowerCase() === plate.toLowerCase(),
      );
      if (match) return match;
    }
  } catch {
    // Silently ignore if user endpoint lacks full vehicle listing permissions
  }
  return null;
}

/**
 * Normaliza y formatea el nombre visible de un perfil de usuario siguiendo Clean Code.
 */
export function formatUserProfileName(user?: any): string {
  if (!user) return '';

  const displayName =
    typeof user === 'string'
      ? user.trim()
      : (
          user.displayName ||
          user.fullName ||
          user.driverName ||
          user.name ||
          ''
        ).trim();

  if (
    displayName &&
    displayName !== 'Usuario Invitado' &&
    displayName !== 'Usuario'
  ) {
    return displayName;
  }

  const first = user.firstName?.trim() || '';
  const last = user.lastName?.trim() || '';
  if (first || last) {
    const combined = `${first} ${last}`.trim();
    if (combined && combined !== 'Usuario Invitado' && combined !== 'Usuario') {
      return combined;
    }
  }

  if (typeof user === 'object' && user.email && user.email.includes('@')) {
    const prefix = user.email.split('@')[0];
    if (prefix && prefix !== 'invitado' && prefix !== 'usuario') {
      return prefix
        .replace(/[._-]/g, ' ')
        .replace(/\d+/g, '')
        .trim()
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
    }
  }

  return '';
}

/**
 * Intenta resolver la información del conductor y vehículo consultando múltiples rutas candidatas del backend.
 */
export async function resolveDriverAndVehicleFromBackend(
  sessionUuid?: string,
  vehiclePlate?: string,
): Promise<{
  driverName?: string;
  driverDoc?: string;
  unitNumber?: string;
  vehicleModel?: string;
}> {
  const result: {
    driverName?: string;
    driverDoc?: string;
    unitNumber?: string;
    vehicleModel?: string;
  } = {};

  // 1. Contexto de sesión activa local o perfil autenticado en la app
  try {
    const activeStr = await AsyncStorage.getItem('gofare_active_cash_session');
    if (activeStr) {
      const active = JSON.parse(activeStr);
      const name =
        formatUserProfileName(active.driver) ||
        formatUserProfileName(active.driverName);
      const doc =
        active.driverDoc || active.driver?.nationalId || active.driver?.cedula;
      if (name) result.driverName = name;
      if (doc) result.driverDoc = doc;
      if (active.vehicle?.unitNumber || active.vehicle?.number) {
        result.unitNumber = active.vehicle.unitNumber || active.vehicle.number;
      }
      if (active.vehicle?.brand || active.vehicle?.model) {
        result.vehicleModel = [active.vehicle.brand, active.vehicle.model]
          .filter(Boolean)
          .join(' ');
      }
    }
  } catch {}

  // 2. Caché del perfil de usuario local o Firebase currentUser
  if (!result.driverName) {
    try {
      const cachedProfileStr = await AsyncStorage.getItem(
        'gofare_cached_user_profile',
      );
      if (cachedProfileStr) {
        const cached = JSON.parse(cachedProfileStr);
        const name = formatUserProfileName(cached);
        if (name) {
          result.driverName = name;
          if (cached.nationalId || cached.cedula) {
            result.driverDoc = cached.nationalId || cached.cedula;
          }
        }
      }
    } catch {}
  }

  // 3. Consultas a la API backend (si aún no se ha resuelto el nombre)
  if (sessionUuid) {
    const sessionEndpoints = [
      `/cash-sessions/${sessionUuid}`,
      `/cash-sessions/session/${sessionUuid}`,
      `/cash-sessions/public/${sessionUuid}`,
      `/cash-sessions/info/${sessionUuid}`,
    ];

    for (const ep of sessionEndpoints) {
      try {
        const data = await fetchWithAuth(ep);
        if (data) {
          const name =
            formatUserProfileName(data.driver) ||
            formatUserProfileName(data.owner) ||
            formatUserProfileName(data.user) ||
            formatUserProfileName(data.driverName);
          const doc =
            data.driver?.nationalId ||
            data.owner?.nationalId ||
            data.user?.nationalId ||
            data.driver?.cedula ||
            data.owner?.cedula ||
            data.user?.cedula ||
            data.driverDoc;

          if (name) result.driverName = name;
          if (doc) result.driverDoc = doc;
          if (data.vehicle?.unitNumber || data.vehicle?.number) {
            result.unitNumber = data.vehicle.unitNumber || data.vehicle.number;
          }
          if (data.vehicle?.brand || data.vehicle?.model) {
            result.vehicleModel = [data.vehicle.brand, data.vehicle.model]
              .filter(Boolean)
              .join(' ');
          }
          if (result.driverName) break;
        }
      } catch {}
    }
  }

  if (!result.driverName && vehiclePlate) {
    const vehicleEndpoints = [
      `/vehicles/plate/${encodeURIComponent(vehiclePlate)}`,
      `/vehicles/by-plate/${encodeURIComponent(vehiclePlate)}`,
      `/vehicles/search?plate=${encodeURIComponent(vehiclePlate)}`,
      `/vehicles`,
    ];

    for (const ep of vehicleEndpoints) {
      try {
        const data = await fetchWithAuth(ep);
        if (data) {
          const v = Array.isArray(data)
            ? data.find(
                (item: any) =>
                  item.plate?.toLowerCase() === vehiclePlate.toLowerCase() ||
                  item.licensePlate?.toLowerCase() ===
                    vehiclePlate.toLowerCase(),
              )
            : data;

          if (v) {
            const name =
              formatUserProfileName(v.owner) ||
              formatUserProfileName(v.driver) ||
              formatUserProfileName(v.driverName);
            const doc =
              v.owner?.nationalId || v.driver?.nationalId || v.driverDoc;

            if (name && !result.driverName) result.driverName = name;
            if (doc && !result.driverDoc) result.driverDoc = doc;
            if (v.unitNumber || v.routeNumber) {
              result.unitNumber = v.unitNumber || v.routeNumber;
            }
            if (v.brand || v.model) {
              result.vehicleModel = [v.brand, v.model]
                .filter(Boolean)
                .join(' ');
            }
            if (result.driverName) break;
          }
        }
      } catch {}
    }
  }

  // 4. Búsqueda en usuarios registrados coincidiendo con la cuenta activa
  if (!result.driverName) {
    try {
      const usersData = await fetchWithAuth('/users');
      if (Array.isArray(usersData) && usersData.length > 0) {
        const curUser = auth.currentUser;
        const matchingUser = usersData.find((u: any) => {
          if (curUser) {
            if (
              u.uuid === curUser.uid ||
              u.email === curUser.email ||
              u.phoneNumber === curUser.phoneNumber
            ) {
              return true;
            }
          }
          const roles = u.roles || [];
          return roles.some((r: any) => {
            const rName = (r?.name || r?.code || r || '')
              .toString()
              .toLowerCase();
            return rName === 'driver' || rName === 'conductor';
          });
        });

        if (matchingUser) {
          const name = formatUserProfileName(matchingUser);
          const doc =
            matchingUser.nationalId ||
            matchingUser.cedula ||
            matchingUser.idNumber;

          if (name) result.driverName = name;
          if (doc) result.driverDoc = doc;
        }
      }
    } catch {}
  }

  return result;
}

/**
 * Abre una nueva sesión de caja (turno) para el conductor.
 */
export async function openSession(
  vehicleUuid: string,
  routeUuid: string,
): Promise<any> {
  try {
    const session = await fetchWithAuth('/cash-sessions/open', {
      method: 'POST',
      body: JSON.stringify({ vehicleUuid, routeUuid }),
    });
    if (session) {
      await AsyncStorage.setItem(
        'gofare_active_cash_session',
        JSON.stringify(session),
      );
    }
    return session;
  } catch (err: any) {
    console.warn('[API] Backend error on openSession:', err?.message || err);

    // Intentar obtener si ya existe una sesión activa real en el servidor
    try {
      const active = await fetchWithAuth('/cash-sessions/me/current');
      if (active?.uuid) {
        await AsyncStorage.setItem(
          'gofare_active_cash_session',
          JSON.stringify(active),
        );
        return active;
      }
    } catch {}

    throw err;
  }
}

/**
 * Pausa la sesión de caja activa.
 */
export async function pauseSession(sessionUuid: string): Promise<any> {
  try {
    const session = await fetchWithAuth(`/cash-sessions/${sessionUuid}/pause`, {
      method: 'POST',
    });
    if (session) {
      await AsyncStorage.setItem(
        'gofare_active_cash_session',
        JSON.stringify(session),
      );
    }
    return session;
  } catch (err: any) {
    console.warn('[API] Backend error on pauseSession, fallback local:', err);
    try {
      const stored = await AsyncStorage.getItem('gofare_active_cash_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.status = 'paused';
        await AsyncStorage.setItem(
          'gofare_active_cash_session',
          JSON.stringify(parsed),
        );
        return parsed;
      }
    } catch {}
    return { status: 'paused', uuid: sessionUuid };
  }
}

/**
 * Reanuda la sesión de caja pausada.
 */
export async function resumeSession(sessionUuid: string): Promise<any> {
  try {
    const session = await fetchWithAuth(
      `/cash-sessions/${sessionUuid}/resume`,
      {
        method: 'POST',
      },
    );
    if (session) {
      await AsyncStorage.setItem(
        'gofare_active_cash_session',
        JSON.stringify(session),
      );
    }
    return session;
  } catch (err: any) {
    console.warn('[API] Backend error on resumeSession, fallback local:', err);
    try {
      const stored = await AsyncStorage.getItem('gofare_active_cash_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.status = 'open';
        await AsyncStorage.setItem(
          'gofare_active_cash_session',
          JSON.stringify(parsed),
        );
        return parsed;
      }
    } catch {}
    return { status: 'open', uuid: sessionUuid };
  }
}

/**
 * Cierra la sesión de caja activa y liquida el total al owner.
 */
export async function closeSession(sessionUuid: string): Promise<any> {
  try {
    const session = await fetchWithAuth(`/cash-sessions/${sessionUuid}/close`, {
      method: 'POST',
    });
    await AsyncStorage.removeItem('gofare_active_cash_session');
    return session;
  } catch (err: any) {
    console.warn('[API] Backend error on closeSession, fallback local:', err);
    await AsyncStorage.removeItem('gofare_active_cash_session');
    return { status: 'closed', uuid: sessionUuid };
  }
}

/**
 * Obtiene las unidades de transporte (vehículos) asignadas del conductor.
 * Consulta directamente al backend en PostgreSQL y nunca retorna datos mockeados.
 */
export async function getAssignedVehicles(): Promise<any[]> {
  try {
    // 1. Si hay una sesión activa de caja en el backend, tomar la unidad real de la sesión
    const activeSession = await getCurrentSession().catch(() => null);
    if (activeSession?.vehicle?.uuid) {
      return [activeSession.vehicle];
    }

    // 2. Consultar unidades asignadas directamente desde el backend (/vehicles/assigned)
    const res = await fetchWithAuth('/vehicles/assigned').catch(() => null);
    if (Array.isArray(res) && res.length > 0) {
      return res;
    }

    // 3. Fallback: intentar /vehicles/my
    const myUnits = await fetchWithAuth('/vehicles/my').catch(() => null);
    if (Array.isArray(myUnits) && myUnits.length > 0) {
      return myUnits;
    }

    // 4. Si el conductor no tiene unidades asignadas en base de datos, retornar arreglo vacío (sin mock)
    return [];
  } catch (err) {
    console.warn('[API] Error consultando vehículos asignados:', err);
    return [];
  }
}

/**
 * Obtiene las rutas asignadas para la operación del conductor.
 * Consulta al backend en PostgreSQL y nunca retorna datos mockeados.
 */
export async function getAssignedRoutes(): Promise<any[]> {
  try {
    // 1. Si hay una sesión activa de caja, tomar la ruta de la sesión
    const activeSession = await getCurrentSession().catch(() => null);
    if (activeSession?.route?.uuid) {
      return [activeSession.route];
    }

    // 2. Consultar rutas activas del backend
    const res = await fetchWithAuth('/routes').catch(() => null);
    if (Array.isArray(res) && res.length > 0) {
      return res.filter((r: any) => r.isActive !== false);
    }

    // Si no hay rutas asignadas, retornar arreglo vacío
    return [];
  } catch (err) {
    console.warn('[API] Error consultando rutas asignadas:', err);
    return [];
  }
}

/**
 * Obtiene el código QR de cobro de la sesión actual.
 */
export async function getSessionQr(
  sessionUuid: string,
): Promise<{ qr: string; expiresAt: string; ttlSeconds: number }> {
  let backendQrToken = '';
  let expiresAt = new Date(Date.now() + 90000).toISOString();
  let ttlSeconds = 90;

  try {
    const backendQr = await fetchWithAuth(`/cash-sessions/${sessionUuid}/qr`);
    if (backendQr?.qr) {
      backendQrToken = backendQr.qr;
      if (backendQr.expiresAt) expiresAt = backendQr.expiresAt;
      if (backendQr.ttlSeconds) ttlSeconds = backendQr.ttlSeconds;
    }
  } catch (_qrErr) {}

  // Enriquecer dinámicamente el QR con el nombre del conductor activo de la sesión
  let driverName = '';
  let driverDoc = '';
  let vehiclePlate = '';

  try {
    const storedSess = await AsyncStorage.getItem('gofare_active_cash_session');
    if (storedSess) {
      const sess = JSON.parse(storedSess);
      driverName =
        sess.driverName ||
        sess.driver?.displayName ||
        formatUserProfileName(sess.driver);
      driverDoc = sess.driverDoc || sess.driver?.nationalId || '';
      vehiclePlate = sess.vehicle?.plate || vehiclePlate;
    }
  } catch {}

  if (!driverName) {
    try {
      const cachedProfileStr = await AsyncStorage.getItem(
        'gofare_cached_user_profile',
      );
      if (cachedProfileStr) {
        const cached = JSON.parse(cachedProfileStr);
        driverName = formatUserProfileName(cached);
        if (!driverDoc) driverDoc = cached.nationalId || cached.cedula || '';
      }
    } catch {}
  }

  if (!driverName) {
    driverName = formatUserProfileName(auth.currentUser);
  }

  const qrPayload = {
    qr: backendQrToken || undefined,
    sid: sessionUuid,
    plate: vehiclePlate,
    driverName: driverName || undefined,
    driverDoc: driverDoc || undefined,
    ts: Date.now(),
  };

  return {
    qr: JSON.stringify(qrPayload),
    expiresAt,
    ttlSeconds,
  };
}

/**
 * Obtiene los cobros de pasajes (viajes/rides) asociados a una sesión de caja específica.
 */
export async function getSessionRides(sessionUuid: string): Promise<any[]> {
  return await fetchWithAuth(`/rides/session/${sessionUuid}`);
}

/**
 * Crea una invitación real en el backend.
 */
export async function createBackendInviteCode(): Promise<any> {
  return await fetchWithAuth('/invite-codes', {
    method: 'POST',
  });
}

/**
 * Canjea un código de invitación vinculando al conductor autenticado con el socio.
 */
export async function redeemBackendInviteCode(code: string): Promise<any> {
  return await fetchWithAuth('/invite-codes/redeem', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/**
 * Obtiene los códigos emitidos por el socio autenticado.
 */
export async function getBackendInviteCodes(): Promise<any[]> {
  return await fetchWithAuth('/invite-codes', {
    method: 'GET',
  });
}

/**
 * Obtiene las invitaciones y asociaciones del conductor autenticado (vigentes e históricas).
 */
export async function getMyDriverInviteCodes(): Promise<any[]> {
  try {
    return await fetchWithAuth('/invite-codes/mine');
  } catch (err) {
    console.warn('[API] Error al obtener asociaciones del conductor:', err);
    return [];
  }
}

/**
 * Obtiene la información del dueño / transportista al que está asociado el conductor autenticado.
 */
export async function getMyAssociatedOwner(): Promise<any | null> {
  try {
    // 1. Si hay una sesión activa de caja en el backend, revisar si incluye el owner
    const session = await getCurrentSession().catch(() => null);
    if (session?.owner) {
      return session.owner;
    }

    // 2. Consultar asociaciones activas vía /invite-codes/mine
    const codes = await getMyDriverInviteCodes();
    if (Array.isArray(codes)) {
      // Buscar la asociación activa: canjeada (usedAt != null) y no revocada (revokedAt == null)
      const activeAssociation = codes.find(
        (c: any) => c.usedAt && !c.revokedAt && c.owner,
      );
      if (activeAssociation?.owner) {
        return activeAssociation.owner;
      }
      // Fallback: cualquier código canjeado con owner
      const redeemed = codes.find(
        (c: any) => (c.isRedeemed || c.usedAt) && !c.revokedAt && c.owner,
      );
      if (redeemed?.owner) {
        return redeemed.owner;
      }
    }
    return null;
  } catch (err) {
    console.warn('[API] Error al obtener dueño asociado:', err);
    return null;
  }
}

/**
 * [Admin] Aprueba una unidad de transporte (inactive -> active).
 */
export async function approveVehicle(uuid: string): Promise<any> {
  return await fetchWithAuth(`/vehicles/${uuid}/approve`, {
    method: 'PATCH',
  });
}

/**
 * [Admin] Rechaza una unidad de transporte (inactive -> suspended/rejected).
 */
export async function rejectVehicle(uuid: string): Promise<any> {
  return await fetchWithAuth(`/vehicles/${uuid}/reject`, {
    method: 'PATCH',
  });
}

/**
 * Obtiene la lista de conductores asignados a una unidad específica desde el backend.
 * Endpoint: GET /vehicles/:vehicleUuid/drivers
 */
export async function getVehicleAssignedDrivers(
  vehicleUuid: string,
): Promise<any[]> {
  try {
    const res = await fetchWithAuth(`/vehicles/${vehicleUuid}/drivers`, {
      method: 'GET',
    });
    return Array.isArray(res) ? res : [];
  } catch (err) {
    console.warn(
      `[API] Error al obtener conductores asignados a la unidad ${vehicleUuid}:`,
      err,
    );
    return [];
  }
}

/**
 * Asigna un conductor a una unidad específica en el backend.
 * Endpoint: POST /vehicles/:vehicleUuid/drivers
 */
export async function assignDriverToVehicle(
  vehicleUuid: string,
  driverUuid: string,
): Promise<any> {
  return await fetchWithAuth(`/vehicles/${vehicleUuid}/drivers`, {
    method: 'POST',
    body: JSON.stringify({ driverUuid }),
  });
}

/**
 * Quita / desvincula un conductor de una unidad en el backend.
 * Endpoint: DELETE /vehicles/:vehicleUuid/drivers/:driverUuid
 */
export async function removeDriverFromVehicle(
  vehicleUuid: string,
  driverUuid: string,
): Promise<void> {
  await fetchWithAuth(`/vehicles/${vehicleUuid}/drivers/${driverUuid}`, {
    method: 'DELETE',
  });
}
