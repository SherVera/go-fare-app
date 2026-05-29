// ─── Interfaces de Rutas y Transporte ──────────────────────────────────────

import { Ionicons } from '@expo/vector-icons';

/** Tipo de vehículo de transporte */
export type TransportType = 'bus' | 'metro' | 'other';

/** Tipo de estado visual del badge de una ruta */
export type RouteStatusType = 'success' | 'warning' | 'neutral' | 'primary';

/** Ruta de transporte público disponible en la ciudad */
export interface Route {
  /** Número o código de la ruta (ej. "201", "L1") */
  number: string;
  /** Etiqueta del badge (ej. "RUTA", "METRO") */
  label?: string;
  /** Nombre descriptivo del trayecto (ej. "Chacaíto - El Hatillo") */
  title: string;
  /** Información adicional: tiempo de llegada, frecuencia, distancia */
  subtitle: string;
  /** Texto de estado mostrado en el badge (ej. "ÓPTIMO", "REGULAR") */
  status: string;
  /** Tipo de vehículo de la ruta */
  type?: TransportType;
  /** Determina el color del badge de estado */
  statusType?: RouteStatusType;
  /** Icono de Ionicons a mostrar junto al subtitle */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Minutos estimados de llegada */
  estimatedArrivalMin?: number;
}

/** Filtro de período para la lista de viajes */
export interface TripFilter {
  /** Etiqueta visible al usuario */
  label: string;
  /** Valor interno del filtro */
  value: 'all' | 'month' | 'year';
}

/** Resumen estadístico de viajes para mostrar en la pantalla Trips */
export interface TripSummary {
  /** Total gastado en el período seleccionado (en Bs.) */
  totalSpent: number;
  /** Número de viajes realizados en el período */
  tripsCount: number;
  /** Ruta más frecuente del usuario */
  mostFrequentRoute?: string;
}
