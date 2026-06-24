/**
 * Interfaz que representa a un usuario devuelto por el backend de GoFare.
 */
export interface BackendUser {
  id: string;
  uuid?: string;
  email: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  profilePhoto?: string;
  provider: string;
  providerId: string;
  nationalId?: string;
  createdAt: string;
  updatedAt: string;
}
