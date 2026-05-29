export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  method: 'pago_movil' | 'tarjeta' | 'cripto';
  status: 'pendiente' | 'completado' | 'fallido';
  date: any; // Firebase Firestore Timestamp
  reference?: string; // For banking reference numbers
}
