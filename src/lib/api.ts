import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';
import {
  BackendFareAccount,
  BackendTicket,
  BackendUser,
  FirebaseEmailRegisterDto,
  FirebaseIssuedCredentialsDto,
} from '@/interfaces';

// Determinar la URL base de forma inteligente para desarrollo local y producción
const getBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  // Si la URL del env existe y es una URL de producción (no local)
  if (
    envUrl &&
    !envUrl.includes('localhost') &&
    !envUrl.includes('127.0.0.1') &&
    !envUrl.includes('10.0.2.2')
  ) {
    return envUrl;
  }

  // En desarrollo local, intentamos detectar la IP de la computadora host de forma dinámica.
  // Esto permite conectar dispositivos físicos (por Wi-Fi) y emuladores sin configurar nada.
  const hostUri = Constants.expoConfig?.hostUri; // ej. "192.168.1.50:8081"
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:3000/api/v1`;
  }

  // Fallback si no se detecta la IP
  return envUrl || 'https://go-fare-backend-1.onrender.com/api/v1';
};

import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

const BASE_URL = getBaseUrl();
const GOFARE_JWT_KEY = 'gofare_jwt_token';
const BACKEND_JWT_KEY = 'backend_jwt';

/**
 * Guarda el token JWT de GoFare en el almacenamiento local.
 */
export async function saveGoFareToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(GOFARE_JWT_KEY, token);
    await AsyncStorage.setItem(BACKEND_JWT_KEY, token);
  } catch (error) {
    console.error('[API] Error al guardar el token JWT:', error);
  }
}

/**
 * Obtiene el token JWT de GoFare desde el almacenamiento local.
 */
export async function getGoFareToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(GOFARE_JWT_KEY);
  } catch (error) {
    console.error('[API] Error al obtener el token JWT:', error);
    return null;
  }
}

/**
 * Elimina el token JWT de GoFare del almacenamiento local.
 */
export async function clearGoFareToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GOFARE_JWT_KEY);
    await AsyncStorage.removeItem(BACKEND_JWT_KEY);
  } catch (error) {
    console.error('[API] Error al eliminar el token JWT:', error);
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
  firebaseUser: FirebaseAuthTypes.User,
): Promise<BackendAuthResponse> {
  const idToken = await firebaseUser.getIdToken();
  const response = await loginWithFirebaseToken(idToken);
  return response;
}


function sanitizeNumericFields(data: any): any {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(sanitizeNumericFields);
  }
  if (typeof data === 'object') {
    const copy = { ...data };
    for (const key in copy) {
      if (Object.prototype.hasOwnProperty.call(copy, key)) {
        if (copy[key] && typeof copy[key] === 'object') {
          copy[key] = sanitizeNumericFields(copy[key]);
        }
      }
    }
    if ('balance' in copy && copy.balance !== undefined && copy.balance !== null) {
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
 * Wrapper personalizado para peticiones fetch que añade automáticamente la cabecera
 * de autorización Bearer si hay un token disponible, y maneja errores globales.
 */
async function fetchWithAuth(
  path: string,
  options: RequestInit = {},
): Promise<any> {
  const token = await getGoFareToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Si la respuesta es No Content (204), retornamos null directamente
  if (response.status === 204) {
    return null;
  }

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      responseData.message || `Error del servidor (${response.status})`;

    // Si obtenemos un 401 Unauthorized, significa que el token expiró o es inválido
    // (por ejemplo, debido a una migración/cambio de proyecto Firebase).
    // Limpiamos el token y forzamos el cierre de sesión en el SDK nativo.
    if (response.status === 401) {
      await clearGoFareToken();
      try {
        const { sigOutAccount } = require('./firebase');
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
  const response = await fetch(`${BASE_URL}/auth/email/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || 'Error en el registro con el servidor backend.',
    );
  }

  return response.json();
}

/**
 * Envía un correo de verificación de email usando la API REST de Firebase Identity Toolkit.
 * Funciona con el idToken devuelto por el backend, sin necesidad de sesión nativa ni SHA-1.
 */
export async function sendFirebaseVerificationEmail(
  idToken: string,
): Promise<void> {
  const FIREBASE_API_KEY = Platform.select({
    ios: 'AIzaSyAptMIEEKqMB6M1K3IjWeaWxL6Ihi4RxL4',
    android: 'AIzaSyA9khlhufDxwggM-qC0acy9wmou1mrEtOQ',
    default: 'AIzaSyA9khlhufDxwggM-qC0acy9wmou1mrEtOQ',
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (Platform.OS === 'android') {
    headers['X-Android-Package'] = 'com.gofare.app';
  } else if (Platform.OS === 'ios') {
    headers['X-Ios-Bundle-Identifier'] = 'com.gofare.app';
  }

  const response = await fetch(
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
  const response = await fetch(`${BASE_URL}/auth/firebase-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${firebaseIdToken}`,
    },
  });

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
 * Obtiene la cuenta de tarifa del usuario por su ID de usuario del backend.
 */
export async function getFareAccountByUserId(
  userId: string,
): Promise<BackendFareAccount> {
  return await fetchWithAuth(`/fare/accounts/user/${userId}`);
}

/**
 * Crea una nueva cuenta de tarifa para un usuario.
 */
export async function createFareAccount(
  userId: string,
): Promise<BackendFareAccount> {
  return await fetchWithAuth('/fare/accounts', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      balance: 0,
      isActive: true,
    }),
  });
}

/**
 * Añade saldo a la cuenta de tarifa del usuario.
 */
export async function addAccountBalance(
  accountId: string,
  amount: number,
): Promise<BackendFareAccount> {
  return await fetchWithAuth(`/fare/accounts/${accountId}/add-balance`, {
    method: 'POST',
    body: JSON.stringify({
      amount,
      description: 'Recarga saldo por la App Móvil',
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
  return await fetchWithAuth(`/fare/accounts/${accountId}/deduct-balance`, {
    method: 'POST',
    body: JSON.stringify({
      amount,
      description: 'Débito automático por viaje',
    }),
  });
}

/**
 * Obtiene los boletos / viajes de un usuario por su ID del backend.
 */
export async function getUserTickets(userId: string): Promise<BackendTicket[]> {
  return await fetchWithAuth(`/tickets/user/${userId}`);
}

/**
 * Obtiene el historial de transacciones de la cuenta de tarifa.
 */
export async function getAccountTransactions(
  accountId: string,
): Promise<any[]> {
  return await fetchWithAuth(`/fare/transactions?accountId=${accountId}`);
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
  return await fetchWithAuth('/tickets', {
    method: 'POST',
    body: JSON.stringify({
      ...ticketData,
      status: ticketData.status || 'active',
    }),
  });
}

/**
 * Obtiene la información de un boleto por su código QR único.
 */
export async function getTicketByQr(qrCode: string): Promise<BackendTicket> {
  return await fetchWithAuth(`/tickets/qr/${qrCode}`);
}

/**
 * Valida un boleto utilizando su código QR en una unidad (lo marca como usado).
 */
export async function validateTicketByQr(
  qrCode: string,
): Promise<BackendTicket> {
  return await fetchWithAuth(`/tickets/validate/${qrCode}`, {
    method: 'POST',
  });
}

/**
 * Cooperativas simuladas para pruebas en frontend en caso de error del servidor.
 */
export const MOCK_COOPERATIVES = [
  { uuid: 'coop-1', name: 'Cooperativa Caracas Move R.L.', rif: 'J-304598124' },
  { uuid: 'coop-2', name: 'Línea de Transporte Chacao', rif: 'J-401234567' },
  { uuid: 'coop-3', name: 'Asociación de Conductores La India', rif: 'J-298765432' },
  { uuid: 'coop-4', name: 'Cooperativa Metrópolis', rif: 'J-311223344' },
];

/**
 * Envía una solicitud para registrarse como dueño de vehículo.
 */
export async function submitVehicleOwnerRequest(requestData: {
  businessName: string;
  idNumber: string;
}): Promise<any> {
  try {
    await AsyncStorage.setItem(
      'mock_vehicle_owner_cooperative',
      JSON.stringify(requestData)
    );
  } catch (storageErr) {
    console.warn('[API] Error al guardar cooperativa de dueño localmente:', storageErr);
  }

  try {
    return await fetchWithAuth('/vehicle-owner-requests', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  } catch (error) {
    console.warn('[API] submitVehicleOwnerRequest falló en backend (se usará mock local):', error);
    return { success: true, mocked: true };
  }
}

/**
 * Envía una solicitud para registrar un vehículo (propietario ya aprobado).
 */
export async function submitVehicleRequest(requestData: {
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  licensePlate: string;
  cooperativeUuid?: string;
}): Promise<any> {
  // Guardar localmente en AsyncStorage para simulación
  try {
    const existingStr = await AsyncStorage.getItem('mock_vehicle_requests');
    const existing = existingStr ? JSON.parse(existingStr) : [];
    
    let coopName = 'Particular / Ninguna';
    if (requestData.cooperativeUuid) {
      const found = MOCK_COOPERATIVES.find(c => c.uuid === requestData.cooperativeUuid);
      if (found) coopName = found.name;
    }

    const newRequest = {
      uuid: `mock-veh-${Date.now()}`,
      vehicleMake: requestData.vehicleMake,
      vehicleModel: requestData.vehicleModel,
      vehicleYear: requestData.vehicleYear,
      licensePlate: requestData.licensePlate,
      cooperativeName: coopName,
      status: 'pending',
      createdAt: new Date().toLocaleDateString('es-VE'), // formato DD/MM/YYYY
    };

    existing.unshift(newRequest);
    await AsyncStorage.setItem('mock_vehicle_requests', JSON.stringify(existing));
  } catch (storageErr) {
    console.warn('[API] Error al guardar vehículo localmente:', storageErr);
  }

  try {
    return await fetchWithAuth('/vehicle-requests', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  } catch (error) {
    console.warn('[API] submitVehicleRequest falló en backend (se guardó localmente como simulado):', error);
    return { success: true, mocked: true };
  }
}

/**
 * Obtiene la lista de cooperativas registradas.
 */
export async function getCooperatives(): Promise<any[]> {
  try {
    return await fetchWithAuth('/cooperatives');
  } catch (error) {
    console.warn('[API] getCooperatives falló, usando datos simulados:', error);
    return MOCK_COOPERATIVES;
  }
}

/**
 * Envía una solicitud para registrarse como conductor.
 */
export async function submitDriverRequest(requestData: {
  licenseNumber: string;
  licenseType: string;
  experienceYears: number;
  emergencyPhone: string;
}): Promise<any> {
  return await fetchWithAuth('/driver-requests', {
    method: 'POST',
    body: JSON.stringify(requestData),
  });
}

