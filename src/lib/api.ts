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

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
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
 * Wrapper personalizado para peticiones fetch que añade automáticamente la cabecera
 * de autorización Bearer si hay un token disponible, y maneja errores globales.
 */
async function fetchWithAuth(
  path: string,
  options: RequestInit = {},
  timeoutMs?: number,
): Promise<any> {
  const token = await getGoFareToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetchWithTimeout(
    `${BASE_URL}${path}`,
    {
      ...options,
      headers,
    },
    timeoutMs,
  );

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
    throw new Error(
      errorData.message || 'Error en el registro con el servidor backend.',
    );
  }

  return response.json();
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
  firstName?: string;
  lastName?: string;
  displayName?: string;
  roleIds?: string[];
}): Promise<BackendUser> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/users`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
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
  const whitelistedData: Partial<{
    displayName: string;
    firstName: string;
    lastName: string;
  }> = {};

  if (data.displayName !== undefined) {
    whitelistedData.displayName = data.displayName;
  }
  if (data.firstName !== undefined) {
    whitelistedData.firstName = data.firstName;
  }
  if (data.lastName !== undefined) {
    whitelistedData.lastName = data.lastName;
  }

  // NOTA: phoneNumber y nationalId se omiten del cuerpo de la petición PUT /users/:id
  // porque el backend (UpdateUserDto) no los permite en actualizaciones de perfil y devuelve 400.
  // El nationalId ya se guarda automáticamente en PostgreSQL mediante las Custom Claims de Firebase en el primer login.
  // El phoneNumber se vincula por separado mediante verificación SMS en /auth/phone/link por motivos de seguridad.

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
  return await fetchWithAuth('/transport-owners/me/application', {
    method: 'POST',
    body: JSON.stringify({
      legalName: requestData.businessName,
      rif: requestData.idNumber,
    }),
  });
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
  vehicleColor?: string;
}): Promise<any> {
  return await fetchWithAuth('/vehicles', {
    method: 'POST',
    body: JSON.stringify({
      plate: requestData.licensePlate,
      brand: requestData.vehicleMake,
      model: requestData.vehicleModel,
      year: requestData.vehicleYear,
      color: requestData.vehicleColor,
      capacity: 32,
      status: 'inactive', // status válido del enum del backend para nuevo vehículo en revisión
    }),
  });
}

/**
 * Obtiene las unidades de transporte (vehículos) del socio autenticado.
 */
export async function getOwnerVehicles(): Promise<any[]> {
  let backendVehicles: any[] = [];
  try {
    const list = await fetchWithAuth('/vehicles/my');
    if (Array.isArray(list)) {
      backendVehicles = list.map((v: any) => {
        let appStatus: 'approved' | 'pending' | 'rejected' = 'pending';
        if (v.status === 'active') {
          appStatus = 'approved';
        } else if (v.status === 'rejected') {
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
          cooperativeName: 'Particular / Ninguna',
          status: appStatus,
          createdAt: new Date(v.createdAt).toLocaleDateString('es-VE'),
          totalEarnings: 0,
          tripsCount: 0,
        };
      });
    }
  } catch (error) {
    console.warn(
      '[API] getOwnerVehicles backend falló, usando sólo local:',
      error,
    );
  }

  // Leer placas de vehículos dados de baja
  let deletedPlates: string[] = [];
  try {
    const deletedPlatesStr = await AsyncStorage.getItem(
      'mock_deleted_vehicle_plates',
    );
    if (deletedPlatesStr) {
      deletedPlates = JSON.parse(deletedPlatesStr);
    }
  } catch {}

  // Leer solicitudes y vehículos guardados en mock_vehicle_requests
  let localVehicles: any[] = [];
  try {
    const localStr = await AsyncStorage.getItem('mock_vehicle_requests');
    if (localStr) {
      localVehicles = JSON.parse(localStr);
    }
  } catch {}

  // Combinar
  const combined = [...backendVehicles];

  // Agregar los locales que no colisionen por placa o uuid
  for (const lv of localVehicles) {
    if (deletedPlates.includes(lv.licensePlate)) continue;
    const idx = combined.findIndex(
      (bv) => bv.licensePlate === lv.licensePlate || bv.uuid === lv.uuid,
    );
    if (idx !== -1) {
      combined[idx] = {
        ...combined[idx],
        assignedDriver: lv.assignedDriver || combined[idx].assignedDriver,
        totalEarnings: lv.totalEarnings || combined[idx].totalEarnings,
        tripsCount: lv.tripsCount || combined[idx].tripsCount,
        status: lv.status || combined[idx].status,
      };
    } else {
      combined.push(lv);
    }
  }

  return combined.filter((v) => !deletedPlates.includes(v.licensePlate));
}

/**
 * Obtiene el detalle de un vehículo por su UUID.
 */
export async function getVehicleDetail(uuid: string): Promise<any> {
  const isMockUuid = uuid.length < 10 || uuid.startsWith('mock-');

  if (!isMockUuid) {
    try {
      const v = await fetchWithAuth(`/vehicles/${uuid}`);
      if (v) {
        let appStatus: 'approved' | 'pending' | 'rejected' = 'pending';
        if (v.status === 'active') {
          appStatus = 'approved';
        } else if (v.status === 'rejected') {
          appStatus = 'rejected';
        } else if (v.status === 'inactive') {
          appStatus = 'pending';
        }

        let assignedDriver: any;
        try {
          const localStr = await AsyncStorage.getItem('mock_vehicle_requests');
          const localVehicles = localStr ? JSON.parse(localStr) : [];
          const localMatch = localVehicles.find(
            (lv: any) => lv.uuid === uuid || lv.licensePlate === v.plate,
          );
          if (localMatch) {
            assignedDriver = localMatch.assignedDriver;
          }
        } catch {}

        return {
          uuid: v.uuid,
          vehicleMake: v.brand,
          vehicleModel: v.model,
          vehicleYear: v.year,
          licensePlate: v.plate,
          cooperativeName: 'Particular / Ninguna',
          status: appStatus,
          createdAt: new Date(v.createdAt).toLocaleDateString('es-VE'),
          totalEarnings: 0,
          tripsCount: 0,
          assignedDriver,
          color: v.color,
          capacity: v.capacity,
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
  }

  const allVehicles = await getOwnerVehicles();
  const found = allVehicles.find((v) => v.uuid === uuid);
  return found || null;
}

/**
 * Da de baja un vehículo por su UUID.
 */
export async function deleteVehicle(uuid: string): Promise<any> {
  const isMockUuid = uuid.length < 10 || uuid.startsWith('mock-');

  if (!isMockUuid) {
    try {
      await fetchWithAuth(`/vehicles/${uuid}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('[API] Error al eliminar vehículo del backend:', err);
    }
  }

  try {
    const list = await getOwnerVehicles();
    const target = list.find((v) => v.uuid === uuid);
    if (target?.licensePlate) {
      const deletedPlatesStr = await AsyncStorage.getItem(
        'mock_deleted_vehicle_plates',
      );
      const deletedPlates = deletedPlatesStr
        ? JSON.parse(deletedPlatesStr)
        : [];
      deletedPlates.push(target.licensePlate);
      await AsyncStorage.setItem(
        'mock_deleted_vehicle_plates',
        JSON.stringify(deletedPlates),
      );
    }

    const localStr = await AsyncStorage.getItem('mock_vehicle_requests');
    if (localStr) {
      const localVehicles = JSON.parse(localStr);
      const filtered = localVehicles.filter((v: any) => v.uuid !== uuid);
      await AsyncStorage.setItem(
        'mock_vehicle_requests',
        JSON.stringify(filtered),
      );
    }
  } catch (storageErr) {
    console.warn(
      '[API] Error al actualizar baja de vehículo en AsyncStorage:',
      storageErr,
    );
  }

  return { success: true };
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

  return await fetchWithAuth('/legal-documents', {
    method: 'POST',
    body: JSON.stringify({
      type: requestData.type,
      fileUrl: requestData.fileUrl,
      documentNumber: requestData.documentNumber,
      vehicleUuid: requestData.vehicleUuid,
      issuedAt: requestData.issuedAt,
      expiresAt: requestData.expiresAt,
    }),
  });
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

/**
 * Obtiene la lista completa de usuarios registrados.
 * @returns Lista de usuarios (BackendUser[])
 */
export async function getAllUsers(): Promise<BackendUser[]> {
  return fetchWithAuth('/users');
}

/**
 * Obtiene todas las transacciones de tarifa del sistema.
 */
export async function getAllTransactions(): Promise<any[]> {
  return fetchWithAuth('/fare/transactions');
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
const CIVIL_ASSOC_MOCKS_KEY = 'gofare_civil_assoc_mocks';

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
  let realAssocs: any[] = [];
  let users: any[] = [];

  try {
    users = await getAllUsers();
    realAssocs = users.filter((u: any) => {
      const roles = u.roles || [];
      return roles.some((r: any) => r.name === 'civil_association');
    });
  } catch (err) {
    console.warn(
      '[API] Falló la obtención de usuarios reales para asociaciones:',
      err,
    );
  }

  const metadata = await getCivilAssociationsMetadata();

  // Enriquecer asociaciones reales con sus metadatos
  const enrichedReal = realAssocs.map((u: any) => {
    const meta = metadata[u.uuid] || {
      position: 'Presidente',
      status: 'approved',
      rejectionReason: '',
    };
    return {
      ...u,
      position: meta.position,
      status: meta.status,
      rejectionReason: (meta as any).rejectionReason || '',
    };
  });

  // Cargar también las asociaciones simuladas (para pruebas sin conexión a Neon DB)
  let mockAssocs: any[] = [];
  try {
    const cachedMocks = await AsyncStorage.getItem(CIVIL_ASSOC_MOCKS_KEY);
    if (cachedMocks) {
      mockAssocs = JSON.parse(cachedMocks);
      // Limpiar los mocks por defecto que confunden al usuario
      if (mockAssocs.some((m: any) => m.uuid === 'mock-ca-1')) {
        mockAssocs = [];
        await AsyncStorage.removeItem(CIVIL_ASSOC_MOCKS_KEY);
      }
    } else {
      mockAssocs = [];
    }
  } catch (_) {}

  // Si el backend falló o no tiene asociaciones reales, retornar la lista de mocks.
  // Si hay reales, las combinamos (excluyendo duplicados por correo o cédula si es necesario)
  const combined = [...enrichedReal];
  for (const mock of mockAssocs) {
    const exists = combined.some(
      (r) => r.email === mock.email || r.nationalId === mock.nationalId,
    );
    if (!exists) {
      combined.push(mock);
    }
  }

  return combined;
}

export async function registerCivilAssociation(data: {
  userUuid?: string; // Si se promueve uno existente
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  nationalId?: string;
  position: string;
  status: string;
}): Promise<any> {
  // Si estamos promoviendo a un usuario real
  if (data.userUuid) {
    // Buscar el UUID del rol civil_association
    const roleUuid = await resolveRoleUuid('civil_association');
    if (!roleUuid) {
      throw new Error(
        'No se pudo resolver el identificador del rol Asociación Civil.',
      );
    }

    // Asignar el rol real en el backend
    try {
      await updateUserRoles(data.userUuid, [roleUuid]);
    } catch (err) {
      console.warn(
        '[API] Error al asignar rol en backend, procediendo con simulación local:',
        err,
      );
    }

    // Guardar metadatos locales (cargo y estado)
    await saveCivilAssociationMetadata(
      data.userUuid,
      data.position,
      data.status,
    );
    return { success: true, userUuid: data.userUuid };
  }

  // Si estamos creando uno nuevo y no tenemos conexión o el usuario prefiere registro local
  const newMock = {
    uuid: `mock-ca-${Date.now()}`,
    firstName: data.firstName || 'Sin Nombre',
    lastName: data.lastName || '',
    displayName: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
    email: data.email || `ca-${Date.now()}@gofare.local`,
    phoneNumber: data.phoneNumber || '',
    nationalId: data.nationalId || '',
    position: data.position,
    status: data.status,
    roles: [{ name: 'civil_association', uuid: 'mock-role-civil' }],
    createdAt: new Date().toISOString(),
  };

  try {
    const cachedMocks = await AsyncStorage.getItem(CIVIL_ASSOC_MOCKS_KEY);
    const mocks = cachedMocks ? JSON.parse(cachedMocks) : [];
    mocks.unshift(newMock);
    await AsyncStorage.setItem(CIVIL_ASSOC_MOCKS_KEY, JSON.stringify(mocks));
  } catch (err) {
    console.warn('[API] Error al registrar asociación simulada:', err);
  }

  return newMock;
}

export async function updateCivilAssociationProfile(
  uuid: string,
  data: {
    position?: string;
    status?: string;
    rejectionReason?: string;
  },
): Promise<any> {
  // Si es un mock local
  if (uuid.startsWith('mock-ca-')) {
    try {
      const cachedMocks = await AsyncStorage.getItem(CIVIL_ASSOC_MOCKS_KEY);
      if (cachedMocks) {
        const mocks = JSON.parse(cachedMocks);
        const updated = mocks.map((m: any) => {
          if (m.uuid === uuid) {
            return { ...m, ...data };
          }
          return m;
        });
        await AsyncStorage.setItem(
          CIVIL_ASSOC_MOCKS_KEY,
          JSON.stringify(updated),
        );
      }
    } catch (_) {}
    return { uuid, ...data };
  }

  // Si es un usuario real, guardamos su cargo y estado localmente
  const metadata = await getCivilAssociationsMetadata();
  const current = metadata[uuid] || {
    position: 'Presidente',
    status: 'approved',
    rejectionReason: '',
  };

  const updatedMeta = {
    position: data.position !== undefined ? data.position : current.position,
    status: data.status !== undefined ? data.status : current.status,
    rejectionReason:
      data.rejectionReason !== undefined
        ? data.rejectionReason
        : (current as any).rejectionReason || '',
  };

  try {
    const fullMeta = await getCivilAssociationsMetadata();
    fullMeta[uuid] = updatedMeta;
    await AsyncStorage.setItem(
      CIVIL_ASSOC_METADATA_KEY,
      JSON.stringify(fullMeta),
    );
  } catch (err) {
    console.warn('[API] Error al guardar metadatos de asociación civil:', err);
  }

  return { uuid, ...data };
}

/**
 * Obtiene la lista de todos los documentos presentados en la plataforma.
 * Intenta consumir del backend, si no existe el endpoint usa datos mock de AsyncStorage.
 */
export async function getAllDocuments(): Promise<any[]> {
  // 1. Intentar obtener datos actualizados en tiempo real del backend
  try {
    const docs = await fetchWithAuth('/legal-documents');
    if (Array.isArray(docs)) {
      await AsyncStorage.setItem('mock_admin_documents', JSON.stringify(docs));
      return docs;
    }
  } catch (err: any) {
    // Si falla la red o da 404, usamos el fallback de AsyncStorage
    console.warn(
      '[API] Error al consultar documentos del backend, usando caché local:',
      err.message || err,
    );
  }

  // 2. Fallback de caché local en AsyncStorage
  try {
    const cached = await AsyncStorage.getItem('mock_admin_documents');
    if (cached) {
      const cachedDocs = JSON.parse(cached);
      if (Array.isArray(cachedDocs)) {
        // Filtrar mocks obsoletos
        return cachedDocs.filter(
          (d: any) =>
            d &&
            d.uuid !== 'doc-1111-2222' &&
            d.uuid !== 'doc-3333-4444' &&
            d.uuid !== 'doc-5555-6666',
        );
      }
    }
  } catch (err) {
    console.warn('[API] Error al leer caché de documentos:', err);
  }

  return [];
}

/**
 * Aprueba un documento de conductor/dueño.
 * @param uuid - Identificador del documento
 */
export async function verifyDocument(uuid: string): Promise<any> {
  try {
    const res = await fetchWithAuth(`/legal-documents/${uuid}/verify`, {
      method: 'PATCH',
    });
    return res;
  } catch (err) {
    console.warn(
      '[API] verifyDocument falló en backend, actualizando local:',
      err,
    );
  }

  const cached = await AsyncStorage.getItem('mock_admin_documents');
  const docs = cached ? JSON.parse(cached) : [];
  const updated = docs.map((d: any) => {
    if (d.uuid === uuid) {
      return {
        ...d,
        status: 'verified',
        verifiedBy: { displayName: 'Administrador' },
      };
    }
    return d;
  });
  await AsyncStorage.setItem('mock_admin_documents', JSON.stringify(updated));
  return { uuid, status: 'verified' };
}

/**
 * Rechaza un documento con un motivo opcional.
 * @param uuid - Identificador del documento
 * @param reason - Motivo del rechazo
 */
export async function rejectDocument(
  uuid: string,
  reason: string,
): Promise<any> {
  try {
    const res = await fetchWithAuth(`/legal-documents/${uuid}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
    return res;
  } catch (err) {
    console.warn(
      '[API] rejectDocument falló en backend, actualizando local:',
      err,
    );
  }

  const cached = await AsyncStorage.getItem('mock_admin_documents');
  const docs = cached ? JSON.parse(cached) : [];
  const updated = docs.map((d: any) => {
    if (d.uuid === uuid) {
      return {
        ...d,
        status: 'rejected',
        rejectionReason: reason,
        verifiedBy: { displayName: 'Administrador' },
      };
    }
    return d;
  });
  await AsyncStorage.setItem('mock_admin_documents', JSON.stringify(updated));
  return { uuid, status: 'rejected', rejectionReason: reason };
}

/**
 * Obtiene todas las unidades de transporte registradas.
 * Intenta consumir del backend, si no existe el endpoint usa datos mock de AsyncStorage.
 */
export async function getAllTransportUnits(): Promise<any[]> {
  try {
    const units = await fetchWithAuth('/vehicles');
    if (Array.isArray(units)) {
      return units.map((u: any) => ({
        uuid: u.uuid,
        plate: u.plate,
        brand: u.brand,
        model: u.model,
        inviteCode: u.inviteCode || `INV-${u.plate.toUpperCase()}`,
        isActive: u.status === 'active',
        owner: u.owner
          ? {
              displayName:
                u.owner.displayName ||
                `${u.owner.firstName || ''} ${u.owner.lastName || ''}`,
              email: u.owner.email,
            }
          : {
              displayName: 'Dueño GoFare',
              email: '',
            },
      }));
    }
  } catch (err) {
    console.error('[API] Error fetching transport units from backend:', err);
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
 * Obtiene todas las solicitudes de registro de dueños de vehículos.
 * Si está vacío, se auto-inicializa basándose en usuarios reales con rol 'transport_owner' en PostgreSQL.
 */
export async function getAllOwnerRequests(): Promise<any[]> {
  let cachedRequests: any[] = [];
  try {
    const cached = await AsyncStorage.getItem('mock_global_owner_requests');
    if (cached) {
      cachedRequests = JSON.parse(cached);
    }
  } catch (err) {
    console.warn(
      '[API] Error al leer solicitudes de socio de AsyncStorage:',
      err,
    );
  }

  // Filtrar los mocks por defecto que confunden al usuario
  cachedRequests = cachedRequests.filter(
    (r: any) => r && !r.uuid.startsWith('owner-req-'),
  );

  // Consulta en segundo plano
  Promise.all([
    fetchWithAuth('/transport-owners?status=pending_review'),
    fetchWithAuth('/transport-owners?status=approved'),
    fetchWithAuth('/transport-owners?status=rejected'),
  ])
    .then(async ([pending, approved, rejected]) => {
      const mappedPending = pending.map((o: any) => ({
        uuid: o.uuid,
        userUuid: o.user?.uuid || o.user?.id,
        displayName:
          o.user?.displayName ||
          `${o.user?.firstName || ''} ${o.user?.lastName || ''}`,
        email: o.user?.email,
        nationalId: o.user?.nationalId,
        phoneNumber: o.user?.phoneNumber,
        businessName: o.legalName,
        idNumber: o.rif,
        status: 'pending',
        createdAt: o.submittedAt || o.createdAt,
        rejectionReason: o.rejectionReason,
      }));

      const mappedApproved = approved.map((o: any) => ({
        uuid: o.uuid,
        userUuid: o.user?.uuid || o.user?.id,
        displayName:
          o.user?.displayName ||
          `${o.user?.firstName || ''} ${o.user?.lastName || ''}`,
        email: o.user?.email,
        nationalId: o.user?.nationalId,
        phoneNumber: o.user?.phoneNumber,
        businessName: o.legalName,
        idNumber: o.rif,
        status: 'approved',
        createdAt: o.submittedAt || o.createdAt,
      }));

      const mappedRejected = rejected.map((o: any) => ({
        uuid: o.uuid,
        userUuid: o.user?.uuid || o.user?.id,
        displayName:
          o.user?.displayName ||
          `${o.user?.firstName || ''} ${o.user?.lastName || ''}`,
        email: o.user?.email,
        nationalId: o.user?.nationalId,
        phoneNumber: o.user?.phoneNumber,
        businessName: o.legalName,
        idNumber: o.rif,
        status: 'rejected',
        createdAt: o.submittedAt || o.createdAt,
        rejectionReason: o.rejectionReason,
      }));

      const merged = [...mappedPending, ...mappedApproved, ...mappedRejected];
      await AsyncStorage.setItem(
        'mock_global_owner_requests',
        JSON.stringify(merged),
      );
    })
    .catch(async (error) => {
      // Silenciar warnings esperados
      if (
        error.message &&
        !error.message.includes('404') &&
        !error.message.includes('Cannot GET') &&
        !error.message.includes('servidor')
      ) {
        console.warn(
          '[API] Error en segundo plano al actualizar solicitudes de socio:',
          error,
        );
      }
    });

  return cachedRequests;
}

/**
 * Aprueba una solicitud de dueño de vehículo.
 */
export async function verifyOwnerRequest(
  requestUuid: string,
  userUuid: string,
): Promise<any> {
  try {
    await fetchWithAuth(`/transport-owners/${requestUuid}/approve`, {
      method: 'PATCH',
    });
  } catch (err) {
    console.warn(
      '[API] Error al aprobar la solicitud del dueño en Render, intentando fallback de rol:',
      err,
    );
    try {
      await updateUserRoles(userUuid, ['3']);
    } catch (roleErr) {
      console.warn('[API] Fallback de rol también falló:', roleErr);
      throw new Error('No se pudo aprobar al socio en el servidor.');
    }
  }

  try {
    const cached = await AsyncStorage.getItem('mock_global_owner_requests');
    if (cached) {
      const requests = JSON.parse(cached);
      const updated = requests.map((r: any) => {
        if (r.uuid === requestUuid) {
          return { ...r, status: 'approved' };
        }
        return r;
      });
      await AsyncStorage.setItem(
        'mock_global_owner_requests',
        JSON.stringify(updated),
      );
    }
  } catch (storageErr) {
    console.warn(
      '[API] Error al actualizar estado de solicitud aprobada:',
      storageErr,
    );
  }

  return { requestUuid, status: 'approved' };
}

/**
 * Rechaza una solicitud de socio con un motivo.
 */
export async function rejectOwnerRequest(
  requestUuid: string,
  reason: string,
): Promise<any> {
  try {
    await fetchWithAuth(`/transport-owners/${requestUuid}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  } catch (err) {
    console.warn(
      '[API] Error al rechazar la solicitud del dueño en Render:',
      err,
    );
  }

  try {
    const cached = await AsyncStorage.getItem('mock_global_owner_requests');
    if (cached) {
      const requests = JSON.parse(cached);
      const updated = requests.map((r: any) => {
        if (r.uuid === requestUuid) {
          return { ...r, status: 'rejected', rejectionReason: reason };
        }
        return r;
      });
      await AsyncStorage.setItem(
        'mock_global_owner_requests',
        JSON.stringify(updated),
      );
    }
  } catch (storageErr) {
    console.warn(
      '[API] Error al actualizar estado de solicitud rechazada:',
      storageErr,
    );
  }

  return { requestUuid, status: 'rejected', rejectionReason: reason };
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
      bcvRate: 40.0,
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
}> {
  return await fetchWithAuth('/rides/preview', {
    method: 'POST',
    body: JSON.stringify({ qr }),
  });
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
  return await fetchWithAuth('/rides/confirm', {
    method: 'POST',
    body: JSON.stringify({ qr }),
  });
}

// ─── SESIONES DE CAJA (TURNOS DEL CONDUCTOR) ──────────────────────────────────

/**
 * Obtiene la sesión de caja (turno) activa del conductor autenticado.
 */
export async function getCurrentSession(): Promise<any> {
  const session = await fetchWithAuth('/cash-sessions/me/current');
  if (!session?.uuid) {
    return null;
  }
  return session;
}

/**
 * Abre una nueva sesión de caja (turno) para el conductor.
 */
export async function openSession(
  vehicleUuid: string,
  routeUuid: string,
): Promise<any> {
  return await fetchWithAuth('/cash-sessions/open', {
    method: 'POST',
    body: JSON.stringify({ vehicleUuid, routeUuid }),
  });
}

/**
 * Pausa la sesión de caja activa.
 */
export async function pauseSession(sessionUuid: string): Promise<any> {
  return await fetchWithAuth(`/cash-sessions/${sessionUuid}/pause`, {
    method: 'POST',
  });
}

/**
 * Reanuda la sesión de caja pausada.
 */
export async function resumeSession(sessionUuid: string): Promise<any> {
  return await fetchWithAuth(`/cash-sessions/${sessionUuid}/resume`, {
    method: 'POST',
  });
}

/**
 * Cierra la sesión de caja activa y liquida el total al owner.
 */
export async function closeSession(sessionUuid: string): Promise<any> {
  return await fetchWithAuth(`/cash-sessions/${sessionUuid}/close`, {
    method: 'POST',
  });
}

/**
 * Obtiene las unidades de transporte (vehículos) asignadas del conductor (del owner asociado).
 * Simulado localmente con UUIDs reales de la base de datos de pruebas para no alterar el backend.
 */
export async function getAssignedVehicles(): Promise<any[]> {
  return [
    {
      uuid: 'e8e3f885-e18f-4d81-8d8a-1646c85957f9',
      plate: 'XY987ZT',
      brand: 'Encava',
      model: 'ENT-610',
      year: 2015,
      capacity: 32,
      color: 'Blanco',
      status: 'active',
      routeNumber: 'Ruta L1',
    },
  ];
}

/**
 * Obtiene las rutas de transporte asignadas del conductor (del owner asociado).
 * Simulado localmente con UUIDs reales de la base de datos de pruebas para no alterar el backend.
 */
export async function getAssignedRoutes(): Promise<any[]> {
  return [
    {
      uuid: '8ba1fbcc-54ff-4125-b731-dd5880aec48a',
      name: 'Ruta L1: Propatria - Palo Verde',
      code: 'L1',
      fareCost: 1,
      isActive: true,
    },
  ];
}

/**
 * Obtiene el código QR de cobro de la sesión actual.
 */
export async function getSessionQr(
  sessionUuid: string,
): Promise<{ qr: string; expiresAt: string; ttlSeconds: number }> {
  return await fetchWithAuth(`/cash-sessions/${sessionUuid}/qr`);
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
 * [Admin] Aprueba una unidad de transporte (inactive -> active).
 */
export async function approveVehicle(uuid: string): Promise<any> {
  return await fetchWithAuth(`/vehicles/${uuid}/approve`, {
    method: 'PATCH',
  });
}

/**
 * [Admin] Rechaza una unidad de transporte (inactive -> suspended).
 */
export async function rejectVehicle(uuid: string): Promise<any> {
  return await fetchWithAuth(`/vehicles/${uuid}/reject`, {
    method: 'PATCH',
  });
}
