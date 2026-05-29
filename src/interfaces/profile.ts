// ─── Interfaces de Perfil de Usuario (UI) ──────────────────────────────────

import type { Ionicons } from '@expo/vector-icons';

/** Tipo de dato para una tarjeta de información del perfil */
export type ProfileInfoType = 'email' | 'phone' | 'location';

/** Tarjeta de información del perfil del usuario */
export interface ProfileInfoCard {
  /** Etiqueta en mayúsculas mostrada arriba del valor (ej. "CORREO ELECTRÓNICO") */
  label: string;
  /** Valor a mostrar (ej. "carlos.perez@email.com") */
  value: string;
  /** Determina el estilo del valor (azul para email/phone, oscuro para location) */
  type: ProfileInfoType;
}

/** Ítem del menú de configuración en la pantalla de perfil */
export interface ProfileMenuItem {
  /** Identificador único del ítem */
  id: string;
  /** Título visible del ítem (ej. "Métodos de Pago") */
  title: string;
  /** Subtítulo descriptivo (ej. "Visa, Master y Pago Móvil") */
  subtitle: string;
  /** Nombre del icono Ionicons */
  iconName: keyof typeof Ionicons.glyphMap;
  /** Función a ejecutar al presionar el ítem */
  onPress: () => void;
}
