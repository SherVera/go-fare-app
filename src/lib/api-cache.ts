import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@gofare_cache_';
const DEFAULT_LITE_TTL_MS = 15 * 60 * 1000; // 15 minutos por defecto para Modo Lite

interface CacheEnvelope<T> {
  timestamp: number;
  data: T;
}

/**
 * Obtiene datos desde el almacenamiento local si existen y no han expirado según el TTL.
 */
export async function getLiteCache<T>(
  key: string,
  ttlMs: number = DEFAULT_LITE_TTL_MS,
): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;

    const envelope: CacheEnvelope<T> = JSON.parse(raw);
    const now = Date.now();

    // Si ha superado el TTL, se considera expirado (salvo que ttlMs sea Infinity)
    if (
      ttlMs !== Number.POSITIVE_INFINITY &&
      now - envelope.timestamp > ttlMs
    ) {
      return null;
    }

    return envelope.data;
  } catch (error) {
    console.warn(`[ApiCache] Error leyendo clave "${key}":`, error);
    return null;
  }
}

/**
 * Guarda datos en el almacenamiento local asociándolos a un timestamp.
 */
export async function setLiteCache<T>(key: string, data: T): Promise<void> {
  try {
    const envelope: CacheEnvelope<T> = {
      timestamp: Date.now(),
      data,
    };
    await AsyncStorage.setItem(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify(envelope),
    );
  } catch (error) {
    console.warn(`[ApiCache] Error guardando clave "${key}":`, error);
  }
}

/**
 * Elimina una entrada del caché local.
 */
export async function invalidateLiteCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch (error) {
    console.warn(`[ApiCache] Error eliminando clave "${key}":`, error);
  }
}

/**
 * Constantes de claves de caché para la app.
 */
export const CACHE_KEYS = {
  USER_PROFILE: 'user_profile',
  TICKETS: 'user_tickets',
  TRANSACTIONS: 'user_transactions',
  EXCHANGE_RATES: 'exchange_rates',
};
