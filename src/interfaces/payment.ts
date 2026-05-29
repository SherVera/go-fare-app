// ─── Interfaces de Pagos y Recargas ────────────────────────────────────────

import type { MaterialCommunityIcons } from '@expo/vector-icons';

/** Métodos de pago disponibles en la app */
export type PaymentMethodType = 'pago_movil' | 'tarjeta' | 'cripto';

/** Monto predefinido de recarga rápida */
export type QuickAmount = 10 | 20 | 50 | 100;

/** Representación de un método de pago en la UI */
export interface PaymentMethod {
  /** Identificador único del método */
  id: PaymentMethodType;
  /** Nombre visible al usuario (ej. "Pago Móvil") */
  title: string;
  /** Detalle adicional (ej. "Transferencia instantánea", "Mastercard •••• 8829") */
  subtitle: string;
  /** Icono de MaterialCommunityIcons */
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Color de fondo del contenedor del icono */
  iconBgColor: string;
  /** Color del icono */
  iconColor: string;
}

/** Estado del formulario de recarga de saldo */
export interface TopupFormState {
  /** Monto ingresado por el usuario como texto (puede contener comas) */
  amount: string;
  /** Monto de recarga rápida seleccionado, null si el usuario digitó uno personalizado */
  selectedQuickAmount: QuickAmount | null;
  /** Método de pago actualmente seleccionado */
  selectedMethod: PaymentMethodType;
}

/** Resultado de un escaneo de código QR */
export interface QRScanResult {
  /** Tipo de código (QR, barcode, etc.) */
  type: string;
  /** Dato codificado en el QR */
  data: string;
  /** Timestamp del escaneo */
  scannedAt: Date;
}
