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
import { auth, sigOutAccount } from './firebase';

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
  timeoutMs = 8000,
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

  const response = await fetchWithTimeout(`${BASE_URL}${path}`, {
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
  const response = await fetchWithTimeout(`${BASE_URL}/auth/register`, {
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
  const response = await fetchWithTimeout(`${BASE_URL}/auth/login`, {
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
    return JSON.parse(data);
  }
  const newAccount: BackendFareAccount = {
    id: `local-acc-${userId}`,
    userId,
    balance: 100.0, // Saldo inicial de cortesía para pruebas locales
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
    if (isPhoneVerificationError(err) || transactionData.fareAccountId.startsWith('local-')) {
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

      const transactions = await getLocalTransactions(transactionData.fareAccountId);
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
        console.log(`[API] Sincronizando ${localTickets.length} boletos locales al backend...`);
        
        const failedTickets: BackendTicket[] = [];
        for (const localTkt of localTickets) {
          try {
            await fetchWithAuth('/tickets', {
              method: 'POST',
              body: JSON.stringify({
                userId,
                qrCode: localTkt.qrCode.startsWith('local-qr-') ? undefined : localTkt.qrCode,
                price: localTkt.price,
                status: localTkt.status,
                route: localTkt.route || 'General',
                origin: localTkt.origin || 'Origen',
                destination: localTkt.destination || 'Destino',
              }),
            });
          } catch (postErr) {
            console.warn('[API] Error al sincronizar boleto individual:', postErr);
            failedTickets.push(localTkt);
          }
        }
        
        // Si falló la subida de algún boleto, restaurarlos localmente
        if (failedTickets.length > 0) {
          await saveLocalTickets(userId, failedTickets);
        } else {
          console.log('[API] Sincronización de boletos locales finalizada con éxito.');
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
        await AsyncStorage.setItem('mock_global_tickets', JSON.stringify(globalTickets));
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
          status: (data.status || tickets[idx].status) as BackendTicket['status'],
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
 * Cooperativas simuladas para pruebas en frontend en caso de error del servidor.
 */
export const MOCK_COOPERATIVES = [
  { uuid: 'coop-1', name: 'Cooperativa Caracas Move R.L.', rif: 'J-304598124' },
  { uuid: 'coop-2', name: 'Línea de Transporte Chacao', rif: 'J-401234567' },
  {
    uuid: 'coop-3',
    name: 'Asociación de Conductores La India',
    rif: 'J-298765432',
  },
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
      JSON.stringify(requestData),
    );
  } catch (storageErr) {
    console.warn(
      '[API] Error al guardar cooperativa de dueño localmente:',
      storageErr,
    );
  }

  try {
    return await fetchWithAuth('/vehicle-owner-requests', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  } catch (error) {
    console.warn(
      '[API] submitVehicleOwnerRequest falló en backend (se usará mock local):',
      error,
    );
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
      const found = MOCK_COOPERATIVES.find(
        (c) => c.uuid === requestData.cooperativeUuid,
      );
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
    await AsyncStorage.setItem(
      'mock_vehicle_requests',
      JSON.stringify(existing),
    );
  } catch (storageErr) {
    console.warn('[API] Error al guardar vehículo localmente:', storageErr);
  }

  try {
    return await fetchWithAuth('/vehicle-requests', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  } catch (error) {
    console.warn(
      '[API] submitVehicleRequest falló en backend (se guardó localmente como simulado):',
      error,
    );
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
