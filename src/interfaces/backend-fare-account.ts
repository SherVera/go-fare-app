/**
 * Interfaz que representa una cuenta de tarifa devuelta por el backend de GoFare.
 */
export interface BackendFareAccount {
  id: string;
  userId: string;
  balance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
