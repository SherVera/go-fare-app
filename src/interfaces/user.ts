export interface UserProfile {
  uid: string;
  backendUuid?: string;
  fullName: string;
  displayName?: string;
  idNumber: string; // Cédula venezolana
  email: string;
  phoneNumber: string;
  balance: number;
  photoURL?: string;
  /** Ciudad del usuario (ej. "Caracas") */
  city?: string;
  /** ID de transporte generado (ej. "4892-3012-8821") */
  carnetId?: string;
  createdAt: any; // Firebase Firestore Timestamp
  updatedAt?: any;
}
