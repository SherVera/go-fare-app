/**
 * Interfaz que representa un boleto de viaje devuelto por el backend de GoFare.
 */
export interface BackendTicket {
  id: string;
  userId: string;
  qrCode: string;
  price: number;
  status: 'pending' | 'active' | 'used' | 'expired' | 'cancelled';
  route?: string;
  origin?: string;
  destination?: string;
  validFrom?: string;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
}
