export interface Trip {
  id: string;
  userId: string;
  origin: string;
  destination: string;
  amount: number;
  status: 'en-curso' | 'completado' | 'cancelado';
  type: 'bus' | 'train' | 'metro' | 'other';
  date: any; // Firebase Firestore Timestamp
  /** Nombre/código de la ruta (ej. "Ruta 201") */
  route?: string;
  /** Duración del viaje en minutos */
  durationMinutes?: number;
}
